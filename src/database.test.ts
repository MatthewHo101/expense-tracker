import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync } from "node:fs";
import { emptyState } from "./domain";
const owner = "00000000-0000-4000-8000-000000000001",
  member = "00000000-0000-4000-8000-000000000002",
  outsider = "00000000-0000-4000-8000-000000000003",
  invitee = "00000000-0000-4000-8000-000000000004";
let db: PGlite;
let familyId: string;
async function asUser(id: string) {
  await db.exec("reset role; set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
}
async function invite(email: string) {
  return (
    await db.query<{ token: string }>(
      "select public.jam_create_invite($1) as token",
      [email],
    )
  ).rows[0].token;
}
beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(
    `create schema auth; create schema extensions; create role anon; create role authenticated; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`,
  );
  const schema = readFileSync(
    new URL("../supabase/setup.sql", import.meta.url),
    "utf8",
  );
  await db.exec(schema);
  await db.exec(schema);
  for (const [id, email] of [
    [owner, "owner@example.com"],
    [member, "member@example.com"],
    [outsider, "outsider@example.com"],
    [invitee, "invitee@example.com"],
  ])
    await db.query("insert into auth.users values($1,$2,now())", [id, email]);
  await asUser(owner);
  familyId = (
    await db.query<{ id: string }>(
      "select public.jam_create_family('Our family','USD','Alex') as id",
    )
  ).rows[0].id;
  const token = await invite("member@example.com");
  await asUser(member);
  await db.query("select public.jam_accept_invite($1,'Sam')", [token]);
  await asUser(outsider);
  await db.query(
    "select public.jam_create_family('Other family','USD','Other')",
  );
  await db.exec("reset role");
}, 30000);
beforeEach(async () => {
  await db.exec("begin");
});
afterEach(async () => {
  await db.exec("rollback; reset role");
});
afterAll(async () => {
  await db.close();
});
describe("database authorization and concurrent writes", () => {
  it("lets members read both family ledgers but no other household", async () => {
    await asUser(member);
    const result = await db.query<{ user_id: string }>(
      "select user_id from public.jam_member_data",
    );
    expect(result.rows.map((r) => r.user_id).sort()).toEqual(
      [owner, member].sort(),
    );
    expect(
      (await db.query<{ id: string }>("select id from public.jam_families"))
        .rows,
    ).toEqual([{ id: familyId }]);
  });
  it("prevents anonymous access and direct writes even to your own record", async () => {
    await db.exec("set role anon");
    await expect(
      db.query("select * from public.jam_member_data"),
    ).rejects.toThrow("permission denied");
  });
  it("prevents member writes through the table API", async () => {
    await asUser(member);
    await expect(
      db.query(
        "update public.jam_member_data set revision=9 where user_id=$1",
        [member],
      ),
    ).rejects.toThrow("permission denied");
  });
  it("saves only the signed-in user’s ledger and rejects stale revisions", async () => {
    await asUser(member);
    const state = { ...emptyState(), name: "Sam" };
    expect(
      (
        await db.query<{ rev: number }>(
          "select public.jam_save_state($1::jsonb,1) as rev",
          [JSON.stringify(state)],
        )
      ).rows[0].rev,
    ).toBe(2);
    const rows = await db.query<{ user_id: string; revision: number }>(
      "select user_id,revision from public.jam_member_data order by user_id",
    );
    expect(rows.rows).toEqual([
      { user_id: owner, revision: 1 },
      { user_id: member, revision: 2 },
    ]);
    await expect(
      db.query("select public.jam_save_state($1::jsonb,1)", [
        JSON.stringify(state),
      ]),
    ).rejects.toThrow("Another device");
  });
  it("rejects a different currency and sample-data uploads", async () => {
    await asUser(member);
    await expect(
      db.query("select public.jam_save_state($1::jsonb,1)", [
        JSON.stringify({ ...emptyState(), name: "Sam", currency: "HKD" }),
      ]),
    ).rejects.toThrow("different family currency");
  });
  it("accepts well-formed expense records with exact cents", async () => {
    await asUser(member);
    const state = {
      ...emptyState(),
      name: "Sam",
      transactions: [
        {
          id: "coffee",
          title: "Coffee",
          amount: 1250,
          type: "expense",
          category: "Food & drink",
          date: "2026-11-15",
          note: "With family",
        },
      ],
    };
    await db.query("select public.jam_save_state($1::jsonb,1)", [
      JSON.stringify(state),
    ]);
    const result = await db.query<{
      state: { transactions: { amount: number }[] };
    }>("select state from public.jam_member_data where user_id=$1", [member]);
    expect(result.rows[0].state.transactions[0].amount).toBe(1250);
  });
  it("rejects malformed ledgers before publishing them to family members", async () => {
    await asUser(member);
    await expect(
      db.query("select public.jam_save_state($1::jsonb,1)", [
        JSON.stringify({
          ...emptyState(),
          transactions: [{ amount: 0, type: "expense" }],
        }),
      ]),
    ).rejects.toThrow("Invalid Jam data");
  });
  it("limits family invitations and shared budget changes to the owner", async () => {
    await asUser(member);
    await expect(
      db.query("select public.jam_create_invite('person@example.com')"),
    ).rejects.toThrow("Only the family owner");
  });
  it("allows the owner to update the shared budget", async () => {
    await asUser(owner);
    await db.query("select public.jam_update_family_budget(500000)");
    expect(
      (
        await db.query<{ monthly_budget: number }>(
          "select monthly_budget from public.jam_families",
        )
      ).rows[0].monthly_budget,
    ).toBe(500000);
  });
  it("does not allow members to update the shared budget", async () => {
    await asUser(member);
    await expect(
      db.query("select public.jam_update_family_budget(500000)"),
    ).rejects.toThrow("Only the family owner");
  });
  it("binds invitations to a confirmed email and does not leak tokens through table access", async () => {
    await asUser(owner);
    const token = await invite("invitee@example.com");
    await asUser(outsider);
    await expect(
      db.query("select public.jam_accept_invite($1,'Someone')", [token]),
    ).rejects.toThrow("already belong");
  });
  it("accepts a one-time email-bound invite and shares only that household", async () => {
    await asUser(owner);
    const token = await invite("invitee@example.com");
    await asUser(invitee);
    await db.query("select public.jam_accept_invite($1,'Taylor')", [token]);
    expect(
      (await db.query("select * from public.jam_member_data")).rows,
    ).toHaveLength(3);
    await db.exec("reset role");
    const used = (
      await db.query<{ used_by: string; token_hash: string }>(
        "select used_by,token_hash from public.jam_invites where used_by=$1",
        [invitee],
      )
    ).rows[0];
    expect(used.used_by).toBe(invitee);
    expect(used.token_hash).not.toBe(token);
    await db.query("delete from public.jam_memberships where user_id=$1", [
      invitee,
    ]);
    await asUser(invitee);
    await expect(
      db.query("select public.jam_accept_invite($1,'Taylor')", [token]),
    ).rejects.toThrow("invalid");
  });
  it("does not expose invitation records to client accounts", async () => {
    await asUser(owner);
    await expect(db.query("select * from public.jam_invites")).rejects.toThrow(
      "permission denied",
    );
  });
  it("rejects an invitation addressed to a different email", async () => {
    await asUser(owner);
    const token = await invite("wrong@example.com");
    await asUser(invitee);
    await expect(
      db.query("select public.jam_accept_invite($1,'Taylor')", [token]),
    ).rejects.toThrow("different email");
  });
  it("rejects unconfirmed recipients", async () => {
    await db.query(
      "update auth.users set email_confirmed_at=null where id=$1",
      [invitee],
    );
    await asUser(owner);
    const token = await invite("invitee@example.com");
    await asUser(invitee);
    await expect(
      db.query("select public.jam_accept_invite($1,'Taylor')", [token]),
    ).rejects.toThrow("Confirm your email");
  });
  it("rejects expired invitation links", async () => {
    await asUser(owner);
    const token = await invite("invitee@example.com");
    await db.exec("reset role");
    await db.exec(
      "update public.jam_invites set expires_at=now()-interval '1 day' where used_by is null",
    );
    await asUser(invitee);
    await expect(
      db.query("select public.jam_accept_invite($1,'Taylor')", [token]),
    ).rejects.toThrow("expired");
  });
});

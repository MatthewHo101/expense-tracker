import { describe, expect, it } from "vitest";
import { emptyState } from "./domain";
import { familyReport, readLedgers } from "./family";
import type { Member, Ledger } from "./family";
const members: Member[] = [
  { user_id: "a", family_id: "family", display_name: "Alex", role: "owner" },
  { user_id: "b", family_id: "family", display_name: "Sam", role: "member" },
];
const ledger = (user_id: string): Ledger => ({
  user_id,
  revision: 1,
  state: {
    ...emptyState(),
    name: user_id,
    transactions: [
      {
        id: "same-id",
        title: "Lunch",
        type: "expense",
        amount: 1250,
        category: "Food & drink",
        date: "2026-11-15",
        note: "",
      },
      {
        id: "save",
        title: "Savings",
        type: "saving",
        amount: 5000,
        category: "Other",
        date: "2026-11-15",
        note: "",
      },
      {
        id: "past",
        title: "Old",
        type: "expense",
        amount: 900,
        category: "Other",
        date: "2026-10-15",
        note: "",
      },
    ],
  },
});
describe("family reports", () => {
  it("combines members without collapsing matching transaction IDs and excludes transfers from spending", () => {
    const report = familyReport(members, [ledger("a"), ledger("b")], "2026-11");
    expect(report.expenses).toBe(2500);
    expect(report.rows).toHaveLength(4);
    expect(report.spending.map((m) => m.amount)).toEqual([1250, 1250]);
    expect(report.rows.map((r) => r.memberName)).toContain("Sam");
  });
  it("filters by person, month, and category", () => {
    const report = familyReport(
      members,
      [ledger("a"), ledger("b")],
      "2026-11",
      "b",
      "Food & drink",
    );
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].userId).toBe("b");
    expect(report.expenses).toBe(1250);
  });
  it("rejects malformed ledgers and mixed currencies before adding totals", () => {
    expect(() =>
      readLedgers([{ user_id: "a", state: {}, revision: 1 }], "USD"),
    ).toThrow("invalid data");
    expect(() => readLedgers([ledger("a")], "HKD")).toThrow(
      "different currency",
    );
  });
});

import { inMonth, total, validState } from "./domain";
import type { AppState, Category, Transaction } from "./domain";
export type Member = {
  user_id: string;
  family_id: string;
  display_name: string;
  role: "owner" | "member";
};
export type Family = {
  id: string;
  name: string;
  currency: string;
  monthly_budget: number;
  owner_id: string;
};
export type Ledger = { user_id: string; state: AppState; revision: number };
export type FamilyRow = Transaction & { userId: string; memberName: string };
export function readLedgers(
  rows: { user_id: string; state: unknown; revision: number }[],
  currency: string,
): Ledger[] {
  return rows.map((row) => {
    if (!validState(row.state) || row.state.currency !== currency)
      throw new Error(
        "A family ledger contains invalid data or a different currency. Restore a valid backup for that account.",
      );
    return { ...row, state: row.state };
  });
}
export function familyReport(
  members: Member[],
  ledgers: Ledger[],
  month: string,
  person = "all",
  category: Category | "all" = "all",
) {
  const rows: FamilyRow[] = ledgers
    .filter((l) => person === "all" || l.user_id === person)
    .flatMap((l) =>
      inMonth(l.state.transactions, month)
        .filter((t) => category === "all" || t.category === category)
        .map((t) => ({
          ...t,
          userId: l.user_id,
          memberName:
            members.find((m) => m.user_id === l.user_id)?.display_name ||
            l.state.name,
        })),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const spending = members
    .filter((m) => person === "all" || m.user_id === person)
    .map((m) => ({
      member: m,
      amount: total(
        rows.filter((r) => r.userId === m.user_id),
        "expense",
      ),
    }));
  return {
    rows,
    spending,
    expenses: total(rows, "expense"),
    income: total(rows, "income"),
  };
}

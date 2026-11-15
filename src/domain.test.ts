import { describe, expect, it } from "vitest";
import {
  applyTransaction,
  balance,
  emptyState,
  inMonth,
  monthShift,
  parseAmount,
  removeTransaction,
  seedState,
  toCsv,
  total,
  validState,
} from "./domain";
import type { Transaction } from "./domain";
const tx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: "t1",
  title: "Coffee",
  amount: 1250,
  type: "expense",
  category: "Food & drink",
  date: "2026-11-15",
  note: "",
  ...overrides,
});
describe("money and reports", () => {
  it("uses exact cents and rejects invalid or excessive precision", () => {
    expect(parseAmount("17.83")).toBe(1783);
    expect(parseAmount("0.10")).toBe(10);
    expect(parseAmount("1")).toBe(100);
    for (const value of [
      "-10",
      "0",
      "abc",
      "1.001",
      "1e3",
      "Infinity",
      "999999999999999",
    ])
      expect(parseAmount(value)).toBeNaN();
  });
  it("keeps sample totals consistent", () => {
    const s = seedState();
    expect(total(s.transactions, "income")).toBe(1400000);
    expect(total(s.transactions, "expense")).toBe(199600);
    expect(balance(s.transactions)).toBe(1200400);
    expect(validState(s)).toBe(true);
  });
  it("filters months and crosses year boundaries", () => {
    expect(monthShift("2026-12", 1)).toBe("2027-01");
    expect(monthShift("2026-01", -1)).toBe("2025-12");
    expect(
      inMonth([tx(), tx({ id: "other", date: "2026-10-30" })], "2026-11"),
    ).toHaveLength(1);
  });
  it("escapes CSV fields and neutralizes spreadsheet formulas", () => {
    const csv = toCsv([
      tx({ title: "=SUM(A1:A2)", note: 'a "quote", and newline\nnext' }),
    ]);
    expect(csv).toContain('"\'=SUM(A1:A2)"');
    expect(csv).toContain('"a ""quote"", and newline\nnext"');
    expect(csv).toContain('"12.50"');
  });
});
describe("savings ledger", () => {
  const start = () => ({
    ...emptyState(),
    goals: [{ id: "goal", name: "Trip", emoji: "🌸", saved: 0, target: 50000 }],
    transactions: [tx({ id: "salary", type: "income", amount: 10000 })],
  });
  it("moves savings without counting transfers as spending and reverses deletions", () => {
    const original = start();
    const topup = tx({
      id: "save",
      type: "saving",
      goalId: "goal",
      amount: 3000,
    });
    const next = applyTransaction(original, topup);
    expect(balance(next.transactions)).toBe(7000);
    expect(next.goals[0].saved).toBe(3000);
    expect(total(next.transactions, "expense")).toBe(0);
    expect(removeTransaction(next, "save")).toEqual(original);
  });
  it("withdraws savings and restores them when deleted", () => {
    const withSavings = applyTransaction(
      start(),
      tx({ id: "save", type: "saving", goalId: "goal", amount: 3000 }),
    );
    const next = applyTransaction(
      withSavings,
      tx({ id: "withdraw", type: "withdrawal", goalId: "goal", amount: 1000 }),
    );
    expect(next.goals[0].saved).toBe(2000);
    expect(balance(next.transactions)).toBe(8000);
    expect(removeTransaction(next, "withdraw")).toEqual(withSavings);
  });
  it("blocks overdrawing funds, missing goals, and invalid amounts", () => {
    expect(() =>
      applyTransaction(
        start(),
        tx({ type: "saving", goalId: "goal", amount: 10001 }),
      ),
    ).toThrow("not enough");
    expect(() =>
      applyTransaction(
        start(),
        tx({ type: "withdrawal", goalId: "goal", amount: 1 }),
      ),
    ).toThrow("exceeds");
    expect(() =>
      applyTransaction(start(), tx({ type: "saving", goalId: "missing" })),
    ).toThrow("Choose");
    expect(() => applyTransaction(start(), tx({ amount: NaN }))).toThrow(
      "valid amount",
    );
  });
  it("protects withdrawn savings against deleting the original top up", () => {
    const a = applyTransaction(
      start(),
      tx({ id: "save", type: "saving", goalId: "goal", amount: 3000 }),
    );
    const b = applyTransaction(
      a,
      tx({ id: "withdraw", type: "withdrawal", goalId: "goal", amount: 1000 }),
    );
    expect(() => removeTransaction(b, "save")).toThrow(
      "already been withdrawn",
    );
  });
});
describe("backup validation", () => {
  it("accepts a clean workspace and rejects malformed or orphaned records", () => {
    expect(validState(emptyState())).toBe(true);
    expect(validState({ version: 1 })).toBe(false);
    expect(validState({ ...emptyState(), currency: "UNKNOWN" })).toBe(false);
    expect(
      validState({
        ...emptyState(),
        transactions: [tx({ type: "saving", goalId: "missing" })],
      }),
    ).toBe(false);
    expect(
      validState({ ...emptyState(), transactions: [tx({ amount: -1 })] }),
    ).toBe(false);
  });
});

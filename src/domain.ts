export const categories = [
  "Food & drink",
  "Shopping",
  "Home",
  "Transport",
  "Entertainment",
  "Health",
  "Other",
] as const;
export type Category = (typeof categories)[number];
export type Transaction = {
  id: string;
  title: string;
  amount: number;
  type: "income" | "expense" | "saving" | "withdrawal";
  category: Category;
  date: string;
  note: string;
  goalId?: string;
};
export type Goal = {
  id: string;
  name: string;
  emoji: string;
  saved: number;
  target: number;
};
export type AppState = {
  version: 1;
  name: string;
  currency: string;
  budget: number;
  transactions: Transaction[];
  goals: Goal[];
  demo: boolean;
};
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const money = (cents: number, currency = "USD", digits = 2) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(cents / 100);
export function parseAmount(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return NaN;
  const [whole, fraction = ""] = value.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount > 0 && amount <= 100_000_000_000
    ? amount
    : NaN;
}
export const balance = (transactions: Transaction[]) =>
  transactions.reduce(
    (sum, t) =>
      sum + (["income", "withdrawal"].includes(t.type) ? t.amount : -t.amount),
    0,
  );
export const total = (transactions: Transaction[], type: Transaction["type"]) =>
  transactions.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
export function inMonth(transactions: Transaction[], month: string) {
  return transactions
    .filter((t) => t.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));
}
export function monthShift(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(y, m - 1 + by, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
export function seedState(): AppState {
  const now = today(),
    month = now.slice(0, 7),
    day = Number(now.slice(8));
  const rows: [string, number, Transaction["type"], Category, number][] = [
    ["Whole Foods Market", 1783, "expense", "Food & drink", 0],
    ["Kristin Watson", 10000, "income", "Other", 0],
    ["Blue Bottle Coffee", 620, "expense", "Food & drink", 1],
    ["Uniqlo", 6310, "expense", "Shopping", 1],
    ["Monthly salary", 980000, "income", "Other", Math.max(0, day - 1)],
    ["Apartment rent", 98000, "expense", "Home", Math.max(0, day - 2)],
    ["Dinner with friends", 21057, "expense", "Food & drink", 3],
    ["Weekend groceries", 6700, "expense", "Food & drink", 5],
    ["Nike", 20000, "expense", "Shopping", 6],
    ["Metro & rides", 8650, "expense", "Transport", 7],
    ["Spotify Premium", 1999, "expense", "Entertainment", 8],
    ["Cinema night", 4900, "expense", "Entertainment", 9],
    ["Gym membership", 9581, "expense", "Health", 10],
    ["Household essentials", 20000, "expense", "Other", 11],
    ["Freelance project", 410000, "income", "Other", 12],
  ];
  return {
    version: 1,
    name: "Matthew",
    currency: "USD",
    budget: 300000,
    demo: true,
    goals: [
      {
        id: "car",
        name: "New car",
        emoji: "🚗",
        saved: 600000,
        target: 700000,
      },
      {
        id: "trip",
        name: "Japan trip",
        emoji: "🌸",
        saved: 65000,
        target: 180000,
      },
      {
        id: "rainy",
        name: "Rainy day",
        emoji: "☀️",
        saved: 30000,
        target: 200000,
      },
    ],
    transactions: rows.map(([title, amount, type, category, offset], i) => ({
      id: `demo-${i}`,
      title,
      amount,
      type,
      category,
      date: `${month}-${String(Math.max(1, day - offset)).padStart(2, "0")}`,
      note: "",
    })),
  };
}
export const emptyState = (): AppState => ({
  version: 1,
  name: "Matthew",
  currency: "USD",
  budget: 300000,
  transactions: [],
  goals: [],
  demo: false,
});
export function applyTransaction(state: AppState, t: Transaction): AppState {
  if (!Number.isSafeInteger(t.amount) || t.amount <= 0)
    throw new Error("Enter a valid amount.");
  const transfer = t.type === "saving" || t.type === "withdrawal";
  const goal = state.goals.find((g) => g.id === t.goalId);
  if (transfer && !goal) throw new Error("Choose a savings goal.");
  if (t.type === "saving" && t.amount > balance(state.transactions))
    throw new Error("There is not enough available balance for this top up.");
  if (t.type === "withdrawal" && goal && t.amount > goal.saved)
    throw new Error("This exceeds the amount saved in this goal.");
  return {
    ...state,
    transactions: [t, ...state.transactions],
    goals: transfer
      ? state.goals.map((g) =>
          g.id === t.goalId
            ? {
                ...g,
                saved: g.saved + (t.type === "saving" ? t.amount : -t.amount),
              }
            : g,
        )
      : state.goals,
  };
}
export function removeTransaction(state: AppState, id: string): AppState {
  const t = state.transactions.find((t) => t.id === id);
  if (!t) return state;
  const goal = state.goals.find((g) => g.id === t.goalId);
  if (t.type === "saving" && goal && goal.saved < t.amount)
    throw new Error(
      "This top up has already been withdrawn. Remove the withdrawal first.",
    );
  return {
    ...state,
    transactions: state.transactions.filter((t) => t.id !== id),
    goals: state.goals.map((g) =>
      g.id === t.goalId
        ? {
            ...g,
            saved:
              g.saved +
              (t.type === "saving"
                ? -t.amount
                : t.type === "withdrawal"
                  ? t.amount
                  : 0),
          }
        : g,
    ),
  };
}
export function validState(s: unknown): s is AppState {
  if (!s || typeof s !== "object") return false;
  const v = s as AppState;
  const cents = (n: unknown) =>
    typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
  return (
    v.version === 1 &&
    typeof v.name === "string" &&
    ["USD", "HKD", "EUR", "GBP"].includes(v.currency) &&
    typeof v.demo === "boolean" &&
    cents(v.budget) &&
    Array.isArray(v.goals) &&
    v.goals.every(
      (g) =>
        g &&
        typeof g.id === "string" &&
        typeof g.name === "string" &&
        typeof g.emoji === "string" &&
        cents(g.saved) &&
        cents(g.target) &&
        g.target > 0,
    ) &&
    Array.isArray(v.transactions) &&
    v.transactions.every(
      (t) =>
        t &&
        typeof t.id === "string" &&
        typeof t.title === "string" &&
        typeof t.note === "string" &&
        cents(t.amount) &&
        t.amount > 0 &&
        ["income", "expense", "saving", "withdrawal"].includes(t.type) &&
        categories.includes(t.category) &&
        /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
        (!["saving", "withdrawal"].includes(t.type) ||
          v.goals.some((g) => g.id === t.goalId)),
    )
  );
}
export function toCsv(transactions: Transaction[]) {
  const cell = (v: string) =>
    `"${(/^[=+\-@\t\r]/.test(v) ? "'" : "") + v.replaceAll('"', '""')}"`;
  return [
    "Date,Description,Type,Category,Amount,Note",
    ...transactions.map((t) =>
      [t.date, t.title, t.type, t.category, (t.amount / 100).toFixed(2), t.note]
        .map(cell)
        .join(","),
    ),
  ].join("\r\n");
}

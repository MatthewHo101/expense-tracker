import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  ArrowUpFromLine,
  BarChart3,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Coffee,
  Download,
  Flower2,
  Home,
  LayoutDashboard,
  Leaf,
  Lightbulb,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  Target,
  Trash2,
  Utensils,
  Wallet,
  X,
  Car,
  Heart,
  Film,
  BriefcaseBusiness,
  CircleDollarSign,
  Users,
  LogOut,
} from "lucide-react";
import {
  applyTransaction,
  balance,
  categories,
  emptyState,
  inMonth,
  money,
  monthShift,
  parseAmount,
  removeTransaction,
  seedState,
  toCsv,
  today,
  total,
  validState,
} from "./domain";
import type { AppState, Category, Goal, Transaction } from "./domain";
import JamLogo from "./JamLogo";

type View = "overview" | "transactions" | "insights" | "savings";
type Modal =
  | "transaction"
  | "budget"
  | "goal"
  | "transfer"
  | "settings"
  | "detail"
  | "install"
  | null;
// Keep the original key so existing records remain available after rebranding.
const STORAGE_KEY = "mint-expenses-v1";
const categoryIcons = {
  "Food & drink": Utensils,
  Shopping: ShoppingBag,
  Home: Home,
  Transport: Car,
  Entertainment: Film,
  Health: Heart,
  Other: CircleDollarSign,
};
const categoryColors: Record<Category, string> = {
  "Food & drink": "orange",
  Shopping: "purple",
  Home: "blue",
  Transport: "green",
  Entertainment: "pink",
  Health: "red",
  Other: "gray",
};
const navItems: [View, string, typeof Home][] = [
  ["overview", "Overview", LayoutDashboard],
  ["transactions", "Transactions", ArrowRight],
  ["insights", "Insights", BarChart3],
  ["savings", "Savings", Target],
];
function loadState(): { data: AppState; issue: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { data: seedState(), issue: "" };
    const s: unknown = JSON.parse(raw);
    if (validState(s)) return { data: s, issue: "" };
    return {
      data: emptyState(),
      issue:
        "Saved data could not be read. A fresh workspace is open; the original saved data has been kept.",
    };
  } catch {
    return {
      data: emptyState(),
      issue: "Browser storage is unavailable. Changes may not be saved.",
    };
  }
}
function IconBox({
  category,
  type,
  title,
}: {
  category: Category;
  type?: Transaction["type"];
  title?: string;
}) {
  const Icon =
    type === "income"
      ? ArrowDownLeft
      : type === "saving" || type === "withdrawal"
        ? Target
        : title?.toLowerCase().includes("coffee")
          ? Coffee
          : categoryIcons[category];
  return (
    <span
      className={`icon-box ${type === "income" ? "green" : type === "saving" || type === "withdrawal" ? "green" : categoryColors[category]}`}
    >
      <Icon size={19} strokeWidth={1.6} />
    </span>
  );
}
function Ring({
  percent,
  size = 72,
  children,
}: {
  percent: number;
  size?: number;
  children: ReactNode;
}) {
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="44" className="ring-track" />
        <circle
          cx="50"
          cy="50"
          r="44"
          className="ring-fill"
          strokeDasharray={`${Math.min(100, Math.max(0, percent)) * 2.765} 276.5`}
        />
      </svg>
      <span>{children}</span>
    </div>
  );
}
function ModalShell({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal-content">
        <div className="modal-heading">
          <h2 id="modal-title">{title}</h2>
          <button
            className="icon-button"
            onClick={close}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
function downloadFile(content: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type AppProps = {
  onConnect?: () => void;
  cloud?: {
    initialState: AppState;
    onChange: (state: AppState) => void;
    status: string;
    onFamily: () => void;
    onSignOut: () => Promise<void>;
  };
};
export default function App({ cloud, onConnect }: AppProps) {
  const [initial] = useState(() =>
    cloud ? { data: cloud.initialState, issue: "" } : loadState(),
  );
  const [data, setData] = useState(initial.data);
  const [storageIssue, setStorageIssue] = useState(initial.issue);
  const [view, setView] = useState<View>("overview");
  const [month, setMonth] = useState(today().slice(0, 7));
  const [modal, setModal] = useState<Modal>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [period, setPeriod] = useState<"Week" | "Month" | "Quarter">("Month");
  const [txType, setTxType] = useState<"expense" | "income">("expense");
  const [selectedGoal, setSelectedGoal] = useState("car");
  const [transferType, setTransferType] = useState<"saving" | "withdrawal">(
    "saving",
  );
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const [installPrompt, setInstallPrompt] = useState<
    | (Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: string }>;
      })
    | null
  >(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const persistAllowed = useRef(!initial.issue);
  useEffect(() => {
    if (cloud) {
      cloud.onChange(data);
      return;
    }
    if (!persistAllowed.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setStorageIssue("");
    } catch {
      setStorageIssue(
        "Your browser could not save this change. Export a backup to keep your data.",
      );
    }
  }, [data]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (cloud) return;
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const s: unknown = JSON.parse(e.newValue);
          if (validState(s)) setData(s);
        } catch {
          /* Keep the current valid state. */
        }
      }
    };
    window.addEventListener("storage", onStorage);
    const prompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as typeof installPrompt);
    };
    window.addEventListener("beforeinstallprompt", prompt);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("beforeinstallprompt", prompt);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  const fmt = (n: number, digits = 2) => money(n, data.currency, digits);
  const monthRows = inMonth(data.transactions, month);
  const income = total(monthRows, "income"),
    expenses = total(monthRows, "expense");
  const currentBalance = balance(data.transactions),
    saved = data.goals.reduce((sum, g) => sum + g.saved, 0);
  const monthName = new Date(`${month}-01T12:00:00`).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" },
  );
  const budgetPercent = data.budget ? (expenses / data.budget) * 100 : 0;
  const selected =
    data.goals.find((g) => g.id === selectedGoal) || data.goals[0];
  const visibleRows = monthRows.filter(
    (t) =>
      (filter === "all" || t.type === filter) &&
      (t.title + " " + t.category + " " + t.note)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const categoryTotals = categories
    .map((category) => ({
      category,
      amount: monthRows
        .filter((t) => t.type === "expense" && t.category === category)
        .reduce((s, t) => s + t.amount, 0),
    }))
    .sort((a, b) => b.amount - a.amount);
  const close = () => {
    setModal(null);
    setFormError("");
    setConfirmReset(false);
  };
  const open = (m: Modal) => {
    setFormError("");
    setModal(m);
  };
  const addTransaction = () => {
    setTxType("expense");
    open("transaction");
  };
  const navigate = (next: View) => {
    setView(next);
    setQuery("");
    setFilter("all");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  function submitTransaction(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget),
      amount = parseAmount(String(form.get("amount")));
    const title = String(form.get("title")).trim(),
      date = String(form.get("date"));
    if (!title || !Number.isFinite(amount) || date > today()) {
      setFormError(
        "Enter a description, a positive amount (up to 2 decimal places), and a date up to today.",
      );
      return;
    }
    try {
      const t: Transaction = {
        id: crypto.randomUUID(),
        title,
        amount,
        type: txType,
        category: form.get("category") as Category,
        date,
        note: String(form.get("note")).trim(),
      };
      setData(applyTransaction(data, t));
      close();
      setToast(`${txType === "expense" ? "Expense" : "Income"} added`);
    } catch (err) {
      setFormError((err as Error).message);
    }
  }
  function submitTransfer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget),
      amount = parseAmount(String(form.get("amount")));
    try {
      const goal = data.goals.find((g) => g.id === String(form.get("goal")));
      if (!goal) throw new Error("Choose a savings goal.");
      const t: Transaction = {
        id: crypto.randomUUID(),
        title: `${transferType === "saving" ? "To" : "From"} ${goal.name}`,
        amount,
        type: transferType,
        goalId: goal.id,
        category: "Other",
        date: today(),
        note: "Savings transfer",
      };
      setData(applyTransaction(data, t));
      close();
      setToast(
        transferType === "saving"
          ? "A little closer to your goal ✨"
          : "Withdrawal added to your balance",
      );
    } catch (err) {
      setFormError((err as Error).message);
    }
  }
  function submitGoal(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget),
      target = parseAmount(String(form.get("target"))),
      name = String(form.get("name")).trim();
    if (!name || !Number.isFinite(target)) {
      setFormError("Give your goal a name and a positive target amount.");
      return;
    }
    const g: Goal = {
      id: crypto.randomUUID(),
      name,
      emoji: String(form.get("emoji")),
      saved: 0,
      target,
    };
    setData({ ...data, goals: [...data.goals, g] });
    setSelectedGoal(g.id);
    close();
    setToast("Your next little goal is ready");
  }
  function exportCsv() {
    downloadFile(
      toCsv(monthRows),
      "text/csv;charset=utf-8",
      `jam-transactions-${month}.csv`,
    );
    setToast("Transactions exported");
  }
  function removeSelected() {
    if (!selectedTx) return;
    try {
      setData(removeTransaction(data, selectedTx.id));
      close();
      setToast("Transaction deleted");
    } catch (err) {
      setFormError((err as Error).message);
    }
  }
  const MonthPicker = () => (
    <div className="month-picker">
      <button
        aria-label="Previous month"
        onClick={() => setMonth(monthShift(month, -1))}
      >
        <ChevronLeft size={16} />
      </button>
      <span>{monthName}</span>
      <button
        aria-label="Next month"
        onClick={() => setMonth(monthShift(month, 1))}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
  const SectionHeading = ({
    eyebrow,
    title,
    action,
  }: {
    eyebrow?: string;
    title: string;
    action?: ReactNode;
  }) => (
    <div className="section-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
  function transactionList(rows: Transaction[], limit?: number) {
    return (
      <div className="transaction-list">
        {(limit ? rows.slice(0, limit) : rows).map((t) => (
          <button
            className="transaction-row"
            key={t.id}
            onClick={() => {
              setSelectedTx(t);
              open("detail");
            }}
          >
            <IconBox category={t.category} type={t.type} title={t.title} />
            <span className="transaction-copy">
              <strong>{t.title}</strong>
              <small>
                {t.type === "income"
                  ? "Money in"
                  : t.type === "saving" || t.type === "withdrawal"
                    ? "Savings transfer"
                    : t.category}
              </small>
            </span>
            <span className="transaction-date">
              {new Date(t.date + "T12:00:00").toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
            <span
              className={`transaction-amount ${["income", "withdrawal"].includes(t.type) ? "positive" : ""}`}
            >
              <strong>
                {["income", "withdrawal"].includes(t.type) ? "+" : "−"}
                {fmt(t.amount)}
              </strong>
              <small>
                {t.date === today()
                  ? "Today"
                  : new Date(t.date + "T12:00:00").toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
              </small>
            </span>
          </button>
        ))}
        {rows.length === 0 && (
          <div className="empty-state">
            <Sprout size={30} />
            <h3>A fresh start</h3>
            <p>
              {query
                ? "No transactions match your search."
                : "No transactions here yet. Add one to get started."}
            </p>
            {!query && (
              <button className="text-button" onClick={addTransaction}>
                Add a transaction <Plus size={15} />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }
  function cashFlow() {
    const [y, m] = month.split("-").map(Number),
      days = new Date(y, m, 0).getDate();
    let buckets: { label: string; in: number; out: number }[] = [];
    if (period === "Quarter") {
      buckets = [-2, -1, 0].map((offset) => {
        const key = monthShift(month, offset),
          rows = inMonth(data.transactions, key);
        return {
          label: new Date(`${key}-01T12:00:00`).toLocaleDateString("en-US", {
            month: "short",
          }),
          in: total(rows, "income"),
          out: total(rows, "expense"),
        };
      });
    } else if (period === "Week") {
      const end =
        month === today().slice(0, 7) ? Number(today().slice(8)) : days;
      buckets = Array.from({ length: 7 }, (_, i) => {
        const d = end - 6 + i;
        const date = new Date(y, m - 1, d);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        const rows = data.transactions.filter((t) => t.date === key);
        return {
          label: date.toLocaleDateString("en-US", { weekday: "short" }),
          in: total(rows, "income"),
          out: total(rows, "expense"),
        };
      });
    } else {
      buckets = Array.from({ length: 6 }, (_, i) => {
        const start = Math.floor((i * days) / 6) + 1,
          end = Math.floor(((i + 1) * days) / 6);
        const rows = monthRows.filter((t) => {
          const d = Number(t.date.slice(8));
          return d >= start && d <= end;
        });
        return {
          label: `${String(m).padStart(2, "0")}/${String(start).padStart(2, "0")}`,
          in: total(rows, "income"),
          out: total(rows, "expense"),
        };
      });
    }
    const max = Math.max(...buckets.flatMap((b) => [b.in, b.out]), 10000);
    return (
      <section className="panel cashflow">
        <SectionHeading
          title="Cash flow"
          action={
            <div className="segmented">
              {(["Week", "Month", "Quarter"] as const).map((p) => (
                <button
                  key={p}
                  className={period === p ? "active" : ""}
                  aria-pressed={period === p}
                  onClick={() => setPeriod(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          }
        />
        <div className="chart-legend">
          <span>
            <i className="dot green-dot" />
            Money in{" "}
            <strong>
              {fmt(
                buckets.reduce((s, b) => s + b.in, 0),
                0,
              )}
            </strong>
          </span>
          <span>
            <i className="dot coral-dot" />
            Money out{" "}
            <strong>
              {fmt(
                buckets.reduce((s, b) => s + b.out, 0),
                0,
              )}
            </strong>
          </span>
        </div>
        <div
          className="bar-chart"
          role="img"
          aria-label={`${period} cash flow. ${buckets.map((b) => `${b.label}: income ${fmt(b.in)}, expenses ${fmt(b.out)}`).join("; ")}`}
        >
          <div className="chart-grid">
            <span>{fmt(max, 0)}</span>
            <span>{fmt(max / 2, 0)}</span>
            <span>{fmt(0, 0)}</span>
          </div>
          <div className="chart-bars">
            {buckets.map((b, i) => (
              <div className="bar-group" key={i}>
                <div
                  className="bar-pair"
                  title={`${b.label}: ${fmt(b.in)} in, ${fmt(b.out)} out`}
                >
                  <div
                    className="bar income-bar"
                    style={{
                      height: `${(b.in / max) * 100}%`,
                      minHeight: b.in ? 5 : 2,
                    }}
                  />
                  <div
                    className="bar expense-bar"
                    style={{
                      height: `${(b.out / max) * 100}%`,
                      minHeight: b.out ? 5 : 2,
                    }}
                  />
                </div>
                <small>{b.label}</small>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }
  function savingsPanel() {
    return (
      <section className="panel savings-panel">
        <SectionHeading
          eyebrow="LITTLE STEPS, BIG DREAMS"
          title="Your savings"
          action={
            <button className="text-button" onClick={() => navigate("savings")}>
              See all <ArrowUpRight size={15} />
            </button>
          }
        />
        <div className="savings-overview">
          <span>
            {fmt(saved)}
            <small>saved for your future</small>
          </span>
          <button
            className="round-button pale"
            onClick={() => open("goal")}
            aria-label="Create savings goal"
          >
            <Plus size={21} />
          </button>
        </div>
        <div className="goal-list">
          {data.goals.slice(0, 3).map((g) => (
            <button
              className="goal-row"
              key={g.id}
              onClick={() => {
                setSelectedGoal(g.id);
                navigate("savings");
              }}
            >
              <Ring percent={(g.saved / g.target) * 100} size={52}>
                <span className="goal-emoji">{g.emoji}</span>
              </Ring>
              <span className="goal-copy">
                <strong>{g.name}</strong>
                <small>
                  {fmt(g.saved, 0)} <span>of {fmt(g.target, 0)}</span>
                </small>
              </span>
              <span className="goal-percent">
                {Math.round((g.saved / g.target) * 100)}%
                <ChevronRight size={15} />
              </span>
            </button>
          ))}
        </div>
        {data.goals.length === 0 && (
          <div className="empty-state">
            <p>Make room for your next big thing.</p>
            <button className="text-button" onClick={() => open("goal")}>
              Create your first goal <Plus size={16} />
            </button>
          </div>
        )}
        <div className="gentle-note">
          <Sparkles size={16} />
          <p>A little today. A lot more possibilities tomorrow.</p>
        </div>
      </section>
    );
  }
  function budgetBanner() {
    return (
      <div
        className={`budget-banner ${budgetPercent > 100 ? "over-budget" : ""}`}
      >
        <span className="budget-icon">
          <Wallet size={21} />
        </span>
        <div className="budget-copy">
          <strong>
            {data.budget
              ? budgetPercent > 100
                ? "A moment to check in"
                : "Looking good this month"
              : "Give your spending a plan"}
          </strong>
          <span>
            {data.budget
              ? `${fmt(Math.abs(data.budget - expenses), 0)} ${budgetPercent > 100 ? "over your" : "left in your"} ${fmt(data.budget, 0)} budget`
              : "Set a monthly spending budget."}
          </span>
        </div>
        <div className="budget-progress">
          <div>
            <span>Monthly budget</span>
            <strong>{Math.round(budgetPercent)}%</strong>
          </div>
          <div className="progress-track">
            <span style={{ width: `${Math.min(budgetPercent, 100)}%` }} />
          </div>
        </div>
        <button
          className="icon-button"
          aria-label="Edit monthly budget"
          onClick={() => open("budget")}
        >
          <SlidersHorizontal size={18} />
        </button>
      </div>
    );
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("overview");
          }}
        >
          <span className="brand-mark">
            <JamLogo size={25} />
          </span>
          jam<span className="brand-period">.</span>
        </a>
        <span className="nav-caption">YOUR PERSONAL SPACE</span>
        <nav aria-label="Main navigation">
          {navItems.map(([id, label, Icon]) => (
            <button
              key={id}
              className={`nav-link ${view === id ? "active" : ""}`}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              {label}
              {view === id && <span className="nav-active-dot" />}
            </button>
          ))}
          <button
            className="nav-link settings-link"
            onClick={() => open("settings")}
          >
            <Settings size={19} />
            Settings
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="grow-card">
            <span className="plant-art" aria-hidden="true">
              🌱
            </span>
            <h3>
              Small habits.
              <br />A brighter future.
            </h3>
            <p>Your money journey starts with a little clarity.</p>
            <button className="text-button" onClick={() => open("install")}>
              Take Jam with you <ArrowUpRight size={14} />
            </button>
          </div>
          <button className="profile" onClick={() => open("settings")}>
            <span className="avatar">
              {data.name.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{data.name}</strong>
              <small>Personal account</small>
            </span>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="greeting">
            <span className="mobile-avatar avatar">
              {data.name.slice(0, 1).toUpperCase()}
            </span>
            <span>
              Hello, <strong>{data.name}</strong>{" "}
              <span className="wave">✳</span>
              <small>Let’s make room for what matters.</small>
            </span>
          </div>
          <div className="topbar-right">
            <button
              className="button secondary family-open"
              onClick={cloud ? cloud.onFamily : onConnect}
            >
              <Users size={16} />
              <span>{cloud ? "Family" : "Family accounts"}</span>
            </button>
            {cloud && (
              <button
                className="icon-button cloud-signout"
                onClick={() => void cloud.onSignOut()}
                aria-label="Sign out of family account"
              >
                <LogOut size={17} />
              </button>
            )}
            <span className="local-badge">
              <span />
              {cloud ? cloud.status : "Saved on this device"}
            </span>
            <button
              className="icon-button"
              onClick={() => open("install")}
              aria-label="Install Jam on your phone"
            >
              <Download size={19} />
            </button>
            <button
              className="icon-button mobile-settings"
              onClick={() => open("settings")}
              aria-label="Open settings"
            >
              <Settings size={20} />
            </button>
          </div>
        </header>
        {storageIssue && (
          <div className="storage-warning" role="alert">
            {storageIssue}{" "}
            <button
              onClick={() =>
                downloadFile(
                  JSON.stringify(data, null, 2),
                  "application/json",
                  "jam-backup.json",
                )
              }
            >
              Export a backup
            </button>
          </div>
        )}
        <div className="page-heading">
          <div>
            <span className="eyebrow">YOUR MONEY, A LITTLE CLEARER</span>
            <h1>
              {view === "overview"
                ? "A little more in balance."
                : view === "transactions"
                  ? "Every little detail."
                  : view === "insights"
                    ? "See the bigger picture."
                    : "Good things take saving."}
            </h1>
          </div>
          <div className="page-actions">
            <MonthPicker />
            <button
              className="button primary add-desktop"
              onClick={addTransaction}
            >
              <Plus size={17} />
              Add transaction
            </button>
          </div>
        </div>
        {data.demo && (
          <div className="demo-notice">
            <span>
              <span className="demo-dot" />
              You’re exploring with sample data.
            </span>
            <button
              onClick={() => {
                open("settings");
                setConfirmReset(true);
              }}
            >
              Start with my own <ArrowRight size={13} />
            </button>
          </div>
        )}
        {view === "overview" && (
          <>
            <div className="top-grid">
              <section className="balance-panel">
                <div className="balance-top">
                  <span className="balance-label">
                    <span className="tiny-wallet">
                      <Wallet size={17} />
                    </span>
                    Available balance
                  </span>
                  <span className="balance-currency">
                    {data.currency}
                    <ChevronDown size={12} />
                  </span>
                </div>
                <div className="balance-number">
                  {fmt(currentBalance)}
                  <span>All your little moves, in one place.</span>
                </div>
                <div className="wallet-art" aria-hidden="true">
                  <div className="wallet-orbit" />
                  <Leaf className="wallet-leaf" size={115} strokeWidth={0.8} />
                  <div className="mini-card">
                    <span>jam.</span>
                    <span className="chip" />
                    <span>•••• &nbsp; 5882</span>
                  </div>
                </div>
                <div className="balance-bottom">
                  <div>
                    <span className="stat-icon in">
                      <ArrowDownLeft size={17} />
                    </span>
                    <span>
                      <small>Money in</small>
                      <strong>{fmt(income, 0)}</strong>
                    </span>
                  </div>
                  <div>
                    <span className="stat-icon out">
                      <ArrowUpRight size={17} />
                    </span>
                    <span>
                      <small>Money out</small>
                      <strong>{fmt(expenses, 0)}</strong>
                    </span>
                  </div>
                </div>
              </section>
              {cashFlow()}
            </div>
            {budgetBanner()}
            <div className="bottom-grid">
              <section className="panel recent-panel">
                <SectionHeading
                  eyebrow="THE DAY-TO-DAY"
                  title="Recent transactions"
                  action={
                    <button
                      className="text-button"
                      onClick={() => navigate("transactions")}
                    >
                      View all <ArrowUpRight size={15} />
                    </button>
                  }
                />
                <div className="list-header">
                  <span>TRANSACTION</span>
                  <span>DATE</span>
                  <span>AMOUNT</span>
                </div>
                {transactionList(monthRows, 5)}
                <button className="add-inline" onClick={addTransaction}>
                  <Plus size={16} />
                  Add a little detail
                </button>
              </section>
              {savingsPanel()}
            </div>
          </>
        )}
        {view === "transactions" && (
          <section className="panel full-panel">
            <SectionHeading
              title="Your transactions"
              action={
                <button className="button secondary" onClick={exportCsv}>
                  <Download size={16} />
                  Export CSV
                </button>
              }
            />
            <div className="transaction-toolbar">
              <label className="search-input">
                <Search size={18} />
                <input
                  placeholder="Search transactions…"
                  aria-label="Search transactions"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <label className="filter-label">
                <SlidersHorizontal size={16} />
                <select
                  aria-label="Filter transaction type"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All transactions</option>
                  <option value="expense">Expenses</option>
                  <option value="income">Income</option>
                  <option value="saving">Savings top ups</option>
                  <option value="withdrawal">Withdrawals</option>
                </select>
              </label>
            </div>
            <div className="list-header">
              <span>TRANSACTION</span>
              <span>DATE</span>
              <span>AMOUNT</span>
            </div>
            {transactionList(visibleRows)}
            <div className="table-footer">
              {visibleRows.length} transaction
              {visibleRows.length !== 1 ? "s" : ""}
              <span>Amounts shown in {data.currency}</span>
            </div>
          </section>
        )}
        {view === "insights" && (
          <>
            <div className="insight-stats">
              <div className="panel">
                <span className="stat-icon in">
                  <ArrowDownLeft size={19} />
                </span>
                <span>
                  Money in<strong>{fmt(income)}</strong>
                </span>
              </div>
              <div className="panel">
                <span className="stat-icon out">
                  <ArrowUpRight size={19} />
                </span>
                <span>
                  Money out<strong>{fmt(expenses)}</strong>
                </span>
              </div>
              <div className="panel">
                <span className="stat-icon in">
                  <Sprout size={19} />
                </span>
                <span>
                  Income kept
                  <strong>
                    {income
                      ? Math.round(((income - expenses) / income) * 100)
                      : 0}
                    %
                  </strong>
                </span>
              </div>
            </div>
            <div className="insights-grid">
              {cashFlow()}
              <section className="panel">
                <SectionHeading title="Where it went" />
                <div className="category-list">
                  {categoryTotals
                    .filter((c) => c.amount > 0)
                    .map((c) => (
                      <div className="category-row" key={c.category}>
                        <IconBox category={c.category} />
                        <div>
                          <span>
                            {c.category}
                            <strong>{fmt(c.amount)}</strong>
                          </span>
                          <div className="progress-track">
                            <span
                              className={categoryColors[c.category]}
                              style={{
                                width: `${expenses ? (c.amount / expenses) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                        <small>
                          {expenses
                            ? Math.round((c.amount / expenses) * 100)
                            : 0}
                          %
                        </small>
                      </div>
                    ))}
                  {!expenses && (
                    <div className="empty-state">
                      <BarChart3 size={28} />
                      <p>Your spending story will appear here.</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
            {budgetBanner()}
            <div className="insight-note">
              <Lightbulb size={22} />
              <div>
                <strong>
                  {categoryTotals[0].amount
                    ? `${categoryTotals[0].category} is your biggest category this month.`
                    : "Every insight starts with a little detail."}
                </strong>
                <p>
                  {categoryTotals[0].amount
                    ? "Small, mindful changes can make more room for your savings."
                    : "Add your first expense to see where your money goes."}
                </p>
              </div>
            </div>
          </>
        )}
        {view === "savings" && (
          <div className="savings-grid">
            <section className="panel goals-selector">
              <SectionHeading
                title="Your little goals"
                action={
                  <button
                    className="round-button pale"
                    onClick={() => open("goal")}
                    aria-label="Create savings goal"
                  >
                    <Plus size={20} />
                  </button>
                }
              />
              <p className="muted">Big dreams start somewhere.</p>
              {data.goals.map((g) => (
                <button
                  key={g.id}
                  className={`goal-option ${selected?.id === g.id ? "selected" : ""}`}
                  onClick={() => setSelectedGoal(g.id)}
                >
                  <span className="goal-option-emoji">{g.emoji}</span>
                  <span>
                    <strong>{g.name}</strong>
                    <small>
                      {fmt(g.saved)} of {fmt(g.target, 0)}
                    </small>
                  </span>
                  <ChevronRight size={17} />
                </button>
              ))}
              {!data.goals.length && (
                <div className="empty-state">
                  <Target size={30} />
                  <p>
                    A trip, a rainy day, a fresh start.
                    <br />
                    What are you saving for?
                  </p>
                  <button
                    className="button primary"
                    onClick={() => open("goal")}
                  >
                    <Plus size={17} />
                    Create a goal
                  </button>
                </div>
              )}
              <div className="gentle-note">
                <ShieldCheck size={17} />
                <p>
                  Manually track your savings here. Jam doesn’t connect to or
                  move money from your bank.
                </p>
              </div>
            </section>
            {selected && (
              <section className="panel goal-detail">
                <div className="goal-detail-header">
                  <span>SAVING FOR</span>
                  <h2>{selected.name}</h2>
                </div>
                <Ring
                  percent={(selected.saved / selected.target) * 100}
                  size={194}
                >
                  <span className="big-emoji">{selected.emoji}</span>
                </Ring>
                <div className="goal-total">
                  {fmt(selected.saved)}
                  <small>
                    of {fmt(selected.target)} ·{" "}
                    {Math.round((selected.saved / selected.target) * 100)}%
                    there
                  </small>
                </div>
                <div className="goal-actions">
                  <button
                    className="button primary"
                    onClick={() => {
                      setTransferType("saving");
                      open("transfer");
                    }}
                  >
                    <ArrowDownToLine size={17} />
                    Top up
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setTransferType("withdrawal");
                      open("transfer");
                    }}
                  >
                    <ArrowUpFromLine size={17} />
                    Withdraw
                  </button>
                </div>
                <div className="goal-history">
                  <h3>A little progress</h3>
                  {transactionList(
                    data.transactions
                      .filter((t) => t.goalId === selected.id)
                      .sort((a, b) => b.date.localeCompare(a.date)),
                    5,
                  )}
                  {!data.transactions.some((t) => t.goalId === selected.id) && (
                    <p className="muted">
                      Your next top up is your next step forward.
                    </p>
                  )}
                </div>
              </section>
            )}
          </div>
        )}
        <footer className="page-footer">
          <span>
            <JamLogo size={14} />A little clarity goes a long way.
          </span>
          <button onClick={() => open("install")}>
            Made for your everyday <ArrowUpRight size={13} />
          </button>
        </footer>
      </main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button
          className={view === "overview" ? "active" : ""}
          onClick={() => navigate("overview")}
          aria-label="Overview"
        >
          <Home size={21} />
          <span>Home</span>
        </button>
        <button
          className={view === "insights" ? "active" : ""}
          onClick={() => navigate("insights")}
          aria-label="Insights"
        >
          <BarChart3 size={21} />
          <span>Insights</span>
        </button>
        <button
          className="mobile-add"
          onClick={addTransaction}
          aria-label="Add transaction"
        >
          <Plus size={28} />
        </button>
        <button
          className={view === "savings" ? "active" : ""}
          onClick={() => navigate("savings")}
          aria-label="Savings"
        >
          <Target size={21} />
          <span>Savings</span>
        </button>
        <button
          className={view === "transactions" ? "active" : ""}
          onClick={() => navigate("transactions")}
          aria-label="Transactions"
        >
          <Wallet size={21} />
          <span>Activity</span>
        </button>
      </nav>
      {toast && (
        <div className="toast" role="status">
          <span>
            <Check size={16} />
          </span>
          {toast}
        </div>
      )}
      {modal && (
        <ModalShell
          title={
            modal === "transaction"
              ? "A little detail."
              : modal === "goal"
                ? "Something to save for."
                : modal === "transfer"
                  ? transferType === "saving"
                    ? "A step closer."
                    : "Move it back."
                  : modal === "budget"
                    ? "Make a little plan."
                    : modal === "settings"
                      ? "Make yourself at home."
                      : modal === "install"
                        ? "Jam, on the go."
                        : "Transaction details"
          }
          close={close}
        >
          {modal === "transaction" && (
            <form onSubmit={submitTransaction}>
              <p className="modal-description">
                Small details make the bigger picture clearer.
              </p>
              <div className="segmented form-segmented">
                <button
                  type="button"
                  className={txType === "expense" ? "active" : ""}
                  onClick={() => setTxType("expense")}
                >
                  Money out
                </button>
                <button
                  type="button"
                  className={txType === "income" ? "active" : ""}
                  onClick={() => setTxType("income")}
                >
                  Money in
                </button>
              </div>
              <label>
                Amount ({data.currency})
                <input
                  name="amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  required
                  autoFocus
                  className="amount-input"
                  maxLength={14}
                />
              </label>
              <label>
                Description
                <input
                  name="title"
                  placeholder={
                    txType === "expense"
                      ? "e.g. Coffee with a friend"
                      : "e.g. Monthly salary"
                  }
                  required
                  maxLength={80}
                />
              </label>
              <div className="form-row">
                <label>
                  Category
                  <select
                    name="category"
                    defaultValue={
                      txType === "income" ? "Other" : "Food & drink"
                    }
                    key={txType}
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Date
                  <input
                    type="date"
                    name="date"
                    defaultValue={today()}
                    max={today()}
                    required
                  />
                </label>
              </div>
              <label>
                Note <span className="optional">optional</span>
                <textarea
                  name="note"
                  placeholder="Anything you’d like to remember…"
                  maxLength={300}
                  rows={2}
                />
              </label>
              {formError && (
                <p className="form-error" role="alert">
                  {formError}
                </p>
              )}
              <button className="button primary full-width" type="submit">
                <Plus size={18} />
                Add {txType === "expense" ? "expense" : "income"}
              </button>
            </form>
          )}
          {modal === "goal" && (
            <form onSubmit={submitGoal}>
              <p className="modal-description">
                What’s the next thing you’re dreaming of?
              </p>
              <label>
                Goal name
                <input
                  name="name"
                  placeholder="e.g. A little adventure"
                  maxLength={40}
                  required
                  autoFocus
                />
              </label>
              <div className="form-row">
                <label>
                  A little personality
                  <select name="emoji" defaultValue="🌸">
                    <option value="🌸">🌸 A trip</option>
                    <option value="🚗">🚗 A new car</option>
                    <option value="☀️">☀️ Rainy day</option>
                    <option value="🏡">🏡 A home</option>
                    <option value="💻">💻 New tech</option>
                    <option value="✨">✨ Something special</option>
                  </select>
                </label>
                <label>
                  Target ({data.currency})
                  <input
                    name="target"
                    inputMode="decimal"
                    placeholder="1000.00"
                    required
                  />
                </label>
              </div>
              <p className="field-hint">
                Start at zero and track your progress with top ups.
              </p>
              {formError && (
                <p className="form-error" role="alert">
                  {formError}
                </p>
              )}
              <button className="button primary full-width">
                <Target size={17} />
                Create goal
              </button>
            </form>
          )}
          {modal === "transfer" && (
            <form onSubmit={submitTransfer}>
              <p className="modal-description">
                {transferType === "saving"
                  ? "Set aside a little for your future."
                  : "Return savings to your available balance."}
              </p>
              <label>
                Savings goal
                <select name="goal" defaultValue={selected?.id}>
                  {data.goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.emoji} {g.name} · {fmt(g.saved)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Amount ({data.currency})
                <input
                  name="amount"
                  inputMode="decimal"
                  placeholder="0.00"
                  required
                  autoFocus
                  className="amount-input"
                />
              </label>
              <p className="field-hint">
                Available balance: {fmt(currentBalance)}. This records a
                transfer; it doesn’t move bank funds.
              </p>
              {formError && (
                <p className="form-error" role="alert">
                  {formError}
                </p>
              )}
              <button className="button primary full-width">
                {transferType === "saving"
                  ? "Top up savings"
                  : "Withdraw savings"}
                <ArrowRight size={17} />
              </button>
            </form>
          )}
          {modal === "budget" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const amount = parseAmount(
                  String(new FormData(e.currentTarget).get("budget")),
                );
                if (!Number.isFinite(amount)) {
                  setFormError(
                    "Enter a positive budget with up to 2 decimal places.",
                  );
                  return;
                }
                setData({ ...data, budget: amount });
                close();
                setToast("Monthly budget updated");
              }}
            >
              <p className="modal-description">
                A little intention for your everyday spending. This budget
                applies to each month.
              </p>
              <label>
                Monthly budget ({data.currency})
                <input
                  name="budget"
                  defaultValue={data.budget / 100}
                  inputMode="decimal"
                  className="amount-input"
                  required
                  autoFocus
                />
              </label>
              {formError && (
                <p className="form-error" role="alert">
                  {formError}
                </p>
              )}
              <button className="button primary full-width">
                Save budget
                <Check size={17} />
              </button>
            </form>
          )}
          {modal === "settings" && (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  setData({
                    ...data,
                    name: String(f.get("name")).trim() || "Friend",
                    currency: cloud ? data.currency : String(f.get("currency")),
                  });
                  close();
                  setToast("Your preferences are saved");
                }}
              >
                <p className="modal-description">Your space, your pace.</p>
                <label>
                  Your first name
                  <input
                    name="name"
                    defaultValue={data.name}
                    required
                    maxLength={30}
                  />
                </label>
                <label>
                  Display currency
                  <select
                    name="currency"
                    defaultValue={data.currency}
                    disabled={!!cloud}
                  >
                    <option value="USD">US Dollar · USD</option>
                    <option value="HKD">Hong Kong Dollar · HKD</option>
                    <option value="EUR">Euro · EUR</option>
                    <option value="GBP">British Pound · GBP</option>
                  </select>
                </label>
                <p className="field-hint">
                  {cloud
                    ? "Your family uses one currency for shared totals. Amounts are not converted."
                    : "Changes the currency label only. Amounts are not converted."}
                </p>
                <button className="button primary full-width">
                  Save preferences
                  <Check size={17} />
                </button>
              </form>
              <div className="settings-section">
                <h3>Your data stays with you</h3>
                <p className="muted">
                  {cloud
                    ? "Your personal account syncs to Supabase. Your family can view your entries; only you can change them. No bank connection is enabled."
                    : "Saved in this browser, on this device. Cross-device sync and bank connections are not enabled."}
                </p>
                <div className="settings-buttons">
                  <button
                    className="button secondary"
                    onClick={() =>
                      downloadFile(
                        JSON.stringify(data, null, 2),
                        "application/json",
                        "jam-backup.json",
                      )
                    }
                  >
                    <Download size={16} />
                    Back up
                  </button>
                  <label className="button secondary restore-label">
                    <ArrowUpFromLine size={16} />
                    Restore
                    <input
                      type="file"
                      accept="application/json,.json"
                      onChange={async (e) => {
                        const input = e.currentTarget;
                        const file = input.files?.[0];
                        if (!file) return;
                        try {
                          const s: unknown = JSON.parse(await file.text());
                          if (
                            cloud &&
                            validState(s) &&
                            (s.currency !== data.currency || s.demo)
                          )
                            throw new Error(
                              "Restore personal data in your family currency only; sample data cannot be uploaded.",
                            );
                          if (!validState(s))
                            throw new Error(
                              "This file is not a valid Jam backup.",
                            );
                          if (
                            !window.confirm(
                              cloud
                                ? "Replace your account ledger with this backup?"
                                : "Replace the data on this device with this backup?",
                            )
                          )
                            return;
                          persistAllowed.current = true;
                          setData(s);
                          close();
                          setToast("Backup restored");
                        } catch (err) {
                          setFormError((err as Error).message);
                        }
                        input.value = "";
                      }}
                    />
                  </label>
                  <button className="button secondary" onClick={exportCsv}>
                    Export CSV
                  </button>
                </div>
              </div>
              <div className="settings-section">
                {confirmReset ? (
                  <div className="reset-confirm">
                    <strong>Start with a clean slate?</strong>
                    <p>
                      This removes all transactions and goals in this workspace.
                      Download a backup first if you want to keep them.
                    </p>
                    <div className="settings-buttons">
                      <button
                        className="button danger"
                        onClick={() => {
                          persistAllowed.current = true;
                          setData({
                            ...emptyState(),
                            name: data.name,
                            currency: data.currency,
                          });
                          close();
                          setToast("Your fresh start is ready");
                        }}
                      >
                        Clear data & start fresh
                      </button>
                      <button
                        className="button secondary"
                        onClick={() => setConfirmReset(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="text-button danger-text"
                    onClick={() => setConfirmReset(true)}
                  >
                    <Trash2 size={15} />
                    {data.demo
                      ? "Clear sample data & start fresh"
                      : "Clear all data"}
                  </button>
                )}
              </div>
              {formError && (
                <p className="form-error" role="alert">
                  {formError}
                </p>
              )}
            </>
          )}
          {modal === "detail" && selectedTx && (
            <>
              <div className="detail-hero">
                <IconBox
                  category={selectedTx.category}
                  type={selectedTx.type}
                />
                <h3>{selectedTx.title}</h3>
                <strong
                  className={
                    ["income", "withdrawal"].includes(selectedTx.type)
                      ? "positive"
                      : ""
                  }
                >
                  {["income", "withdrawal"].includes(selectedTx.type)
                    ? "+"
                    : "−"}
                  {fmt(selectedTx.amount)}
                </strong>
              </div>
              <dl className="detail-list">
                <div>
                  <dt>Category</dt>
                  <dd>{selectedTx.category}</dd>
                </div>
                <div>
                  <dt>Date</dt>
                  <dd>
                    {new Date(selectedTx.date + "T12:00:00").toLocaleDateString(
                      "en-US",
                      { dateStyle: "long" },
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>
                    {selectedTx.type === "saving"
                      ? "Savings top up"
                      : selectedTx.type}
                  </dd>
                </div>
                {selectedTx.note && (
                  <div>
                    <dt>Note</dt>
                    <dd>{selectedTx.note}</dd>
                  </div>
                )}
              </dl>
              {formError && (
                <p className="form-error" role="alert">
                  {formError}
                </p>
              )}
              <button className="button delete-button" onClick={removeSelected}>
                <Trash2 size={16} />
                Delete transaction
              </button>
            </>
          )}
          {modal === "install" && (
            <div className="install-content">
              <div className="install-icon">
                <JamLogo size={46} />
              </div>
              <p>Your everyday money companion, right on your home screen.</p>
              {installPrompt ? (
                <button
                  className="button primary full-width"
                  onClick={async () => {
                    await installPrompt.prompt();
                    await installPrompt.userChoice;
                    setInstallPrompt(null);
                  }}
                >
                  Install Jam
                  <Download size={17} />
                </button>
              ) : (
                <>
                  <div className="install-step">
                    <span>1</span>
                    <p>
                      <strong>On iPhone</strong>Open Jam in Safari, tap Share,
                      then “Add to Home Screen”.
                    </p>
                  </div>
                  <div className="install-step">
                    <span>2</span>
                    <p>
                      <strong>On Android</strong>Open Jam in Chrome, tap the
                      menu, then “Install app” or “Add to Home screen”.
                    </p>
                  </div>
                </>
              )}
              <div className="gentle-note">
                <ShieldCheck size={18} />
                <p>
                  {cloud
                    ? "Family accounts need a connection to load and save. If saving fails, export a backup before closing this tab."
                    : "Works offline after your first visit. Your data stays in this browser; export a backup before switching browsers or devices."}
                </p>
              </div>
            </div>
          )}
        </ModalShell>
      )}
    </div>
  );
}

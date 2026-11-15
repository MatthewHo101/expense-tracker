import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Download,
  LogOut,
  Plus,
  RefreshCw,
  Users,
  X,
} from "lucide-react";
import App from "./App";
import JamLogo from "./JamLogo";
import { supabase } from "./supabase";
import { categories, money, parseAmount, today, validState } from "./domain";
import type { AppState, Category } from "./domain";
import { familyReport, readLedgers } from "./family";
import type { Family, Ledger, Member } from "./family";
const setupUrl =
  "https://github.com/MatthewHo101/expense-tracker/blob/main/supabase/setup.sql";
const setupGuide =
  "https://github.com/MatthewHo101/expense-tracker/blob/main/supabase/README.md";
function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : typeof error === "object" && error && "message" in error
      ? String(error.message)
      : "Something went wrong. Please try again.";
}
function Logo() {
  return (
    <div className="family-logo">
      <JamLogo size={32} />
      <span>jam.</span>
    </div>
  );
}
function captureInvite() {
  try {
    const url = new URL(location.href);
    const token = url.searchParams.get("invite");
    if (token && /^[a-f0-9]{48}$/.test(token)) {
      sessionStorage.setItem("jam-invite", token);
      url.searchParams.delete("invite");
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    return sessionStorage.getItem("jam-invite") || "";
  } catch {
    return "";
  }
}
export default function CloudApp() {
  const [session, setSession] = useState<Session | null>(null),
    [starting, setStarting] = useState(true),
    [local, setLocal] = useState(false),
    [recovery, setRecovery] = useState(false);
  const [invite] = useState(captureInvite);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setSession(data.session);
      setStarting(false);
      if (error) console.error("Jam session could not be restored.");
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setStarting(false);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  if (starting)
    return (
      <div className="account-page">
        <Logo />
        <p className="muted">Opening your little space…</p>
      </div>
    );
  if (local && !session) return <App onConnect={() => setLocal(false)} />;
  if (!session || recovery)
    return (
      <AuthScreen
        recovery={recovery}
        onRecovered={() => setRecovery(false)}
        onLocal={() => setLocal(true)}
        invite={invite}
      />
    );
  return <Workspace key={session.user.id} session={session} invite={invite} />;
}
function AuthScreen({
  recovery,
  onRecovered,
  onLocal,
  invite,
}: {
  recovery: boolean;
  onRecovered: () => void;
  onLocal: () => void;
  invite: string;
}) {
  const [mode, setMode] = useState<"login" | "signup" | "reset">(
      invite ? "signup" : "login",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget),
      email = String(form.get("email")).trim(),
      password = String(form.get("password") || "");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (recovery) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        onRecovered();
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: String(form.get("name")).trim() },
            emailRedirectTo: location.origin + "/",
          },
        });
        if (error) throw error;
        if (!data.session)
          setNotice(
            "Check your inbox to confirm your email, then return here and sign in.",
          );
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: location.origin + "/",
        });
        if (error) throw error;
        setNotice(
          "If this email has an account, check your inbox for a password reset link.",
        );
      }
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="account-page">
      <div className="account-card">
        <Logo />
        <span className="eyebrow">A LITTLE SPACE FOR YOUR WHOLE FAMILY</span>
        <h1>
          {recovery
            ? "A fresh password."
            : mode === "signup"
              ? "Make yourself at home."
              : mode === "reset"
                ? "Let’s get you back in."
                : "Your money. Together."}
        </h1>
        <p className="muted">
          {invite
            ? "You have a family invitation. Use the email address the invitation was sent to."
            : "Track your own spending and see the whole family’s picture, from any device."}
        </p>
        {!recovery && (
          <div className="segmented form-segmented">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError("");
                  setNotice("");
                }}
                className={mode === m ? "active" : ""}
              >
                {m === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={submit}>
          {mode === "signup" && !recovery && (
            <label>
              Your first name
              <input
                name="name"
                autoComplete="given-name"
                required
                maxLength={30}
              />
            </label>
          )}
          {!recovery && (
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
          )}
          {(recovery || mode !== "reset") && (
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={
                  mode === "login" && !recovery
                    ? "current-password"
                    : "new-password"
                }
                minLength={8}
                required
              />
            </label>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="account-notice" role="status">
              {notice}
            </p>
          )}
          <button className="button primary full-width" disabled={busy}>
            {busy
              ? "One moment…"
              : recovery
                ? "Save new password"
                : mode === "login"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : "Send reset link"}
            <ArrowRight size={16} />
          </button>
        </form>
        {!recovery && (
          <button
            className="text-button account-link"
            onClick={() => {
              setMode(mode === "reset" ? "login" : "reset");
              setError("");
              setNotice("");
            }}
          >
            {mode === "reset" ? "Back to sign in" : "Forgot your password?"}
          </button>
        )}
        <div className="account-divider" />
        <button className="text-button" onClick={onLocal}>
          Continue with this device’s local workspace <ArrowRight size={14} />
        </button>
        <p className="account-footnote">
          Family accounts use Supabase. Your browser-only workspace stays
          separate until you choose to import it.
        </p>
      </div>
    </div>
  );
}
function Workspace({ session, invite }: { session: Session; invite: string }) {
  const [member, setMember] = useState<Member | null>(null),
    [family, setFamily] = useState<Family | null>(null),
    [members, setMembers] = useState<Member[]>([]),
    [ledgers, setLedgers] = useState<Ledger[]>([]),
    [own, setOwn] = useState<AppState | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [status, setStatus] = useState("Saved to your family account"),
    [showFamily, setShowFamily] = useState(false),
    [generation, setGeneration] = useState(0),
    [blocked, setBlocked] = useState(false);
  const revision = useRef(0),
    pending = useRef<AppState | null>(null),
    baseline = useRef(""),
    saving = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    mounted = useRef(true),
    blockedRef = useRef(false),
    loadedRef = useRef(false);
  const refresh = useCallback(async () => {
    const { data: me, error: mError } = await supabase
      .from("jam_memberships")
      .select("*")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (mError) throw mError;
    if (!mounted.current) return;
    if (!me) {
      setMember(null);
      loadedRef.current = true;
      return;
    }
    const [
      { data: f, error: fe },
      { data: ms, error: meError },
      { data: ls, error: le },
    ] = await Promise.all([
      supabase.from("jam_families").select("*").eq("id", me.family_id).single(),
      supabase
        .from("jam_memberships")
        .select("*")
        .eq("family_id", me.family_id),
      supabase.from("jam_member_data").select("user_id,state,revision"),
    ]);
    if (fe || meError || le) throw fe || meError || le;
    if (!f) throw new Error("Family not found.");
    if (!mounted.current) return;
    const parsed = readLedgers(ls || [], f.currency),
      self = parsed.find((l) => l.user_id === session.user.id);
    if (!self)
      throw new Error(
        "Your account ledger is missing. Please contact the family owner.",
      );
    setMember(me as Member);
    setFamily({ ...f, monthly_budget: Number(f.monthly_budget) });
    setMembers((ms || []) as Member[]);
    setLedgers(parsed);
    if (
      !pending.current &&
      !saving.current &&
      (!loadedRef.current || self.revision > revision.current)
    ) {
      revision.current = self.revision;
      baseline.current = JSON.stringify(self.state);
      setOwn(self.state);
      setGeneration((g) => g + 1);
      setStatus("Saved to your family account");
    }
    loadedRef.current = true;
  }, [session.user.id]);
  useEffect(() => {
    mounted.current = true;
    refresh()
      .catch((err) => setError(message(err)))
      .finally(() => setLoading(false));
    const id = setInterval(() => {
      refresh().catch((err) => setError(message(err)));
    }, 15000);
    const focus = () => {
      refresh().catch((err) => setError(message(err)));
    };
    window.addEventListener("focus", focus);
    return () => {
      mounted.current = false;
      clearInterval(id);
      window.removeEventListener("focus", focus);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refresh]);
  const save = useCallback(async () => {
    if (saving.current || !pending.current || blockedRef.current) return;
    const state = pending.current;
    saving.current = true;
    setStatus("Saving to your account…");
    try {
      const { data, error } = await supabase.rpc("jam_save_state", {
        p_state: state,
        p_expected_revision: revision.current,
      });
      if (error) throw error;
      revision.current = Number(data);
      baseline.current = JSON.stringify(state);
      if (pending.current === state) pending.current = null;
      if (mounted.current) {
        setStatus(
          pending.current ? "Saving changes…" : "Saved to your family account",
        );
        setLedgers((rows) =>
          rows.map((l) =>
            l.user_id === session.user.id
              ? { ...l, state, revision: revision.current }
              : l,
          ),
        );
        setMembers((rows) =>
          rows.map((m) =>
            m.user_id === session.user.id
              ? { ...m, display_name: state.name }
              : m,
          ),
        );
        setError("");
      }
    } catch (err) {
      const msg = message(err);
      if (msg.includes("Another device")) {
        blockedRef.current = true;
        setBlocked(true);
      }
      setError(msg);
      setStatus("Changes are not saved — keep this tab open");
    } finally {
      saving.current = false;
      if (pending.current && pending.current !== state && !blockedRef.current)
        timer.current = setTimeout(() => void save(), 800);
    }
  }, [session.user.id]);
  const onChange = useCallback(
    (state: AppState) => {
      if (JSON.stringify(state) === baseline.current && !pending.current)
        return;
      pending.current = state;
      setStatus("Unsaved changes…");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(), 800);
    },
    [save],
  );
  useEffect(() => {
    const online = () => void save();
    const leave = (e: BeforeUnloadEvent) => {
      if (pending.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("online", online);
    window.addEventListener("beforeunload", leave);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("beforeunload", leave);
    };
  }, [save]);
  async function signOut() {
    if (saving.current) {
      setError("Please wait for saving to finish, then sign out.");
      return;
    }
    await save();
    if (pending.current) {
      setError(
        "Your changes are not saved yet. Export a backup before leaving, or retry saving.",
      );
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) setError(message(error));
  }
  async function imported() {
    try {
      const raw = localStorage.getItem("mint-expenses-v1");
      const state: unknown = raw ? JSON.parse(raw) : null;
      if (!validState(state) || state.demo)
        throw new Error(
          "No personal browser data is ready to import. Sample data is not uploaded.",
        );
      if (state.currency !== family?.currency)
        throw new Error(
          "Your browser data uses a different currency. Export it and convert amounts before importing.",
        );
      if (
        !window.confirm(
          "Replace your account ledger with this device’s personal workspace? Other family members are not affected.",
        )
      )
        return;
      onChange({ ...state, demo: false });
      setOwn({ ...state, demo: false });
      setGeneration((g) => g + 1);
      setShowFamily(false);
    } catch (err) {
      setError(message(err));
    }
  }
  if (loading)
    return (
      <div className="account-page">
        <Logo />
        <p className="muted">Finding your family space…</p>
      </div>
    );
  if (!member || !family || !own)
    return (
      <FamilyOnboarding
        session={session}
        invite={invite}
        error={error}
        onReady={async () => {
          setError("");
          setLoading(true);
          try {
            await refresh();
          } catch (err) {
            setError(message(err));
          } finally {
            setLoading(false);
          }
        }}
        onSignOut={signOut}
      />
    );
  return (
    <>
      {error && (
        <div className="cloud-error" role="alert">
          <span>{error}</span>
          {blocked ? (
            <button
              onClick={() => {
                if (
                  window.confirm(
                    "Discard unsaved changes and load the latest account data? Export a backup from Settings first if needed.",
                  )
                )
                  location.reload();
              }}
            >
              Load latest data
            </button>
          ) : (
            <button
              onClick={() => {
                void save();
                void refresh().catch((err) => setError(message(err)));
              }}
            >
              Retry
            </button>
          )}
          <button
            aria-label="Dismiss cloud message"
            onClick={() => setError("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      <div hidden={showFamily}>
        <App
          key={generation}
          cloud={{
            initialState: own,
            onChange,
            status,
            onFamily: () => {
              setShowFamily(true);
              void refresh().catch((err) => setError(message(err)));
            },
            onSignOut: signOut,
          }}
        />
      </div>
      {showFamily && (
        <FamilyDashboard
          family={family}
          me={member}
          members={members}
          ledgers={ledgers}
          onClose={() => setShowFamily(false)}
          refresh={refresh}
          onImport={imported}
        />
      )}
    </>
  );
}
function FamilyOnboarding({
  session,
  invite,
  error,
  onReady,
  onSignOut,
}: {
  session: Session;
  invite: string;
  error: string;
  onReady: () => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"create" | "join">(
      invite ? "join" : "create",
    ),
    [issue, setIssue] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setIssue("");
    try {
      const args =
        mode === "create"
          ? {
              p_name: String(f.get("family")).trim(),
              p_currency: String(f.get("currency")),
              p_display_name: String(f.get("name")).trim(),
            }
          : {
              p_token: String(f.get("token")).trim(),
              p_display_name: String(f.get("name")).trim(),
            };
      const { error } = await supabase.rpc(
        mode === "create" ? "jam_create_family" : "jam_accept_invite",
        args,
      );
      if (error) throw error;
      sessionStorage.removeItem("jam-invite");
      await onReady();
    } catch (err) {
      setIssue(message(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="account-page">
      <div className="account-card">
        <Logo />
        <h1>Your family’s little space.</h1>
        <p className="muted">
          Signed in as {session.user.email}. Every member can see their own
          spending and the family’s spending.
        </p>
        {error && (
          <div className="setup-needed">
            <p>{error}</p>
            <p>
              If the family tables are missing, run the database setup script in
              Supabase SQL Editor.
            </p>
            <a href={setupUrl} target="_blank" rel="noreferrer">
              Open database setup script <ArrowRight size={13} />
            </a>
            <a href={setupGuide} target="_blank" rel="noreferrer">
              Read setup instructions
            </a>
            <button className="button secondary" onClick={() => void onReady()}>
              <RefreshCw size={14} />
              Check setup again
            </button>
          </div>
        )}
        <div className="segmented form-segmented">
          <button
            onClick={() => setMode("create")}
            className={mode === "create" ? "active" : ""}
          >
            Create a family
          </button>
          <button
            onClick={() => setMode("join")}
            className={mode === "join" ? "active" : ""}
          >
            Join a family
          </button>
        </div>
        <form onSubmit={submit}>
          <label>
            Your first name
            <input
              name="name"
              maxLength={30}
              defaultValue={String(
                session.user.user_metadata.display_name || "",
              )}
              required
            />
          </label>
          {mode === "create" ? (
            <>
              <label>
                Family name
                <input
                  name="family"
                  placeholder="e.g. The Ho family"
                  maxLength={60}
                  required
                />
              </label>
              <label>
                Family currency
                <select name="currency" defaultValue="USD">
                  <option value="USD">USD · US Dollar</option>
                  <option value="HKD">HKD · Hong Kong Dollar</option>
                  <option value="EUR">EUR · Euro</option>
                  <option value="GBP">GBP · British Pound</option>
                </select>
              </label>
              <p className="field-hint">
                Everyone uses this currency so family totals stay meaningful. It
                is fixed when the family is created.
              </p>
            </>
          ) : (
            <label>
              Invitation code
              <input
                name="token"
                defaultValue={invite}
                required
                minLength={48}
                maxLength={48}
                placeholder="Paste the code from your invitation"
              />
            </label>
          )}
          {issue && (
            <p className="form-error" role="alert">
              {issue}
            </p>
          )}
          <button
            className="button primary full-width"
            disabled={busy || !!error}
          >
            {busy
              ? "One moment…"
              : mode === "create"
                ? "Create family"
                : "Join family"}
            <Users size={17} />
          </button>
        </form>
        <button
          className="text-button account-link"
          onClick={() => void onSignOut()}
        >
          Sign out <LogOut size={14} />
        </button>
      </div>
    </div>
  );
}
function FamilyDashboard({
  family,
  me,
  members,
  ledgers,
  onClose,
  refresh,
  onImport,
}: {
  family: Family;
  me: Member;
  members: Member[];
  ledgers: Ledger[];
  onClose: () => void;
  refresh: () => Promise<void>;
  onImport: () => Promise<void>;
}) {
  const [month, setMonth] = useState(today().slice(0, 7)),
    [person, setPerson] = useState("all"),
    [category, setCategory] = useState<Category | "all">("all"),
    [error, setError] = useState(""),
    [inviteLink, setInviteLink] = useState(""),
    [copied, setCopied] = useState(false),
    [busy, setBusy] = useState(false);
  const report = familyReport(members, ledgers, month, person, category),
    fmt = (amount: number) => money(amount, family.currency);
  const full = familyReport(members, ledgers, month),
    used = family.monthly_budget
      ? (full.expenses / family.monthly_budget) * 100
      : 0;
  async function invite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email"));
    setError("");
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("jam_create_invite", {
        p_email: email,
      });
      if (error) throw error;
      setInviteLink(`${location.origin}/?invite=${String(data)}`);
      setCopied(false);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  async function budget(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = parseAmount(
      String(new FormData(e.currentTarget).get("budget")),
    );
    if (!Number.isFinite(value)) {
      setError("Enter a positive budget amount.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.rpc("jam_update_family_budget", {
        p_budget: value,
      });
      if (error) throw error;
      await refresh();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  const exportData = () => {
    const blob = new Blob(
        [
          JSON.stringify(
            {
              family: family.name,
              currency: family.currency,
              month,
              transactions: report.rows,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `jam-family-${month}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="family-dashboard">
      <header className="family-topbar">
        <Logo />
        <div>
          <button className="button secondary" onClick={onClose} autoFocus>
            <ArrowLeft size={15} />
            My expenses
          </button>
          <button
            className="icon-button"
            aria-label="Close family dashboard"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
      </header>
      <div className="family-content">
        <div className="family-title">
          <div>
            <span className="eyebrow">EVERY LITTLE MOVE, TOGETHER</span>
            <h1>{family.name}</h1>
            <p className="muted">
              Everyone can see the family picture. You can change your own
              entries in My expenses.
            </p>
          </div>
          <button
            className="button secondary"
            onClick={() =>
              void refresh().catch((err) => setError(message(err)))
            }
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>
        <div className="family-filters">
          <label>
            Month
            <input
              type="month"
              value={month}
              required
              onChange={(e) => {
                if (e.target.value) setMonth(e.target.value);
              }}
            />
          </label>
          <label>
            Person
            <select value={person} onChange={(e) => setPerson(e.target.value)}>
              <option value="all">Whole family</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.display_name}
                  {m.user_id === me.user_id ? " (you)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category | "all")}
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <button className="button secondary" onClick={exportData}>
            <Download size={16} />
            Export view
          </button>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="insight-stats">
          <div className="panel">
            <span>
              Money in<strong>{fmt(report.income)}</strong>
            </span>
          </div>
          <div className="panel">
            <span>
              Money out<strong>{fmt(report.expenses)}</strong>
            </span>
          </div>
          <div className="panel">
            <span>
              Income kept<strong>{fmt(report.income - report.expenses)}</strong>
            </span>
          </div>
        </div>
        <div className="family-columns">
          <section className="panel">
            <div className="section-heading">
              <h2>Family activity</h2>
              <span className="muted">{report.rows.length} entries</span>
            </div>
            <div className="family-activity">
              {report.rows.map((t) => (
                <div className="family-transaction" key={`${t.userId}:${t.id}`}>
                  <span className="avatar">
                    {t.memberName.slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <strong>{t.title}</strong>
                    <small>
                      {t.memberName} · {t.category} · {t.date}
                    </small>
                    {t.note && <small>{t.note}</small>}
                  </span>
                  <strong
                    className={
                      ["income", "withdrawal"].includes(t.type)
                        ? "positive"
                        : ""
                    }
                  >
                    {["income", "withdrawal"].includes(t.type) ? "+" : "−"}
                    {fmt(t.amount)}
                    <small>
                      {t.type === "saving" ? "Savings top up" : t.type}
                    </small>
                  </strong>
                </div>
              ))}
              {!report.rows.length && (
                <div className="empty-state">
                  <Users size={28} />
                  <p>
                    No matching activity yet. Add an expense in My expenses to
                    start your family’s picture.
                  </p>
                </div>
              )}
            </div>
          </section>
          <div className="family-side">
            <section className="panel">
              <h2>Spending by person</h2>
              {report.spending.map(({ member, amount }) => (
                <div className="family-person" key={member.user_id}>
                  <span>
                    {member.display_name}
                    <small>
                      {member.role === "owner"
                        ? "Family owner"
                        : "Family member"}
                    </small>
                  </span>
                  <strong>{fmt(amount)}</strong>
                </div>
              ))}
            </section>
            <section className="panel">
              <h2>Shared monthly budget</h2>
              <p className="family-budget-value">
                {fmt(full.expenses)}{" "}
                <small>of {fmt(family.monthly_budget)}</small>
              </p>
              <div className="progress-track">
                <span
                  style={{
                    width: `${Math.min(used, 100)}%`,
                    background: used > 100 ? "#d38e6e" : undefined,
                  }}
                />
              </div>
              <p className="field-hint">
                Whole family, all categories · {Math.round(used)}% used
              </p>
              {me.role === "owner" && (
                <form onSubmit={budget}>
                  <label>
                    Budget ({family.currency})
                    <input
                      name="budget"
                      inputMode="decimal"
                      defaultValue={family.monthly_budget / 100}
                      required
                    />
                  </label>
                  <button
                    className="button secondary full-width"
                    disabled={busy}
                  >
                    Save family budget
                  </button>
                </form>
              )}
            </section>
            {me.role === "owner" && (
              <section className="panel">
                <h2>Invite your family</h2>
                <p className="muted">
                  Create a private link for one confirmed email address. Share
                  it directly; it expires in 7 days.
                </p>
                <form onSubmit={invite}>
                  <label>
                    Email address
                    <input
                      name="email"
                      type="email"
                      required
                      placeholder="family@example.com"
                    />
                  </label>
                  <button className="button primary full-width" disabled={busy}>
                    <Plus size={16} />
                    Create invitation
                  </button>
                </form>
                {inviteLink && (
                  <div className="invite-result">
                    <label>
                      Invitation link
                      <input
                        readOnly
                        value={inviteLink}
                        onFocus={(e) => e.target.select()}
                      />
                    </label>
                    <button
                      className="button secondary full-width"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(inviteLink);
                          setCopied(true);
                        } catch {
                          setError(
                            "Select and copy the invitation link above.",
                          );
                        }
                      }}
                    >
                      {copied ? <Check size={15} /> : <Copy size={15} />}{" "}
                      {copied ? "Copied" : "Copy link"}
                    </button>
                    <p className="field-hint">
                      No email is sent automatically. The recipient must also be
                      allowed to open this hosted Site.
                    </p>
                  </div>
                )}
              </section>
            )}
            <section className="panel">
              <h2>Bring your little details</h2>
              <p className="muted">
                You can replace your own account ledger with this device’s
                personal workspace. Other members’ records stay with them.
              </p>
              <button
                className="button secondary full-width"
                onClick={() => void onImport()}
              >
                Import this device’s data
              </button>
            </section>
          </div>
        </div>
        <p className="family-footnote">
          Synced across devices · refreshes every 15 seconds · {family.currency}{" "}
          for the whole family
        </p>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import "../App.css";
import { memberPortalFetch } from "../services/api";

type PortalMembership = {
  id: number;
  status: "ACTIVE" | "PAUSED" | "EXPIRED" | "CANCELLED";
  startDate: string;
  endDate: string;
  plan: { name: string; durationDays: number; price: string };
};
type PortalAttendance = {
  id: number;
  checkedInAt: string;
  method: string;
  membership: { plan: { name: string } };
};
type PortalHome = {
  member: {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    gym: { id: number; name: string };
    memberships: PortalMembership[];
    attendances: PortalAttendance[];
  };
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function MemberPortal() {
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const inviteMode = query.get("activate") === "1";
  const [mode, setMode] = useState<"login" | "activate">(inviteMode ? "activate" : "login");
  const [gymId, setGymId] = useState(query.get("gymId") ?? "");
  const [memberId, setMemberId] = useState(query.get("memberId") ?? "");
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [home, setHome] = useState<PortalHome | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("gymflow_member_token");
    if (!savedToken) {
      setCheckingSession(false);
      return;
    }

    setToken(savedToken);
    void (async () => {
      try {
        const response = await memberPortalFetch("/api/member-portal/me", savedToken);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Member session expired");
        setHome(data);
      } catch {
        localStorage.removeItem("gymflow_member_token");
        setToken("");
      } finally {
        setCheckingSession(false);
      }
    })();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const endpoint = mode === "login"
        ? "/api/member-portal/login"
        : "/api/member-portal/activate";
      const body = mode === "login"
        ? { gymId: Number(gymId), email, password }
        : { gymId: Number(gymId), memberId: Number(memberId), inviteCode, password };
      const response = await memberPortalFetch(endpoint, "", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not continue");

      localStorage.setItem("gymflow_member_token", data.token);
      setToken(data.token);
      const homeResponse = await memberPortalFetch("/api/member-portal/me", data.token);
      const homeData = await homeResponse.json();
      if (!homeResponse.ok) throw new Error(homeData.message || "Could not load your portal");
      setHome(homeData);
      window.history.replaceState({}, "", "/member-portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not continue");
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    localStorage.removeItem("gymflow_member_token");
    setToken("");
    setHome(null);
    setPassword("");
    setMode("login");
  }

  const member = home?.member;
  const now = new Date();
  const currentMembership = member?.memberships.find((item) =>
    item.status === "ACTIVE" && new Date(item.startDate) <= now && new Date(item.endDate) >= now,
  ) ?? member?.memberships[0] ?? null;
  const daysRemaining = currentMembership
    ? Math.max(0, Math.ceil((new Date(currentMembership.endDate).getTime() - now.getTime()) / 86_400_000))
    : null;

  if (checkingSession) {
    return <main className="member-portal-loading">Loading your member portal...</main>;
  }

  if (!token || !member) {
    return (
      <main className="member-portal-auth-screen">
        <section className="member-portal-auth-card">
          <a className="member-portal-brand" href="/member-portal">
            <span className="member-portal-mark">G</span>
            <span><strong>GymFlow</strong><small>Member Portal</small></span>
          </a>
          <p className="eyebrow">{mode === "login" ? "WELCOME BACK" : "FIRST-TIME SETUP"}</p>
          <h1>{mode === "login" ? "Your gym, at a glance." : "Activate your portal"}</h1>
          <p className="member-portal-intro">{mode === "login"
            ? "Check your membership and recent gym visits."
            : "Use the invite details from your gym to set a password."}</p>

          {error && <div className="form-message error">{error}</div>}

          <form className="member-portal-form" onSubmit={handleSubmit}>
            <label>
              Gym code
              <input required inputMode="numeric" value={gymId} onChange={(event) => setGymId(event.target.value)} placeholder="From your gym invite" />
            </label>
            {mode === "activate" ? <>
              <label>
                Member number
                <input required inputMode="numeric" value={memberId} onChange={(event) => setMemberId(event.target.value)} placeholder="From your gym invite" />
              </label>
              <label>
                One-time invite code
                <input required autoCapitalize="characters" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="Enter the code from your gym" />
              </label>
            </> : <label>
              Email address
              <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Your registered email" />
            </label>}
            <label>
              {mode === "login" ? "Password" : "Create a password"}
              <input required type="password" minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
            </label>
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Activate account"}
            </button>
          </form>

          <button className="member-portal-mode-switch" type="button" onClick={() => { setMode(mode === "login" ? "activate" : "login"); setError(""); }}>
            {mode === "login" ? "Have an invite code? Activate your account" : "Already activated? Sign in"}
          </button>
          <a className="member-portal-staff-link" href="/">Gym staff? Go to staff sign-in</a>
        </section>
      </main>
    );
  }

  return (
    <main className="member-portal-shell">
      <header className="member-portal-topbar">
        <a className="member-portal-brand" href="/member-portal">
          <span className="member-portal-mark">G</span>
          <span><strong>GymFlow</strong><small>{member.gym.name}</small></span>
        </a>
        <button className="secondary-button" type="button" onClick={signOut}>Sign out</button>
      </header>

      <section className="member-portal-welcome">
        <div>
          <p className="eyebrow">MEMBER HOME</p>
          <h1>Hi, {member.name.split(" ")[0]}</h1>
          <p>Your membership and recent visits, all in one place.</p>
        </div>
        <div className="member-portal-gym-pill">{member.gym.name}</div>
      </section>

      <section className="member-portal-summary-grid">
        <article className="member-portal-card member-portal-membership-card">
          <div className="member-portal-card-heading">
            <div><span className="member-portal-icon">✦</span><span>Membership</span></div>
            <span className={`member-portal-status ${(currentMembership?.status ?? "none").toLowerCase()}`}>
              {currentMembership?.status ?? "NO PLAN"}
            </span>
          </div>
          {currentMembership ? <>
            <h2>{currentMembership.plan.name}</h2>
            <p className="member-portal-price">₹{Number(currentMembership.plan.price).toLocaleString("en-IN")}</p>
            <div className="member-portal-dates">
              <div><span>Started</span><strong>{formatDate(currentMembership.startDate)}</strong></div>
              <div><span>Valid until</span><strong>{formatDate(currentMembership.endDate)}</strong></div>
            </div>
            <div className="member-portal-expiry">
              {currentMembership.status === "ACTIVE" && daysRemaining !== null
                ? daysRemaining === 0 ? "Your plan expires today" : `${daysRemaining} days remaining`
                : "Contact your gym to renew or update your plan."}
            </div>
          </> : <div className="member-portal-empty-plan">No membership found. Please contact your gym for help.</div>}
        </article>

        <article className="member-portal-card member-portal-profile-card">
          <div className="member-portal-card-heading"><div><span className="member-portal-icon">◎</span><span>Your profile</span></div></div>
          <dl>
            <div><dt>Name</dt><dd>{member.name}</dd></div>
            <div><dt>Email</dt><dd>{member.email || "Not added"}</dd></div>
            <div><dt>Phone</dt><dd>{member.phone || "Not added"}</dd></div>
            <div><dt>Member number</dt><dd>#{member.id}</dd></div>
          </dl>
          <p className="member-portal-note">Need to update your details? Contact the team at {member.gym.name}.</p>
        </article>
      </section>

      <section className="member-portal-card member-portal-attendance-card">
        <div className="member-portal-card-heading">
          <div><span className="member-portal-icon">▦</span><span>Recent attendance</span></div>
          <span className="member-portal-count">{member.attendances.length} recent visits</span>
        </div>
        {member.attendances.length ? <div className="member-portal-visits">
          {member.attendances.map((visit) => <div className="member-portal-visit" key={visit.id}>
            <span className="member-portal-visit-icon">✓</span>
            <div><strong>{formatDate(visit.checkedInAt)}</strong><span>{visit.membership.plan.name} plan</span></div>
            <time>{new Date(visit.checkedInAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</time>
          </div>)}
        </div> : <p className="member-portal-empty-visits">Your visits will show here after your first check-in.</p>}
      </section>
      <footer className="member-portal-footer">Questions about your account? Contact {member.gym.name}.</footer>
    </main>
  );
}

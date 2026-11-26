import { useState } from "react";
import { apiFetch } from "../services/api";

export default function ActivateAccount() {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [password, setPassword] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  async function submit(e: React.FormEvent) { e.preventDefault(); const r = await apiFetch("/api/auth/activate-account", { method: "POST", body: JSON.stringify({ token, password }) }); const d = await r.json(); if (!r.ok) setError(d.message); else setMessage("Account activated. You can now log in."); }
  return <div className="auth-screen"><div className="auth-card"><h1>GymFlow</h1><h2>Activate your account</h2>{error && <div className="form-message error">{error}</div>}{message && <div className="form-message">{message}</div>}<form className="auth-form" onSubmit={submit}><div className="form-group"><label>Password</label><input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} /></div><button className="primary-button auth-submit">Activate account</button></form></div></div>;
}

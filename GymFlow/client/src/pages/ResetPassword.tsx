import { useState } from "react";
import { apiFetch } from "../services/api";

export default function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get("token") || ""; const [password, setPassword] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  async function submit(event: React.FormEvent) { event.preventDefault(); const response = await apiFetch("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) }); const data = await response.json(); if (!response.ok) setError(data.message); else setMessage("Password reset successfully. You can now sign in."); }
  return <div className="auth-screen"><div className="auth-card"><div className="auth-brand"><div className="auth-logo">G</div><h1>GymFlow</h1></div><div className="auth-header"><p className="eyebrow">ACCOUNT RECOVERY</p><h2>Choose a new password</h2></div>{error && <div className="form-message error">{error}</div>}{message && <div className="form-message success">{message}</div>}<form className="auth-form" onSubmit={submit}><div className="form-group"><label>New password</label><input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} /></div><button className="primary-button auth-submit">Update password</button></form></div></div>;
}

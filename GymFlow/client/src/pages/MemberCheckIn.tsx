import { useState } from "react";
import type { FormEvent } from "react";
import { apiFetch } from "../services/api";

export default function MemberCheckIn() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const token = new URLSearchParams(window.location.search).get("token");

  async function handleCheckIn(event: FormEvent) {
    event.preventDefault();

    setSuccess("");
    setError("");

    if (!token) {
      setError("Invalid check-in QR code.");
      return;
    }

    if (!phone.trim()) {
      setError("Please enter your phone number.");
      return;
    }

    try {
      setLoading(true);

      const response = await apiFetch("/api/attendance/qr-check-in", {
        method: "POST",
        body: JSON.stringify({
          token,
          phone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to check in.");
      }

      setSuccess(
        `Welcome ${data.attendance?.member?.name || "back"}! Your check-in was successful.`,
      );

      setPhone("");
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to complete check-in.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="member-checkin-page">
      <div className="member-checkin-card">
        <div className="member-checkin-logo">
          G
        </div>

        <p className="eyebrow">GYMFLOW</p>

        <h1>Member Check-in</h1>

        <p className="member-checkin-subtitle">
          Enter your registered phone number to record today's
          attendance.
        </p>

        {success && (
          <div className="member-checkin-success">
            ✓ {success}
          </div>
        )}

        {error && (
          <div className="member-checkin-error">
            {error}
          </div>
        )}

        {!success && (
          <form onSubmit={handleCheckIn}>
            <label className="member-checkin-label">
              Phone Number

              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Enter your phone number"
                autoComplete="tel"
                disabled={loading}
              />
            </label>

            <button
              type="submit"
              className="primary-button member-checkin-button"
              disabled={loading}
            >
              {loading ? "Checking in..." : "✓ Check In"}
            </button>
          </form>
        )}

        {success && (
          <button
            type="button"
            className="secondary-button member-checkin-button"
            onClick={() => {
              setSuccess("");
              setError("");
            }}
          >
            Done
          </button>
        )}

        <p className="member-checkin-note">
          Your information is only used to verify your gym
          membership and record attendance.
        </p>
      </div>
    </div>
  );
}
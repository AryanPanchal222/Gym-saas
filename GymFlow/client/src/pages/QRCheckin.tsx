import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { apiFetch, getGymId } from "../services/api";

type QRSession = {
  token: string;
  expiresAt: string;
};

export default function QRCheckin() {
  const [session, setSession] = useState<QRSession | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [copied, setCopied] = useState(false);

  const generateQR = useCallback(async () => {
    try {
      setGenerating(true);
      setError("");
      setCopied(false);

      const gymId = getGymId();

      if (!gymId) {
        throw new Error("Gym information is missing");
      }

      const response = await apiFetch(
        `/api/gyms/${gymId}/qr-sessions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            durationMinutes: 5,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to generate QR session",
        );
      }

      const qrSession =
        data.session ?? data.qrSession ?? data;

      if (!qrSession.token || !qrSession.expiresAt) {
        throw new Error("Invalid QR session response");
      }

      setSession({
        token: qrSession.token,
        expiresAt: qrSession.expiresAt,
      });

      const checkInUrl = `${window.location.origin}/check-in?token=${encodeURIComponent(
  qrSession.token,
)}`;

const qrUrl = await QRCode.toDataURL(checkInUrl, {
  width: 320,
  margin: 2,
  errorCorrectionLevel: "M",
});

      setQrDataUrl(qrUrl);

      const expiryTime =
        new Date(qrSession.expiresAt).getTime();

      const remaining = Math.max(
        0,
        Math.floor(
          (expiryTime - Date.now()) / 1000,
        ),
      );

      setSecondsLeft(remaining);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to generate QR code.",
      );

      setSession(null);
      setQrDataUrl("");
      setSecondsLeft(0);
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  }, []);

  useEffect(() => {
    generateQR();
  }, [generateQR]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const interval = window.setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor(
          (new Date(session.expiresAt).getTime() -
            Date.now()) /
            1000,
        ),
      );

      setSecondsLeft(remaining);

      if (remaining === 0) {
        window.clearInterval(interval);
      }
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [session]);

  function formatCountdown(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
      seconds,
    ).padStart(2, "0")}`;
  }

  async function copyToken() {
    if (!session?.token) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        session.token,
      );

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  }

  return (
    <div className="qr-page">

      <div className="page-heading">
        <div>
          <p className="eyebrow">ATTENDANCE</p>

          <h2>QR Check-in</h2>

          <p className="page-subtitle">
            Display this QR code at the gym entrance so
            members can check in quickly.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={generateQR}
          disabled={generating}
        >
          {generating ? "Generating..." : "↻ New QR Code"}
        </button>
      </div>

      {loading ? (
        <div className="qr-card qr-loading">
          <div className="qr-loading-icon">📱</div>

          <h3>Generating QR code...</h3>

          <p>
            Creating a secure check-in session for your
            gym.
          </p>
        </div>
      ) : error ? (
        <div className="qr-card qr-error">
          <div className="qr-error-icon">⚠️</div>

          <h3>Unable to generate QR</h3>

          <p>{error}</p>

          <button
            className="primary-button"
            onClick={generateQR}
            disabled={generating}
          >
            Try Again
          </button>
        </div>
      ) : (
        <div className="qr-layout">

          <div className="qr-card qr-main-card">

            <div className="qr-status">
              <span
                className={
                  secondsLeft > 0
                    ? "status-dot active"
                    : "status-dot expired"
                }
              />

              <span>
                {secondsLeft > 0
                  ? "QR session active"
                  : "QR session expired"}
              </span>
            </div>

            <div className="qr-code-wrapper">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="GymFlow attendance QR code"
                  className="qr-image"
                />
              ) : (
                <div className="qr-placeholder">
                  QR unavailable
                </div>
              )}
            </div>

            <div className="qr-countdown">
              <span>Expires in</span>

              <strong
                className={
                  secondsLeft <= 30
                    ? "countdown-danger"
                    : ""
                }
              >
                {formatCountdown(secondsLeft)}
              </strong>
            </div>

            <p className="qr-help">
              Ask members to scan this code from their
              phone to record today's attendance.
            </p>

            <button
              className="secondary-button qr-regenerate"
              onClick={generateQR}
              disabled={generating}
            >
              Generate Fresh QR
            </button>
          </div>

          <div className="qr-side">

            <div className="qr-card">

              <div className="profile-card-title">
                <div>
                  <h3>How it works</h3>

                  <span>
                    Simple member check-in
                  </span>
                </div>
              </div>

              <div className="qr-steps">

                <div className="qr-step">
                  <div className="qr-step-number">
                    1
                  </div>

                  <div>
                    <strong>Display QR</strong>

                    <p>
                      Keep this QR visible near your
                      gym entrance.
                    </p>
                  </div>
                </div>

                <div className="qr-step">
                  <div className="qr-step-number">
                    2
                  </div>

                  <div>
                    <strong>Member scans</strong>

                    <p>
                      The member scans the QR from their
                      phone.
                    </p>
                  </div>
                </div>

                <div className="qr-step">
                  <div className="qr-step-number">
                    3
                  </div>

                  <div>
                    <strong>Membership verified</strong>

                    <p>
                      GymFlow checks that the member has
                      an active membership.
                    </p>
                  </div>
                </div>

                <div className="qr-step">
                  <div className="qr-step-number">
                    4
                  </div>

                  <div>
                    <strong>Attendance recorded</strong>

                    <p>
                      The check-in appears in attendance
                      history and the dashboard.
                    </p>
                  </div>
                </div>

              </div>
            </div>

            <div className="qr-card">

              <div className="profile-card-title">
                <div>
                  <h3>Session Details</h3>

                  <span>
                    Security information
                  </span>
                </div>
              </div>

              <div className="profile-info-row">
                <span>Status</span>

                <strong>
                  {secondsLeft > 0
                    ? "Active"
                    : "Expired"}
                </strong>
              </div>

              <div className="profile-info-row">
                <span>Session duration</span>

                <strong>5 minutes</strong>
              </div>

              <div className="profile-info-row">
                <span>Expires</span>

                <strong>
                  {session
                    ? new Date(
                        session.expiresAt,
                      ).toLocaleTimeString(
                        "en-IN",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )
                    : "—"}
                </strong>
              </div>

              <div className="qr-token-section">
                <span>Session token</span>

                <div className="qr-token-row">
                  <code>
                    {session?.token
                      ? `${session.token.slice(
                          0,
                          14,
                        )}...`
                      : "—"}
                  </code>

                  <button
                    className="small-button"
                    onClick={copyToken}
                    disabled={!session?.token}
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}
    </div>
  );
}
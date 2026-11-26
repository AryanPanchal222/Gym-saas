import { useEffect, useMemo, useState } from "react";
import { apiFetch, getGymId } from "../services/api";

type NoShowMembership = {
  id: number;
  gymId: number;
  memberId: number;
  planId: number;
  startDate: string;
  endDate: string;
  status: string;
  plan: {
    id: number;
    name: string;
    durationDays: number;
    price: string;
    isActive: boolean;
  };
};

type NoShowCase = {
  id: number;
  memberId: number;
  memberName: string;
  phone: string | null;
  email: string | null;
  lastAttendance: string | null;
  inactiveDays: number;
  status: "OPEN" | "RESOLVED" | "CANCELLED";
  detectedAt: string;
  membership: NoShowMembership | null;
};

type Outcome =
  | "WILL_RETURN"
  | "INJURED"
  | "TRAVELLING"
  | "TIMING_ISSUE"
  | "UNHAPPY"
  | "NO_RESPONSE"
  | "CANCELLED";

type FollowUp = {
  id: number;
  outcome: Outcome;
  notes: string | null;
  nextActionAt: string | null;
  createdAt: string;
};

const outcomes: {
  value: Outcome;
  label: string;
}[] = [
  { value: "WILL_RETURN", label: "Will Return" },
  { value: "INJURED", label: "Injured" },
  { value: "TRAVELLING", label: "Travelling" },
  { value: "TIMING_ISSUE", label: "Timing Issue" },
  { value: "UNHAPPY", label: "Unhappy" },
  { value: "NO_RESPONSE", label: "No Response" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function NoShowRedList() {
  const [noShows, setNoShows] = useState<NoShowCase[]>([]);
  const [thresholdDays, setThresholdDays] = useState(10);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedCase, setSelectedCase] =
    useState<NoShowCase | null>(null);

  const [showFollowUp, setShowFollowUp] =
    useState(false);

  const [outcome, setOutcome] =
    useState<Outcome>("WILL_RETURN");

  const [notes, setNotes] = useState("");
  const [nextActionAt, setNextActionAt] = useState("");

  const [savingFollowUp, setSavingFollowUp] =
    useState(false);

  const [resolving, setResolving] =
    useState(false);

  const [modalError, setModalError] =
    useState("");

  const [modalSuccess, setModalSuccess] =
    useState("");

    const [followUps, setFollowUps] = useState<FollowUp[]>([]);
const [loadingFollowUps, setLoadingFollowUps] = useState(false);

  useEffect(() => {
    loadNoShows();
  }, []);

  async function loadNoShows() {
    try {
      setLoading(true);
      setError("");

      const gymId = getGymId();

      if (!gymId) {
        throw new Error("Gym information is missing");
      }

      const response = await apiFetch(
        `/api/gyms/${gymId}/no-shows`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to load no-show cases"
        );
      }

      setNoShows(data.noShows || []);
      setThresholdDays(data.thresholdDays || 10);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load no-show cases"
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredNoShows = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) {
      return noShows;
    }

    return noShows.filter((item) => {
      return (
        item.memberName.toLowerCase().includes(query) ||
        item.phone?.toLowerCase().includes(query) ||
        item.email?.toLowerCase().includes(query) ||
        item.membership?.plan.name
          .toLowerCase()
          .includes(query)
      );
    });
  }, [noShows, search]);

  function formatDate(date: string | null) {
    if (!date) {
      return "No attendance recorded";
    }

    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function formatDetectedAt(date: string) {
    return new Date(date).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getInitials(name: string) {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  async function openFollowUp(item: NoShowCase) {
  setSelectedCase(item);
  setOutcome("WILL_RETURN");
  setNotes("");
  setNextActionAt("");
  setModalError("");
  setModalSuccess("");
  setFollowUps([]);
  setShowFollowUp(true);

  try {
    setLoadingFollowUps(true);

    const gymId = getGymId();

    if (!gymId) {
      setModalError("Gym information is missing");
      return;
    }

    const response = await apiFetch(
      `/api/gyms/${gymId}/no-shows/${item.id}/follow-ups`,
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Failed to load follow-up history",
      );
    }

    setFollowUps(data.followUps || []);
  } catch (err) {
    console.error(err);

    setModalError(
      err instanceof Error
        ? err.message
        : "Failed to load follow-up history",
    );
  } finally {
    setLoadingFollowUps(false);
  }
}

  function closeFollowUp() {
    if (savingFollowUp || resolving) {
      return;
    }

    setShowFollowUp(false);
    setSelectedCase(null);
    setModalError("");
    setModalSuccess("");
  }

  async function handleSaveFollowUp() {
    if (!selectedCase) {
      return;
    }

    try {
      setSavingFollowUp(true);
      setModalError("");
      setModalSuccess("");

      const gymId = getGymId();

      if (!gymId) {
        setModalError("Gym information is missing");
        return;
      }

      const response = await apiFetch(
        `/api/gyms/${gymId}/no-shows/${selectedCase.id}/follow-ups`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            outcome,
            notes: notes.trim(),
            nextActionAt: nextActionAt
              ? new Date(nextActionAt).toISOString()
              : null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to save follow-up"
        );
      }

      setModalSuccess("Follow-up saved successfully.");

      await loadNoShows();

      setTimeout(() => {
        setShowFollowUp(false);
        setSelectedCase(null);
        setModalSuccess("");
      }, 700);
    } catch (err) {
      setModalError(
        err instanceof Error
          ? err.message
          : "Failed to save follow-up"
      );
    } finally {
      setSavingFollowUp(false);
    }
  }

  async function handleResolveCase() {
    if (!selectedCase) {
      return;
    }

    const confirmed = window.confirm(
      `Resolve the no-show case for ${selectedCase.memberName}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setResolving(true);
      setModalError("");
      setModalSuccess("");

      const gymId = getGymId();

      if (!gymId) {
        setModalError("Gym information is missing");
        return;
      }

      const response = await apiFetch(
        `/api/gyms/${gymId}/no-shows/${selectedCase.id}/resolve`,
        {
          method: "PATCH",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to resolve case"
        );
      }

      setModalSuccess(
        "No-show case resolved successfully."
      );

      await loadNoShows();

      setTimeout(() => {
        setShowFollowUp(false);
        setSelectedCase(null);
        setModalSuccess("");
      }, 700);
    } catch (err) {
      setModalError(
        err instanceof Error
          ? err.message
          : "Failed to resolve case"
      );
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="page no-show-page">

      {/* ================= HEADER ================= */}

      <div className="page-header">

        <div>
          <h1>No-Show Red List</h1>

          <p>
            Members inactive for{" "}
            <strong>{thresholdDays}+ days</strong>.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={loadNoShows}
          disabled={loading}
        >
          ↻ {loading ? "Checking..." : "Refresh"}
        </button>

      </div>

      {/* ================= STATS ================= */}

      <section className="stats-grid">

        <div className="stat-card warning">
          <div className="stat-top">
            <span>Open Cases</span>
            <span className="stat-icon">🚨</span>
          </div>

          <strong>{noShows.length}</strong>

          <p className="neutral">
            Needs attention
          </p>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Threshold</span>
            <span className="stat-icon">📅</span>
          </div>

          <strong>{thresholdDays}</strong>

          <p className="neutral">
            Days of inactivity
          </p>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Longest Inactive</span>
            <span className="stat-icon">⏳</span>
          </div>

          <strong>
            {noShows.length > 0
              ? Math.max(
                  ...noShows.map(
                    (item) => item.inactiveDays
                  )
                )
              : 0}
          </strong>

          <p className="neutral">
            Days
          </p>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>At Risk Members</span>
            <span className="stat-icon">👥</span>
          </div>

          <strong>{noShows.length}</strong>

          <p className="neutral">
            Current open cases
          </p>
        </div>

      </section>

      {error && (
        <div className="form-message error">
          {error}
        </div>
      )}

      {/* ================= CASE LIST ================= */}

      <div className="panel no-show-panel">

        <div className="panel-header">

          <div>
            <h3>Members Needing Follow-up</h3>

            <p>
              Contact members before inactivity becomes churn.
            </p>
          </div>

          <input
            type="text"
            className="search-input"
            placeholder="Search member..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

        </div>

        {loading ? (
          <div className="page-loading">
            Loading no-show cases...
          </div>
        ) : filteredNoShows.length === 0 ? (
          <div className="no-show-empty">

            <div className="no-show-empty-icon">
              ✅
            </div>

            <h3>
              No open no-show cases
            </h3>

            <p>
              Great! No active members currently
              require follow-up.
            </p>

            <span>
              The system checks members after{" "}
              {thresholdDays} days of inactivity.
            </span>

          </div>
        ) : (
          <div className="no-show-list">

            {filteredNoShows.map((item) => (

              <div
                className="no-show-card"
                key={item.id}
              >

                <div className="no-show-member">

                  <div className="no-show-avatar">
                    {getInitials(item.memberName)}
                  </div>

                  <div>
                    <strong>
                      {item.memberName}
                    </strong>

                    {item.phone && (
                      <span>{item.phone}</span>
                    )}

                    {item.email && (
                      <span>{item.email}</span>
                    )}
                  </div>

                </div>

                <div className="no-show-detail">

                  <span>Last attendance</span>

                  <strong>
                    {formatDate(
                      item.lastAttendance
                    )}
                  </strong>

                </div>

                <div className="no-show-detail">

                  <span>Inactive for</span>

                  <strong className="inactive-days">
                    {item.inactiveDays} days
                  </strong>

                </div>

                <div className="no-show-detail">

                  <span>Plan</span>

                  <strong>
                    {item.membership?.plan.name ||
                      "No active plan"}
                  </strong>

                </div>

                <div className="no-show-detail">

                  <span>Status</span>

                  <span className="no-show-status">
                    {item.status}
                  </span>

                </div>

                <div className="no-show-actions">

                  {item.phone && (
                    <>
                      <a
                        className="small-button"
                        href={`tel:${item.phone}`}
                      >
                        📞 Call
                      </a>

                      <a
                        className="small-button"
                        href={`https://wa.me/91${item.phone.replace(
                          /\D/g,
                          ""
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        💬 WhatsApp
                      </a>
                    </>
                  )}

                  <button
                    className="small-button"
                    onClick={() =>
                      openFollowUp(item)
                    }
                  >
                    📝 Follow-up
                  </button>

                </div>

                <div className="no-show-detected">
                  Detected{" "}
                  {formatDetectedAt(
                    item.detectedAt
                  )}
                </div>

              </div>

            ))}

          </div>
        )}

      </div>

      {/* ================= FOLLOW-UP MODAL ================= */}

      {showFollowUp && selectedCase && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closeFollowUp();
            }
          }}
        >

          <div className="modal">

            <div className="modal-header">

              <div>
                <p className="eyebrow">
                  RETENTION
                </p>

                <h3>
                  Follow-up — {selectedCase.memberName}
                </h3>

                <p>
                  Record the conversation and decide
                  the next action.
                </p>
              </div>

              <button
                className="modal-close"
                onClick={closeFollowUp}
                disabled={
                  savingFollowUp || resolving
                }
              >
                ×
              </button>

            </div>

            <div className="member-form">

              {modalError && (
                <div className="form-message error">
                  {modalError}
                </div>
              )}

              {modalSuccess && (
                <div className="form-message success">
                  {modalSuccess}
                </div>
              )}

              {/* Member summary */}

              <div className="follow-up-member-summary">

                <div className="no-show-avatar">
                  {getInitials(
                    selectedCase.memberName
                  )}
                </div>

                <div>
                  <strong>
                    {selectedCase.memberName}
                  </strong>

                  <span>
                    Inactive for{" "}
                    {selectedCase.inactiveDays} days
                  </span>

                  <span>
                    Last attendance:{" "}
                    {formatDate(
                      selectedCase.lastAttendance
                    )}
                  </span>
                </div>

              </div>

              {/* Outcome */}

              <div className="form-group">

                <label>
                  Outcome <span>*</span>
                </label>

                <select
                  value={outcome}
                  onChange={(event) =>
                    setOutcome(
                      event.target.value as Outcome
                    )
                  }
                  disabled={
                    savingFollowUp || resolving
                  }
                >

                  {outcomes.map((item) => (
                    <option
                      key={item.value}
                      value={item.value}
                    >
                      {item.label}
                    </option>
                  ))}

                </select>

              </div>

              {/* Follow-up History */}

<div className="follow-up-history">
  <div className="follow-up-history-header">
    <div>
      <h4>Follow-up History</h4>
      <p>Previous conversations with this member.</p>
    </div>

    <span className="follow-up-count">
      {followUps.length}
    </span>
  </div>

  {loadingFollowUps ? (
    <div className="follow-up-history-empty">
      Loading follow-up history...
    </div>
  ) : followUps.length === 0 ? (
    <div className="follow-up-history-empty">
      No previous follow-ups recorded.
    </div>
  ) : (
    <div className="follow-up-history-list">
      {followUps.map((followUp) => {
        const outcomeLabel =
          outcomes.find(
            (item) => item.value === followUp.outcome,
          )?.label || followUp.outcome;

        return (
          <div
            key={followUp.id}
            className="follow-up-history-item"
          >
            <div className="follow-up-history-top">
              <strong>{outcomeLabel}</strong>

              <span>
                {new Date(
                  followUp.createdAt,
                ).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>

            {followUp.notes && (
              <p className="follow-up-history-notes">
                {followUp.notes}
              </p>
            )}

            {followUp.nextActionAt && (
              <div className="follow-up-next-action">
                Next action:{" "}
                {new Date(
                  followUp.nextActionAt,
                ).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  )}
</div>

              {/* Notes */}

              <div className="form-group">

                <label>
                  Notes
                </label>

                <textarea
                  value={notes}
                  onChange={(event) =>
                    setNotes(event.target.value)
                  }
                  disabled={
                    savingFollowUp || resolving
                  }
                  placeholder="Add notes about the member conversation..."
                  rows={4}
                  className="follow-up-textarea"
                />

              </div>

              {/* Next Action */}

              <div className="form-group">

                <label>
                  Next Action Date
                </label>

                <input
                  type="datetime-local"
                  value={nextActionAt}
                  onChange={(event) =>
                    setNextActionAt(
                      event.target.value
                    )
                  }
                  disabled={
                    savingFollowUp || resolving
                  }
                />

              </div>

              {/* Actions */}

              <div className="modal-actions">

                <button
                  className="secondary-button resolve-button"
                  onClick={handleResolveCase}
                  disabled={
                    savingFollowUp || resolving
                  }
                >
                  {resolving
                    ? "Resolving..."
                    : "✓ Resolve Case"}
                </button>

                <button
                  className="secondary-button"
                  onClick={closeFollowUp}
                  disabled={
                    savingFollowUp || resolving
                  }
                >
                  Cancel
                </button>

                <button
                  className="primary-button"
                  onClick={handleSaveFollowUp}
                  disabled={
                    savingFollowUp || resolving
                  }
                >
                  {savingFollowUp
                    ? "Saving..."
                    : "Save Follow-up"}
                </button>

              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}
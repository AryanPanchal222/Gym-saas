import { useEffect, useMemo, useState } from "react";
import { apiFetch, getGymId } from "../services/api";

type AttendanceRecord = {
  id: number;
  checkedInAt: string;
  method: "QR" | "MANUAL" | "ASSISTED";
  assistedReason: string | null;
  member: {
    id: number;
    name: string;
    phone: string | null;
  };
  membership: {
    plan: {
      name: string;
    };
  } | null;
};

export default function Attendance() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAttendance();
  }, []);

  async function loadAttendance() {
    try {
      setLoading(true);
      setError("");

      const gymId = getGymId();

      if (!gymId) {
        throw new Error("Gym information is missing");
      }

      const response = await apiFetch(
        `/api/gyms/${gymId}/attendance`,
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to load attendance",
        );
      }

      setAttendance(data.attendance || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load attendance",
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredAttendance = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) return attendance;

    return attendance.filter((record) =>
      record.member.name.toLowerCase().includes(query),
    );
  }, [attendance, search]);

  const qrCount = attendance.filter(
    (record) => record.method === "QR",
  ).length;

  const manualCount = attendance.filter(
    (record) => record.method === "MANUAL",
  ).length;

  const assistedCount = attendance.filter(
    (record) => record.method === "ASSISTED",
  ).length;

  function formatDateTime(date: string) {
    return new Date(date).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Attendance</h1>
          <p>Track member check-ins and gym attendance.</p>
        </div>

        <button
          className="primary-button"
          onClick={loadAttendance}
        >
          ↻ Refresh
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span>Total Check-ins</span>
          <strong>{attendance.length}</strong>
        </div>

        <div className="stat-card">
          <span>QR Check-ins</span>
          <strong>{qrCount}</strong>
        </div>

        <div className="stat-card">
          <span>Manual Check-ins</span>
          <strong>{manualCount}</strong>
        </div>

        <div className="stat-card">
          <span>Assisted</span>
          <strong>{assistedCount}</strong>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Check-in History</h2>
            <p>All recorded member attendance.</p>
          </div>

          <input
            type="text"
            placeholder="Search member..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>

        {loading ? (
          <div className="loading-state">
            Loading attendance...
          </div>
        ) : error ? (
          <div className="error-state">{error}</div>
        ) : filteredAttendance.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <h3>No attendance found</h3>
            <p>
              Check-ins will appear here when members attend
              the gym.
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Plan</th>
                  <th>Check-in Time</th>
                  <th>Method</th>
                  <th>Details</th>
                </tr>
              </thead>

              <tbody>
                {filteredAttendance.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <div className="member-cell">
                        <div className="member-avatar">
                          {record.member.name
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <strong>
                            {record.member.name}
                          </strong>

                          {record.member.phone && (
                            <span>{record.member.phone}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td>
                      {record.membership?.plan.name || "—"}
                    </td>

                    <td>
                      {formatDateTime(record.checkedInAt)}
                    </td>

                    <td>
                      <span
                        className={`attendance-badge ${record.method.toLowerCase()}`}
                      >
                        {record.method}
                      </span>
                    </td>

                    <td>
                      {record.method === "ASSISTED"
                        ? record.assistedReason ||
                          "Assisted check-in"
                        : record.method === "QR"
                          ? "QR scan"
                          : "Staff entry"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
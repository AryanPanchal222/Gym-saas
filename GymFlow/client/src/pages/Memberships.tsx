import { useEffect, useMemo, useState } from "react";
import { apiFetch, getGymId } from "../services/api";

type Membership = {
  id: number;
  gymId: number;
  memberId: number;
  planId: number;
  startDate: string;
  endDate: string;
  status: "ACTIVE" | "PAUSED" | "EXPIRED" | "CANCELLED";
  createdAt: string;
  updatedAt: string;
  plan: {
    id: number;
    name: string;
    durationDays: number;
    price: string;
    isActive: boolean;
  };
};

type Member = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  memberships?: Membership[];
};

type MembershipRow = Membership & {
  member: Member;
};

type RenewalOrder = {
  id: number;
  membershipId: number;
  amount: string;
  status:
    | "PENDING"
    | "PAID"
    | "FAILED"
    | "CANCELLED"
    | "REFUNDED";
  paidAt: string | null;
};

type Renewal = {
  membershipId: number;
  member: Member;
  plan: Membership["plan"];
  startDate: string;
  endDate: string;
  status: Membership["status"];
  daysUntilExpiry: number;
  latestRenewalOrder: RenewalOrder | null;
};

type MembershipFilter =
  | "ALL"
  | "ACTIVE"
  | "PAUSED"
  | "EXPIRED"
  | "CANCELLED"
  | "RENEWAL_DUE";

export default function Memberships() {
  const [members, setMembers] = useState<Member[]>([]);
  const [renewals, setRenewals] = useState<Renewal[]>([]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] =
    useState<MembershipFilter>("ALL");

  const [loading, setLoading] = useState(true);
  const [renewalLoading, setRenewalLoading] =
    useState(true);

  const [error, setError] = useState("");
  const [renewalError, setRenewalError] = useState("");

  const [selectedRenewal, setSelectedRenewal] =
    useState<Renewal | null>(null);

  const [renewalOrder, setRenewalOrder] =
    useState<RenewalOrder | null>(null);

  const [renewalActionLoading, setRenewalActionLoading] =
    useState(false);

  const [renewalMessage, setRenewalMessage] =
    useState("");

  useEffect(() => {
    loadMemberships();
    loadRenewals();
  }, []);

  async function loadMemberships() {
    try {
      setLoading(true);
      setError("");

      const gymId = getGymId();

      if (!gymId) {
        throw new Error("Gym information is missing");
      }

      const response = await apiFetch(
        `/api/gyms/${gymId}/members`,
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to load memberships",
        );
      }

      setMembers(data.members || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load memberships",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadRenewals() {
    try {
      setRenewalLoading(true);
      setRenewalError("");

      const gymId = getGymId();

      if (!gymId) {
        throw new Error("Gym information is missing");
      }

      const response = await apiFetch(
        `/api/gyms/${gymId}/renewals`,
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to load renewals",
        );
      }

      setRenewals(data.renewals || []);
    } catch (err) {
      setRenewalError(
        err instanceof Error
          ? err.message
          : "Failed to load renewals",
      );
    } finally {
      setRenewalLoading(false);
    }
  }

  async function createRenewal(
    renewal: Renewal,
  ) {
    try {
      setRenewalActionLoading(true);
      setRenewalError("");
      setRenewalMessage("");

      const gymId = getGymId();

      if (!gymId) {
        throw new Error("Gym information is missing");
      }

      const response = await apiFetch(
        `/api/gyms/${gymId}/renewals`,
        {
          method: "POST",
          body: JSON.stringify({
            membershipId: renewal.membershipId,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to create renewal",
        );
      }

      setRenewalOrder(data.renewalOrder);

      setRenewalMessage(
        "Renewal order created successfully.",
      );

      await loadRenewals();
    } catch (err) {
      setRenewalError(
        err instanceof Error
          ? err.message
          : "Failed to create renewal",
      );
    } finally {
      setRenewalActionLoading(false);
    }
  }

  async function markRenewalPaid(
    order: RenewalOrder,
  ) {
    try {
      setRenewalActionLoading(true);
      setRenewalError("");
      setRenewalMessage("");

      const gymId = getGymId();

      if (!gymId) {
        throw new Error("Gym information is missing");
      }

      const response = await apiFetch(
        `/api/gyms/${gymId}/renewals/${order.id}/mark-paid`,
        {
          method: "POST",
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to process payment",
        );
      }

      setRenewalMessage(
        data.message ||
          "Renewal payment successful.",
      );

      setRenewalOrder(null);
      setSelectedRenewal(null);

      await Promise.all([
        loadMemberships(),
        loadRenewals(),
      ]);
    } catch (err) {
      setRenewalError(
        err instanceof Error
          ? err.message
          : "Failed to process payment",
      );
    } finally {
      setRenewalActionLoading(false);
    }
  }

  const membershipRows = useMemo<MembershipRow[]>(
    () => {
      return members.flatMap((member) =>
        (member.memberships || []).map(
          (membership) => ({
            ...membership,
            member,
          }),
        ),
      );
    },
    [members],
  );

  const renewalMembershipIds = useMemo(
    () =>
      new Set(
        renewals.map(
          (renewal) => renewal.membershipId,
        ),
      ),
    [renewals],
  );

  const filteredMemberships = useMemo(() => {
    const query = search.toLowerCase().trim();

    return membershipRows.filter((membership) => {
      const matchesFilter =
        filter === "ALL"
          ? true
          : filter === "RENEWAL_DUE"
            ? renewalMembershipIds.has(
                membership.id,
              )
            : membership.status === filter;

      const matchesSearch =
        !query ||
        membership.member.name
          .toLowerCase()
          .includes(query) ||
        membership.member.phone
          ?.toLowerCase()
          .includes(query) ||
        membership.member.email
          ?.toLowerCase()
          .includes(query) ||
        membership.plan.name
          .toLowerCase()
          .includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [
    membershipRows,
    search,
    filter,
    renewalMembershipIds,
  ]);

  const activeCount = membershipRows.filter(
    (item) => item.status === "ACTIVE",
  ).length;

  const pausedCount = membershipRows.filter(
    (item) => item.status === "PAUSED",
  ).length;

  const expiredCount = membershipRows.filter(
    (item) => item.status === "EXPIRED",
  ).length;

  const cancelledCount = membershipRows.filter(
    (item) => item.status === "CANCELLED",
  ).length;

  const renewalDueCount = renewals.length;

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString(
      "en-IN",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      },
    );
  }

  function formatPrice(price: string) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(price));
  }

  function getInitials(name: string) {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  function getRenewalForMembership(
    membershipId: number,
  ) {
    return renewals.find(
      (renewal) =>
        renewal.membershipId === membershipId,
    );
  }

  function openRenewal(renewal: Renewal) {
    setSelectedRenewal(renewal);
    setRenewalOrder(
      renewal.latestRenewalOrder?.status ===
        "PENDING"
        ? renewal.latestRenewalOrder
        : null,
    );
    setRenewalError("");
    setRenewalMessage("");
  }

  function closeRenewalModal() {
    if (renewalActionLoading) return;

    setSelectedRenewal(null);
    setRenewalOrder(null);
    setRenewalError("");
    setRenewalMessage("");
  }

  return (
    <div className="page memberships-page">
      {/* ================= HEADER ================= */}

      <div className="page-header">
        <div>
          <h1>Memberships</h1>

          <p>
            Manage member plans, dates, and
            membership status.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={() => {
            loadMemberships();
            loadRenewals();
          }}
          disabled={loading || renewalLoading}
        >
          ↻{" "}
          {loading || renewalLoading
            ? "Loading..."
            : "Refresh"}
        </button>
      </div>

      {/* ================= STATS ================= */}

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-top">
            <span>Total Memberships</span>
            <span className="stat-icon">
              💳
            </span>
          </div>

          <strong>{membershipRows.length}</strong>

          <p className="neutral">
            All records
          </p>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Active</span>
            <span className="stat-icon">
              ✅
            </span>
          </div>

          <strong>{activeCount}</strong>

          <p className="positive">
            Currently active
          </p>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Renewal Due</span>
            <span className="stat-icon">
              🔔
            </span>
          </div>

          <strong>{renewalDueCount}</strong>

          <p className="neutral">
            Due within 14 days
          </p>
        </div>

        <div className="stat-card warning">
          <div className="stat-top">
            <span>Expired</span>
            <span className="stat-icon">
              ⏳
            </span>
          </div>

          <strong>{expiredCount}</strong>

          <p className="negative">
            Renewal may be needed
          </p>
        </div>
      </section>

      {/* ================= MAIN PANEL ================= */}

      <div className="panel memberships-panel">
        <div className="panel-header">
          <div>
            <h3>Membership Records</h3>

            <p>
              Plans currently assigned to
              members.
            </p>
          </div>

          <input
            type="text"
            className="search-input"
            placeholder="Search member or plan..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        {/* ================= FILTERS ================= */}

        <div className="membership-filters">
          <button
            className={
              filter === "ALL"
                ? "membership-filter active"
                : "membership-filter"
            }
            onClick={() => setFilter("ALL")}
          >
            All ({membershipRows.length})
          </button>

          <button
            className={
              filter === "ACTIVE"
                ? "membership-filter active"
                : "membership-filter"
            }
            onClick={() =>
              setFilter("ACTIVE")
            }
          >
            Active ({activeCount})
          </button>

          <button
            className={
              filter === "RENEWAL_DUE"
                ? "membership-filter active"
                : "membership-filter"
            }
            onClick={() =>
              setFilter("RENEWAL_DUE")
            }
          >
            🔔 Renewal Due ({renewalDueCount})
          </button>

          <button
            className={
              filter === "PAUSED"
                ? "membership-filter active"
                : "membership-filter"
            }
            onClick={() =>
              setFilter("PAUSED")
            }
          >
            Paused ({pausedCount})
          </button>

          <button
            className={
              filter === "EXPIRED"
                ? "membership-filter active"
                : "membership-filter"
            }
            onClick={() =>
              setFilter("EXPIRED")
            }
          >
            Expired ({expiredCount})
          </button>

          <button
            className={
              filter === "CANCELLED"
                ? "membership-filter active"
                : "membership-filter"
            }
            onClick={() =>
              setFilter("CANCELLED")
            }
          >
            Cancelled ({cancelledCount})
          </button>
        </div>

        {/* ================= ERRORS ================= */}

        {error && (
          <div className="form-message error">
            {error}
          </div>
        )}

        {renewalError && !selectedRenewal && (
          <div className="form-message error">
            {renewalError}
          </div>
        )}

        {renewalMessage &&
          !selectedRenewal && (
            <div className="form-message success">
              {renewalMessage}
            </div>
          )}

        {/* ================= TABLE ================= */}

        {loading ? (
          <div className="page-loading">
            Loading memberships...
          </div>
        ) : filteredMemberships.length ===
          0 ? (
          <div className="membership-empty">
            <div>💳</div>

            <h3>
              No memberships found
            </h3>

            <p>
              No membership records match
              your current search or filter.
            </p>
          </div>
        ) : (
          <div className="membership-table-wrapper">
            <table className="membership-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Plan</th>
                  <th>Price</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                  <th>Renewal</th>
                </tr>
              </thead>

              <tbody>
                {filteredMemberships.map(
                  (membership) => {
                    const renewal =
                      getRenewalForMembership(
                        membership.id,
                      );

                    const pendingOrder =
                      renewal?.latestRenewalOrder
                        ?.status === "PENDING"
                        ? renewal.latestRenewalOrder
                        : null;

                    return (
                      <tr
                        key={membership.id}
                      >
                        <td>
                          <div className="membership-member">
                            <div className="membership-avatar">
                              {getInitials(
                                membership
                                  .member
                                  .name,
                              )}
                            </div>

                            <div>
                              <strong>
                                {
                                  membership
                                    .member
                                    .name
                                }
                              </strong>

                              <span>
                                {membership
                                  .member
                                  .phone ||
                                  membership
                                    .member
                                    .email ||
                                  "No contact information"}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="membership-plan-cell">
                            <strong>
                              {
                                membership.plan
                                  .name
                              }
                            </strong>

                            <span>
                              {
                                membership.plan
                                  .durationDays
                              }{" "}
                              days
                            </span>
                          </div>
                        </td>

                        <td>
                          <strong>
                            {formatPrice(
                              membership
                                .plan.price,
                            )}
                          </strong>
                        </td>

                        <td>
                          {formatDate(
                            membership.startDate,
                          )}
                        </td>

                        <td>
                          <div>
                            {formatDate(
                              membership.endDate,
                            )}

                            {renewal && (
                              <small
                                style={{
                                  display:
                                    "block",
                                  marginTop:
                                    "4px",
                                  opacity: 0.7,
                                }}
                              >
                                {renewal
                                  .daysUntilExpiry <
                                0
                                  ? `${Math.abs(
                                      renewal.daysUntilExpiry,
                                    )} days expired`
                                  : renewal.daysUntilExpiry ===
                                      0
                                    ? "Expires today"
                                    : `${renewal.daysUntilExpiry} days left`}
                              </small>
                            )}
                          </div>
                        </td>

                        <td>
                          <span
                            className={`membership-status ${membership.status.toLowerCase()}`}
                          >
                            {membership.status}
                          </span>
                        </td>

                        <td>
                          {renewal ? (
                            pendingOrder ? (
                              <button
                                className="primary-button"
                                onClick={() =>
                                  openRenewal(
                                    renewal,
                                  )
                                }
                              >
                                💳 Pending
                              </button>
                            ) : (
                              <button
                                className="primary-button"
                                onClick={() =>
                                  openRenewal(
                                    renewal,
                                  )
                                }
                              >
                                🔄 Renew
                              </button>
                            )
                          ) : (
                            <span
                              style={{
                                opacity: 0.5,
                              }}
                            >
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================= RENEWAL MODAL ================= */}

      {selectedRenewal && (
        <div
          className="modal-backdrop"
          onClick={closeRenewalModal}
        >
          <div
            className="modal-card"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <h2>
                  Renew Membership
                </h2>

                <p>
                  Create and process a
                  membership renewal.
                </p>
              </div>

              <button
                className="icon-button"
                onClick={closeRenewalModal}
                disabled={
                  renewalActionLoading
                }
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              {/* Member */}

              <div className="membership-member">
                <div className="membership-avatar">
                  {getInitials(
                    selectedRenewal
                      .member.name,
                  )}
                </div>

                <div>
                  <strong>
                    {
                      selectedRenewal
                        .member.name
                    }
                  </strong>

                  <span>
                    {
                      selectedRenewal
                        .member.phone
                    }
                  </span>
                </div>
              </div>

              {/* Renewal details */}

              <div
                className="renewal-summary"
                style={{
                  marginTop: "20px",
                  display: "grid",
                  gap: "12px",
                }}
              >
                <div>
                  <span>Plan</span>
                  <strong>
                    {
                      selectedRenewal
                        .plan.name
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Current Expiry
                  </span>
                  <strong>
                    {formatDate(
                      selectedRenewal
                        .endDate,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Duration</span>
                  <strong>
                    {
                      selectedRenewal
                        .plan.durationDays
                    }{" "}
                    days
                  </strong>
                </div>

                <div>
                  <span>Renewal Amount</span>
                  <strong>
                    {formatPrice(
                      selectedRenewal
                        .plan.price,
                    )}
                  </strong>
                </div>
              </div>

              {/* Messages */}

              {renewalError && (
                <div
                  className="form-message error"
                  style={{
                    marginTop: "16px",
                  }}
                >
                  {renewalError}
                </div>
              )}

              {renewalMessage && (
                <div
                  className="form-message success"
                  style={{
                    marginTop: "16px",
                  }}
                >
                  {renewalMessage}
                </div>
              )}

              {/* Pending order */}

              {renewalOrder ? (
                <div
                  className="renewal-order-box"
                  style={{
                    marginTop: "20px",
                    padding: "16px",
                    borderRadius:
                      "12px",
                    border:
                      "1px solid var(--border-color, #ddd)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      gap: "12px",
                      alignItems:
                        "center",
                    }}
                  >
                    <div>
                      <strong>
                        Renewal Order #
                        {
                          renewalOrder.id
                        }
                      </strong>

                      <span
                        style={{
                          display:
                            "block",
                          marginTop:
                            "4px",
                          opacity: 0.7,
                        }}
                      >
                        {
                          renewalOrder
                            .status
                        }
                      </span>
                    </div>

                    <strong>
                      {formatPrice(
                        renewalOrder
                          .amount,
                      )}
                    </strong>
                  </div>

                  <button
                    className="primary-button"
                    style={{
                      width: "100%",
                      marginTop: "16px",
                    }}
                    onClick={() =>
                      markRenewalPaid(
                        renewalOrder,
                      )
                    }
                    disabled={
                      renewalActionLoading
                    }
                  >
                    {renewalActionLoading
                      ? "Processing..."
                      : "✓ Mark Paid"}
                  </button>

                  <p
                    style={{
                      marginTop:
                        "10px",
                      fontSize:
                        "12px",
                      opacity: 0.65,
                    }}
                  >
                    Development mode:
                    this simulates a
                    verified successful
                    payment.
                  </p>
                </div>
              ) : (
                <button
                  className="primary-button"
                  style={{
                    width: "100%",
                    marginTop: "20px",
                  }}
                  onClick={() =>
                    createRenewal(
                      selectedRenewal,
                    )
                  }
                  disabled={
                    renewalActionLoading
                  }
                >
                  {renewalActionLoading
                    ? "Creating..."
                    : `Create Renewal • ${formatPrice(
                        selectedRenewal
                          .plan.price,
                      )}`}
                </button>
              )}
            </div>

            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={closeRenewalModal}
                disabled={
                  renewalActionLoading
                }
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
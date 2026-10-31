import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, getGymId } from "../services/api";

type Member = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  createdAt?: string;
  memberships?: Membership[];
  attendances?: Attendance[];
};

type Membership = {
  id: number;
  status: "ACTIVE" | "PAUSED" | "EXPIRED" | "CANCELLED";
  startDate: string;
  endDate: string;
  plan: {
    name: string;
    price: string;
  };
};

type Attendance = {
  id: number;
  checkedInAt: string;
  method: "QR" | "MANUAL" | "ASSISTED";
  assistedReason: string | null;
  membership?: {
    plan: {
      name: string;
    };
  };
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getMembership(member: Member) {
  if (!member.memberships || member.memberships.length === 0) {
    return null;
  }

  return (
    member.memberships.find(
      (membership) => membership.status === "ACTIVE",
    ) ?? member.memberships[0]
  );
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateString: string) {
  return new Date(dateString).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Members() {
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedMemberId, setSelectedMemberId] =
    useState<number | null>(null);

  const [selectedMember, setSelectedMember] =
    useState<Member | null>(null);

  const [profileLoading, setProfileLoading] =
    useState(false);

  const [profileError, setProfileError] =
    useState("");

  const [showAddMember, setShowAddMember] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [showMembershipModal, setShowMembershipModal] =
    useState(false);

  const [plans, setPlans] = useState<
    {
      id: number;
      name: string;
      durationDays: number;
      price: string;
    }[]
  >([]);

  const [selectedPlanId, setSelectedPlanId] =
    useState("");

  const [membershipStartDate, setMembershipStartDate] =
    useState("");

  const [membershipSaving, setMembershipSaving] =
    useState(false);

  const [membershipError, setMembershipError] =
    useState("");

  const [membershipSuccess, setMembershipSuccess] =
    useState("");

  const loadMembers = useCallback(async () => {
    try {
      setError("");

      const gymId = getGymId();

      if (!gymId) {
        throw new Error("Gym information is missing");
      }

      const response = await apiFetch(
        `/api/gyms/${gymId}/members`,
      );

      if (!response.ok) {
        throw new Error("Failed to load members");
      }

      const data = await response.json();

      setMembers(data.members ?? []);
    } catch (err) {
      console.error(err);
      setError("Unable to load members.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const membership = getMembership(member);

      const searchValue = search.toLowerCase().trim();

      const matchesSearch =
        member.name.toLowerCase().includes(searchValue) ||
        member.email?.toLowerCase().includes(searchValue) ||
        member.phone?.includes(searchValue);

      const matchesFilter =
        filter === "ALL" ||
        membership?.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [members, search, filter]);

  async function openMemberProfile(memberId: number) {
    setSelectedMemberId(memberId);
    setSelectedMember(null);
    setProfileError("");
    setProfileLoading(true);

    try {
      const gymId = getGymId();

      if (!gymId) {
        throw new Error("Gym information is missing");
      }

      const response = await apiFetch(
        `/api/gyms/${gymId}/members/${memberId}`,
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to load member profile",
        );
      }

      setSelectedMember(data.member);
    } catch (err) {
      console.error(err);

      setProfileError(
        err instanceof Error
          ? err.message
          : "Unable to load member profile.",
      );
    } finally {
      setProfileLoading(false);
    }
  }

  function closeMemberProfile() {
    setSelectedMemberId(null);
    setSelectedMember(null);
    setProfileError("");
  }

  function openAddMember() {
    setName("");
    setPhone("");
    setEmail("");
    setFormError("");
    setSuccessMessage("");
    setShowAddMember(true);
  }

  function closeAddMember() {
    if (saving) {
      return;
    }

    setShowAddMember(false);
    setFormError("");
  }

  async function handleAddMember(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setFormError("");
    setSuccessMessage("");

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setFormError("Member name is required.");
      return;
    }

    if (trimmedName.length < 2) {
      setFormError(
        "Member name must be at least 2 characters.",
      );
      return;
    }

    if (
      trimmedPhone &&
      !/^[0-9+\-\s()]{7,20}$/.test(trimmedPhone)
    ) {
      setFormError("Please enter a valid phone number.");
      return;
    }

    if (
      trimmedEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        trimmedEmail,
      )
    ) {
      setFormError(
        "Please enter a valid email address.",
      );
      return;
    }

    try {
      setSaving(true);

      const gymId = getGymId();

      if (!gymId) {
        throw new Error("Gym information is missing");
      }

      const response = await apiFetch(
        `/api/gyms/${gymId}/members`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: trimmedName,
            phone: trimmedPhone || null,
            email: trimmedEmail || null,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to create member",
        );
      }

      setSuccessMessage(
        "Member added successfully! 🎉",
      );

      setName("");
      setPhone("");
      setEmail("");

      await loadMembers();

      setTimeout(() => {
        setShowAddMember(false);
        setSuccessMessage("");
      }, 900);
    } catch (err) {
      console.error(err);

      setFormError(
        err instanceof Error
          ? err.message
          : "Failed to create member.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function loadPlans() {
    try {
      setMembershipError("");

      const gymId = getGymId();

      if (!gymId) {
        throw new Error("Gym information is missing");
      }

      const response = await apiFetch(
        `/api/gyms/${gymId}/plans`,
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to load plans",
        );
      }

      setPlans(data.plans ?? []);
    } catch (err) {
      console.error(err);

      setMembershipError(
        err instanceof Error
          ? err.message
          : "Unable to load plans.",
      );
    }
  }

  function openMembershipModal() {
    setSelectedPlanId("");

    setMembershipStartDate(
      new Date().toISOString().split("T")[0],
    );

    setMembershipError("");
    setMembershipSuccess("");
    setShowMembershipModal(true);

    loadPlans();
  }

  function closeMembershipModal() {
    if (membershipSaving) {
      return;
    }

    setShowMembershipModal(false);
    setMembershipError("");
  }

  async function handleAssignMembership(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedMember) {
      return;
    }

    if (!selectedPlanId) {
      setMembershipError("Please select a plan.");
      return;
    }

    if (!membershipStartDate) {
      setMembershipError("Please select a start date.");
      return;
    }

    try {
      setMembershipSaving(true);
      setMembershipError("");
      setMembershipSuccess("");

      const gymId = getGymId();

      if (!gymId) {
        throw new Error("Gym information is missing");
      }

      const response = await apiFetch(
        `/api/gyms/${gymId}/members/${selectedMember.id}/memberships`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            planId: Number(selectedPlanId),
            startDate: membershipStartDate,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to assign membership",
        );
      }

      setMembershipSuccess(
        "Membership assigned successfully! 🎉",
      );

      await loadMembers();

      await openMemberProfile(selectedMember.id);

      setTimeout(() => {
        setShowMembershipModal(false);
        setMembershipSuccess("");
      }, 900);
    } catch (err) {
      console.error(err);

      setMembershipError(
        err instanceof Error
          ? err.message
          : "Failed to assign membership.",
      );
    } finally {
      setMembershipSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page-loading">
        Loading members...
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-error">
        <h3>Unable to load members</h3>
        <p>{error}</p>
      </div>
    );
  }

  /* ================= MEMBER PROFILE ================= */

  if (selectedMemberId !== null) {
    const membership = selectedMember
      ? getMembership(selectedMember)
      : null;

    return (
      <div className="member-profile-page">
        <button
          className="back-button"
          onClick={closeMemberProfile}
        >
          ← Back to Members
        </button>

        {profileLoading && (
          <div className="profile-loading">
            Loading member profile...
          </div>
        )}

        {profileError && (
          <div className="profile-error">
            <h3>Unable to load profile</h3>
            <p>{profileError}</p>

            <button
              className="secondary-button"
              onClick={() =>
                openMemberProfile(selectedMemberId)
              }
            >
              Try Again
            </button>
          </div>
        )}

        {selectedMember && !profileLoading && (
          <>
            {/* Profile Header */}

            <div className="profile-header-card">
              <div className="profile-member-main">
                <div className="profile-avatar-large">
                  {getInitials(selectedMember.name)}
                </div>

                <div>
                  <p className="eyebrow">
                    MEMBER PROFILE
                  </p>

                  <h2>
                    {selectedMember.name}
                  </h2>

                  <span>
                    Member #{selectedMember.id}
                  </span>
                </div>
              </div>

              {membership && (
                <span
                  className={`status-badge ${membership.status.toLowerCase()}`}
                >
                  {membership.status}
                </span>
              )}
            </div>

            {/* Contact */}

            <div className="profile-grid">
              <div className="profile-card">
                <div className="profile-card-title">
                  <h3>Contact Information</h3>
                  <span>Member details</span>
                </div>

                <div className="profile-info-row">
                  <span>Phone</span>

                  <strong>
                    {selectedMember.phone ||
                      "No phone"}
                  </strong>
                </div>

                <div className="profile-info-row">
                  <span>Email</span>

                  <strong>
                    {selectedMember.email ||
                      "No email"}
                  </strong>
                </div>

                <div className="profile-info-row">
                  <span>Member since</span>

                  <strong>
                    {formatDate(
                      selectedMember.createdAt ??
                        new Date().toISOString(),
                    )}
                  </strong>
                </div>
              </div>

              {/* Membership */}

              <div className="profile-card">
                <div className="profile-card-title">
                  <h3>Membership</h3>

                  <span>
                    Current membership
                  </span>
                </div>

                {membership ? (
                  <>
                    <div className="membership-plan">
                      <div>
                        <strong>
                          {membership.plan.name}
                        </strong>

                        <span>
                          ₹{membership.plan.price}
                        </span>
                      </div>

                      <span
                        className={`status-badge ${membership.status.toLowerCase()}`}
                      >
                        {membership.status}
                      </span>
                    </div>

                    <div className="profile-info-row">
                      <span>Start date</span>

                      <strong>
                        {formatDate(
                          membership.startDate,
                        )}
                      </strong>
                    </div>

                    <div className="profile-info-row">
                      <span>End date</span>

                      <strong>
                        {formatDate(
                          membership.endDate,
                        )}
                      </strong>
                    </div>
                  </>
                ) : (
                  <div className="no-membership">
                    <div>💳</div>

                    <h4>
                      No active membership
                    </h4>

                    <p>
                      This member doesn't have a
                      membership yet.
                    </p>

                    <button
                      className="primary-button"
                      onClick={openMembershipModal}
                    >
                      + Assign Membership
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Attendance */}

            <div className="profile-card attendance-history">
              <div className="profile-card-title">
                <div>
                  <h3>Attendance History</h3>

                  <span>
                    {selectedMember.attendances
                      ?.length ?? 0}{" "}
                    total check-ins
                  </span>
                </div>
              </div>

              {!selectedMember.attendances ||
              selectedMember.attendances.length ===
                0 ? (
                <div className="no-attendance">
                  <div>📅</div>

                  <h4>No attendance yet</h4>

                  <p>
                    Attendance records will
                    appear here after check-in.
                  </p>
                </div>
              ) : (
                <div className="profile-attendance-list">
                  {selectedMember.attendances.map(
                    (attendance) => (
                      <div
                        className="profile-attendance-row"
                        key={attendance.id}
                      >
                        <div className="attendance-date-icon">
                          📅
                        </div>

                        <div>
                          <strong>
                            {formatDateTime(
                              attendance.checkedInAt,
                            )}
                          </strong>

                          <span>
                            {attendance.membership
                              ?.plan?.name ||
                              "Membership"}
                          </span>
                        </div>

                        <span
                          className={
                            attendance.method ===
                            "QR"
                              ? "qr-badge"
                              : "manual-badge"
                          }
                        >
                          {attendance.method}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ================= ASSIGN MEMBERSHIP MODAL ================= */}

        {showMembershipModal && selectedMember && (
          <div
            className="modal-overlay"
            onMouseDown={(event) => {
              if (
                event.target === event.currentTarget
              ) {
                closeMembershipModal();
              }
            }}
          >
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="assign-membership-title"
            >
              <div className="modal-header">
                <div>
                  <p className="eyebrow">
                    MEMBERSHIP
                  </p>

                  <h3 id="assign-membership-title">
                    Assign Membership
                  </h3>

                  <p>
                    Assign a plan to{" "}
                    <strong>
                      {selectedMember.name}
                    </strong>
                    .
                  </p>
                </div>

                <button
                  className="modal-close"
                  onClick={closeMembershipModal}
                  disabled={membershipSaving}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <form
                className="member-form"
                onSubmit={handleAssignMembership}
              >
                <div className="form-group">
                  <label htmlFor="membership-plan">
                    Plan <span>*</span>
                  </label>

                  <select
                    id="membership-plan"
                    value={selectedPlanId}
                    onChange={(event) =>
                      setSelectedPlanId(
                        event.target.value,
                      )
                    }
                    disabled={membershipSaving}
                  >
                    <option value="">
                      Select a plan
                    </option>

                    {plans.map((plan) => (
                      <option
                        key={plan.id}
                        value={plan.id}
                      >
                        {plan.name} — ₹{plan.price}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedPlanId && (
                  <div className="plan-preview">
                    {(() => {
                      const selectedPlan =
                        plans.find(
                          (plan) =>
                            plan.id ===
                            Number(selectedPlanId),
                        );

                      if (!selectedPlan) {
                        return null;
                      }

                      return (
                        <>
                          <div>
                            <span>
                              Plan price
                            </span>

                            <strong>
                              ₹{selectedPlan.price}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Duration
                            </span>

                            <strong>
                              {
                                selectedPlan.durationDays
                              }{" "}
                              days
                            </strong>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="membership-start-date">
                    Start Date <span>*</span>
                  </label>

                  <input
                    id="membership-start-date"
                    type="date"
                    value={membershipStartDate}
                    onChange={(event) =>
                      setMembershipStartDate(
                        event.target.value,
                      )
                    }
                    disabled={membershipSaving}
                  />
                </div>

                {selectedPlanId &&
                  membershipStartDate && (
                    <div className="membership-end-preview">
                      {(() => {
                        const selectedPlan =
                          plans.find(
                            (plan) =>
                              plan.id ===
                              Number(selectedPlanId),
                          );

                        if (!selectedPlan) {
                          return null;
                        }

                        const endDate = new Date(
                          membershipStartDate,
                        );

                        endDate.setDate(
                          endDate.getDate() +
                            selectedPlan.durationDays,
                        );

                        return (
                          <>
                            <span>
                              Membership end date
                            </span>

                            <strong>
                              {endDate.toLocaleDateString(
                                "en-IN",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                },
                              )}
                            </strong>
                          </>
                        );
                      })()}
                    </div>
                  )}

                {membershipError && (
                  <div className="form-message error">
                    {membershipError}
                  </div>
                )}

                {membershipSuccess && (
                  <div className="form-message success">
                    {membershipSuccess}
                  </div>
                )}

                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={closeMembershipModal}
                    disabled={membershipSaving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={
                      membershipSaving ||
                      plans.length === 0
                    }
                  >
                    {membershipSaving
                      ? "Assigning..."
                      : "Assign Membership"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ================= MEMBERS LIST ================= */

  return (
    <>
      <div className="members-page">
        <div className="page-heading">
          <div>
            <p className="eyebrow">MEMBERS</p>

            <h2>Members</h2>

            <p className="page-subtitle">
              Manage your gym members and memberships.
            </p>
          </div>

          <button
            className="primary-button"
            onClick={openAddMember}
          >
            + Add Member
          </button>
        </div>

        <div className="members-toolbar">
          <div className="search-box">
            <span>🔍</span>

            <input
              type="text"
              placeholder="Search by name, email or phone..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <div className="filter-buttons">
            <button
              className={
                filter === "ALL"
                  ? "filter active"
                  : "filter"
              }
              onClick={() => setFilter("ALL")}
            >
              All
            </button>

            <button
              className={
                filter === "ACTIVE"
                  ? "filter active"
                  : "filter"
              }
              onClick={() => setFilter("ACTIVE")}
            >
              Active
            </button>

            <button
              className={
                filter === "PAUSED"
                  ? "filter active"
                  : "filter"
              }
              onClick={() => setFilter("PAUSED")}
            >
              Paused
            </button>

            <button
              className={
                filter === "EXPIRED"
                  ? "filter active"
                  : "filter"
              }
              onClick={() => setFilter("EXPIRED")}
            >
              Expired
            </button>
          </div>
        </div>

        <div className="members-card">
          <div className="members-card-header">
            <div>
              <strong>
                {filteredMembers.length} Members
              </strong>

              <span>
                Showing registered gym members
              </span>
            </div>
          </div>

          {filteredMembers.length === 0 ? (
            <div className="members-empty">
              <div>👥</div>

              <h3>No members found</h3>

              <p>
                Try changing your search or filter.
              </p>
            </div>
          ) : (
            <div className="members-table">
              <div className="member-table-header">
                <span>MEMBER</span>
                <span>CONTACT</span>
                <span>PLAN</span>
                <span>STATUS</span>
                <span>MEMBERSHIP END</span>
                <span></span>
              </div>

              {filteredMembers.map((member) => {
                const membership =
                  getMembership(member);

                return (
                  <div
                    className="member-table-row"
                    key={member.id}
                  >
                    <div className="member-cell member-main">
                      <div className="member-avatar">
                        {getInitials(member.name)}
                      </div>

                      <div>
                        <strong>
                          {member.name}
                        </strong>

                        <span>
                          Member #{member.id}
                        </span>
                      </div>
                    </div>

                    <div className="member-cell contact-cell">
                      <strong>
                        {member.phone ||
                          "No phone"}
                      </strong>

                      <span>
                        {member.email ||
                          "No email"}
                      </span>
                    </div>

                    <div className="member-cell">
                      <strong>
                        {membership?.plan?.name ||
                          "No plan"}
                      </strong>

                      {membership?.plan?.price && (
                        <span>
                          ₹{membership.plan.price}
                        </span>
                      )}
                    </div>

                    <div className="member-cell">
                      {membership ? (
                        <span
                          className={`status-badge ${membership.status.toLowerCase()}`}
                        >
                          {membership.status}
                        </span>
                      ) : (
                        <span className="status-badge none">
                          NO MEMBERSHIP
                        </span>
                      )}
                    </div>

                    <div className="member-cell">
                      <strong>
                        {membership
                          ? formatDate(
                              membership.endDate,
                            )
                          : "—"}
                      </strong>
                    </div>

                    <div className="member-cell">
                      <button
                        className="view-button"
                        onClick={() =>
                          openMemberProfile(
                            member.id,
                          )
                        }
                      >
                        View
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ================= ADD MEMBER MODAL ================= */}

      {showAddMember && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeAddMember();
            }
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-member-title"
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">
                  MEMBERS
                </p>

                <h3 id="add-member-title">
                  Add New Member
                </h3>

                <p>
                  Create a new member profile for
                  your gym.
                </p>
              </div>

              <button
                className="modal-close"
                onClick={closeAddMember}
                disabled={saving}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form
              className="member-form"
              onSubmit={handleAddMember}
            >
              <div className="form-group">
                <label htmlFor="member-name">
                  Full Name
                  <span>*</span>
                </label>

                <input
                  id="member-name"
                  type="text"
                  placeholder="e.g. Aryan Sharma"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  disabled={saving}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="member-phone">
                  Phone
                </label>

                <input
                  id="member-phone"
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(event) =>
                    setPhone(event.target.value)
                  }
                  disabled={saving}
                />
              </div>

              <div className="form-group">
                <label htmlFor="member-email">
                  Email
                </label>

                <input
                  id="member-email"
                  type="email"
                  placeholder="e.g. member@example.com"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  disabled={saving}
                />
              </div>

              {formError && (
                <div className="form-message error">
                  {formError}
                </div>
              )}

              {successMessage && (
                <div className="form-message success">
                  {successMessage}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeAddMember}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Adding..."
                    : "Add Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
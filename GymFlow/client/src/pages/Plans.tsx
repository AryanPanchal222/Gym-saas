import { useEffect, useMemo, useState } from "react";
import { apiFetch, getGymId } from "../services/api";

type Plan = {
  id: number;
  gymId: number;
  name: string;
  durationDays: number;
  price: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function Plans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);

  const [name, setName] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [price, setPrice] = useState("");

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    try {
      setLoading(true);
      setError("");

      const gymId = getGymId();

      if (!gymId) {
        throw new Error("Gym information is missing");
      }

      const response = await apiFetch(
        `/api/gyms/${gymId}/plans`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to load plans"
        );
      }

      setPlans(data.plans || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load plans"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePlan(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Plan name is required.");
      return;
    }

    const days = Number(durationDays);
    const amount = Number(price);

    if (!Number.isInteger(days) || days <= 0) {
      setError("Duration must be a positive number of days.");
      return;
    }

    if (!Number.isFinite(amount) || amount < 0) {
      setError("Price must be a valid non-negative number.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const gymId = getGymId();

      if (!gymId) {
        setError("Gym information is missing");
        return;
      }

      const response = await apiFetch(
        `/api/gyms/${gymId}/plans`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
            durationDays: days,
            price: amount,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to create plan"
        );
      }

      setPlans((current) => [data.plan, ...current]);

      setName("");
      setDurationDays("");
      setPrice("");

      setSuccess("Plan created successfully.");
      setShowCreateModal(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create plan"
      );
    } finally {
      setSaving(false);
    }
  }

  const filteredPlans = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) {
      return plans;
    }

    return plans.filter((plan) =>
      plan.name.toLowerCase().includes(query)
    );
  }, [plans, search]);

  const activePlans = plans.filter(
    (plan) => plan.isActive
  ).length;

  const totalPlans = plans.length;

  function formatPrice(price: string) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(price));
  }

  return (
    <div className="page plans-page">

      {/* ================= HEADER ================= */}

      <div className="page-header">

        <div>
          <h1>Plans</h1>

          <p>
            Create and manage membership plans for your gym.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={() => {
            setError("");
            setSuccess("");
            setShowCreateModal(true);
          }}
        >
          + Create Plan
        </button>

      </div>

      {/* ================= STATS ================= */}

      <section className="stats-grid">

        <div className="stat-card">
          <div className="stat-top">
            <span>Total Plans</span>
            <span className="stat-icon">💳</span>
          </div>

          <strong>{totalPlans}</strong>

          <p className="neutral">
            All membership plans
          </p>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Active Plans</span>
            <span className="stat-icon">✅</span>
          </div>

          <strong>{activePlans}</strong>

          <p className="positive">
            Available for assignment
          </p>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Inactive Plans</span>
            <span className="stat-icon">⏸️</span>
          </div>

          <strong>{totalPlans - activePlans}</strong>

          <p className="neutral">
            Not currently active
          </p>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Search Results</span>
            <span className="stat-icon">🔎</span>
          </div>

          <strong>{filteredPlans.length}</strong>

          <p className="neutral">
            Matching plans
          </p>
        </div>

      </section>

      {/* ================= MESSAGES ================= */}

      {error && (
        <div className="form-message error">
          {error}
        </div>
      )}

      {success && (
        <div className="form-message success">
          {success}
        </div>
      )}

      {/* ================= PLAN LIST ================= */}

      <div className="panel plans-panel">

        <div className="panel-header">

          <div>
            <h3>Membership Plans</h3>

            <p>
              Plans available for member assignments.
            </p>
          </div>

          <input
            type="text"
            className="search-input"
            placeholder="Search plans..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

        </div>

        {loading ? (
          <div className="page-loading">
            Loading plans...
          </div>
        ) : filteredPlans.length === 0 ? (
          <div className="plans-empty">

            <div>💳</div>

            <h3>No plans found</h3>

            <p>
              Create your first membership plan to get started.
            </p>

          </div>
        ) : (
          <div className="plans-grid">

            {filteredPlans.map((plan) => (

              <div
                className="plan-card"
                key={plan.id}
              >

                <div className="plan-card-top">

                  <div className="plan-icon">
                    💳
                  </div>

                  <span
                    className={
                      plan.isActive
                        ? "plan-status active"
                        : "plan-status inactive"
                    }
                  >
                    {plan.isActive
                      ? "ACTIVE"
                      : "INACTIVE"}
                  </span>

                </div>

                <h3>
                  {plan.name}
                </h3>

                <div className="plan-price">
                  {formatPrice(plan.price)}
                </div>

                <div className="plan-duration">
                  {plan.durationDays} days
                </div>

                <div className="plan-divider" />

                <div className="plan-info-row">
                  <span>Duration</span>
                  <strong>
                    {plan.durationDays} days
                  </strong>
                </div>

                <div className="plan-info-row">
                  <span>Price</span>
                  <strong>
                    {formatPrice(plan.price)}
                  </strong>
                </div>

              </div>

            ))}

          </div>
        )}

      </div>

      {/* ================= CREATE PLAN MODAL ================= */}

      {showCreateModal && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              if (!saving) {
                setShowCreateModal(false);
              }
            }
          }}
        >

          <div className="modal">

            <div className="modal-header">

              <div>
                <p className="eyebrow">
                  MEMBERSHIP
                </p>

                <h3>
                  Create Plan
                </h3>

                <p>
                  Add a new membership plan for your gym.
                </p>
              </div>

              <button
                className="modal-close"
                onClick={() => setShowCreateModal(false)}
                disabled={saving}
              >
                ×
              </button>

            </div>

            <form
              className="member-form"
              onSubmit={handleCreatePlan}
            >

              <div className="form-group">

                <label>
                  Plan Name <span>*</span>
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="e.g. Monthly"
                  disabled={saving}
                />

              </div>

              <div className="form-group">

                <label>
                  Duration (days) <span>*</span>
                </label>

                <input
                  type="number"
                  min="1"
                  value={durationDays}
                  onChange={(event) =>
                    setDurationDays(event.target.value)
                  }
                  placeholder="30"
                  disabled={saving}
                />

              </div>

              <div className="form-group">

                <label>
                  Price (₹) <span>*</span>
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(event) =>
                    setPrice(event.target.value)
                  }
                  placeholder="999"
                  disabled={saving}
                />

              </div>

              <div className="plan-create-preview">

                <div>
                  <span>Preview</span>

                  <strong>
                    {name.trim() || "Plan Name"}
                  </strong>
                </div>

                <div className="plan-create-preview-meta">

                  <span>
                    {durationDays
                      ? `${durationDays} days`
                      : "Duration"}
                  </span>

                  <strong>
                    {price
                      ? formatPrice(price)
                      : "₹0"}
                  </strong>

                </div>

              </div>

              <div className="modal-actions">

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setShowCreateModal(false)
                  }
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
                    ? "Creating..."
                    : "Create Plan"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}
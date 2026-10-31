import { useEffect, useState } from "react";

import "./App.css";

import Auth from "./pages/Auth";
import Members from "./pages/Members";
import QRCheckin from "./pages/QRCheckin";
import Attendance from "./pages/Attendance";
import NoShowRedList from "./pages/NoShowRedList";
import Memberships from "./pages/Memberships";
import Plans from "./pages/Plans";
import Settings from "./pages/Settings";
import { apiFetch, getGymId } from "./services/api";
import MemberCheckIn from "./pages/MemberCheckIn";

type UserData = {
  id: number;
  name: string;
  email: string;
  role: string;
};

type DashboardData = {
  success: boolean;

  gym: {
    id: number;
    name: string;
  };

  stats: {
    activeMembers: number;
    todayCheckIns: number;
    openNoShows: number;
    renewalsDue: number;
  };

  recentAttendance: Attendance[];
};

type Attendance = {
  id: number;
  checkedInAt: string;

  method: "QR" | "MANUAL" | "ASSISTED";

  member: {
    id: number;
    name: string;
  };

  membership: {
    plan: {
      name: string;
    };
  };
};

type Page =
  | "dashboard"
  | "members"
  | "qr-checkin"
  | "attendance"
  | "no-shows"
  | "memberships"
  | "plans"
  | "settings";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRole(role: string) {
  if (!role) {
    return "Owner";
  }

  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

function App() {

  const isMemberCheckIn =
    window.location.pathname === "/check-in";

  /* ================= AUTH ================= */

  const [token, setToken] = useState<string | null>(
    localStorage.getItem("gymflow_token"),
  );

  const [user, setUser] = useState<UserData | null>(null);

  /* ================= DASHBOARD ================= */

  const [dashboard, setDashboard] =
    useState<DashboardData | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  /* ================= NAVIGATION ================= */

  const [currentPage, setCurrentPage] =
    useState<Page>("dashboard");

  /* ================= CHECK AUTH ================= */

  useEffect(() => {
    async function checkAuth() {
      const savedToken =
        localStorage.getItem("gymflow_token");

      if (!savedToken) {
        setToken(null);
        setLoading(false);
        return;
      }

      try {
        const response = await apiFetch(
          "/api/auth/me",
          {
            headers: {
              Authorization: `Bearer ${savedToken}`,
            },
          },
        );

        if (!response.ok) {
          localStorage.removeItem("gymflow_token");
          localStorage.removeItem("gymflow_user");
          localStorage.removeItem("gymflow_gym");

          setToken(null);
          setUser(null);

          return;
        }

        const data = await response.json();

        /*
         * Save the real authenticated user.
         */
        if (data.user) {
          setUser(data.user);

          localStorage.setItem(
            "gymflow_user",
            JSON.stringify(data.user),
          );
        }

        /*
         * Keep the latest gym information locally.
         */
        if (data.gym) {
          localStorage.setItem(
            "gymflow_gym",
            JSON.stringify(data.gym),
          );
        }

        setToken(savedToken);
      } catch (err) {
        console.error("Auth check failed:", err);

        localStorage.removeItem("gymflow_token");
        localStorage.removeItem("gymflow_user");
        localStorage.removeItem("gymflow_gym");

        setToken(null);
        setUser(null);
      }
    }

    checkAuth();
  }, []);

  /* ================= LOAD DASHBOARD ================= */

  useEffect(() => {
    async function loadDashboard() {
      if (!token) {
        return;
      }

      try {
        setLoading(true);
        setError("");

        const gymId = getGymId();

        if (!gymId) {
          throw new Error("Gym information is missing");
        }

        const response = await apiFetch(
          `/api/gyms/${gymId}/dashboard`,
        );

        if (!response.ok) {
          throw new Error(
            "Unable to load dashboard data.",
          );
        }

        const data: DashboardData =
          await response.json();

        setDashboard(data);
      } catch (err) {
        console.error(err);

        setError(
          "Unable to load dashboard data.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [token]);

  /* ================= LISTEN FOR PROFILE CHANGES ================= */

  useEffect(() => {
    function handleProfileUpdated() {
      const storedUser =
        localStorage.getItem("gymflow_user");

      const storedGym =
        localStorage.getItem("gymflow_gym");

      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch {
          console.error(
            "Unable to read updated user profile.",
          );
        }
      }

      if (storedGym && dashboard) {
        try {
          const updatedGym = JSON.parse(storedGym);

          setDashboard((current) => {
            if (!current) {
              return current;
            }

            return {
              ...current,
              gym: {
                ...current.gym,
                ...updatedGym,
              },
            };
          });
        } catch {
          console.error(
            "Unable to read updated gym profile.",
          );
        }
      }
    }

    window.addEventListener(
      "gymflow-profile-updated",
      handleProfileUpdated,
    );

    return () => {
      window.removeEventListener(
        "gymflow-profile-updated",
        handleProfileUpdated,
      );
    };
  }, [dashboard]);

  /* ================= PUBLIC MEMBER CHECK-IN ================= */

  if (isMemberCheckIn) {
    return <MemberCheckIn />;
  }

  /* ================= LOGIN SCREEN ================= */

  if (!token) {
    return (
      <Auth
        onLogin={() => {
          const newToken =
            localStorage.getItem(
              "gymflow_token",
            );

          const storedUser =
            localStorage.getItem(
              "gymflow_user",
            );

          if (storedUser) {
            try {
              setUser(JSON.parse(storedUser));
            } catch {
              setUser(null);
            }
          }

          setToken(newToken);
        }}
      />
    );
  }

  /* ================= LOADING ================= */

  if (loading) {
    return (
      <div className="loading-screen">
        <div>
          <div className="loading-logo">
            G
          </div>

          <h2>
            Loading GymFlow...
          </h2>

          <p>
            Connecting to your gym dashboard.
          </p>
        </div>
      </div>
    );
  }

  /* ================= ERROR ================= */

  if (error || !dashboard) {
    return (
      <div className="error-screen">
        <div>
          <div className="error-icon">
            !
          </div>

          <h2>
            Something went wrong
          </h2>

          <p>
            {error ||
              "Dashboard data is unavailable."}
          </p>

          <button
            className="primary-button"
            onClick={() =>
              window.location.reload()
            }
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  /* ================= CURRENT USER ================= */

  const displayUserName =
    user?.name ||
    "Gym Owner";

  const displayUserRole =
    formatRole(
      user?.role || "OWNER",
    );

  const userInitials =
    getInitials(
      displayUserName,
    );

  /* ================= MAIN APP ================= */

  return (
    <div className="app">

      {/* ================= SIDEBAR ================= */}

      <aside className="sidebar">

        {/* BRAND */}

        <div className="brand">

          <div className="brand-icon">
            G
          </div>

          <div>
            <h1>
              GymFlow
            </h1>

            <span>
              Gym Retention OS
            </span>
          </div>

        </div>

        {/* NAVIGATION */}

        <nav className="nav">

          {/* DASHBOARD */}

          <button
            type="button"
            className={
              currentPage === "dashboard"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() =>
              setCurrentPage("dashboard")
            }
          >
            <span>📊</span>
            Dashboard
          </button>

          {/* MEMBERS */}

          <button
            type="button"
            className={
              currentPage === "members"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() =>
              setCurrentPage("members")
            }
          >
            <span>👥</span>
            Members
          </button>

          {/* ATTENDANCE */}

          <button
            type="button"
            className={
              currentPage === "attendance"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() =>
              setCurrentPage("attendance")
            }
          >
            <span>📅</span>
            Attendance
          </button>

          {/* NO-SHOW */}

          <button
            type="button"
            className={
              currentPage === "no-shows"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() =>
              setCurrentPage("no-shows")
            }
          >
            <span>🚨</span>
            No-Show Red List
          </button>

          {/* QR CHECK-IN */}

          <button
            type="button"
            className={
              currentPage === "qr-checkin"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() =>
              setCurrentPage("qr-checkin")
            }
          >
            <span>📱</span>
            QR Check-in
          </button>

          {/* MEMBERSHIPS */}

          <button
            type="button"
            className={
              currentPage === "memberships"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() =>
              setCurrentPage("memberships")
            }
          >
            <span>💳</span>
            Memberships
          </button>

          {/* PLANS */}

          <button
            type="button"
            className={
              currentPage === "plans"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() =>
              setCurrentPage("plans")
            }
          >
            <span>📋</span>
            Plans
          </button>

        </nav>

        {/* SIDEBAR BOTTOM */}

        <div className="sidebar-bottom">

          {/* SETTINGS */}

          <button
            type="button"
            className={
              currentPage === "settings"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() =>
              setCurrentPage("settings")
            }
          >
            <span>⚙️</span>
            Settings
          </button>

          {/* GYM PROFILE */}

          <div className="gym-profile">

            <div className="profile-avatar">
              {getInitials(
                dashboard.gym.name,
              )}
            </div>

            <div>
              <strong>
                {dashboard.gym.name}
              </strong>

              <span>
                Gym Owner
              </span>
            </div>

          </div>

        </div>

      </aside>

      {/* ================= MOBILE NAVIGATION ================= */}

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button
          type="button"
          className={currentPage === "dashboard" ? "mobile-nav-item active" : "mobile-nav-item"}
          onClick={() => setCurrentPage("dashboard")}
          aria-label="Dashboard"
        >
          <span>📊</span>
          <small>Home</small>
        </button>

        <button
          type="button"
          className={currentPage === "members" ? "mobile-nav-item active" : "mobile-nav-item"}
          onClick={() => setCurrentPage("members")}
          aria-label="Members"
        >
          <span>👥</span>
          <small>Members</small>
        </button>

        <button
          type="button"
          className={currentPage === "attendance" ? "mobile-nav-item active" : "mobile-nav-item"}
          onClick={() => setCurrentPage("attendance")}
          aria-label="Attendance"
        >
          <span>📅</span>
          <small>Attendance</small>
        </button>

        <button
          type="button"
          className={currentPage === "qr-checkin" ? "mobile-nav-item active" : "mobile-nav-item"}
          onClick={() => setCurrentPage("qr-checkin")}
          aria-label="QR Check-in"
        >
          <span>📱</span>
          <small>QR</small>
        </button>

        <button
          type="button"
          className={currentPage === "no-shows" ? "mobile-nav-item active" : "mobile-nav-item"}
          onClick={() => setCurrentPage("no-shows")}
          aria-label="No-Show Red List"
        >
          <span>🚨</span>
          <small>Alerts</small>
        </button>

        <button
          type="button"
          className={currentPage === "memberships" ? "mobile-nav-item active" : "mobile-nav-item"}
          onClick={() => setCurrentPage("memberships")}
          aria-label="Memberships"
        >
          <span>💳</span>
          <small>Memberships</small>
        </button>

        <button
          type="button"
          className={currentPage === "plans" ? "mobile-nav-item active" : "mobile-nav-item"}
          onClick={() => setCurrentPage("plans")}
          aria-label="Plans"
        >
          <span>📋</span>
          <small>Plans</small>
        </button>

        <button
          type="button"
          className={currentPage === "settings" ? "mobile-nav-item active" : "mobile-nav-item"}
          onClick={() => setCurrentPage("settings")}
          aria-label="Settings"
        >
          <span>⚙️</span>
          <small>Settings</small>
        </button>
      </nav>

      {/* ================= MAIN ================= */}

      <main className="main">

        {/* ================= TOPBAR ================= */}

        <header className="topbar">

          <div>

            <p className="eyebrow">
              {currentPage ===
              "dashboard"
                ? "OVERVIEW"
                : "MANAGEMENT"}
            </p>

            <h2>
              {currentPage ===
              "dashboard"
                ? "Dashboard"
                : currentPage ===
                    "members"
                  ? "Members"
                  : currentPage ===
                      "attendance"
                    ? "Attendance"
                    : currentPage ===
                        "qr-checkin"
                      ? "QR Check-in"
                      : currentPage ===
                          "no-shows"
                        ? "No-Show Red List"
                        : currentPage ===
                            "memberships"
                          ? "Memberships"
                          : currentPage ===
                              "plans"
                            ? "Plans"
                            : currentPage ===
                                "settings"
                              ? "Settings"
                              : "Management"}
            </h2>

          </div>

          <div className="topbar-right">

            <button
              type="button"
              className="icon-button"
            >
              🔔
            </button>

            {/* REAL USER PROFILE */}

            <div className="owner">

              <div className="owner-avatar">
                {userInitials}
              </div>

              <div>

                <strong>
                  {displayUserName}
                </strong>

                <span>
                  {displayUserRole}
                </span>

              </div>

            </div>

          </div>

        </header>

        {/* ================= MEMBERS ================= */}

        {currentPage === "members" && (
          <Members />
        )}

        {/* ================= QR ================= */}

        {currentPage === "qr-checkin" && (
          <QRCheckin />
        )}

        {/* ================= ATTENDANCE ================= */}

        {currentPage === "attendance" && (
          <Attendance />
        )}

        {/* ================= NO-SHOW ================= */}

        {currentPage === "no-shows" && (
          <NoShowRedList />
        )}

        {/* ================= MEMBERSHIPS ================= */}

        {currentPage === "memberships" && (
          <Memberships />
        )}

        {/* ================= PLANS ================= */}

        {currentPage === "plans" && (
          <Plans />
        )}

        {/* ================= SETTINGS ================= */}

        {currentPage === "settings" && (
          <Settings />
        )}

        {/* ================= DASHBOARD ================= */}

        {currentPage === "dashboard" && (
          <>

            {/* WELCOME */}

            <section className="welcome">

              <div>

                <h3>
                  Good evening 👋
                </h3>

                <p>
                  Here's what's happening
                  with your gym today.
                </p>

              </div>

              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  setCurrentPage("members")
                }
              >
                + Add Member
              </button>

            </section>

            {/* ================= STATS ================= */}

            <section className="stats-grid">

              {/* ACTIVE MEMBERS */}

              <div className="stat-card">

                <div className="stat-top">

                  <span>
                    Active Members
                  </span>

                  <span className="stat-icon">
                    👥
                  </span>

                </div>

                <strong>
                  {
                    dashboard.stats
                      .activeMembers
                  }
                </strong>

                <p className="neutral">
                  Currently active
                </p>

              </div>

              {/* TODAY CHECK-INS */}

              <div className="stat-card">

                <div className="stat-top">

                  <span>
                    Today's Check-ins
                  </span>

                  <span className="stat-icon">
                    📅
                  </span>

                </div>

                <strong>
                  {
                    dashboard.stats
                      .todayCheckIns
                  }
                </strong>

                <p className="neutral">
                  Today
                </p>

              </div>

              {/* NO-SHOW */}

              <div className="stat-card warning">

                <div className="stat-top">

                  <span>
                    No-Show Cases
                  </span>

                  <span className="stat-icon">
                    🚨
                  </span>

                </div>

                <strong>
                  {
                    dashboard.stats
                      .openNoShows
                  }
                </strong>

                <p
                  className={
                    dashboard.stats
                      .openNoShows > 0
                      ? "negative"
                      : "positive"
                  }
                >
                  {
                    dashboard.stats
                      .openNoShows > 0
                      ? "Needs attention"
                      : "All clear"
                  }
                </p>

              </div>

              {/* RENEWALS */}

              <div className="stat-card">

                <div className="stat-top">

                  <span>
                    Renewals Due
                  </span>

                  <span className="stat-icon">
                    💳
                  </span>

                </div>

                <strong>
                  {
                    dashboard.stats
                      .renewalsDue
                  }
                </strong>

                <p className="neutral">
                  Next 7 days
                </p>

              </div>

            </section>

            {/* ================= CONTENT ================= */}

            <section className="content-grid">

              {/* RECENT ATTENDANCE */}

              <div className="panel">

                <div className="panel-header">

                  <div>

                    <h3>
                      Recent Attendance
                    </h3>

                    <p>
                      Latest member check-ins
                    </p>

                  </div>

                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      setCurrentPage(
                        "attendance",
                      )
                    }
                  >
                    View all →
                  </button>

                </div>

                <div className="attendance-list">

                  {
                    dashboard
                      .recentAttendance
                      .length === 0 ? (
                      <div className="empty-state">
                        No attendance
                        records yet.
                      </div>
                    ) : (
                      dashboard
                        .recentAttendance
                        .map(
                          (
                            attendance,
                          ) => (
                            <div
                              className="attendance-row"
                              key={
                                attendance.id
                              }
                            >

                              <div className="member-avatar">

                                {getInitials(
                                  attendance
                                    .member
                                    .name,
                                )}

                              </div>

                              <div className="member-info">

                                <strong>
                                  {
                                    attendance
                                      .member
                                      .name
                                  }
                                </strong>

                                <span>
                                  {
                                    attendance
                                      .membership
                                      .plan
                                      .name
                                  }
                                </span>

                              </div>

                              <div className="checkin-time">

                                <strong>
                                  {formatTime(
                                    attendance
                                      .checkedInAt,
                                  )}
                                </strong>

                                {attendance
                                  .method ===
                                "QR" ? (
                                  <span className="qr-badge">
                                    QR
                                  </span>
                                ) : (
                                  <span className="manual-badge">
                                    {
                                      attendance
                                        .method
                                    }
                                  </span>
                                )}

                              </div>

                            </div>
                          ),
                        )
                    )
                  }

                </div>

              </div>

              {/* ATTENTION */}

              <div className="panel">

                <div className="panel-header">

                  <div>

                    <h3>
                      Attention Required
                    </h3>

                    <p>
                      Members who may need
                      a follow-up
                    </p>

                  </div>

                </div>

                <div className="attention-card">

                  <div className="attention-icon">
                    🚨
                  </div>

                  <div>

                    <strong>
                      {
                        dashboard.stats
                          .openNoShows
                      }{" "}
                      No-Show Cases
                    </strong>

                    <p>
                      Members inactive
                      for 10+ days
                    </p>

                  </div>

                  <button
                    type="button"
                    className="small-button"
                    onClick={() =>
                      setCurrentPage(
                        "no-shows",
                      )
                    }
                  >
                    Review
                  </button>

                </div>

                <div className="attention-card">

                  <div className="attention-icon">
                    💳
                  </div>

                  <div>

                    <strong>
                      {
                        dashboard.stats
                          .renewalsDue
                      }{" "}
                      Renewals Due
                    </strong>

                    <p>
                      Memberships
                      expiring soon
                    </p>

                  </div>

                  <button
                    type="button"
                    className="small-button"
                    onClick={() =>
                      setCurrentPage(
                        "memberships",
                      )
                    }
                  >
                    Review
                  </button>

                </div>

              </div>

            </section>

          </>
        )}

      </main>

    </div>
  );
}

export default App;
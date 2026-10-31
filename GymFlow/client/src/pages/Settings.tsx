import { useEffect, useState } from "react";
import { apiFetch, getGymId } from "../services/api";

type Theme = "light" | "dark" | "system";

type GymProfile = {
  name: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Settings() {
  const [profile, setProfile] = useState<GymProfile>({
    name: "",
    ownerName: "",
    email: "",
    phone: "",
    address: "",
  });

  const [theme, setTheme] = useState<Theme>(
    (localStorage.getItem("gymflow_theme") as Theme) || "system",
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        setError("");

        const response = await apiFetch("/api/auth/me");

        if (!response.ok) {
          throw new Error("Unable to load account information.");
        }

        const data = await response.json();

        setProfile({
          name: data.gym?.name || "",
          ownerName: data.user?.name || "",
          email: data.user?.email || "",
          phone: data.gym?.phone || "",
          address: data.gym?.address || "",
        });
      } catch (err) {
        console.error(err);
        setError("Unable to load settings.");
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  useEffect(() => {
    localStorage.setItem("gymflow_theme", theme);

    const root = document.documentElement;
    const mediaQuery = window.matchMedia(
      "(prefers-color-scheme: dark)",
    );

    const applyTheme = () => {
      const resolvedTheme =
        theme === "system"
          ? mediaQuery.matches
            ? "dark"
            : "light"
          : theme;

      root.setAttribute("data-theme", resolvedTheme);
    };

    applyTheme();

    if (theme === "system") {
      mediaQuery.addEventListener("change", applyTheme);

      return () => {
        mediaQuery.removeEventListener("change", applyTheme);
      };
    }
  }, [theme]);

  async function handleSave() {
    const gymId = getGymId();

    if (!gymId) {
      setError("Gym information is missing.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setError("");

      const response = await apiFetch(`/api/gyms/${gymId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: profile.name,
          phone: profile.phone,
          address: profile.address,
          ownerName: profile.ownerName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to save changes.");
      }

      if (data.gym) {
        localStorage.setItem(
          "gymflow_gym",
          JSON.stringify(data.gym),
        );
      }

      const storedUser = localStorage.getItem("gymflow_user");

      if (storedUser) {
        try {
          const currentUser = JSON.parse(storedUser);
          localStorage.setItem(
            "gymflow_user",
            JSON.stringify({
              ...currentUser,
              name: profile.ownerName,
            }),
          );
        } catch {
          console.error("Unable to update stored user profile.");
        }
      }

      setMessage("Changes saved successfully.");
      window.dispatchEvent(
  new Event("gymflow-profile-updated"),
);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save changes.",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("gymflow_token");
    localStorage.removeItem("gymflow_user");
    localStorage.removeItem("gymflow_gym");

    window.location.reload();
  }

  if (loading) {
    return (
      <section className="page-section">
        <div className="panel">
          <div className="empty-state">
            Loading settings...
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="page-section">
      <div
        style={{
          maxWidth: "900px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {/* HEADER */}
        <div>
          <p className="eyebrow">SETTINGS</p>

          <h3
            style={{
              margin: "4px 0 6px",
              fontSize: "28px",
            }}
          >
            Gym Settings
          </h3>

          <p className="neutral">
            Manage your gym profile, appearance and account.
          </p>
        </div>

        {/* SUCCESS / ERROR */}
        {message && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "10px",
              background: "#e9f8ef",
              color: "#187a3d",
              fontWeight: 600,
            }}
          >
            ✓ {message}
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "10px",
              background: "#fff0f0",
              color: "#b42318",
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        {/* GYM PROFILE */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <h3>🏢 Gym Profile</h3>
              <p>Update your gym information.</p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "18px",
              padding: "20px",
            }}
          >
            <label>
              <span className="eyebrow">GYM NAME</span>

              <input
                value={profile.name}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    name: e.target.value,
                  })
                }
                placeholder="Enter gym name"
                style={{
                  width: "100%",
                  marginTop: "8px",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid #ddd",
                  fontSize: "14px",
                }}
              />
            </label>

            <label>
              <span className="eyebrow">OWNER NAME</span>

              <input
                value={profile.ownerName}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    ownerName: e.target.value,
                  })
                }
                placeholder="Enter owner name"
                style={{
                  width: "100%",
                  marginTop: "8px",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid #ddd",
                  fontSize: "14px",
                }}
              />
            </label>

            <label>
              <span className="eyebrow">EMAIL</span>

              <input
                value={profile.email}
                disabled
                style={{
                  width: "100%",
                  marginTop: "8px",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid #ddd",
                  fontSize: "14px",
                  background: "#f5f5f5",
                }}
              />
            </label>

            <label>
              <span className="eyebrow">PHONE</span>

              <input
                value={profile.phone}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    phone: e.target.value,
                  })
                }
                placeholder="Enter phone number"
                style={{
                  width: "100%",
                  marginTop: "8px",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid #ddd",
                  fontSize: "14px",
                }}
              />
            </label>

            <label style={{ gridColumn: "1 / -1" }}>
              <span className="eyebrow">ADDRESS</span>

              <textarea
                value={profile.address}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    address: e.target.value,
                  })
                }
                placeholder="Enter gym address"
                rows={3}
                style={{
                  width: "100%",
                  marginTop: "8px",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid #ddd",
                  fontSize: "14px",
                  resize: "vertical",
                }}
              />
            </label>
          </div>

          <div
            style={{
              padding: "0 20px 20px",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              className="primary-button"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {/* APPEARANCE */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <h3>🎨 Appearance</h3>
              <p>Choose how GymFlow looks for you.</p>
            </div>
          </div>

          <div
            style={{
              padding: "20px",
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
            }}
          >
            {(
              [
                ["light", "☀️", "Light", "Clean and bright"],
                ["dark", "🌙", "Dark", "Easy on the eyes"],
                ["system", "💻", "System", "Use device setting"],
              ] as const
            ).map(([value, icon, title, description]) => (
              <button
  key={value}
  type="button"
  className={`settings-theme-option ${
    theme === value ? "active" : ""
  }`}
  onClick={() => setTheme(value)}
>
  <div className="settings-theme-icon">{icon}</div>

  <strong>{title}</strong>

  <p>{description}</p>
</button>
            ))}
          </div>
        </div>

        {/* ACCOUNT */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <h3>🔐 Account & Security</h3>
              <p>Manage your GymFlow account.</p>
            </div>
          </div>

          <div
            style={{
              padding: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "20px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
              }}
            >
              <div className="profile-avatar">
                {getInitials(profile.ownerName || "Owner")}
              </div>

              <div>
                <strong>
                  {profile.ownerName || "Gym Owner"}
                </strong>

                <p
                  style={{
                    margin: "4px 0 0",
                    opacity: 0.65,
                  }}
                >
                  {profile.email}
                </p>
              </div>
            </div>

            <button
              type="button"
              className="small-button"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Settings;
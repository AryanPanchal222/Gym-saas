import { useState } from "react";
import { apiFetch } from "../services/api";

type AuthProps = {
  onLogin: () => void;
};

export default function Auth({
  onLogin,
}: AuthProps) {
  const [mode, setMode] =
    useState<"login" | "signup">("login");

  const [gymName, setGymName] =
    useState("");

  const [ownerName, setOwnerName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleSubmit(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");

      const endpoint =
        mode === "login"
          ? "/api/auth/login"
          : "/api/auth/signup";

      const body =
        mode === "login"
          ? {
              email,
              password,
            }
          : {
              gymName,
              ownerName,
              email,
              password,
            };

      const response = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Authentication failed",
        );
      }

      localStorage.setItem(
        "gymflow_token",
        data.token,
      );

      localStorage.setItem(
        "gymflow_user",
        JSON.stringify(
          data.user,
        ),
      );

      localStorage.setItem(
        "gymflow_gym",
        JSON.stringify(
          data.gym,
        ),
      );

      onLogin();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Authentication failed",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">

      <div className="auth-card">

        <div className="auth-brand">

          <div className="auth-logo">
            G
          </div>

          <div>
            <h1>GymFlow</h1>
            <span>
              Gym Retention OS
            </span>
          </div>

        </div>

        <div className="auth-header">

          <p className="eyebrow">
            {mode === "login"
              ? "WELCOME BACK"
              : "GET STARTED"}
          </p>

          <h2>
            {mode === "login"
              ? "Login to GymFlow"
              : "Create your gym"}
          </h2>

          <p>
            {mode === "login"
              ? "Manage your gym from one dashboard."
              : "Create your GymFlow workspace."}
          </p>

        </div>

        {error && (
          <div className="form-message error">
            {error}
          </div>
        )}

        <form
          className="auth-form"
          onSubmit={
            handleSubmit
          }
        >

          {mode === "signup" && (
            <>
              <div className="form-group">

                <label>
                  Gym Name{" "}
                  <span>*</span>
                </label>

                <input
                  type="text"
                  value={gymName}
                  onChange={(event) =>
                    setGymName(
                      event.target.value,
                    )
                  }
                  placeholder="Iron Fitness"
                  disabled={loading}
                />

              </div>

              <div className="form-group">

                <label>
                  Owner Name{" "}
                  <span>*</span>
                </label>

                <input
                  type="text"
                  value={ownerName}
                  onChange={(event) =>
                    setOwnerName(
                      event.target.value,
                    )
                  }
                  placeholder="Gym Owner"
                  disabled={loading}
                />

              </div>
            </>
          )}

          <div className="form-group">

            <label>
              Email <span>*</span>
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value,
                )
              }
              placeholder="owner@gym.com"
              disabled={loading}
            />

          </div>

          <div className="form-group">

            <label>
              Password{" "}
              <span>*</span>
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value,
                )
              }
              placeholder="Minimum 8 characters"
              disabled={loading}
            />

          </div>

          <button
            type="submit"
            className="primary-button auth-submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Login"
                : "Create Account"}
          </button>

        </form>

        <div className="auth-switch">

          <span>
            {mode === "login"
              ? "Don't have an account?"
              : "Already have an account?"}
          </span>

          <button
            type="button"
            onClick={() => {
              setMode(
                mode === "login"
                  ? "signup"
                  : "login",
              );

              setError("");
            }}
          >
            {mode === "login"
              ? "Create one"
              : "Login"}
          </button>

        </div>

      </div>

    </div>
  );
}
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../../components/Button";
import { Modal } from "../../../components/Modal";
import { EyeIcon, EyeOffIcon } from "../../../components/icons";
import { useTenantLogin } from "./useTenantLogin";
import "./ErpLogin.css";

const PORTAL_LABELS = { erp1: "ERP 1", erp2: "ERP 2", erp3: "ERP 3" };

function BakeryLogo() {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M14 22c0-5.523 4.477-10 10-10s10 4.477 10 10v2H14v-2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 24h24v8c0 4.418-3.582 8-8 8H20c-4.418 0-8-3.582-8-8v-8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M20 14c0-2 1-3 2-4M24 12c0-2 1-3 2-4M28 14c0-2 1-3 2-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 32h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export default function ErpLogin({ portal }) {
  const [showPassword, setShowPassword] = useState(false);
  const {
    username,
    setUsername,
    password,
    setPassword,
    agreeTerms,
    setAgreeTerms,
    error,
    isSubmitting,
    conflict,
    setConflict,
    user,
    handleSubmit,
    handleForceLogin,
    formatDateTime,
  } = useTenantLogin(portal);
  const navigate = useNavigate();

  if (user?.portal === "tenant") {
    navigate("/app", { replace: true });
    return null;
  }

  return (
    <div className="erp-login-page">
      <div className="erp-login-left">
        <div className="erp-login-card">
          <div className="erp-login-logo">
            <BakeryLogo />
          </div>

          <h1>Log in to continue</h1>
          <p className="erp-login-subtitle">
            Please log in to access {PORTAL_LABELS[portal] || portal}.
          </p>

          {error && <div className="login-error">{error}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="erp-login-field">
              <span className="erp-login-field-icon">
                <UserIcon />
              </span>
              <input
                id="username"
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="erp-login-field">
              <span className="erp-login-field-icon">
                <LockIcon />
              </span>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="erp-login-field-toggle"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>

            <div className="erp-login-meta">
              <label className="erp-login-terms" htmlFor={`login-terms-${portal}`}>
                <input
                  id={`login-terms-${portal}`}
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                />
                <span>
                  I agree to the{" "}
                  <Link to="/terms" target="_blank" rel="noopener noreferrer">
                    Terms and Conditions
                  </Link>
                </span>
              </label>
              <Link className="erp-login-forgot" to="/forgot-password">
                Forgot Password?
              </Link>
            </div>

            <Button type="submit" className="erp-login-submit" disabled={isSubmitting || !agreeTerms}>
              {isSubmitting ? "Logging in..." : "Log in"}
            </Button>
          </form>
        </div>

        <footer className="erp-login-footer">
          <p>
            © 2026 Project X. All Rights Reserved | Powered by{" "}
            <a href="https://webhouseinc.co/" target="_blank" rel="noopener noreferrer">
              WebHouse Inc
            </a>
            .
          </p>
        </footer>
      </div>

      <div className="erp-login-right">
        <div className="erp-login-image-frame">
          <img src="/erp-login-image.png" alt="Bakery workspace" />
        </div>
      </div>

      <Modal
        open={Boolean(conflict)}
        onClose={() => setConflict(null)}
        title="Already signed in elsewhere"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConflict(null)}>
              Cancel
            </Button>
            <Button onClick={handleForceLogin} disabled={isSubmitting || !agreeTerms}>
              {isSubmitting ? "Signing in…" : "Log out other device and continue"}
            </Button>
          </>
        }
      >
        <p>You are already logged in on another device.</p>
        {conflict?.login_at && (
          <p className="wh-muted">Last active: {formatDateTime(conflict.login_at)}</p>
        )}
        {conflict?.ip_address && <p className="wh-muted">IP: {conflict.ip_address}</p>}
        {conflict?.device_info && <p className="wh-muted">Device: {conflict.device_info}</p>}
        <p>Continue here to end the other session.</p>
      </Modal>
    </div>
  );
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../../components/Button";
import { Modal } from "../../../components/Modal";
import { EyeIcon, EyeOffIcon } from "../../../components/icons";
import { useTenantLogin } from "./useTenantLogin";
import "./Erp3Login.css";

export default function Erp3Login() {
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
  } = useTenantLogin("erp3");

  const navigate = useNavigate();

  if (user?.portal === "tenant") {
    navigate("/app", { replace: true });
    return null;
  }

  return (
    <div className="erp3-login-page">
      <div className="erp3-scene" aria-hidden="true">
        {/* Existing oven glow */}
        <div className="erp3-scene__oven" />

        {/* Existing shelves */}
        <div className="erp3-scene__shelf erp3-scene__shelf--left" />
        <div className="erp3-scene__shelf erp3-scene__shelf--right" />

        {/* 3D Bread */}
        <svg
          className="erp3-3d erp3-3d--bread"
          viewBox="0 0 240 180"
        >
          <defs>
            <linearGradient id="breadTop" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f3c77c" />
              <stop offset="45%" stopColor="#c47a32" />
              <stop offset="100%" stopColor="#713b17" />
            </linearGradient>

            <linearGradient id="breadSide" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8d481d" />
              <stop offset="100%" stopColor="#3d1b0a" />
            </linearGradient>

            <filter id="breadShadow">
              <feDropShadow
                dx="10"
                dy="16"
                stdDeviation="9"
                floodColor="#000"
                floodOpacity="0.35"
              />
            </filter>
          </defs>

          <g filter="url(#breadShadow)">
            <path
              d="M36 107C36 61 68 31 120 31C172 31 204 61 204 107V128H36Z"
              fill="url(#breadTop)"
            />

            <path
              d="M36 128H204L184 153H57Z"
              fill="url(#breadSide)"
            />

            <path
              d="M76 63C88 77 93 91 94 110"
              stroke="#f9d89c"
              strokeWidth="10"
              strokeLinecap="round"
              opacity="0.75"
            />

            <path
              d="M120 52C132 68 137 86 137 108"
              stroke="#f9d89c"
              strokeWidth="10"
              strokeLinecap="round"
              opacity="0.75"
            />

            <path
              d="M164 63C176 77 181 91 182 110"
              stroke="#f9d89c"
              strokeWidth="10"
              strokeLinecap="round"
              opacity="0.75"
            />

            <ellipse
              cx="103"
              cy="52"
              rx="42"
              ry="13"
              fill="#fff"
              opacity="0.13"
            />
          </g>
        </svg>

        {/* 3D Croissant */}
        <svg
          className="erp3-3d erp3-3d--croissant"
          viewBox="0 0 260 190"
        >
          <defs>
            <radialGradient id="croissantMain">
              <stop offset="0%" stopColor="#ffd28a" />
              <stop offset="55%" stopColor="#d9822d" />
              <stop offset="100%" stopColor="#71350f" />
            </radialGradient>

            <filter id="croissantShadow">
              <feDropShadow
                dx="8"
                dy="14"
                stdDeviation="9"
                floodColor="#000"
                floodOpacity="0.35"
              />
            </filter>
          </defs>

          <g filter="url(#croissantShadow)">
            <path
              d="M35 120C48 60 87 43 128 87C169 43 210 60 225 120C198 153 63 153 35 120Z"
              fill="url(#croissantMain)"
            />

            <path
              d="M54 108C77 78 95 83 110 112"
              fill="none"
              stroke="#f7b45c"
              strokeWidth="20"
              strokeLinecap="round"
            />

            <path
              d="M91 95C108 72 145 72 166 98"
              fill="none"
              stroke="#f8bd67"
              strokeWidth="22"
              strokeLinecap="round"
            />

            <path
              d="M150 112C166 83 188 79 208 108"
              fill="none"
              stroke="#e99a43"
              strokeWidth="20"
              strokeLinecap="round"
            />

            <ellipse
              cx="111"
              cy="74"
              rx="35"
              ry="12"
              fill="#fff"
              opacity="0.15"
            />
          </g>
        </svg>

        {/* 3D Cupcake */}
        <svg
          className="erp3-3d erp3-3d--pastry"
          viewBox="0 0 180 220"
        >
          <defs>
            <linearGradient id="frosting" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffe2b8" />
              <stop offset="55%" stopColor="#d99056" />
              <stop offset="100%" stopColor="#8b4321" />
            </linearGradient>

            <linearGradient id="wrapper" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#9c4f24" />
              <stop offset="50%" stopColor="#d98b4e" />
              <stop offset="100%" stopColor="#57210e" />
            </linearGradient>

            <filter id="pastryShadow">
              <feDropShadow
                dx="8"
                dy="14"
                stdDeviation="8"
                floodColor="#000"
                floodOpacity="0.35"
              />
            </filter>
          </defs>

          <g filter="url(#pastryShadow)">
            <path
              d="M32 95C32 67 51 47 75 48C77 22 105 15 121 39C145 32 162 50 153 75C170 92 159 119 136 120H45C25 120 20 105 32 95Z"
              fill="url(#frosting)"
            />

            <path
              d="M47 118H139L126 190H60Z"
              fill="url(#wrapper)"
            />

            <path
              d="M63 120L71 188M85 120L88 190M109 120L105 190M128 120L118 188"
              stroke="#f1bd82"
              strokeWidth="6"
              opacity="0.6"
            />

            <circle
              cx="91"
              cy="34"
              r="10"
              fill="#c64a35"
            />

            <ellipse
              cx="76"
              cy="63"
              rx="25"
              ry="10"
              fill="#fff"
              opacity="0.18"
            />
          </g>
        </svg>

        {/* 3D Rolling Pin */}
        <svg
          className="erp3-3d erp3-3d--rolling"
          viewBox="0 0 300 110"
        >
          <defs>
            <linearGradient id="woodPin" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f0bd78" />
              <stop offset="50%" stopColor="#b7662c" />
              <stop offset="100%" stopColor="#633012" />
            </linearGradient>

            <filter id="pinShadow">
              <feDropShadow
                dx="9"
                dy="12"
                stdDeviation="7"
                floodColor="#000"
                floodOpacity="0.3"
              />
            </filter>
          </defs>

          <g filter="url(#pinShadow)">
            <rect
              x="55"
              y="28"
              width="190"
              height="54"
              rx="27"
              fill="url(#woodPin)"
            />

            <path
              d="M55 40H25C5 40 5 70 25 70H55"
              fill="#8c451e"
            />

            <path
              d="M245 40H275C295 40 295 70 275 70H245"
              fill="#6c3012"
            />

            <ellipse
              cx="130"
              cy="40"
              rx="55"
              ry="8"
              fill="#fff"
              opacity="0.12"
            />
          </g>
        </svg>

        {/* Existing steam */}
        <div className="erp3-steam">
          <span />
          <span />
          <span />
        </div>

        {/* Existing flour */}
        <div className="erp3-flour">
          {Array.from({ length: 18 }, (_, i) => (
            <i key={i} style={{ "--i": i }} />
          ))}
        </div>
      </div>

      {/* YOUR ORIGINAL LOGIN CARD */}
      <div className="erp3-ticket">
        <div className="erp3-ticket__perforation" />

        <header className="erp3-ticket__head">
          <div className="erp3-ticket__mark">
            <span className="erp3-ticket__stamp">ERP 3</span>
            <p>Morning batch</p>
          </div>

          <p className="erp3-ticket__no">#014</p>
        </header>

        <h1>Clock in</h1>

        <p className="erp3-ticket__lede">
          The ovens are already warm. Sign in to start the shift.
        </p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <label className="erp3-field" htmlFor="erp3-username">
            Staff username

            <input
              id="erp3-username"
              type="text"
              placeholder="your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </label>

          <label className="erp3-field" htmlFor="erp3-password">
            Password

            <span className="erp3-field__input">
              <input
                id="erp3-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />

              <button
                type="button"
                className="erp3-field__toggle"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={
                  showPassword ? "Hide password" : "Show password"
                }
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </span>
          </label>

          <div className="erp3-ticket__row">
            <label className="erp3-terms" htmlFor="login-terms-erp3">
              <input
                id="login-terms-erp3"
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
              />

              <span>
                I agree to the{" "}
                <Link
                  to="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Terms
                </Link>
              </span>
            </label>

            <Link className="erp3-forgot" to="/forgot-password">
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            className="erp3-ticket__submit"
            disabled={isSubmitting || !agreeTerms}
          >
            {isSubmitting ? "Opening till…" : "Start shift"}
          </Button>
        </form>

        <footer className="erp3-ticket__foot">
          Powered by{" "}
          <a
            href="https://webhouseinc.co/"
            target="_blank"
            rel="noopener noreferrer"
          >
            WebHouse Inc
          </a>
        </footer>
      </div>

      <Modal
        open={Boolean(conflict)}
        onClose={() => setConflict(null)}
        title="Already signed in elsewhere"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConflict(null)}
            >
              Cancel
            </Button>

            <Button
              onClick={handleForceLogin}
              disabled={isSubmitting || !agreeTerms}
            >
              {isSubmitting
                ? "Signing in…"
                : "Log out other device and continue"}
            </Button>
          </>
        }
      >
        <p>You are already logged in on another device.</p>

        {conflict?.login_at && (
          <p className="wh-muted">
            Last active: {formatDateTime(conflict.login_at)}
          </p>
        )}

        {conflict?.ip_address && (
          <p className="wh-muted">
            IP: {conflict.ip_address}
          </p>
        )}

        {conflict?.device_info && (
          <p className="wh-muted">
            Device: {conflict.device_info}
          </p>
        )}

        <p>Continue here to end the other session.</p>
      </Modal>
    </div>
  );
}
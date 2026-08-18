import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../../components/Button";
import { Modal } from "../../../components/Modal";
import { EyeIcon, EyeOffIcon } from "../../../components/icons";
import { useTenantLogin } from "./useTenantLogin";
import "./Erp2Login.css";

export default function Erp2Login() {
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
  } = useTenantLogin("erp2");

  const navigate = useNavigate();

  if (user?.portal === "tenant") {
    navigate("/app", { replace: true });
    return null;
  }

  return (
    <div className="erp2-login-page">
      {/* =========================
          BAKERY BACKGROUND
      ========================== */}
      <div className="erp2-bakery-bg" aria-hidden="true">
        <div className="erp2-bakery-sun" />

        <div className="erp2-bakery-ring erp2-bakery-ring--one" />
        <div className="erp2-bakery-ring erp2-bakery-ring--two" />

        {/* 3D rolling pin */}
<div className="erp2-3d-object erp2-rolling-pin">
  <svg viewBox="0 0 220 120" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="pinBody" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="var(--surface-bg)" />
        <stop offset="50%" stopColor="var(--hover-bg)" />
        <stop offset="100%" stopColor="var(--color-accent)" />
      </linearGradient>
    </defs>

    <ellipse
      cx="110"
      cy="95"
      rx="72"
      ry="9"
      fill="var(--text-primary)"
      opacity=".1"
    />

    <g transform="rotate(-12 110 60)">
      <rect
        x="45"
        y="43"
        width="130"
        height="34"
        rx="17"
        fill="url(#pinBody)"
        stroke="var(--color-accent)"
        strokeWidth="2"
      />

      <rect
        x="25"
        y="50"
        width="32"
        height="20"
        rx="10"
        fill="var(--color-accent)"
      />

      <rect
        x="163"
        y="50"
        width="32"
        height="20"
        rx="10"
        fill="var(--color-accent)"
      />

      <path
        d="M72 46V74M91 46V74M110 46V74M129 46V74M148 46V74"
        stroke="var(--card-bg)"
        strokeWidth="4"
        opacity=".45"
      />
    </g>
  </svg>
</div>

{/* 3D mixing bowl */}


{/* 3D flour sack */}
<div className="erp2-3d-object erp2-flour-sack">
  <svg viewBox="0 0 150 180" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="sackFill" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="var(--surface-bg)" />
        <stop offset="60%" stopColor="var(--hover-bg)" />
        <stop offset="100%" stopColor="var(--border-color)" />
      </linearGradient>
    </defs>

    <ellipse
      cx="75"
      cy="160"
      rx="48"
      ry="9"
      fill="var(--text-primary)"
      opacity=".1"
    />

    <path
      d="M40 34
         L110 34
         L119 57
         L113 145
         C102 157 48 157 37 145
         L31 57Z"
      fill="url(#sackFill)"
      stroke="var(--border-color)"
      strokeWidth="2"
    />

    <path
      d="M42 35
         C52 23 98 23 108 35
         L103 48
         C91 54 59 54 47 48Z"
      fill="var(--hover-bg)"
      stroke="var(--border-color)"
      strokeWidth="2"
    />

    <path
      d="M49 82C62 77 88 77 101 82"
      stroke="var(--color-accent)"
      strokeWidth="3"
      opacity=".7"
    />

    <text
      x="75"
      y="108"
      textAnchor="middle"
      fill="var(--color-accent)"
      fontSize="13"
      fontWeight="800"
      letterSpacing="2"
    >
      FLOUR
    </text>

    <circle
      cx="75"
      cy="126"
      r="12"
      fill="none"
      stroke="var(--color-accent)"
      strokeWidth="2"
      opacity=".65"
    />
  </svg>
</div>

{/* 3D whisk */}
<div className="erp2-3d-object erp2-whisk">
  <svg viewBox="0 0 130 220" xmlns="http://www.w3.org/2000/svg">
    <g transform="rotate(20 65 110)">
      <rect
        x="58"
        y="15"
        width="14"
        height="82"
        rx="7"
        fill="var(--color-accent)"
      />

      <path
        d="M65 96
           C35 116 35 154 65 177
           C95 154 95 116 65 96Z"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="4"
      />

      <path
        d="M65 97C48 124 49 150 65 176"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="3"
      />

      <path
        d="M65 97C82 124 81 150 65 176"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="3"
      />

      <path
        d="M65 97V177"
        stroke="var(--color-accent)"
        strokeWidth="3"
      />

      <ellipse
        cx="65"
        cy="16"
        rx="13"
        ry="8"
        fill="var(--hover-bg)"
        stroke="var(--color-accent)"
        strokeWidth="2"
      />
    </g>
  </svg>
</div>

        {/* Floating 3D bread #1 */}
        <div className="erp2-floating-bread erp2-floating-bread--one">
          <svg
            viewBox="0 0 180 120"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="breadGold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--surface-bg)" />
                <stop offset="48%" stopColor="var(--hover-bg)" />
                <stop offset="100%" stopColor="var(--color-accent)" />
              </linearGradient>

              <linearGradient id="breadLight" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--surface-bg)" />
                <stop offset="100%" stopColor="var(--hover-bg)" />
              </linearGradient>

              <filter id="breadShadow">
                <feDropShadow
                  dx="0"
                  dy="10"
                  stdDeviation="7"
                  floodOpacity="0.18"
                />
              </filter>
            </defs>

            <ellipse
              cx="90"
              cy="103"
              rx="58"
              ry="9"
              fill="var(--text-primary)"
              opacity="0.12"
            />

            <g filter="url(#breadShadow)">
              <path
                d="M31 76
                   C22 63 27 42 43 29
                   C58 17 77 15 91 20
                   C105 15 124 17 139 29
                   C155 42 160 63 151 76
                   C139 93 110 99 91 94
                   C72 99 43 93 31 76Z"
                fill="url(#breadGold)"
              />

              <path
                d="M39 65
                   C42 48 55 34 72 29
                   C65 43 66 61 76 76
                   C63 72 51 68 39 65Z"
                fill="url(#breadLight)"
                opacity="0.8"
              />

              <path
                d="M141 65
                   C138 48 125 34 108 29
                   C115 43 114 61 104 76
                   C117 72 129 68 141 65Z"
                fill="url(#breadLight)"
                opacity="0.55"
              />

              <path
                d="M74 27 C84 39 86 55 81 73"
                fill="none"
                stroke="var(--surface-bg)"
                strokeWidth="6"
                strokeLinecap="round"
                opacity="0.85"
              />

              <path
                d="M106 27 C96 39 94 55 99 73"
                fill="none"
                stroke="var(--surface-bg)"
                strokeWidth="6"
                strokeLinecap="round"
                opacity="0.65"
              />

              <path
                d="M59 31 C52 39 48 49 48 58"
                fill="none"
                stroke="var(--surface-bg)"
                strokeWidth="4"
                strokeLinecap="round"
                opacity="0.55"
              />

              <path
                d="M121 31 C128 39 132 49 132 58"
                fill="none"
                stroke="var(--surface-bg)"
                strokeWidth="4"
                strokeLinecap="round"
                opacity="0.45"
              />
            </g>
          </svg>
        </div>

        {/* Floating 3D bread #2 */}
        <div className="erp2-floating-bread erp2-floating-bread--two">
          <svg
            viewBox="0 0 150 110"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="loaf3d" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--surface-bg)" />
                <stop offset="45%" stopColor="var(--hover-bg)" />
                <stop offset="100%" stopColor="var(--color-accent)" />
              </linearGradient>

              <filter id="loafShadow">
                <feDropShadow
                  dx="0"
                  dy="10"
                  stdDeviation="7"
                  floodOpacity="0.16"
                />
              </filter>
            </defs>

            <ellipse
              cx="75"
              cy="94"
              rx="46"
              ry="7"
              fill="var(--text-primary)"
              opacity="0.1"
            />

            <g filter="url(#loafShadow)">
              <path
                d="M31 72
                   C22 59 27 39 43 28
                   C57 18 77 17 94 24
                   C112 31 123 45 121 61
                   C119 79 102 87 76 88
                   C55 89 38 83 31 72Z"
                fill="url(#loaf3d)"
                stroke="var(--color-accent)"
                strokeWidth="2"
              />

              <path
                d="M53 31 C46 39 44 49 47 58"
                fill="none"
                stroke="var(--card-bg)"
                strokeWidth="6"
                strokeLinecap="round"
                opacity="0.9"
              />

              <path
                d="M72 25 C66 35 65 47 69 58"
                fill="none"
                stroke="var(--card-bg)"
                strokeWidth="6"
                strokeLinecap="round"
                opacity="0.75"
              />

              <path
                d="M91 27 C87 37 87 47 91 56"
                fill="none"
                stroke="var(--card-bg)"
                strokeWidth="6"
                strokeLinecap="round"
                opacity="0.55"
              />

              <ellipse
                cx="91"
                cy="41"
                rx="18"
                ry="11"
                fill="var(--card-bg)"
                opacity="0.12"
              />
            </g>
          </svg>
        </div>

        <span className="erp2-crumb erp2-crumb--one" />
        <span className="erp2-crumb erp2-crumb--two" />
        <span className="erp2-crumb erp2-crumb--three" />
        <span className="erp2-crumb erp2-crumb--four" />
      </div>

      {/* =========================
          MAIN
      ========================== */}
      <main className="erp2-stage">
        <section className="erp2-intro">
          <div className="erp2-brand">
            <div className="erp2-brand__mark">
              <svg
                width="25"
                height="25"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M5 10.5C5 7.46 7.46 5 10.5 5H13.5C16.54 5 19 7.46 19 10.5V16C19 17.66 17.66 19 16 19H8C6.34 19 5 17.66 5 16V10.5Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M8 9.5C8.8 8.4 9.9 8.4 10.7 9.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M13.3 9.5C14.1 8.4 15.2 8.4 16 9.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M8.5 13.5H15.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div className="erp2-brand__name">
              <span>ERP SYSTEM</span>
              <strong>BAKERY</strong>
            </div>
          </div>

          <div className="erp2-intro__content">
            <div className="erp2-kicker">
              <span />
              Bakery Operations
            </div>

            <h1>
              Fresh out
              <br />
              of the <em>oven.</em>
            </h1>

            <p>
              Punch in. Pull trays. Keep the line moving.
              Your bakery operations, all in one place.
            </p>

            {/* Main 3D bread */}
            <div className="erp2-bread-illustration" aria-hidden="true">
              <svg
                viewBox="0 0 320 190"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="mainLoaf" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="var(--surface-bg)" />
                    <stop offset="48%" stopColor="var(--hover-bg)" />
                    <stop offset="100%" stopColor="var(--color-accent)" />
                  </linearGradient>

                  <linearGradient id="mainLoafSide" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-accent)" />
                    <stop offset="100%" stopColor="var(--text-primary)" />
                  </linearGradient>

                  <filter id="mainBreadShadow">
                    <feDropShadow
                      dx="0"
                      dy="15"
                      stdDeviation="10"
                      floodOpacity="0.18"
                    />
                  </filter>
                </defs>

                <ellipse
                  cx="160"
                  cy="168"
                  rx="105"
                  ry="14"
                  fill="var(--text-primary)"
                  opacity="0.1"
                />

                <ellipse
                  cx="160"
                  cy="158"
                  rx="105"
                  ry="22"
                  fill="var(--card-bg)"
                  stroke="var(--border-color)"
                  strokeWidth="3"
                />

                <ellipse
                  cx="160"
                  cy="154"
                  rx="88"
                  ry="16"
                  fill="none"
                  stroke="var(--border-color)"
                  strokeWidth="2"
                />

                <g filter="url(#mainBreadShadow)">
                  <path
                    d="M71 126
                       C54 109 55 80 70 58
                       C87 34 112 25 139 31
                       C155 16 180 16 197 31
                       C224 25 249 34 266 58
                       C281 80 282 109 265 126
                       C246 146 212 151 184 143
                       C162 151 128 146 109 143
                       C94 140 80 134 71 126Z"
                    fill="url(#mainLoaf)"
                    stroke="var(--color-accent)"
                    strokeWidth="3"
                  />

                  <path
                    d="M72 113
                       C96 132 128 136 160 129
                       C192 136 224 132 264 113
                       C261 129 247 139 226 145
                       C207 150 192 146 184 143
                       C160 151 128 146 109 143
                       C91 138 77 129 72 113Z"
                    fill="url(#mainLoafSide)"
                    opacity="0.55"
                  />

                  <path
                    d="M105 57 C91 72 88 90 96 108"
                    fill="none"
                    stroke="var(--card-bg)"
                    strokeWidth="9"
                    strokeLinecap="round"
                    opacity="0.9"
                  />

                  <path
                    d="M138 42 C126 60 124 81 132 104"
                    fill="none"
                    stroke="var(--card-bg)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    opacity="0.8"
                  />

                  <path
                    d="M181 42 C193 60 195 81 187 104"
                    fill="none"
                    stroke="var(--card-bg)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    opacity="0.7"
                  />

                  <path
                    d="M214 57 C229 72 232 90 224 108"
                    fill="none"
                    stroke="var(--card-bg)"
                    strokeWidth="9"
                    strokeLinecap="round"
                    opacity="0.55"
                  />

                  <ellipse
                    cx="119"
                    cy="55"
                    rx="29"
                    ry="12"
                    fill="var(--card-bg)"
                    opacity="0.18"
                    transform="rotate(-18 119 55)"
                  />
                </g>
              </svg>
            </div>
          </div>
        </section>

        {/* =========================
            LOGIN CARD
        ========================== */}
        <section className="erp2-card">
          <div className="erp2-card__tape" aria-hidden="true" />

          <div className="erp2-card__header">
            <div>
              <span className="erp2-card__eyebrow">
                ERP 2 · BAKERY PORTAL
              </span>

              <h2>
                Welcome
                <br />
                <em>back.</em>
              </h2>
            </div>

            <div className="erp2-card__seal" aria-hidden="true">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M6 10.5C6 7.46 8.46 5 11.5 5H12.5C15.54 5 18 7.46 18 10.5V16C18 17.66 16.66 19 15 19H9C7.34 19 6 17.66 6 16V10.5Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M9 11H15"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M9.5 14H14.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          <p className="erp2-card__description">
            Sign in to manage today's production, orders,
            inventory and bakery operations.
          </p>

          <form
            className="erp2-form"
            onSubmit={handleSubmit}
            noValidate
          >
            {error && <div className="login-error">{error}</div>}

            <label className="erp2-field" htmlFor="erp2-username">
              <span>USERNAME</span>

              <input
                id="erp2-username"
                type="text"
                placeholder="baker.jane"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </label>

            <label className="erp2-field" htmlFor="erp2-password">
              <span>PASSWORD</span>

              <span className="erp2-password-wrap">
                <input
                  id="erp2-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  className="erp2-password-toggle"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </span>
            </label>

            <div className="erp2-meta">
              <label
                className="erp2-terms"
                htmlFor="login-terms-erp2"
              >
                <input
                  id="login-terms-erp2"
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) =>
                    setAgreeTerms(e.target.checked)
                  }
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

              <Link
                className="erp2-forgot"
                to="/forgot-password"
              >
                Forgot?
              </Link>
            </div>

            <Button
              type="submit"
              className="erp2-submit"
              disabled={isSubmitting || !agreeTerms}
            >
              {isSubmitting ? "Opening…" : "Punch in"}
            </Button>
          </form>

          <div className="erp2-card__footer">
            <span />
            <small>BAKED FRESH DAILY</small>
            <span />
          </div>
        </section>

        <footer className="erp2-footer">
          Powered by{" "}
          <a
            href="https://webhouseinc.co/"
            target="_blank"
            rel="noopener noreferrer"
          >
            WebHouse Inc
          </a>
        </footer>
      </main>

      {/* =========================
          CONFLICT MODAL
      ========================== */}
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
        <div className="erp2-modal">
          <div className="erp2-modal__icon" aria-hidden="true">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M6 8.5C6 6.01 8.01 4 10.5 4H13.5C15.99 4 18 6.01 18 8.5V17C18 18.66 16.66 20 15 20H9C7.34 20 6 18.66 6 17V8.5Z"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <path
                d="M9 8H15"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
              <path
                d="M9 12H15"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </div>

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

          <p>
            Continue here to end the other session.
          </p>
        </div>
      </Modal>
    </div>
  );
}
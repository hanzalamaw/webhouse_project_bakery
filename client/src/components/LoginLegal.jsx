import { Link } from "react-router-dom";

/** Shared login footer */
export function LoginFooter() {
  return (
    <footer className="login-footer">
      <p>
        © 2026 Project X. All Rights Reserved | Powered by{" "}
        <a href="https://webhouseinc.co/" target="_blank" rel="noopener noreferrer">
          WebHouse Inc
        </a>
        .
      </p>
    </footer>
  );
}

/**
 * Terms checkbox + optional Forgot Password on one row.
 * Checkbox default checked; blocks login when unchecked.
 */
export function LoginTermsAgree({
  checked,
  onChange,
  id = "login-terms",
  showForgot = false,
}) {
  return (
    <div className="login-meta-row">
      <label className="login-terms" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>
          I agree to the{" "}
          <Link to="/terms" target="_blank" rel="noopener noreferrer">
            Terms and Conditions
          </Link>
        </span>
      </label>
      {showForgot ? (
        <Link className="login-forgot-link" to="/forgot-password">
          Forgot Password?
        </Link>
      ) : null}
    </div>
  );
}

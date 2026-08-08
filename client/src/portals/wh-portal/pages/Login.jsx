import { useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE } from "../../../config/api";
import { friendlyError } from "../../../utils/friendlyError";
import { FormField } from "../../../components/FormField";
import { Button } from "../../../components/Button";
import { LoginFooter, LoginTermsAgree } from "../../../components/LoginLegal";
import "./Login.css";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Please enter your username and password.");
      return;
    }

    if (!agreeTerms) {
      setError("Please agree to the Terms and Conditions to continue.");
      return;
    }

    if (!username.trim().toLowerCase().startsWith("w.")) {
      setError("Admin usernames must start with w.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await response.json();

      if (response.ok) {
        login(data.user, data.token, data.refreshToken ?? null);
        const redirect = searchParams.get("redirect") || "/webhouse-portal/dashboard";
        navigate(redirect);
      } else {
        setError(friendlyError(data.message, response.status));
      }
    } catch {
      setError(friendlyError("Failed to fetch"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-form-panel">
        <div className="login-form-content">
          <header className="login-header">
            <h1>Welcome Back 👋</h1>
            <p>Centralize Operations. Simplify Growth.</p>
          </header>

          {error && <div className="login-error">{error}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <FormField
              id="username"
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />

            <FormField
              id="password"
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            <LoginTermsAgree checked={agreeTerms} onChange={setAgreeTerms} showForgot />

            <Button type="submit" className="login-submit" disabled={isSubmitting || !agreeTerms}>
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="login-register">
            Don&apos;t you have an account? <a href="mailto:admin@webhouse.com">Contact Administrator</a>
          </p>
        </div>

        <LoginFooter />
      </div>

      <div className="login-image-panel">
        <div className="login-image-frame">
          <img src="/login-image.png" alt="WebHouse digital operations" />
        </div>
      </div>
    </div>
  );
};

export default Login;

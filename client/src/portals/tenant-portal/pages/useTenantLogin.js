import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { API_BASE } from "../../../config/api";
import { formatDateTime } from "../../../utils/dateTime";
import { friendlyError } from "../../../utils/friendlyError";

export function useTenantLogin(portal) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflict, setConflict] = useState(null);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const doLogin = async (forceLogoutOthers = false) => {
    const response = await fetch(`${API_BASE}/tenant/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.trim(),
        password,
        portal,
        forceLogoutOthers,
      }),
    });
    const data = await response.json();
    if (response.status === 409 && data.code === "SESSION_CONFLICT") {
      setConflict(data.existingSession || {});
      return { conflict: true };
    }
    if (response.ok) {
      login(data.user, data.token, data.refreshToken ?? null);
      navigate("/app");
      return { ok: true };
    }
    setError(friendlyError(data.message, response.status));
    return { error: true };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setConflict(null);
    if (!username.trim() || !password) {
      setError("Please enter your username and password.");
      return;
    }
    if (!agreeTerms) {
      setError("Please agree to the Terms and Conditions to continue.");
      return;
    }
    setIsSubmitting(true);
    try {
      await doLogin(false);
    } catch {
      setError(friendlyError("Failed to fetch"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForceLogin = async () => {
    if (!agreeTerms) {
      setError("Please agree to the Terms and Conditions to continue.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      const result = await doLogin(true);
      if (!result?.conflict) setConflict(null);
    } catch {
      setError(friendlyError("Failed to fetch"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
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
  };
}

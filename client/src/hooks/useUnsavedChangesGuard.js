import { useEffect, useState, useCallback, useRef } from "react";
import { useBlocker, useNavigate } from "react-router-dom";

/**
 * Blocks in-app navigation and warns on reload when the form is dirty.
 * Returns navigateSafely() to leave without the confirmation dialog (e.g. after save).
 */
export function useUnsavedChangesGuard(isDirty, { enabled = true } = {}) {
  const navigate = useNavigate();
  const bypassRef = useRef(false);
  const active = enabled && Boolean(isDirty) && !bypassRef.current;
  const blocker = useBlocker(() => {
    if (bypassRef.current) return false;
    return enabled && Boolean(isDirty);
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reloadPending, setReloadPending] = useState(false);

  useEffect(() => {
    if (blocker.state === "blocked") {
      setReloadPending(false);
      setDialogOpen(true);
    }
  }, [blocker.state]);

  useEffect(() => {
    if (!(enabled && isDirty)) return undefined;
    const onKeyDown = (e) => {
      const isReloadKey = e.key === "F5" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r");
      if (!isReloadKey) return;
      e.preventDefault();
      setReloadPending(true);
      setDialogOpen(true);
    };
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [enabled, isDirty]);

  const stayOnPage = useCallback(() => {
    if (blocker.state === "blocked") blocker.reset();
    setReloadPending(false);
    setDialogOpen(false);
  }, [blocker]);

  const leavePage = useCallback(() => {
    if (reloadPending) {
      setReloadPending(false);
      setDialogOpen(false);
      // Allow the real reload without beforeunload fighting us
      bypassRef.current = true;
      window.location.reload();
      return;
    }
    if (blocker.state === "blocked") blocker.proceed();
    setDialogOpen(false);
  }, [blocker, reloadPending]);

  const navigateSafely = useCallback(
    (to, options) => {
      bypassRef.current = true;
      setDialogOpen(false);
      setReloadPending(false);
      navigate(to, options);
    },
    [navigate]
  );

  return { dialogOpen, stayOnPage, leavePage, reloadPending, navigateSafely, active };
}

import { useMemo } from "react";
import { useUnsavedChangesGuard } from "./useUnsavedChangesGuard";

/**
 * Compares a form value with a serialized baseline and wires the shared
 * leave/reload confirmation behavior.
 */
export function useFormUnsavedGuard(
  value,
  { baseline, enabled = true, serialize = JSON.stringify } = {}
) {
  const current = useMemo(() => serialize(value), [serialize, value]);
  const isDirty = baseline != null && current !== baseline;
  const guard = useUnsavedChangesGuard(isDirty, {
    enabled: enabled && baseline != null,
  });

  return { ...guard, isDirty };
}

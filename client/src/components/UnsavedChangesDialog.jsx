import { Modal } from "./Modal";
import { Button } from "./Button";
import { useT } from "../context/LanguageContext";

export function UnsavedChangesDialog({ open, onStay, onDiscard, reloadPending = false }) {
  const t = useT();
  return (
    <Modal
      open={open}
      onClose={onStay}
      title="Unsaved changes"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onStay}>
            Stay on page
          </Button>
          <Button type="button" variant="danger" onClick={onDiscard}>
            {reloadPending ? t("Reload without saving") : t("Discard changes")}
          </Button>
        </>
      }
    >
      <p>
        {reloadPending
          ? t("You have unsaved changes. Reloading will discard them.")
          : t("You have unsaved changes. Save your work or discard changes before leaving this page.")}
      </p>
    </Modal>
  );
}

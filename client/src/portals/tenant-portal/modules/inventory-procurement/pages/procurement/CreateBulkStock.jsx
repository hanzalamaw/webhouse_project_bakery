import { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { apiFetch } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { FormField } from "../../../../../../components/FormField";
import { Button } from "../../../../../../components/Button";
import { SearchableSelect } from "../../../../../../components/SearchableSelect";
import { useInventoryReference } from "../../hooks/useInventoryReference";
import { MODULE_BASE } from "../../constants";
import { FormBlock } from "../../../../../../components/FormBlock";
import { FormPageLayout, FormActions } from "../../../../../../components/FormPageLayout";
import { UnsavedChangesDialog } from "../../../../../../components/UnsavedChangesDialog";
import { useFormUnsavedGuard } from "../../../../../../hooks/useFormUnsavedGuard";
import ProductPicker from "../../components/ProductPicker";

const CONFIG = {
  "stock-in": {
    title: "Record Stock In",
    description: "Add stock for one or more items into a branch.",
    submitLabel: "Record Stock In",
    backPath: `${MODULE_BASE}/stock/stock-in`,
  },
  "stock-out": {
    title: "Record Stock Out",
    description: "Remove stock for one or more items from a branch.",
    submitLabel: "Record Stock Out",
    backPath: `${MODULE_BASE}/stock/stock-out`,
  },
  transfer: {
    title: "Transfer between branches",
    description: "Move stock for one or more items from one branch to another.",
    submitLabel: "Create Transfer",
    backPath: `${MODULE_BASE}/stock/transfers`,
  },
};

function resolveOperation(pathname) {
  if (pathname.includes("/stock-out/create")) return "stock-out";
  if (pathname.includes("/transfers/create")) return "transfer";
  return "stock-in";
}

const EMPTY_BULK_STATE = {
  selectedIds: [],
  branchId: "",
  fromBranchId: "",
  toBranchId: "",
  sameQtyForAll: true,
  sharedQty: "",
  sharedNotes: "",
  lineDetails: {},
  completeNow: true,
};

export default function CreateBulkStock() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const operation = resolveOperation(pathname);
  const config = CONFIG[operation];
  const { authFetch } = useAuth();
  const { items, branches } = useInventoryReference();

  const [selectedIds, setSelectedIds] = useState([]);
  const [itemSearch, setItemSearch] = useState("");
  const [branchId, setBranchId] = useState("");
  const [fromBranchId, setFromBranchId] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [sameQtyForAll, setSameQtyForAll] = useState(true);
  const [sharedQty, setSharedQty] = useState("");
  const [sharedNotes, setSharedNotes] = useState("");
  const [lineDetails, setLineDetails] = useState({});
  const [completeNow, setCompleteNow] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const branchOptions = useMemo(
    () => branches.map((b) => ({ value: String(b.id), label: b.branch_name })),
    [branches]
  );

  const selectedItems = useMemo(
    () => items.filter((p) => selectedIds.includes(String(p.id))),
    [items, selectedIds]
  );

  const formState = useMemo(
    () => ({
      selectedIds,
      branchId,
      fromBranchId,
      toBranchId,
      sameQtyForAll,
      sharedQty,
      sharedNotes,
      lineDetails,
      completeNow,
    }),
    [
      selectedIds,
      branchId,
      fromBranchId,
      toBranchId,
      sameQtyForAll,
      sharedQty,
      sharedNotes,
      lineDetails,
      completeNow,
    ]
  );
  const { dialogOpen, stayOnPage, leavePage, reloadPending, navigateSafely } =
    useFormUnsavedGuard(formState, { baseline: JSON.stringify(EMPTY_BULK_STATE) });

  const toggleItem = (id) => {
    const sid = String(id);
    setSelectedIds((prev) => {
      if (prev.includes(sid)) {
        setLineDetails((d) => {
          const next = { ...d };
          delete next[sid];
          return next;
        });
        return prev.filter((x) => x !== sid);
      }
      return [...prev, sid];
    });
  };

  const setLine = (id, field, value) => {
    const sid = String(id);
    setLineDetails((d) => ({ ...d, [sid]: { ...d[sid], [field]: value } }));
  };

  const lineQty = (id) => (sameQtyForAll ? Number(sharedQty) : Number(lineDetails[id]?.qty || 0));
  const lineNotes = (id) => (sameQtyForAll ? sharedNotes : lineDetails[id]?.notes) || null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedIds.length) {
      setError("Select at least one item");
      return;
    }
    if (operation === "transfer") {
      if (!fromBranchId || !toBranchId) {
        setError("Select source and destination branches");
        return;
      }
      if (fromBranchId === toBranchId) {
        setError("Source and destination must differ");
        return;
      }
    } else if (!branchId) {
      setError("Select a branch");
      return;
    }
    if (sameQtyForAll && (!sharedQty || Number(sharedQty) <= 0)) {
      setError("Enter a valid quantity");
      return;
    }
    if (!sameQtyForAll && selectedIds.some((id) => lineQty(id) <= 0)) {
      setError("Enter a valid quantity for each item");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      if (operation === "stock-in") {
        await apiFetch(
          "/inventory/stock-movements/stock-in/bulk",
          {
            method: "POST",
            body: JSON.stringify({
              branch_id: Number(branchId),
              items: selectedIds.map((id) => ({
                item_id: Number(id),
                qty: lineQty(id),
                notes: lineNotes(id),
                unit_cost: lineDetails[id]?.unit_cost != null && lineDetails[id]?.unit_cost !== ""
                  ? Number(lineDetails[id].unit_cost)
                  : undefined,
                expiry_date: lineDetails[id]?.expiry_date || null,
              })),
            }),
          },
          authFetch
        );
      } else if (operation === "stock-out") {
        for (const id of selectedIds) {
          await apiFetch(
            "/inventory/stock-movements/stock-out",
            {
              method: "POST",
              body: JSON.stringify({
                branch_id: Number(branchId),
                item_id: Number(id),
                qty: lineQty(id),
                notes: lineNotes(id),
              }),
            },
            authFetch
          );
        }
      } else {
        for (const id of selectedIds) {
          await apiFetch(
            "/inventory/stock-transfers",
            {
              method: "POST",
              body: JSON.stringify({
                item_id: Number(id),
                from_branch_id: Number(fromBranchId),
                to_branch_id: Number(toBranchId),
                qty: lineQty(id),
                notes: lineNotes(id),
                complete: completeNow,
              }),
            },
            authFetch
          );
        }
      }
      navigateSafely(config.backPath);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="wh-page">
      <FormPageLayout>
        <PageHeader
          title={config.title}
          description={config.description}
          actions={
            <Button variant="secondary" onClick={() => navigate(config.backPath)}>
              Back to history
            </Button>
          }
        />

        <form onSubmit={handleSubmit} className="wh-form-stack">
          <FormBlock title="Select items" description="Tap cards to choose one or more bakery items for this operation.">
            <ProductPicker
              items={items}
              selectedIds={selectedIds}
              onToggle={toggleItem}
              search={itemSearch}
              onSearchChange={setItemSearch}
              tall
              entityLabel="items"
            />
          </FormBlock>

          <FormBlock
            title="Branch"
            description={operation === "transfer" ? "Select source and destination branches." : "Select the branch for this stock movement."}
          >
            {operation === "transfer" ? (
              <div className="wh-form-grid">
                <SearchableSelect
                  id="from_br"
                  label="From branch"
                  options={branchOptions}
                  value={fromBranchId}
                  onChange={setFromBranchId}
                  placeholder="Source branch…"
                />
                <SearchableSelect
                  id="to_br"
                  label="To branch"
                  options={branchOptions}
                  value={toBranchId}
                  onChange={setToBranchId}
                  placeholder="Destination branch…"
                />
              </div>
            ) : (
              <SearchableSelect
                id="branch_id"
                label="Branch"
                options={branchOptions}
                value={branchId}
                onChange={setBranchId}
                placeholder="Select branch…"
              />
            )}
            {operation === "transfer" && (
              <label className="wh-checkbox-item wh-inv-checkbox-inline">
                <input type="checkbox" checked={completeNow} onChange={(e) => setCompleteNow(e.target.checked)} />
                <span>Receive immediately at destination</span>
              </label>
            )}
          </FormBlock>

          <FormBlock title="Quantities & notes" description="Set quantities and notes for the selected items.">
            <label className="wh-checkbox-item wh-inv-checkbox-inline">
              <input type="checkbox" checked={sameQtyForAll} onChange={(e) => setSameQtyForAll(e.target.checked)} />
              <span>Same quantity for all</span>
            </label>

            {sameQtyForAll ? (
              <div className="wh-form-grid">
                <FormField id="shared_qty" label="Quantity" type="number" min="1" step="any" value={sharedQty} onChange={(e) => setSharedQty(e.target.value)} required />
                <FormField id="shared_notes" label="Notes" value={sharedNotes} onChange={(e) => setSharedNotes(e.target.value)} />
              </div>
            ) : (
              <div className="wh-inv-line-items">
                {selectedItems.length === 0 ? (
                  <p className="wh-muted">Select items above to enter individual quantities.</p>
                ) : (
                  selectedItems.map((p) => (
                    <div key={p.id} className="wh-inv-line-item">
                      <div className="wh-inv-line-item__head">
                        <strong>{p.item_name}</strong>
                        <span className="wh-muted">{p.sku || p.unit}</span>
                      </div>
                      <div className="wh-form-grid">
                        <FormField
                          id={`qty_${p.id}`}
                          label="Quantity"
                          type="number"
                          min="1"
                          step="any"
                          value={lineDetails[String(p.id)]?.qty || ""}
                          onChange={(e) => setLine(p.id, "qty", e.target.value)}
                          required
                        />
                        {operation === "stock-in" && (
                          <FormField
                            id={`cost_${p.id}`}
                            label="Unit cost (optional)"
                            type="number"
                            min="0"
                            step="0.01"
                            value={lineDetails[String(p.id)]?.unit_cost || ""}
                            onChange={(e) => setLine(p.id, "unit_cost", e.target.value)}
                          />
                        )}
                        {operation === "stock-in" && (
                          <FormField
                            id={`exp_${p.id}`}
                            label="Expiry date"
                            type="date"
                            value={lineDetails[String(p.id)]?.expiry_date || ""}
                            onChange={(e) => setLine(p.id, "expiry_date", e.target.value)}
                          />
                        )}
                        <FormField
                          id={`notes_${p.id}`}
                          label="Notes"
                          value={lineDetails[String(p.id)]?.notes || ""}
                          onChange={(e) => setLine(p.id, "notes", e.target.value)}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </FormBlock>

          {error && <p className="wh-field__error">{error}</p>}

          <FormActions>
            <Button type="button" variant="secondary" onClick={() => navigate(config.backPath)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : config.submitLabel}
            </Button>
          </FormActions>
        </form>
      </FormPageLayout>
      <UnsavedChangesDialog
        open={dialogOpen}
        onStay={stayOnPage}
        onDiscard={leavePage}
        reloadPending={reloadPending}
      />
    </div>
  );
}

import { useState, useMemo, useEffect } from "react";
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
import {
  NOTES_MAX,
  clampNotes,
  expiryError,
  hasAnyError,
  nonNegNumberError,
  notesError,
  positiveQtyError,
  requiredText,
  stockExceedsError,
  visibleError,
} from "../../utils/validation";

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
  sameExpiryForAll: false,
  sharedQty: "",
  sharedNotes: "",
  sharedExpiryDate: "",
  lineDetails: {},
  completeNow: true,
};

function qtyLabel(unit) {
  return unit ? `Quantity/${unit}` : "Quantity";
}

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
  const [sameExpiryForAll, setSameExpiryForAll] = useState(false);
  const [sharedQty, setSharedQty] = useState("");
  const [sharedNotes, setSharedNotes] = useState("");
  const [sharedExpiryDate, setSharedExpiryDate] = useState("");
  const [lineDetails, setLineDetails] = useState({});
  const [completeNow, setCompleteNow] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [availableByItem, setAvailableByItem] = useState({});

  const branchOptions = useMemo(
    () => branches.map((b) => ({ value: String(b.id), label: b.branch_name })),
    [branches]
  );

  const selectedItems = useMemo(
    () => items.filter((p) => selectedIds.includes(String(p.id))),
    [items, selectedIds]
  );

  const sharedQtyLabel = useMemo(() => {
    const units = [...new Set(selectedItems.map((p) => p.unit).filter(Boolean))];
    return units.length === 1 ? qtyLabel(units[0]) : "Quantity";
  }, [selectedItems]);

  const stockBranchId = operation === "transfer" ? fromBranchId : branchId;

  useEffect(() => {
    if ((operation !== "stock-out" && operation !== "transfer") || !stockBranchId) {
      setAvailableByItem({});
      return;
    }
    let cancelled = false;
    apiFetch(`/inventory/branches/${stockBranchId}`, {}, authFetch)
      .then((data) => {
        if (cancelled) return;
        const map = {};
        (data.stock_levels || []).forEach((row) => {
          map[String(row.item_id)] = Number(row.available_qty) || 0;
        });
        setAvailableByItem(map);
      })
      .catch(() => {
        if (!cancelled) setAvailableByItem({});
      });
    return () => {
      cancelled = true;
    };
  }, [operation, stockBranchId, authFetch]);

  const lineQty = (id) => (sameQtyForAll ? Number(sharedQty) : Number(lineDetails[id]?.qty || 0));
  const lineNotes = (id) => (sameQtyForAll ? sharedNotes : lineDetails[id]?.notes) || null;
  const lineExpiry = (id) =>
    sameExpiryForAll ? sharedExpiryDate || null : lineDetails[id]?.expiry_date || null;

  const fieldErrors = useMemo(() => {
    const errs = {};
    errs.items = selectedIds.length ? "" : "Select at least one item";
    if (operation === "transfer") {
      errs.fromBranchId = requiredText(fromBranchId, "From branch");
      errs.toBranchId = requiredText(toBranchId, "To branch");
      if (!errs.fromBranchId && !errs.toBranchId && fromBranchId === toBranchId) {
        errs.toBranchId = "Source and destination must differ";
      }
    } else {
      errs.branchId = requiredText(branchId, "Branch");
    }

    if (sameQtyForAll) {
      errs.sharedQty = positiveQtyError(sharedQty);
      errs.sharedNotes = notesError(sharedNotes);
      if (operation === "stock-out" || operation === "transfer") {
        for (const id of selectedIds) {
          const avail = availableByItem[id] ?? 0;
          const stockErr = stockExceedsError(sharedQty, avail);
          if (stockErr) {
            errs.sharedQty = stockErr;
            break;
          }
        }
      }
    } else {
      errs.sharedNotes = "";
    }

    if (operation === "stock-in" && sameExpiryForAll) {
      errs.sharedExpiryDate = expiryError(sharedExpiryDate);
    }

    const lines = {};
    for (const p of selectedItems) {
      const sid = String(p.id);
      const line = lineDetails[sid] || {};
      const row = {};
      if (!sameQtyForAll) {
        row.qty = positiveQtyError(line.qty);
        if ((operation === "stock-out" || operation === "transfer") && !row.qty) {
          row.qty = stockExceedsError(line.qty, availableByItem[sid] ?? 0);
        }
        row.notes = notesError(line.notes);
      }
      if (operation === "stock-in") {
        const costVal =
          line.unit_cost != null && line.unit_cost !== ""
            ? line.unit_cost
            : p.cost_price != null
              ? String(p.cost_price)
              : "";
        row.unit_cost = nonNegNumberError(costVal, "Unit cost");
        if (!sameExpiryForAll) row.expiry_date = expiryError(line.expiry_date);
      }
      if (Object.values(row).some(Boolean)) lines[sid] = row;
    }
    errs.lines = lines;
    return errs;
  }, [
    selectedIds,
    selectedItems,
    operation,
    branchId,
    fromBranchId,
    toBranchId,
    sameQtyForAll,
    sameExpiryForAll,
    sharedQty,
    sharedNotes,
    sharedExpiryDate,
    lineDetails,
    availableByItem,
  ]);

  const show = (err) => visibleError(attempted, err);

  // Realtime: invalid qty / stock exceed when qty typed
  const sharedQtyRealtime = useMemo(() => {
    if (!sameQtyForAll || sharedQty === "") return "";
    const qtyErr = positiveQtyError(sharedQty);
    if (qtyErr) return qtyErr;
    if (operation === "stock-out" || operation === "transfer") {
      for (const id of selectedIds) {
        const stockErr = stockExceedsError(sharedQty, availableByItem[id] ?? 0);
        if (stockErr) return stockErr;
      }
    }
    return "";
  }, [sameQtyForAll, sharedQty, operation, selectedIds, availableByItem]);

  // Realtime: same-branch transfer when both filled
  const toBranchRealtime =
    operation === "transfer" && fromBranchId && toBranchId && fromBranchId === toBranchId
      ? "Source and destination must differ"
      : "";

  const formState = useMemo(
    () => ({
      selectedIds,
      branchId,
      fromBranchId,
      toBranchId,
      sameQtyForAll,
      sameExpiryForAll,
      sharedQty,
      sharedNotes,
      sharedExpiryDate,
      lineDetails,
      completeNow,
    }),
    [
      selectedIds,
      branchId,
      fromBranchId,
      toBranchId,
      sameQtyForAll,
      sameExpiryForAll,
      sharedQty,
      sharedNotes,
      sharedExpiryDate,
      lineDetails,
      completeNow,
    ]
  );
  const { dialogOpen, stayOnPage, leavePage, reloadPending, navigateSafely } =
    useFormUnsavedGuard(formState, { baseline: JSON.stringify(EMPTY_BULK_STATE) });

  const toggleItem = (id) => {
    const sid = String(id);
    if (selectedIds.includes(sid)) {
      setSelectedIds((prev) => prev.filter((x) => x !== sid));
      setLineDetails((d) => {
        const next = { ...d };
        delete next[sid];
        return next;
      });
      return;
    }
    const item = items.find((p) => String(p.id) === sid);
    const cost =
      item?.cost_price != null && item.cost_price !== "" ? String(item.cost_price) : "";
    setSelectedIds((prev) => [...prev, sid]);
    setLineDetails((d) => ({
      ...d,
      [sid]: { ...d[sid], unit_cost: cost },
    }));
  };

  const setLine = (id, field, value) => {
    const sid = String(id);
    const nextValue = field === "notes" ? clampNotes(value) : value;
    setLineDetails((d) => ({ ...d, [sid]: { ...d[sid], [field]: nextValue } }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAttempted(true);
    if (hasAnyError(fieldErrors)) {
      setError("Please fix the highlighted fields");
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
                unit_cost: (() => {
                  const raw = lineDetails[id]?.unit_cost;
                  if (raw != null && raw !== "") return Number(raw);
                  const item = items.find((p) => String(p.id) === String(id));
                  return item?.cost_price != null && item.cost_price !== ""
                    ? Number(item.cost_price)
                    : undefined;
                })(),
                expiry_date: lineExpiry(id),
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

  const useSplitLayout = operation === "stock-in";

  const itemsBlock = (
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
      {show(fieldErrors.items) ? <p className="wh-field__error">{show(fieldErrors.items)}</p> : null}
    </FormBlock>
  );

  const detailsBlocks = (
    <>
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
              error={show(fieldErrors.fromBranchId)}
            />
            <SearchableSelect
              id="to_br"
              label="To branch"
              options={branchOptions}
              value={toBranchId}
              onChange={setToBranchId}
              placeholder="Destination branch…"
              error={toBranchRealtime || show(fieldErrors.toBranchId)}
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
            error={show(fieldErrors.branchId)}
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
        <div className="wh-inv-checkbox-row">
          <label className="wh-checkbox-item wh-inv-checkbox-inline">
            <input type="checkbox" checked={sameQtyForAll} onChange={(e) => setSameQtyForAll(e.target.checked)} />
            <span>Same quantity for all</span>
          </label>
          {operation === "stock-in" && (
            <label className="wh-checkbox-item wh-inv-checkbox-inline">
              <input
                type="checkbox"
                checked={sameExpiryForAll}
                onChange={(e) => setSameExpiryForAll(e.target.checked)}
              />
              <span>Same expiry date for all</span>
            </label>
          )}
        </div>

        {(sameQtyForAll || (operation === "stock-in" && sameExpiryForAll)) && (
          <div className="wh-form-grid">
            {sameQtyForAll && (
              <>
                <FormField
                  id="shared_qty"
                  label={sharedQtyLabel}
                  type="number"
                  min="1"
                  step="any"
                  value={sharedQty}
                  onChange={(e) => setSharedQty(e.target.value)}
                  required
                  error={sharedQtyRealtime || show(fieldErrors.sharedQty)}
                />
                <FormField
                  id="shared_notes"
                  label="Notes"
                  value={sharedNotes}
                  onChange={(e) => setSharedNotes(clampNotes(e.target.value))}
                  maxLength={NOTES_MAX}
                  error={fieldErrors.sharedNotes}
                />
              </>
            )}
            {operation === "stock-in" && sameExpiryForAll && (
              <FormField
                id="shared_expiry"
                label="Expiry date"
                type="date"
                value={sharedExpiryDate}
                onChange={(e) => setSharedExpiryDate(e.target.value)}
                error={fieldErrors.sharedExpiryDate}
              />
            )}
          </div>
        )}

        {!useSplitLayout && show(fieldErrors.items) ? (
          <p className="wh-field__error">{show(fieldErrors.items)}</p>
        ) : null}

        <div className="wh-inv-line-items">
          {selectedItems.length === 0 ? (
            <p className="wh-muted">
              {useSplitLayout ? "Select items on the left to enter quantities and details." : "Select items above to enter quantities and details."}
            </p>
          ) : (
            selectedItems.map((p) => {
              const sid = String(p.id);
              const line = lineDetails[sid] || {};
              const lineErr = fieldErrors.lines?.[sid] || {};
              const needQty = !sameQtyForAll;
              const needCost = operation === "stock-in";
              const needExpiry = operation === "stock-in" && !sameExpiryForAll;
              const needNotes = !sameQtyForAll;
              const hasFields = needQty || needCost || needExpiry || needNotes;
              const available =
                (operation === "stock-out" || operation === "transfer") && stockBranchId
                  ? availableByItem[sid]
                  : null;
              const qtyRealtime =
                needQty && line.qty !== ""
                  ? positiveQtyError(line.qty) ||
                    ((operation === "stock-out" || operation === "transfer")
                      ? stockExceedsError(line.qty, availableByItem[sid] ?? 0)
                      : "")
                  : "";
              const costVal =
                line.unit_cost != null && line.unit_cost !== ""
                  ? line.unit_cost
                  : p.cost_price != null && p.cost_price !== ""
                    ? String(p.cost_price)
                    : "";
              const costRealtime =
                needCost && costVal !== "" ? nonNegNumberError(costVal, "Unit cost") : "";
              return (
                <div key={p.id} className="wh-inv-line-item">
                  <div className="wh-inv-line-item__head">
                    <strong>{p.item_name}</strong>
                    <span className="wh-muted">
                      {p.sku || p.unit}
                      {available != null ? ` · Available: ${available ?? 0}` : ""}
                    </span>
                  </div>
                  {hasFields && (
                    <div className="wh-form-grid">
                      {needQty && (
                        <FormField
                          id={`qty_${p.id}`}
                          label={qtyLabel(p.unit)}
                          type="number"
                          min="1"
                          step="any"
                          value={line.qty || ""}
                          onChange={(e) => setLine(p.id, "qty", e.target.value)}
                          required
                          error={qtyRealtime || show(lineErr.qty)}
                        />
                      )}
                      {needCost && (
                        <FormField
                          id={`cost_${p.id}`}
                          label="Unit cost"
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            line.unit_cost != null
                              ? line.unit_cost
                              : p.cost_price != null && p.cost_price !== ""
                                ? String(p.cost_price)
                                : ""
                          }
                          onChange={(e) => setLine(p.id, "unit_cost", e.target.value)}
                          error={costRealtime || show(lineErr.unit_cost)}
                        />
                      )}
                      {needExpiry && (
                        <FormField
                          id={`exp_${p.id}`}
                          label="Expiry date"
                          type="date"
                          value={line.expiry_date || ""}
                          onChange={(e) => setLine(p.id, "expiry_date", e.target.value)}
                          error={lineErr.expiry_date}
                        />
                      )}
                      {needNotes && (
                        <FormField
                          id={`notes_${p.id}`}
                          label="Notes"
                          value={line.notes || ""}
                          onChange={(e) => setLine(p.id, "notes", e.target.value)}
                          maxLength={NOTES_MAX}
                          error={lineErr.notes}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </FormBlock>

      {error && attempted && <p className="wh-field__error">{error}</p>}

      <FormActions>
        <Button type="button" variant="secondary" onClick={() => navigate(config.backPath)}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : config.submitLabel}
        </Button>
      </FormActions>
    </>
  );

  return (
    <div className={`wh-page${useSplitLayout ? " wh-page--wide" : ""}`}>
      <FormPageLayout wide={useSplitLayout}>
        <PageHeader
          title={config.title}
          description={config.description}
          actions={
            <Button variant="secondary" onClick={() => navigate(config.backPath)}>
              Back to history
            </Button>
          }
        />

        <form onSubmit={handleSubmit} className={`wh-form-stack${useSplitLayout ? " wh-inv-split-form" : ""}`}>
          {useSplitLayout ? (
            <div className="wh-inv-split">
              <aside className="wh-inv-split__left">{itemsBlock}</aside>
              <div className="wh-inv-split__right">{detailsBlocks}</div>
            </div>
          ) : (
            <>
              {itemsBlock}
              {detailsBlocks}
            </>
          )}
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

import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { useModulePermission } from "../../../../../../hooks/useModulePermission";
import { apiFetch } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { Button } from "../../../../../../components/Button";
import { StatusBadge } from "../../../../../../components/Badge";
import { DetailGrid, DetailValue, RecordViewSummary } from "../../../../../../components/RecordView";
import { ViewKpi, ViewPanel, formatCount } from "../../../../../../components/EntityViewLayout";
import { ProductIcon, WarehouseIcon, LogsIcon } from "../../../../../../components/icons";
import { formatDateTime, formatDate } from "../../../../../../utils/dateTime";
import { formatPKR } from "../../../../../../utils/currency";
import { formatTotalPrice } from "../../utils/pricing";
import { ITEM_TYPE_LABELS, MODULE_BASE } from "../../constants";

export default function ItemView() {
  const { itemId } = useParams();
  const { authFetch } = useAuth();
  const { canEdit } = useModulePermission("stock-purchasing");
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItem(await apiFetch(`/inventory/items/${itemId}`, {}, authFetch));
    } catch (e) {
      setItem(null);
      setError(e.message || "Item not found");
    } finally {
      setLoading(false);
    }
  }, [authFetch, itemId]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const stockLevels = item?.stock_levels || [];
  const batches = item?.batches || [];

  const stats = useMemo(() => {
    if (!item) return null;
    const available = Number(item.total_available) || 0;
    const reserved = Number(item.total_reserved) || 0;
    const damaged = Number(item.total_damaged) || 0;
    const value = available * (Number(item.cost_price) || 0);
    const lowBranches = stockLevels.filter(
      (row) => Number(row.available_qty) <= Number(item.low_stock_threshold || 0)
    ).length;
    const expiringSoon = batches.filter((b) => b.days_left != null && Number(b.days_left) <= 7).length;
    return { available, reserved, damaged, value, lowBranches, expiringSoon, branchCount: stockLevels.length };
  }, [item, stockLevels, batches]);

  if (loading) {
    return <div className="wh-page wh-page--wide"><p className="wh-muted">Loading…</p></div>;
  }

  if (!item) {
    return (
      <div className="wh-page wh-page--wide">
        <div className="wh-alert wh-alert--error">{error || "Item not found"}</div>
        <Button variant="secondary" onClick={() => navigate(`${MODULE_BASE}/items/manage`)}>Back</Button>
      </div>
    );
  }

  return (
    <div className="wh-page wh-page--wide">
      <PageHeader
        title="Item details"
        description="Stock levels, pricing, and batch overview."
        actions={
          <div className="wh-action-btns">
            <Button variant="secondary" onClick={() => navigate(`${MODULE_BASE}/items/manage`)}>Back</Button>
            {canEdit && (
              <Button onClick={() => navigate(`${MODULE_BASE}/items/edit/${item.id}`)}>Edit item</Button>
            )}
          </div>
        }
      />

      {error && <div className="wh-alert wh-alert--error">{error}</div>}

      <RecordViewSummary
        title={item.item_name}
        subtitle={item.category_name || ITEM_TYPE_LABELS[item.item_type] || item.item_type}
        status={item.status}
        chips={[
          { label: "Unit", value: item.unit || "—" },
          { label: "SKU", value: item.sku || "—" },
          { label: "Branches", value: formatCount(stats.branchCount) },
        ]}
      />

      <div className="wh-dash-grid">
        <div className="wh-dash-col-3">
          <ViewKpi
            label="Available stock"
            value={formatCount(stats.available)}
            hint={`${formatCount(stats.reserved)} reserved · ${formatCount(stats.damaged)} damaged`}
            tone="success"
            icon={<ProductIcon />}
          />
        </div>
        <div className="wh-dash-col-3">
          <ViewKpi
            label="Stock value (cost)"
            value={formatPKR(stats.value)}
            hint={`Retail ${formatPKR(item.selling_price)} / unit`}
            tone="accent"
          />
        </div>
        <div className="wh-dash-col-3">
          <ViewKpi
            label="Low-stock branches"
            value={formatCount(stats.lowBranches)}
            hint={`Threshold ${formatCount(item.low_stock_threshold)} ${item.unit || ""}`.trim()}
            tone={stats.lowBranches > 0 ? "warning" : "default"}
            icon={<WarehouseIcon />}
          />
        </div>
        <div className="wh-dash-col-3">
          <ViewKpi
            label="Expiring ≤ 7 days"
            value={formatCount(stats.expiringSoon)}
            hint={`${formatCount(batches.length)} active batches`}
            tone={stats.expiringSoon > 0 ? "danger" : "default"}
            icon={<LogsIcon />}
          />
        </div>
      </div>

      <div className="wh-dash-grid">
        <div className="wh-dash-col-8">
          <ViewPanel title="Stock by branch" subtitle="Available units per location" flush>
            {stockLevels.length ? (
              <table className="wh-table">
                <thead>
                  <tr>
                    <th>Branch</th>
                    <th>Available</th>
                    <th>Reserved</th>
                    <th>Damaged</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stockLevels.map((row) => {
                    const low = Number(row.available_qty) <= Number(item.low_stock_threshold || 0);
                    return (
                      <tr key={row.branch_id || row.branch_name}>
                        <td>{row.branch_name}</td>
                        <td>{formatCount(row.available_qty)}</td>
                        <td>{formatCount(row.reserved_qty)}</td>
                        <td>{formatCount(row.damaged_qty)}</td>
                        <td><StatusBadge status={low ? "pending" : "active"} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="wh-panel__empty">No stock recorded for this item yet.</p>
            )}
          </ViewPanel>
        </div>
        <div className="wh-dash-col-4">
          <ViewPanel title="Active batches" subtitle="Remaining qty & expiry" flush>
            {batches.length ? (
              <table className="wh-table">
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>Qty</th>
                    <th>Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.slice(0, 12).map((b) => (
                    <tr key={b.id || b.batch_no}>
                      <td>
                        <div>{b.batch_no || "—"}</div>
                        <div className="wh-muted" style={{ fontSize: 12 }}>{b.branch_name}</div>
                      </td>
                      <td>{formatCount(b.qty_remaining)}</td>
                      <td className="wh-muted">
                        {b.expiry_date ? formatDate(b.expiry_date) : "—"}
                        {b.days_left != null ? ` · ${b.days_left}d` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="wh-panel__empty">No active batches with remaining quantity.</p>
            )}
          </ViewPanel>
        </div>
      </div>

      <ViewPanel title="Item details" subtitle="Pricing, type, and metadata">
        <DetailGrid columns={3}>
          <DetailValue label="Type">{ITEM_TYPE_LABELS[item.item_type] || item.item_type}</DetailValue>
          <DetailValue label="Category">{item.category_name || "—"}</DetailValue>
          <DetailValue label="Unit">{item.unit || "—"}</DetailValue>
          <DetailValue label="Cost price" highlight>{formatPKR(item.cost_price)}</DetailValue>
          {item.is_sold ? (
            <>
              <DetailValue label="Selling price">{formatPKR(item.selling_price)}</DetailValue>
              <DetailValue label="Total price">{formatTotalPrice(item.selling_price, item.discount, item.tax)}</DetailValue>
              <DetailValue label="Discount">{formatPKR(item.discount)}</DetailValue>
              <DetailValue label="Tax">{formatPKR(item.tax)}</DetailValue>
            </>
          ) : null}
          <DetailValue label="Shelf life">
            {item.shelf_life_days != null ? `${item.shelf_life_days} ${item.shelf_life_unit || "days"}` : "—"}
          </DetailValue>
          <DetailValue label="Flags">
            {[
              item.is_purchased ? "Purchased" : null,
              item.is_produced ? "Produced" : null,
              item.is_sold ? "Sold" : null,
            ].filter(Boolean).join(" · ") || "—"}
          </DetailValue>
          <DetailValue label="Created">{formatDateTime(item.created_at)}</DetailValue>
          <DetailValue label="Updated">{formatDateTime(item.updated_at)}</DetailValue>
        </DetailGrid>
      </ViewPanel>
    </div>
  );
}

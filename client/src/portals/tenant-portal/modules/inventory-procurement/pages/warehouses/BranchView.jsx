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
import { formatDateTime } from "../../../../../../utils/dateTime";
import { formatPKR } from "../../../../../../utils/currency";
import { useT } from "../../../../../../context/LanguageContext";
import { ITEM_TYPE_LABELS, MODULE_BASE, MOVEMENT_LABELS } from "../../constants";

export default function BranchView() {
  const { branchId } = useParams();
  const { authFetch } = useAuth();
  const { canEdit } = useModulePermission("stock-purchasing");
  const navigate = useNavigate();
  const t = useT();
  const [branch, setBranch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setBranch(await apiFetch(`/inventory/branches/${branchId}`, {}, authFetch));
    } catch (e) {
      setBranch(null);
      setError(e.message || "Branch not found");
    } finally {
      setLoading(false);
    }
  }, [authFetch, branchId]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const stockLevels = branch?.stock_levels || [];
  const movements = branch?.recent_movements || [];

  const hours = useMemo(() => {
    if (!branch) return "—";
    if (!branch.open_time && !branch.close_time) return "—";
    return `${branch.open_time || "—"} – ${branch.close_time || "—"}`;
  }, [branch]);

  if (loading) {
    return <div className="wh-page wh-page--wide"><p className="wh-muted">Loading…</p></div>;
  }

  if (!branch) {
    return (
      <div className="wh-page wh-page--wide">
        <div className="wh-alert wh-alert--error">{error || "Branch not found"}</div>
        <Button variant="secondary" onClick={() => navigate(`${MODULE_BASE}/branches`)}>Back</Button>
      </div>
    );
  }

  const lowStock = Number(branch.low_stock_count || 0);

  return (
    <div className="wh-page wh-page--wide">
      <PageHeader
        title="Branch details"
        description="Stock on hand, items, and recent movement activity."
        actions={
          <div className="wh-action-btns">
            <Button variant="secondary" onClick={() => navigate(`${MODULE_BASE}/branches`)}>Back</Button>
            {canEdit && (
              <Button onClick={() => navigate(`${MODULE_BASE}/branches/edit/${branch.id}`)}>Edit branch</Button>
            )}
          </div>
        }
      />

      {error && <div className="wh-alert wh-alert--error">{error}</div>}

      <RecordViewSummary
        title={branch.branch_name}
        subtitle={[branch.code, branch.city, branch.location].filter(Boolean).join(" · ") || "No location set"}
        status={branch.status}
        chips={[
          { label: "Items", value: formatCount(branch.item_count) },
          { label: "Hours", value: hours },
        ]}
      />

      <div className="wh-dash-grid">
        <div className="wh-dash-col-3">
          <ViewKpi
            label="Total units"
            value={formatCount(branch.total_units)}
            hint={`${formatCount(branch.item_count)} items`}
            tone="success"
            icon={<WarehouseIcon />}
          />
        </div>
        <div className="wh-dash-col-3">
          <ViewKpi
            label="Stock value"
            value={formatPKR(branch.stock_value)}
            hint="At cost price"
            tone="accent"
            icon={<ProductIcon />}
          />
        </div>
        <div className="wh-dash-col-3">
          <ViewKpi
            label="Low stock items"
            value={formatCount(lowStock)}
            hint={lowStock > 0 ? "Needs replenishment" : "All healthy"}
            tone={lowStock > 0 ? "warning" : "default"}
          />
        </div>
        <div className="wh-dash-col-3">
          <ViewKpi
            label="Wastage"
            value={formatCount(branch.wastage_count)}
            hint={formatPKR(branch.wastage_cost)}
            icon={<LogsIcon />}
          />
        </div>
      </div>

      <div className="wh-dash-grid">
        <div className="wh-dash-col-8">
          <ViewPanel title="Stock at this branch" subtitle="Items with quantity on hand" flush>
            {stockLevels.length ? (
              <table className="wh-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Type</th>
                    <th>Available</th>
                    <th>Reserved</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {stockLevels.map((row) => (
                    <tr
                      key={row.item_id || row.item_name}
                      className="wh-table__row--clickable"
                      onClick={() => row.item_id && navigate(`${MODULE_BASE}/items/view/${row.item_id}`)}
                    >
                      <td>{row.item_name}</td>
                      <td className="wh-muted">{row.item_type ? t(ITEM_TYPE_LABELS[row.item_type] || row.item_type) : "—"}</td>
                      <td>{`${formatCount(row.available_qty)} ${row.unit || ""}`.trim()}</td>
                      <td>{formatCount(row.reserved_qty)}</td>
                      <td>{formatPKR((Number(row.available_qty) || 0) * (Number(row.cost_price) || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="wh-panel__empty">No stock levels for this branch yet.</p>
            )}
          </ViewPanel>
        </div>
        <div className="wh-dash-col-4">
          <ViewPanel title="Recent movements" subtitle="Latest stock activity" flush>
            {movements.length ? (
              <table className="wh-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Qty</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr
                      key={m.id}
                      className="wh-table__row--clickable"
                      onClick={() =>
                        navigate(`${MODULE_BASE}/stock/movements/view/${m.id}`, {
                          state: { movement: m, backPath: `${MODULE_BASE}/branches/view/${branch.id}` },
                        })
                      }
                    >
                      <td>
                        <div>{MOVEMENT_LABELS[m.movement_type] || m.movement_type}</div>
                        <div className="wh-muted" style={{ fontSize: 12 }}>{m.item_name}</div>
                      </td>
                      <td>{`${formatCount(m.qty)} ${m.unit || ""}`.trim()}</td>
                      <td className="wh-muted">{formatDateTime(m.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="wh-panel__empty">No movements recorded yet.</p>
            )}
          </ViewPanel>
        </div>
      </div>

      <ViewPanel title="Location details">
        <DetailGrid columns={3}>
          <DetailValue label="Code">{branch.code || "—"}</DetailValue>
          <DetailValue label="City">{branch.city || "—"}</DetailValue>
          <DetailValue label="Phone">{branch.phone || "—"}</DetailValue>
          <DetailValue label="Location" fullWidth>{branch.location || "—"}</DetailValue>
          <DetailValue label="Hours">{hours}</DetailValue>
          <DetailValue label="Created">{formatDateTime(branch.created_at)}</DetailValue>
          <DetailValue label="Wastage qty">{formatCount(branch.wastage_qty)}</DetailValue>
          <DetailValue label="Wastage cost">{formatPKR(branch.wastage_cost)}</DetailValue>
        </DetailGrid>
      </ViewPanel>
    </div>
  );
}

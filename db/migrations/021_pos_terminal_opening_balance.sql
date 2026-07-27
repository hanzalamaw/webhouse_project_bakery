-- Per-terminal drawer opening balance (first shift default), separate from store/branch.

ALTER TABLE `pos_terminals`
  ADD COLUMN `opening_balance` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER `status`;

-- Backfill from the store/branch opening balance so existing terminals keep prior behavior.
UPDATE `pos_terminals` t
INNER JOIN `branches` b ON b.id = t.branch_id AND b.deleted_at IS NULL
SET t.opening_balance = COALESCE(b.opening_balance, 0)
WHERE t.deleted_at IS NULL;

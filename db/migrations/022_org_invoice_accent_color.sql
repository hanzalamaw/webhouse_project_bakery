-- Organization invoice branding: accent color + optional print contact lines
-- Safe to re-run.

DROP PROCEDURE IF EXISTS _wh_add_column_if_missing;
DELIMITER //
CREATE PROCEDURE _wh_add_column_if_missing(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
      AND COLUMN_NAME = p_column
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

CALL _wh_add_column_if_missing(
  'organization_settings',
  'invoice_accent_color',
  "VARCHAR(7) NOT NULL DEFAULT '#E11D48' AFTER `logo_url`"
);
CALL _wh_add_column_if_missing(
  'organization_settings',
  'company_address',
  'VARCHAR(255) NULL DEFAULT NULL AFTER `invoice_accent_color`'
);
CALL _wh_add_column_if_missing(
  'organization_settings',
  'company_phone',
  'VARCHAR(45) NULL DEFAULT NULL AFTER `company_address`'
);

DROP PROCEDURE IF EXISTS _wh_add_column_if_missing;

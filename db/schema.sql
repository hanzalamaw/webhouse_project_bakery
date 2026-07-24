-- Full schema snapshot for bakery_erp (Bakery ERP)
-- Multi-tenant bakery management: Branches, Stock & Purchasing (ingredients +
-- finished bakery items + packaging), Production (recipes / baking), Point of
-- Sale, Orders, CRM (Customers), Finance.
--
-- Design notes for this niche:
--   * Multi-branch: every branch bakes AND sells. Stock moves between branches
--     (stock in / stock out / transfers).
--   * One unified stock system: ingredients, finished items and packaging all
--     live in `items`. Production output is exactly what POS/orders sell.
--   * Batch-level expiry: `stock_batches` carry made_on + expiry_date so wastage
--     and expiry/low-stock alerts are accurate for perishable bakery goods.
--   * Simplified variants: `items.parent_item_id` + `items.variant_label` give a
--     lightweight Small/Large sizing without a heavy attribute system.
--   * Quantities use DECIMAL(12,3) so ingredients can be measured by weight/volume.
--
-- Soft delete: every tenant table has deleted_at (NULL = active). Hard purge after 7 days.
-- Foreign keys: ON DELETE CASCADE, ON UPDATE CASCADE (unless noted).
--
-- Apply: cd server && npm run setup:db
-- Or:    mysql -u root -p < db/schema.sql

CREATE DATABASE IF NOT EXISTS `bakery_erp`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `bakery_erp`;

-- =============================================================================
-- WEBHOUSE ADMIN  (platform side — unchanged)
-- =============================================================================

-- -----------------------------------------------------
-- Table `wh_admin_users`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `wh_admin_users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(60) NOT NULL,
  `email` VARCHAR(60) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `status` VARCHAR(45) NOT NULL,
  `last_login_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_wh_admin_users_email` (`email` ASC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `modules`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `modules` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `module_name` VARCHAR(45) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `last_updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `wh_subscription_plans`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `wh_subscription_plans` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `plan_name` VARCHAR(45) NOT NULL,
  `plan_price` DECIMAL(12,2) NOT NULL COMMENT 'Monthly price always in PKR',
  `login_portal` VARCHAR(20) NOT NULL DEFAULT 'erp1',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `last_updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `wh_exchange_rates` (PKR -> tenant display currencies)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `wh_exchange_rates` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `base_currency` VARCHAR(10) NOT NULL DEFAULT 'PKR',
  `target_currency` VARCHAR(10) NOT NULL,
  `rate` DECIMAL(24, 12) NOT NULL COMMENT 'Units of target per 1 base (PKR)',
  `rate_date` DATE NULL DEFAULT NULL,
  `source` VARCHAR(100) NULL DEFAULT NULL,
  `fetched_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_wh_exchange_rates_pair` (`base_currency` ASC, `target_currency` ASC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `wh_tenants`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `wh_tenants` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `company_name` VARCHAR(45) NOT NULL,
  `owner_name` VARCHAR(45) NOT NULL,
  `owner_email` VARCHAR(45) NOT NULL,
  `owner_phone` VARCHAR(45) NOT NULL,
  `industry` VARCHAR(45) NOT NULL,
  `status` VARCHAR(45) NOT NULL,
  `login_portal` VARCHAR(20) NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `wh_subscription_module`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `wh_subscription_module` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `subscription_plan_id` INT NOT NULL,
  `module_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_wh_subscription_module_plan_module` (`subscription_plan_id` ASC, `module_id` ASC),
  INDEX `fk_wh_subscription_module_wh_subscription_plans1_idx` (`subscription_plan_id` ASC),
  INDEX `fk_wh_subscription_module_modules1_idx` (`module_id` ASC),
  CONSTRAINT `fk_wh_subscription_module_wh_subscription_plans1`
    FOREIGN KEY (`subscription_plan_id`)
    REFERENCES `wh_subscription_plans` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_wh_subscription_module_modules1`
    FOREIGN KEY (`module_id`)
    REFERENCES `modules` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `wh_tenant_modules`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `wh_tenant_modules` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `is_enabled` TINYINT(1) NOT NULL,
  `enabled_at` TIMESTAMP NULL DEFAULT NULL,
  `disabled_at` TIMESTAMP NULL DEFAULT NULL,
  `module_id` INT NOT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_wh_tenant_modules_tenant_module` (`tenant_id` ASC, `module_id` ASC),
  INDEX `fk_wh_tenant_modules_modules1_idx` (`module_id` ASC),
  INDEX `fk_wh_tenant_modules_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_wh_tenant_modules_modules1`
    FOREIGN KEY (`module_id`)
    REFERENCES `modules` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_wh_tenant_modules_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `wh_tenant_limits`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `wh_tenant_limits` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `max_users` INT NOT NULL,
  `max_warehouses` INT NOT NULL COMMENT 'Reused as the branch limit in the bakery ERP',
  `max_stores` INT NOT NULL COMMENT 'Reused as the POS store (branch) limit in the bakery ERP',
  `max_orders_per_month` INT NOT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_wh_tenant_limits_tenant` (`tenant_id` ASC),
  INDEX `fk_wh_tenant_limits_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_wh_tenant_limits_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `wh_tenant_subscriptions`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `wh_tenant_subscriptions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `billing_cycle` VARCHAR(45) NOT NULL,
  `start_date` DATE NOT NULL,
  `billing_anchor_date` DATE NULL DEFAULT NULL,
  `renewal_date` DATE NOT NULL,
  `status` VARCHAR(45) NOT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `total_amount` DECIMAL(12,2) NOT NULL,
  `amount_due` DECIMAL(12,2) NOT NULL,
  `tenant_id` INT NOT NULL,
  `subscription_plan_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_wh_tenant_subscriptions_wh_tenants1_idx` (`tenant_id` ASC),
  INDEX `fk_wh_tenant_subscriptions_wh_subscription_plans1_idx` (`subscription_plan_id` ASC),
  CONSTRAINT `fk_wh_tenant_subscriptions_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_wh_tenant_subscriptions_wh_subscription_plans1`
    FOREIGN KEY (`subscription_plan_id`)
    REFERENCES `wh_subscription_plans` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `wh_tenant_payments`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `wh_tenant_payments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `bank` DECIMAL(12,2) NOT NULL,
  `cash` DECIMAL(12,2) NOT NULL,
  `total_received` DECIMAL(12,2) NOT NULL,
  `received_at` TIMESTAMP NULL DEFAULT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_wh_tenant_payments_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_wh_tenant_payments_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `wh_support_tickets`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `wh_support_tickets` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `subject` VARCHAR(45) NOT NULL,
  `description` TEXT NOT NULL,
  `status` VARCHAR(45) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` TIMESTAMP NULL DEFAULT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_wh_support_tickets_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_wh_support_tickets_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `wh_audit_logs`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `wh_audit_logs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `action` VARCHAR(191) NOT NULL,
  `old_value` JSON NULL DEFAULT NULL,
  `new_value` JSON NULL DEFAULT NULL,
  `ip_address` VARCHAR(45) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `admin_user_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_wh_audit_logs_wh_admin_users1_idx` (`admin_user_id` ASC),
  CONSTRAINT `fk_wh_audit_logs_wh_admin_users1`
    FOREIGN KEY (`admin_user_id`)
    REFERENCES `wh_admin_users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- CLIENT ADMIN  (roles / users / permissions)
-- =============================================================================

-- -----------------------------------------------------
-- Table `roles`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `roles` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `role_name` VARCHAR(45) NOT NULL,
  `description` TEXT NULL DEFAULT NULL,
  `status` VARCHAR(45) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_roles_tenant_role_name` (`tenant_id` ASC, `role_name` ASC),
  INDEX `fk_roles_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_roles_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `users`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  `username` VARCHAR(100) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(45) NULL DEFAULT NULL,
  `status` VARCHAR(45) NOT NULL,
  `last_login_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `role_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_users_tenant_email` (`tenant_id` ASC, `email` ASC),
  UNIQUE INDEX `uk_users_tenant_username` (`tenant_id` ASC, `username` ASC),
  INDEX `fk_users_wh_tenants1_idx` (`tenant_id` ASC),
  INDEX `fk_users_roles1_idx` (`role_id` ASC),
  CONSTRAINT `fk_users_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_users_roles1`
    FOREIGN KEY (`role_id`)
    REFERENCES `roles` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `permissions`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `permissions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `permission_name` VARCHAR(45) NOT NULL,
  `action` VARCHAR(45) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `role_id` INT NOT NULL,
  `module_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_permissions_roles1_idx` (`role_id` ASC),
  INDEX `fk_permissions_modules1_idx` (`module_id` ASC),
  CONSTRAINT `fk_permissions_roles1`
    FOREIGN KEY (`role_id`)
    REFERENCES `roles` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_permissions_modules1`
    FOREIGN KEY (`module_id`)
    REFERENCES `modules` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TENANT PORTAL (shared)
-- =============================================================================

-- -----------------------------------------------------
-- Table `audit_logs`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `action` VARCHAR(191) NOT NULL,
  `old_value` JSON NULL DEFAULT NULL,
  `new_value` JSON NULL DEFAULT NULL,
  `ip_address` VARCHAR(45) NULL DEFAULT NULL,
  `device_info` TEXT NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `tenant_id` INT NOT NULL,
  `module_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_audit_logs_wh_tenants1_idx` (`tenant_id` ASC),
  INDEX `fk_audit_logs_modules1_idx` (`module_id` ASC),
  INDEX `fk_audit_logs_users1_idx` (`user_id` ASC),
  CONSTRAINT `fk_audit_logs_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_audit_logs_modules1`
    FOREIGN KEY (`module_id`)
    REFERENCES `modules` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_audit_logs_users1`
    FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `sessions`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `sessions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `session_token` TEXT NOT NULL,
  `ip_address` VARCHAR(45) NULL DEFAULT NULL,
  `device_info` TEXT NULL DEFAULT NULL,
  `login_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `logout_at` TIMESTAMP NULL DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `tenant_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_sessions_wh_tenants1_idx` (`tenant_id` ASC),
  INDEX `fk_sessions_users1_idx` (`user_id` ASC),
  CONSTRAINT `fk_sessions_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_sessions_users1`
    FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `organization_settings`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `organization_settings` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `company_name` VARCHAR(100) NOT NULL,
  `logo_url` TEXT NULL DEFAULT NULL,
  `timezone` VARCHAR(60) NULL DEFAULT NULL,
  `currency` VARCHAR(45) NULL DEFAULT NULL,
  `language` VARCHAR(45) NULL DEFAULT NULL,
  `fiscal_year_start` DATE NULL DEFAULT NULL,
  `fiscal_year_end` DATE NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `last_updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_organization_settings_tenant` (`tenant_id` ASC),
  INDEX `fk_organization_settings_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_organization_settings_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `activity_alerts` (low stock, expiry, etc.)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `activity_alerts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `alert_type` VARCHAR(100) NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `message` TEXT NULL DEFAULT NULL,
  `priority` VARCHAR(45) NOT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `user_id` INT NOT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_activity_alerts_users1_idx` (`user_id` ASC),
  INDEX `fk_activity_alerts_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_activity_alerts_users1`
    FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_activity_alerts_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- BRANCHES (Shops)  -- unifies old warehouses + POS outlets
-- Every branch bakes and sells. Stock moves between branches.
-- =============================================================================

-- -----------------------------------------------------
-- Table `branches`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `branches` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `branch_name` VARCHAR(100) NOT NULL,
  `code` VARCHAR(45) NULL DEFAULT NULL,
  `location` TEXT NULL DEFAULT NULL,
  `city` VARCHAR(100) NULL DEFAULT NULL,
  `phone` VARCHAR(45) NULL DEFAULT NULL,
  `open_time` TIME NULL DEFAULT NULL,
  `close_time` TIME NULL DEFAULT NULL,
  `opening_balance` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `status` VARCHAR(45) NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_branches_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_branches_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- STOCK & PURCHASING  (Store / Khareedari)
-- Unified catalog: ingredients (kacha maal) + finished bakery items + packaging.
-- =============================================================================

-- -----------------------------------------------------
-- Table `item_categories`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `item_categories` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `category_name` VARCHAR(100) NOT NULL,
  `item_type` VARCHAR(45) NULL DEFAULT NULL COMMENT 'ingredient | finished | packaging (optional grouping)',
  `status` VARCHAR(45) NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_item_categories_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_item_categories_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `items`
--   item_type: ingredient (raw material) | finished (bakery item) | packaging
--   flags: is_purchased (bought), is_produced (baked via recipe), is_sold (sellable)
--   parent_item_id + variant_label: lightweight sizing (Small/Large) without attributes
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `item_name` VARCHAR(150) NOT NULL,
  `item_type` VARCHAR(45) NOT NULL DEFAULT 'finished',
  `sku` VARCHAR(100) NULL DEFAULT NULL,
  `unit` VARCHAR(45) NOT NULL DEFAULT 'piece',
  `cost_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `selling_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `tax` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `discount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `is_purchased` TINYINT(1) NOT NULL DEFAULT 0,
  `is_produced` TINYINT(1) NOT NULL DEFAULT 0,
  `is_sold` TINYINT(1) NOT NULL DEFAULT 0,
  `shelf_life_days` INT NULL DEFAULT NULL,
  `low_stock_threshold` DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  `parent_item_id` INT NULL DEFAULT NULL,
  `variant_label` VARCHAR(100) NULL DEFAULT NULL,
  `status` VARCHAR(45) NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `category_id` INT NOT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_items_tenant_sku` (`tenant_id` ASC, `sku` ASC),
  INDEX `fk_items_item_categories1_idx` (`category_id` ASC),
  INDEX `fk_items_parent_idx` (`parent_item_id` ASC),
  INDEX `idx_items_type` (`tenant_id` ASC, `item_type` ASC),
  INDEX `fk_items_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_items_item_categories1`
    FOREIGN KEY (`category_id`)
    REFERENCES `item_categories` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_items_parent`
    FOREIGN KEY (`parent_item_id`)
    REFERENCES `items` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_items_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `stock_batches` (batch-level expiry tracking)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `stock_batches` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `batch_no` VARCHAR(60) NULL DEFAULT NULL,
  `source_type` VARCHAR(45) NOT NULL DEFAULT 'purchase' COMMENT 'purchase | production | transfer | opening | adjustment',
  `source_ref_id` INT NULL DEFAULT NULL,
  `qty_received` DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  `qty_remaining` DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  `unit_cost` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `made_on` DATE NULL DEFAULT NULL,
  `expiry_date` DATE NULL DEFAULT NULL,
  `status` VARCHAR(45) NOT NULL DEFAULT 'active' COMMENT 'active | expired | finished',
  `notes` TEXT NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `item_id` INT NOT NULL,
  `branch_id` INT NOT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_stock_batches_item_branch` (`tenant_id` ASC, `item_id` ASC, `branch_id` ASC),
  INDEX `idx_stock_batches_expiry` (`tenant_id` ASC, `expiry_date` ASC),
  INDEX `fk_stock_batches_item_idx` (`item_id` ASC),
  INDEX `fk_stock_batches_branch_idx` (`branch_id` ASC),
  CONSTRAINT `fk_stock_batches_item`
    FOREIGN KEY (`item_id`)
    REFERENCES `items` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_batches_branch`
    FOREIGN KEY (`branch_id`)
    REFERENCES `branches` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_batches_tenant`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `stock_levels` (fast rollup per item per branch)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `stock_levels` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `available_qty` DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  `reserved_qty` DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  `damaged_qty` DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `item_id` INT NOT NULL,
  `branch_id` INT NOT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_stock_levels_tenant_item_branch` (`tenant_id` ASC, `item_id` ASC, `branch_id` ASC),
  INDEX `fk_stock_levels_item_idx` (`item_id` ASC),
  INDEX `fk_stock_levels_branch_idx` (`branch_id` ASC),
  CONSTRAINT `fk_stock_levels_item`
    FOREIGN KEY (`item_id`)
    REFERENCES `items` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_levels_branch`
    FOREIGN KEY (`branch_id`)
    REFERENCES `branches` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_levels_tenant`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `stock_movements` (audit of every in/out. qty signed positive in, negative out)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `stock_movements` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `movement_type` VARCHAR(45) NOT NULL COMMENT 'purchase_in | production_in | production_consume | sale_out | transfer_in | transfer_out | wastage | adjustment | return_in',
  `qty` DECIMAL(12,3) NOT NULL,
  `unit_cost` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `reference_type` VARCHAR(45) NULL DEFAULT NULL,
  `reference_id` INT NULL DEFAULT NULL,
  `notes` TEXT NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `item_id` INT NOT NULL,
  `branch_id` INT NOT NULL,
  `batch_id` INT NULL DEFAULT NULL,
  `created_by` INT NULL DEFAULT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_stock_movements_item_branch` (`tenant_id` ASC, `item_id` ASC, `branch_id` ASC),
  INDEX `fk_stock_movements_item_idx` (`item_id` ASC),
  INDEX `fk_stock_movements_branch_idx` (`branch_id` ASC),
  INDEX `fk_stock_movements_batch_idx` (`batch_id` ASC),
  INDEX `fk_stock_movements_users1_idx` (`created_by` ASC),
  CONSTRAINT `fk_stock_movements_item`
    FOREIGN KEY (`item_id`)
    REFERENCES `items` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_movements_branch`
    FOREIGN KEY (`branch_id`)
    REFERENCES `branches` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_movements_batch`
    FOREIGN KEY (`batch_id`)
    REFERENCES `stock_batches` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_movements_users1`
    FOREIGN KEY (`created_by`)
    REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_movements_tenant`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `stock_transfers` (between branches)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `stock_transfers` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `qty` DECIMAL(12,3) NOT NULL,
  `transfer_status` VARCHAR(45) NOT NULL DEFAULT 'pending' COMMENT 'pending | in_transit | received | cancelled',
  `expiry_date` DATE NULL DEFAULT NULL,
  `notes` TEXT NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `item_id` INT NOT NULL,
  `batch_id` INT NULL DEFAULT NULL,
  `from_branch_id` INT NOT NULL,
  `to_branch_id` INT NOT NULL,
  `created_by` INT NULL DEFAULT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_stock_transfers_item_idx` (`item_id` ASC),
  INDEX `fk_stock_transfers_from_idx` (`from_branch_id` ASC),
  INDEX `fk_stock_transfers_to_idx` (`to_branch_id` ASC),
  INDEX `fk_stock_transfers_users1_idx` (`created_by` ASC),
  CONSTRAINT `fk_stock_transfers_item`
    FOREIGN KEY (`item_id`)
    REFERENCES `items` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_transfers_from`
    FOREIGN KEY (`from_branch_id`)
    REFERENCES `branches` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_transfers_to`
    FOREIGN KEY (`to_branch_id`)
    REFERENCES `branches` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_transfers_users1`
    FOREIGN KEY (`created_by`)
    REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_transfers_tenant`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `suppliers` (vendors we buy ingredients/packaging from)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `supplier_name` VARCHAR(150) NOT NULL,
  `contact_person` VARCHAR(100) NULL DEFAULT NULL,
  `phone` VARCHAR(45) NULL DEFAULT NULL,
  `email` VARCHAR(100) NULL DEFAULT NULL,
  `address` TEXT NULL DEFAULT NULL,
  `city` VARCHAR(100) NULL DEFAULT NULL,
  `status` VARCHAR(45) NOT NULL DEFAULT 'active',
  `notes` TEXT NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_suppliers_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_suppliers_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `purchase_orders` (buying stock from suppliers)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `purchase_orders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `po_no` VARCHAR(60) NOT NULL,
  `order_date` DATE NOT NULL,
  `expected_date` DATE NULL DEFAULT NULL,
  `status` VARCHAR(45) NOT NULL DEFAULT 'draft' COMMENT 'draft | ordered | partial | received | cancelled',
  `total_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `payable_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `notes` TEXT NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `supplier_id` INT NOT NULL,
  `branch_id` INT NOT NULL,
  `created_by` INT NULL DEFAULT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_purchase_orders_tenant_po_no` (`tenant_id` ASC, `po_no` ASC),
  INDEX `fk_purchase_orders_supplier_idx` (`supplier_id` ASC),
  INDEX `fk_purchase_orders_branch_idx` (`branch_id` ASC),
  INDEX `fk_purchase_orders_users1_idx` (`created_by` ASC),
  CONSTRAINT `fk_purchase_orders_supplier`
    FOREIGN KEY (`supplier_id`)
    REFERENCES `suppliers` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_purchase_orders_branch`
    FOREIGN KEY (`branch_id`)
    REFERENCES `branches` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_purchase_orders_users1`
    FOREIGN KEY (`created_by`)
    REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_purchase_orders_tenant`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `purchase_order_items`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `purchase_order_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `qty` DECIMAL(12,3) NOT NULL,
  `unit_cost` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `discount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `received_qty` DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  `expiry_date` DATE NULL DEFAULT NULL,
  `purchase_order_id` INT NOT NULL,
  `item_id` INT NOT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_po_items_po_idx` (`purchase_order_id` ASC),
  INDEX `fk_po_items_item_idx` (`item_id` ASC),
  INDEX `fk_po_items_tenant_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_po_items_po`
    FOREIGN KEY (`purchase_order_id`)
    REFERENCES `purchase_orders` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_po_items_item`
    FOREIGN KEY (`item_id`)
    REFERENCES `items` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_po_items_tenant`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `wastage` (spoilage / expired / damaged goods thrown away)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `wastage` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `qty` DECIMAL(12,3) NOT NULL,
  `reason` VARCHAR(45) NOT NULL DEFAULT 'expired' COMMENT 'expired | damaged | spoiled | other',
  `wastage_date` DATE NOT NULL,
  `estimated_cost` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `notes` TEXT NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `item_id` INT NOT NULL,
  `batch_id` INT NULL DEFAULT NULL,
  `branch_id` INT NOT NULL,
  `created_by` INT NULL DEFAULT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_wastage_item_idx` (`item_id` ASC),
  INDEX `fk_wastage_batch_idx` (`batch_id` ASC),
  INDEX `fk_wastage_branch_idx` (`branch_id` ASC),
  INDEX `fk_wastage_users1_idx` (`created_by` ASC),
  CONSTRAINT `fk_wastage_item`
    FOREIGN KEY (`item_id`)
    REFERENCES `items` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_wastage_batch`
    FOREIGN KEY (`batch_id`)
    REFERENCES `stock_batches` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_wastage_branch`
    FOREIGN KEY (`branch_id`)
    REFERENCES `branches` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_wastage_users1`
    FOREIGN KEY (`created_by`)
    REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_wastage_tenant`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- PRODUCTION (Baking)
-- Recipes describe which ingredients + quantities make each finished item.
-- Production runs consume ingredients (FIFO by expiry) and add finished goods.
-- =============================================================================

-- -----------------------------------------------------
-- Table `recipes`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `recipes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `recipe_name` VARCHAR(150) NOT NULL,
  `yield_qty` DECIMAL(12,3) NOT NULL DEFAULT 1.000 COMMENT 'How many finished units this recipe makes',
  `yield_unit` VARCHAR(45) NOT NULL DEFAULT 'piece',
  `instructions` TEXT NULL DEFAULT NULL,
  `prep_time_mins` INT NULL DEFAULT NULL,
  `status` VARCHAR(45) NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `item_id` INT NOT NULL COMMENT 'Finished bakery item this recipe produces',
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_recipes_item_idx` (`item_id` ASC),
  INDEX `fk_recipes_tenant_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_recipes_item`
    FOREIGN KEY (`item_id`)
    REFERENCES `items` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_recipes_tenant`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `recipe_ingredients`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `recipe_ingredients` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `quantity` DECIMAL(12,3) NOT NULL,
  `unit` VARCHAR(45) NOT NULL DEFAULT 'g',
  `notes` VARCHAR(255) NULL DEFAULT NULL,
  `recipe_id` INT NOT NULL,
  `ingredient_item_id` INT NOT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_recipe_ingredients_recipe_idx` (`recipe_id` ASC),
  INDEX `fk_recipe_ingredients_item_idx` (`ingredient_item_id` ASC),
  INDEX `fk_recipe_ingredients_tenant_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_recipe_ingredients_recipe`
    FOREIGN KEY (`recipe_id`)
    REFERENCES `recipes` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_recipe_ingredients_item`
    FOREIGN KEY (`ingredient_item_id`)
    REFERENCES `items` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_recipe_ingredients_tenant`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `production_runs` (a baking batch)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `production_runs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `production_no` VARCHAR(60) NOT NULL,
  `quantity_produced` DECIMAL(12,3) NOT NULL,
  `produced_on` DATE NOT NULL,
  `expiry_date` DATE NULL DEFAULT NULL,
  `status` VARCHAR(45) NOT NULL DEFAULT 'planned' COMMENT 'planned | in_progress | completed | cancelled',
  `total_cost` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `notes` TEXT NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `item_id` INT NOT NULL COMMENT 'Finished item produced',
  `recipe_id` INT NULL DEFAULT NULL,
  `branch_id` INT NOT NULL,
  `created_by` INT NULL DEFAULT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_production_runs_tenant_no` (`tenant_id` ASC, `production_no` ASC),
  INDEX `fk_production_runs_item_idx` (`item_id` ASC),
  INDEX `fk_production_runs_recipe_idx` (`recipe_id` ASC),
  INDEX `fk_production_runs_branch_idx` (`branch_id` ASC),
  INDEX `fk_production_runs_users1_idx` (`created_by` ASC),
  CONSTRAINT `fk_production_runs_item`
    FOREIGN KEY (`item_id`)
    REFERENCES `items` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_production_runs_recipe`
    FOREIGN KEY (`recipe_id`)
    REFERENCES `recipes` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_production_runs_branch`
    FOREIGN KEY (`branch_id`)
    REFERENCES `branches` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_production_runs_users1`
    FOREIGN KEY (`created_by`)
    REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_production_runs_tenant`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `production_run_consumption` (actual ingredients used per run)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `production_run_consumption` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `qty_consumed` DECIMAL(12,3) NOT NULL,
  `unit_cost` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `production_run_id` INT NOT NULL,
  `ingredient_item_id` INT NOT NULL,
  `batch_id` INT NULL DEFAULT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_prod_consume_run_idx` (`production_run_id` ASC),
  INDEX `fk_prod_consume_item_idx` (`ingredient_item_id` ASC),
  INDEX `fk_prod_consume_batch_idx` (`batch_id` ASC),
  INDEX `fk_prod_consume_tenant_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_prod_consume_run`
    FOREIGN KEY (`production_run_id`)
    REFERENCES `production_runs` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_prod_consume_item`
    FOREIGN KEY (`ingredient_item_id`)
    REFERENCES `items` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_prod_consume_batch`
    FOREIGN KEY (`batch_id`)
    REFERENCES `stock_batches` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_prod_consume_tenant`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- CRM (Customers)
-- =============================================================================

-- -----------------------------------------------------
-- Table `crm_customers`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `crm_customers` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `customer_name` VARCHAR(100) NOT NULL,
  `company_name` VARCHAR(100) NULL DEFAULT NULL,
  `customer_type` VARCHAR(45) NOT NULL DEFAULT 'walk-in',
  `tags` VARCHAR(500) NULL DEFAULT NULL,
  `phone` VARCHAR(45) NULL DEFAULT NULL,
  `email` VARCHAR(100) NULL DEFAULT NULL,
  `status` VARCHAR(45) NOT NULL,
  `source` VARCHAR(45) NOT NULL DEFAULT 'manual',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `note` TEXT NULL DEFAULT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_crm_customers_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_crm_customers_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `crm_customer_addresses`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `crm_customer_addresses` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `address_type` VARCHAR(45) NOT NULL,
  `address` TEXT NOT NULL,
  `city` VARCHAR(60) NULL DEFAULT NULL,
  `state` VARCHAR(60) NULL DEFAULT NULL,
  `postal_code` VARCHAR(45) NULL DEFAULT NULL,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `customer_id` INT NOT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_crm_customer_addresses_crm_customers1_idx` (`customer_id` ASC),
  INDEX `fk_crm_customer_addresses_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_crm_customer_addresses_crm_customers1`
    FOREIGN KEY (`customer_id`)
    REFERENCES `crm_customers` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_crm_customer_addresses_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `crm_leads`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `crm_leads` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `lead_name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(45) NULL DEFAULT NULL,
  `email` VARCHAR(100) NULL DEFAULT NULL,
  `company_name` VARCHAR(100) NULL DEFAULT NULL,
  `source` VARCHAR(100) NULL DEFAULT NULL,
  `status` VARCHAR(45) NOT NULL,
  `notes` TEXT NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `assigned_to` INT NULL DEFAULT NULL,
  `converted_customer_id` INT NULL DEFAULT NULL,
  `converted_at` TIMESTAMP NULL DEFAULT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_crm_leads_users1_idx` (`assigned_to` ASC),
  INDEX `fk_crm_leads_converted_customer_idx` (`converted_customer_id` ASC),
  INDEX `fk_crm_leads_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_crm_leads_users1`
    FOREIGN KEY (`assigned_to`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_crm_leads_converted_customer`
    FOREIGN KEY (`converted_customer_id`)
    REFERENCES `crm_customers` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_crm_leads_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `crm_customer_complaints`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `crm_customer_complaints` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `subject` VARCHAR(150) NOT NULL,
  `description` TEXT NULL DEFAULT NULL,
  `status` VARCHAR(45) NOT NULL,
  `priority` VARCHAR(45) NOT NULL,
  `issue_type` VARCHAR(45) NOT NULL DEFAULT 'complaint',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` TIMESTAMP NULL DEFAULT NULL,
  `resolution_note` TEXT NULL DEFAULT NULL,
  `customer_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `assigned_to` INT NULL DEFAULT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_crm_customer_complaints_crm_customers1_idx` (`customer_id` ASC),
  INDEX `fk_crm_customer_complaints_users1_idx` (`user_id` ASC),
  INDEX `fk_crm_customer_complaints_assigned_idx` (`assigned_to` ASC),
  INDEX `fk_crm_customer_complaints_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_crm_customer_complaints_crm_customers1`
    FOREIGN KEY (`customer_id`)
    REFERENCES `crm_customers` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_crm_customer_complaints_users1`
    FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_crm_customer_complaints_assigned`
    FOREIGN KEY (`assigned_to`)
    REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_crm_customer_complaints_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- ORDER MANAGEMENT  (bulk / custom cake orders, delivery)
-- =============================================================================

-- -----------------------------------------------------
-- Table `orders`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `order_no` VARCHAR(60) NOT NULL,
  `order_source` VARCHAR(60) NULL DEFAULT NULL COMMENT 'walk-in | phone | whatsapp | manual',
  `order_status` VARCHAR(45) NOT NULL,
  `payment_status` VARCHAR(45) NOT NULL,
  `fulfillment_status` VARCHAR(45) NOT NULL,
  `total_amount` DECIMAL(12,2) NOT NULL,
  `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `delivery_charges` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `payable_amount` DECIMAL(12,2) NOT NULL,
  `city` VARCHAR(60) NULL DEFAULT NULL,
  `delivery_address` TEXT NULL DEFAULT NULL,
  `delivery_date` DATE NULL DEFAULT NULL,
  `notes` TEXT NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `customer_id` INT NULL DEFAULT NULL,
  `branch_id` INT NULL DEFAULT NULL,
  `created_by` INT NULL DEFAULT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_orders_tenant_order_no` (`tenant_id` ASC, `order_no` ASC),
  INDEX `fk_orders_crm_customers1_idx` (`customer_id` ASC),
  INDEX `fk_orders_branch_idx` (`branch_id` ASC),
  INDEX `fk_orders_users1_idx` (`created_by` ASC),
  INDEX `fk_orders_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_orders_crm_customers1`
    FOREIGN KEY (`customer_id`)
    REFERENCES `crm_customers` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_orders_branch`
    FOREIGN KEY (`branch_id`)
    REFERENCES `branches` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_orders_users1`
    FOREIGN KEY (`created_by`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_orders_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `order_items`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `product_name` VARCHAR(150) NOT NULL,
  `sku` VARCHAR(80) NULL DEFAULT NULL,
  `quantity` DECIMAL(12,3) NOT NULL,
  `unit_price` DECIMAL(12,2) NOT NULL,
  `discount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_price` DECIMAL(12,2) NOT NULL,
  `order_id` INT NOT NULL,
  `item_id` INT NULL DEFAULT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_order_items_orders1_idx` (`order_id` ASC),
  INDEX `fk_order_items_items1_idx` (`item_id` ASC),
  INDEX `fk_order_items_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_order_items_orders1`
    FOREIGN KEY (`order_id`)
    REFERENCES `orders` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_order_items_items1`
    FOREIGN KEY (`item_id`)
    REFERENCES `items` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_order_items_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `order_assignments`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `order_assignments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `assigned_to` INT NOT NULL,
  `assignment_type` VARCHAR(45) NOT NULL,
  `assigned_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `status` VARCHAR(45) NOT NULL,
  `order_id` INT NOT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_order_assignments_orders1_idx` (`order_id` ASC),
  INDEX `fk_order_assignments_users1_idx` (`assigned_to` ASC),
  INDEX `fk_order_assignments_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_order_assignments_orders1`
    FOREIGN KEY (`order_id`)
    REFERENCES `orders` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_order_assignments_users1`
    FOREIGN KEY (`assigned_to`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_order_assignments_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `order_payments`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `order_payments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `payment_method` VARCHAR(45) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `payment_status` VARCHAR(45) NOT NULL,
  `paid_at` TIMESTAMP NULL DEFAULT NULL,
  `order_id` INT NOT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_order_payments_orders1_idx` (`order_id` ASC),
  INDEX `fk_order_payments_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_order_payments_orders1`
    FOREIGN KEY (`order_id`)
    REFERENCES `orders` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_order_payments_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `order_cancellations`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `order_cancellations` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `reason` TEXT NULL DEFAULT NULL,
  `cancelled_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `order_id` INT NOT NULL,
  `cancelled_by` INT NOT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_order_cancellations_orders1_idx` (`order_id` ASC),
  INDEX `fk_order_cancellations_users1_idx` (`cancelled_by` ASC),
  INDEX `fk_order_cancellations_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_order_cancellations_orders1`
    FOREIGN KEY (`order_id`)
    REFERENCES `orders` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_order_cancellations_users1`
    FOREIGN KEY (`cancelled_by`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_order_cancellations_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `order_returns`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `order_returns` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `reason` TEXT NULL DEFAULT NULL,
  `return_status` VARCHAR(45) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `order_id` INT NOT NULL,
  `created_by` INT NOT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_order_returns_orders1_idx` (`order_id` ASC),
  INDEX `fk_order_returns_users1_idx` (`created_by` ASC),
  INDEX `fk_order_returns_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_order_returns_orders1`
    FOREIGN KEY (`order_id`)
    REFERENCES `orders` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_order_returns_users1`
    FOREIGN KEY (`created_by`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_order_returns_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `order_exchanges`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `order_exchanges` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `reason` TEXT NULL DEFAULT NULL,
  `exchange_status` VARCHAR(45) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `order_id` INT NOT NULL,
  `old_item_id` INT NOT NULL,
  `new_item_id` INT NOT NULL,
  `created_by` INT NOT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_order_exchanges_orders1_idx` (`order_id` ASC),
  INDEX `fk_order_exchanges_items1_idx` (`old_item_id` ASC),
  INDEX `fk_order_exchanges_items2_idx` (`new_item_id` ASC),
  INDEX `fk_order_exchanges_users1_idx` (`created_by` ASC),
  INDEX `fk_order_exchanges_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_order_exchanges_orders1`
    FOREIGN KEY (`order_id`)
    REFERENCES `orders` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_order_exchanges_items1`
    FOREIGN KEY (`old_item_id`)
    REFERENCES `items` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_order_exchanges_items2`
    FOREIGN KEY (`new_item_id`)
    REFERENCES `items` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_order_exchanges_users1`
    FOREIGN KEY (`created_by`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_order_exchanges_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `order_refunds`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `order_refunds` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `refund_amount` DECIMAL(12,2) NOT NULL,
  `refund_method` VARCHAR(45) NOT NULL,
  `refund_status` VARCHAR(45) NOT NULL,
  `reason` TEXT NULL DEFAULT NULL,
  `refunded_at` TIMESTAMP NULL DEFAULT NULL,
  `order_id` INT NOT NULL,
  `created_by` INT NOT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_order_refunds_orders1_idx` (`order_id` ASC),
  INDEX `fk_order_refunds_users1_idx` (`created_by` ASC),
  INDEX `fk_order_refunds_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_order_refunds_orders1`
    FOREIGN KEY (`order_id`)
    REFERENCES `orders` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_order_refunds_users1`
    FOREIGN KEY (`created_by`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_order_refunds_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- FINANCE & ACCOUNTING
-- =============================================================================

-- -----------------------------------------------------
-- Table `finance_bank_accounts`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `finance_bank_accounts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `bank_name` VARCHAR(100) NOT NULL,
  `account_title` VARCHAR(100) NOT NULL,
  `account_number` VARCHAR(100) NOT NULL,
  `current_balance` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `status` VARCHAR(45) NOT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_finance_bank_accounts_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_finance_bank_accounts_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `finance_vendor_bills` (supplier bills, can link to a purchase order)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `finance_vendor_bills` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `vendor_name` VARCHAR(100) NOT NULL,
  `bill_no` VARCHAR(60) NOT NULL,
  `bill_amount` DECIMAL(12,2) NOT NULL,
  `amount_due` DECIMAL(12,2) NOT NULL,
  `due_date` DATE NOT NULL,
  `status` VARCHAR(45) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `supplier_id` INT NULL DEFAULT NULL,
  `purchase_order_id` INT NULL DEFAULT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_finance_vendor_bills_wh_tenants1_idx` (`tenant_id` ASC),
  INDEX `fk_finance_vendor_bills_supplier_idx` (`supplier_id` ASC),
  INDEX `fk_finance_vendor_bills_po_idx` (`purchase_order_id` ASC),
  CONSTRAINT `fk_finance_vendor_bills_supplier`
    FOREIGN KEY (`supplier_id`)
    REFERENCES `suppliers` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_finance_vendor_bills_po`
    FOREIGN KEY (`purchase_order_id`)
    REFERENCES `purchase_orders` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_finance_vendor_bills_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `finance_vendor_payments`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `finance_vendor_payments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `amount_paid` DECIMAL(12,2) NOT NULL,
  `payment_method` VARCHAR(45) NOT NULL,
  `paid_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `vendor_bill_id` INT NOT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_finance_vendor_payments_finance_vendor_bills1_idx` (`vendor_bill_id` ASC),
  INDEX `fk_finance_vendor_payments_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_finance_vendor_payments_finance_vendor_bills1`
    FOREIGN KEY (`vendor_bill_id`)
    REFERENCES `finance_vendor_bills` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_finance_vendor_payments_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `finance_expense_categories`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `finance_expense_categories` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `category_name` VARCHAR(45) NOT NULL,
  `monthly_allocated_budget` DECIMAL(12,2) NULL DEFAULT NULL,
  `notes` TEXT NULL DEFAULT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_finance_expense_categories_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_finance_expense_categories_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `finance_expense_sub_categories`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `finance_expense_sub_categories` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `sub_category_name` VARCHAR(100) NOT NULL,
  `monthly_allocated_budget` DECIMAL(12,2) NULL DEFAULT NULL,
  `notes` TEXT NULL DEFAULT NULL,
  `category_id` INT NOT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_fin_exp_sub_cat_fin_exp_cat1_idx` (`category_id` ASC),
  INDEX `fk_finance_expense_sub_categories_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_fin_exp_sub_cat_fin_exp_cat1`
    FOREIGN KEY (`category_id`)
    REFERENCES `finance_expense_categories` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_finance_expense_sub_categories_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `finance_expenses`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `finance_expenses` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `expense_title` VARCHAR(100) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `payment_method` VARCHAR(45) NOT NULL,
  `expense_date` DATE NOT NULL,
  `notes` TEXT NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `category_id` INT NOT NULL,
  `sub_category_id` INT NULL DEFAULT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_finance_expenses_finance_expense_categories1_idx` (`category_id` ASC),
  INDEX `fk_finance_expenses_finance_expense_sub_categories1_idx` (`sub_category_id` ASC),
  INDEX `fk_finance_expenses_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_finance_expenses_finance_expense_categories1`
    FOREIGN KEY (`category_id`)
    REFERENCES `finance_expense_categories` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_finance_expenses_finance_expense_sub_categories1`
    FOREIGN KEY (`sub_category_id`)
    REFERENCES `finance_expense_sub_categories` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_finance_expenses_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `finance_recurring_expenses`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `finance_recurring_expenses` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(100) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `frequency` VARCHAR(45) NOT NULL,
  `next_due_date` DATE NOT NULL,
  `last_deducted_at` TIMESTAMP NULL DEFAULT NULL,
  `status` VARCHAR(45) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `category_id` INT NOT NULL,
  `sub_category_id` INT NULL DEFAULT NULL,
  `bank_account_id` INT NULL DEFAULT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_finance_recurring_expenses_finance_expense_categories1_idx` (`category_id` ASC),
  INDEX `fk_fin_recur_exp_fin_exp_sub_cat1_idx` (`sub_category_id` ASC),
  INDEX `fk_fin_recur_exp_bank_idx` (`bank_account_id` ASC),
  INDEX `fk_finance_recurring_expenses_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_finance_recurring_expenses_finance_expense_categories1`
    FOREIGN KEY (`category_id`)
    REFERENCES `finance_expense_categories` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_fin_recur_exp_fin_exp_sub_cat1`
    FOREIGN KEY (`sub_category_id`)
    REFERENCES `finance_expense_sub_categories` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_fin_recur_exp_bank`
    FOREIGN KEY (`bank_account_id`)
    REFERENCES `finance_bank_accounts` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_finance_recurring_expenses_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `finance_transactions`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `finance_transactions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `transaction_type` VARCHAR(45) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `payment_method` VARCHAR(45) NULL DEFAULT NULL,
  `reference` VARCHAR(45) NULL DEFAULT NULL,
  `notes` TEXT NULL DEFAULT NULL,
  `transaction_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_finance_transactions_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_finance_transactions_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- POINT OF SALE (Counter)
-- Sells finished items from unified stock at a branch.
-- =============================================================================

-- -----------------------------------------------------
-- Table `pos_terminals`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `pos_terminals` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `terminal_name` VARCHAR(100) NOT NULL,
  `device_code` VARCHAR(100) NOT NULL,
  `status` VARCHAR(45) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `branch_id` INT NOT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_pos_terminals_branch_idx` (`branch_id` ASC),
  INDEX `fk_pos_terminals_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_pos_terminals_branch`
    FOREIGN KEY (`branch_id`)
    REFERENCES `branches` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_pos_terminals_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `pos_sales`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `pos_sales` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `sale_no` VARCHAR(60) NOT NULL,
  `total_amount` DECIMAL(12,2) NOT NULL,
  `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `payable_amount` DECIMAL(12,2) NOT NULL,
  `payment_status` VARCHAR(45) NOT NULL,
  `payment_method` VARCHAR(45) NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `branch_id` INT NOT NULL,
  `terminal_id` INT NOT NULL,
  `crm_customers_id` INT NULL DEFAULT NULL,
  `created_by` INT NOT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_pos_sales_tenant_sale_no` (`tenant_id` ASC, `sale_no` ASC),
  INDEX `fk_pos_sales_branch_idx` (`branch_id` ASC),
  INDEX `fk_pos_sales_pos_terminals1_idx` (`terminal_id` ASC),
  INDEX `fk_pos_sales_crm_customers1_idx` (`crm_customers_id` ASC),
  INDEX `fk_pos_sales_users1_idx` (`created_by` ASC),
  INDEX `fk_pos_sales_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_pos_sales_branch`
    FOREIGN KEY (`branch_id`)
    REFERENCES `branches` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_pos_sales_pos_terminals1`
    FOREIGN KEY (`terminal_id`)
    REFERENCES `pos_terminals` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_pos_sales_crm_customers1`
    FOREIGN KEY (`crm_customers_id`)
    REFERENCES `crm_customers` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_pos_sales_users1`
    FOREIGN KEY (`created_by`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_pos_sales_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `pos_sale_items`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `pos_sale_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `product_name` VARCHAR(150) NOT NULL,
  `sku` VARCHAR(80) NULL DEFAULT NULL,
  `quantity` DECIMAL(12,3) NOT NULL,
  `unit_price` DECIMAL(12,2) NOT NULL,
  `total_price` DECIMAL(12,2) NOT NULL,
  `pos_sale_id` INT NOT NULL,
  `item_id` INT NULL DEFAULT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_pos_sale_items_pos_sales1_idx` (`pos_sale_id` ASC),
  INDEX `fk_pos_sale_items_item_idx` (`item_id` ASC),
  INDEX `fk_pos_sale_items_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_pos_sale_items_pos_sales1`
    FOREIGN KEY (`pos_sale_id`)
    REFERENCES `pos_sales` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_pos_sale_items_item`
    FOREIGN KEY (`item_id`)
    REFERENCES `items` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_pos_sale_items_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `pos_cash_registers`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `pos_cash_registers` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `opening_balance` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `closing_balance` DECIMAL(12,2) NULL DEFAULT NULL,
  `cash_collected` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `opened_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `closed_at` TIMESTAMP NULL DEFAULT NULL,
  `branch_id` INT NOT NULL,
  `terminal_id` INT NOT NULL,
  `opened_by` INT NOT NULL,
  `closed_by` INT NULL DEFAULT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_pos_cash_registers_branch_idx` (`branch_id` ASC),
  INDEX `fk_pos_cash_registers_pos_terminals1_idx` (`terminal_id` ASC),
  INDEX `fk_pos_cash_registers_users1_idx` (`opened_by` ASC),
  INDEX `fk_pos_cash_registers_users2_idx` (`closed_by` ASC),
  INDEX `fk_pos_cash_registers_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_pos_cash_registers_branch`
    FOREIGN KEY (`branch_id`)
    REFERENCES `branches` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_pos_cash_registers_pos_terminals1`
    FOREIGN KEY (`terminal_id`)
    REFERENCES `pos_terminals` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_pos_cash_registers_users1`
    FOREIGN KEY (`opened_by`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_pos_cash_registers_users2`
    FOREIGN KEY (`closed_by`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_pos_cash_registers_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `pos_refunds`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `pos_refunds` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `refund_amount` DECIMAL(12,2) NOT NULL,
  `reason` TEXT NULL DEFAULT NULL,
  `refunded_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `pos_sale_id` INT NOT NULL,
  `tenant_id` INT NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_pos_refunds_pos_sales1_idx` (`pos_sale_id` ASC),
  INDEX `fk_pos_refunds_wh_tenants1_idx` (`tenant_id` ASC),
  CONSTRAINT `fk_pos_refunds_pos_sales1`
    FOREIGN KEY (`pos_sale_id`)
    REFERENCES `pos_sales` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_pos_refunds_wh_tenants1`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `wh_tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

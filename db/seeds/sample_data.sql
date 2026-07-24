-- =============================================================================
-- Sample / demo data for bakery_erp  (safe to re-run)
-- =============================================================================
-- Run in MySQL:
--   mysql -u root -p bakery_erp < db/seeds/sample_data.sql
--
-- Prereqs: schema applied + WH admins seeded (npm run setup:db)
--
-- Tenant logins (password for all: tenant123)
--   admin@sweetcrumbs.pk → /erp1   (full demo: branches, stock, recipes, POS)
--   admin@lahorebakes.pk → /erp2
--   admin@karachicakes.pk → /erp3
-- =============================================================================

USE `bakery_erp`;

-- -----------------------------------------------------------------------------
-- Cleanup previous sample rows (re-run safe). Tenant delete cascades to all
-- tenant-scoped bakery tables via FK ON DELETE CASCADE.
-- -----------------------------------------------------------------------------
DELETE FROM `wh_tenants`
WHERE `company_name` IN ('Sweet Crumbs Bakery', 'Lahore Bakes', 'Karachi Cakes');

DELETE FROM `wh_subscription_plans`
WHERE `plan_name` IN ('Basic', 'Standard', 'Premium');

DELETE FROM `modules`
WHERE `module_name` IN (
  'Admin', 'Stock & Purchasing', 'Production', 'Point of Sale', 'POS Terminal',
  'Order Management', 'CRM', 'Finance & Accounting',
  -- legacy names (clean up if present)
  'Inventory', 'Orders', 'POS', 'Logistics', 'Logistics Partners',
  'E-Commerce Integration', 'Inventory & Procurement'
);

-- -----------------------------------------------------------------------------
-- Modules (canonical tenant portal names — Bakery ERP)
-- -----------------------------------------------------------------------------
INSERT INTO `modules` (`module_name`) VALUES
  ('Admin'),
  ('Stock & Purchasing'),
  ('Production'),
  ('Point of Sale'),
  ('POS Terminal'),
  ('Order Management'),
  ('CRM'),
  ('Finance & Accounting');

SET @mod_admin      = (SELECT `id` FROM `modules` WHERE `module_name` = 'Admin'               AND `deleted_at` IS NULL ORDER BY `id` LIMIT 1);
SET @mod_stock      = (SELECT `id` FROM `modules` WHERE `module_name` = 'Stock & Purchasing'  AND `deleted_at` IS NULL ORDER BY `id` LIMIT 1);
SET @mod_production = (SELECT `id` FROM `modules` WHERE `module_name` = 'Production'           AND `deleted_at` IS NULL ORDER BY `id` LIMIT 1);
SET @mod_pos        = (SELECT `id` FROM `modules` WHERE `module_name` = 'Point of Sale'       AND `deleted_at` IS NULL ORDER BY `id` LIMIT 1);
SET @mod_posterm    = (SELECT `id` FROM `modules` WHERE `module_name` = 'POS Terminal'        AND `deleted_at` IS NULL ORDER BY `id` LIMIT 1);
SET @mod_orders     = (SELECT `id` FROM `modules` WHERE `module_name` = 'Order Management'    AND `deleted_at` IS NULL ORDER BY `id` LIMIT 1);
SET @mod_crm        = (SELECT `id` FROM `modules` WHERE `module_name` = 'CRM'                 AND `deleted_at` IS NULL ORDER BY `id` LIMIT 1);
SET @mod_finance    = (SELECT `id` FROM `modules` WHERE `module_name` = 'Finance & Accounting' AND `deleted_at` IS NULL ORDER BY `id` LIMIT 1);

-- -----------------------------------------------------------------------------
-- Subscription plans
-- -----------------------------------------------------------------------------
INSERT INTO `wh_subscription_plans` (`plan_name`, `plan_price`, `login_portal`) VALUES
  ('Basic',    5000.00,  'erp1'),
  ('Standard', 10000.00, 'erp2'),
  ('Premium',  20000.00, 'erp3');

SET @plan_basic    = (SELECT `id` FROM `wh_subscription_plans` WHERE `plan_name` = 'Basic'    AND `deleted_at` IS NULL ORDER BY `id` LIMIT 1);
SET @plan_standard = (SELECT `id` FROM `wh_subscription_plans` WHERE `plan_name` = 'Standard' AND `deleted_at` IS NULL ORDER BY `id` LIMIT 1);
SET @plan_premium  = (SELECT `id` FROM `wh_subscription_plans` WHERE `plan_name` = 'Premium'  AND `deleted_at` IS NULL ORDER BY `id` LIMIT 1);

-- Plan bundles — every plan includes the full bakery module set.
INSERT IGNORE INTO `wh_subscription_module` (`subscription_plan_id`, `module_id`)
SELECT p.id, m.id
FROM (SELECT @plan_basic AS id UNION ALL SELECT @plan_standard UNION ALL SELECT @plan_premium) p
CROSS JOIN (
  SELECT @mod_admin AS id UNION ALL SELECT @mod_stock UNION ALL SELECT @mod_production UNION ALL
  SELECT @mod_pos UNION ALL SELECT @mod_posterm UNION ALL SELECT @mod_orders UNION ALL
  SELECT @mod_crm UNION ALL SELECT @mod_finance
) m;

-- -----------------------------------------------------------------------------
-- Tenants (one login portal each)
-- -----------------------------------------------------------------------------
INSERT INTO `wh_tenants`
  (`company_name`, `owner_name`, `owner_email`, `owner_phone`, `industry`, `status`, `login_portal`)
VALUES
  ('Sweet Crumbs Bakery', 'Ayesha Khan', 'ayesha@sweetcrumbs.pk', '+92 300 1112222', 'Bakery', 'active', 'erp1'),
  ('Lahore Bakes',        'Bilal Ahmed', 'bilal@lahorebakes.pk',  '+92 301 2223333', 'Bakery', 'active', 'erp2'),
  ('Karachi Cakes',       'Sana Malik',  'sana@karachicakes.pk',  '+92 302 3334444', 'Bakery', 'active', 'erp3');

SET @tenant_a = (SELECT `id` FROM `wh_tenants` WHERE `company_name` = 'Sweet Crumbs Bakery' AND `deleted_at` IS NULL LIMIT 1);
SET @tenant_b = (SELECT `id` FROM `wh_tenants` WHERE `company_name` = 'Lahore Bakes'         AND `deleted_at` IS NULL LIMIT 1);
SET @tenant_c = (SELECT `id` FROM `wh_tenants` WHERE `company_name` = 'Karachi Cakes'        AND `deleted_at` IS NULL LIMIT 1);

-- -----------------------------------------------------------------------------
-- Tenant limits  (max_warehouses is reused as the branch limit)
-- -----------------------------------------------------------------------------
INSERT INTO `wh_tenant_limits`
  (`max_users`, `max_warehouses`, `max_stores`, `max_orders_per_month`, `tenant_id`)
VALUES
  (25, 5,  5,  50000,  @tenant_a),
  (10, 2,  2,  5000,   @tenant_b),
  (50, 10, 10, 100000, @tenant_c);

-- -----------------------------------------------------------------------------
-- Tenant subscriptions
-- -----------------------------------------------------------------------------
INSERT INTO `wh_tenant_subscriptions`
  (`billing_cycle`, `start_date`, `renewal_date`, `status`, `total_amount`, `amount_due`, `tenant_id`, `subscription_plan_id`)
VALUES
  ('monthly', '2026-01-01', '2026-08-01', 'active', 5000.00,  0.00,    @tenant_a, @plan_basic),
  ('monthly', '2026-02-01', '2026-08-01', 'active', 10000.00, 10000.00, @tenant_b, @plan_standard),
  ('monthly', '2026-01-01', '2026-08-01', 'active', 20000.00, 0.00,    @tenant_c, @plan_premium);

-- -----------------------------------------------------------------------------
-- Enable the full bakery module set for every tenant
-- -----------------------------------------------------------------------------
INSERT INTO `wh_tenant_modules` (`is_enabled`, `enabled_at`, `module_id`, `tenant_id`)
SELECT 1, NOW(), m.id, t.id
FROM (SELECT @tenant_a AS id UNION ALL SELECT @tenant_b UNION ALL SELECT @tenant_c) t
CROSS JOIN (
  SELECT @mod_admin AS id UNION ALL SELECT @mod_stock UNION ALL SELECT @mod_production UNION ALL
  SELECT @mod_pos UNION ALL SELECT @mod_posterm UNION ALL SELECT @mod_orders UNION ALL
  SELECT @mod_crm UNION ALL SELECT @mod_finance
) m;

-- -----------------------------------------------------------------------------
-- Organization settings
-- -----------------------------------------------------------------------------
INSERT INTO `organization_settings`
  (`company_name`, `logo_url`, `timezone`, `currency`, `language`, `fiscal_year_start`, `fiscal_year_end`, `tenant_id`)
VALUES
  ('Sweet Crumbs Bakery', NULL, 'Asia/Karachi', 'PKR', 'en', '2026-01-01', '2026-12-31', @tenant_a),
  ('Lahore Bakes',        NULL, 'Asia/Karachi', 'PKR', 'en', '2026-01-01', '2026-12-31', @tenant_b),
  ('Karachi Cakes',       NULL, 'Asia/Karachi', 'PKR', 'en', '2026-01-01', '2026-12-31', @tenant_c);

-- -----------------------------------------------------------------------------
-- Super Admin roles + users (password: tenant123)
-- -----------------------------------------------------------------------------
INSERT INTO `roles` (`role_name`, `description`, `status`, `tenant_id`) VALUES
  ('Super Admin', 'Full access to all enabled modules', 'active', @tenant_a),
  ('Super Admin', 'Full access to all enabled modules', 'active', @tenant_b),
  ('Super Admin', 'Full access to all enabled modules', 'active', @tenant_c);

SET @role_a = (SELECT `id` FROM `roles` WHERE `tenant_id` = @tenant_a AND `role_name` = 'Super Admin' AND `deleted_at` IS NULL LIMIT 1);
SET @role_b = (SELECT `id` FROM `roles` WHERE `tenant_id` = @tenant_b AND `role_name` = 'Super Admin' AND `deleted_at` IS NULL LIMIT 1);
SET @role_c = (SELECT `id` FROM `roles` WHERE `tenant_id` = @tenant_c AND `role_name` = 'Super Admin' AND `deleted_at` IS NULL LIMIT 1);

-- Password: tenant123 (WARSI cipher — same as server encrypt())
SET @pwd_tenant = 'f018dee4bfe767e14841b96afd2cdb30:b6df070649c1488e4920386fb97f7162';

INSERT INTO `users` (`tenant_id`, `name`, `email`, `username`, `password`, `phone`, `status`, `role_id`) VALUES
  (@tenant_a, 'Sweet Crumbs Admin', 'admin@sweetcrumbs.pk', 'admin@sweetcrumbs.pk', @pwd_tenant, '+92 300 1112222', 'active', @role_a),
  (@tenant_b, 'Lahore Bakes Admin', 'admin@lahorebakes.pk', 'admin@lahorebakes.pk', @pwd_tenant, '+92 301 2223333', 'active', @role_b),
  (@tenant_c, 'Karachi Cakes Admin', 'admin@karachicakes.pk', 'admin@karachicakes.pk', @pwd_tenant, '+92 302 3334444', 'active', @role_c);

SET @user_a = (SELECT `id` FROM `users` WHERE `email` = 'admin@sweetcrumbs.pk' AND `deleted_at` IS NULL LIMIT 1);

-- -----------------------------------------------------------------------------
-- Permissions: full access to every module for each Super Admin
-- -----------------------------------------------------------------------------
INSERT INTO `permissions` (`permission_name`, `action`, `role_id`, `module_id`)
SELECT 'full_access', a.action, r.role_id, m.id
FROM (SELECT @role_a AS role_id UNION ALL SELECT @role_b UNION ALL SELECT @role_c) r
CROSS JOIN (
  SELECT @mod_admin AS id UNION ALL SELECT @mod_stock UNION ALL SELECT @mod_production UNION ALL
  SELECT @mod_pos UNION ALL SELECT @mod_posterm UNION ALL SELECT @mod_orders UNION ALL
  SELECT @mod_crm UNION ALL SELECT @mod_finance
) m
CROSS JOIN (
  SELECT 'view' AS action UNION ALL SELECT 'create' UNION ALL SELECT 'edit' UNION ALL
  SELECT 'delete' UNION ALL SELECT 'manage'
) a;

-- =============================================================================
-- BAKERY DEMO DATA for Sweet Crumbs Bakery (@tenant_a)
-- =============================================================================

-- Branches ---------------------------------------------------------------------
INSERT INTO `branches` (`branch_name`, `code`, `location`, `city`, `phone`, `open_time`, `close_time`, `opening_balance`, `status`, `tenant_id`) VALUES
  ('Main Branch',   'MB', 'Gulberg Main Boulevard', 'Lahore', '+92 42 111 0001', '08:00:00', '23:00:00', 5000.00, 'active', @tenant_a),
  ('DHA Branch',    'DHA', 'DHA Phase 5', 'Lahore', '+92 42 111 0002', '09:00:00', '23:00:00', 3000.00, 'active', @tenant_a);

SET @br_main = (SELECT `id` FROM `branches` WHERE `tenant_id` = @tenant_a AND `code` = 'MB' AND `deleted_at` IS NULL LIMIT 1);
SET @br_dha  = (SELECT `id` FROM `branches` WHERE `tenant_id` = @tenant_a AND `code` = 'DHA' AND `deleted_at` IS NULL LIMIT 1);

-- Item categories --------------------------------------------------------------
INSERT INTO `item_categories` (`category_name`, `item_type`, `status`, `tenant_id`) VALUES
  ('Raw Ingredients', 'ingredient', 'active', @tenant_a),
  ('Cakes',           'finished',   'active', @tenant_a),
  ('Bakery Snacks',   'finished',   'active', @tenant_a),
  ('Packaging',       'packaging',  'active', @tenant_a);

SET @cat_ing  = (SELECT `id` FROM `item_categories` WHERE `tenant_id` = @tenant_a AND `category_name` = 'Raw Ingredients' AND `deleted_at` IS NULL LIMIT 1);
SET @cat_cake = (SELECT `id` FROM `item_categories` WHERE `tenant_id` = @tenant_a AND `category_name` = 'Cakes' AND `deleted_at` IS NULL LIMIT 1);
SET @cat_snack= (SELECT `id` FROM `item_categories` WHERE `tenant_id` = @tenant_a AND `category_name` = 'Bakery Snacks' AND `deleted_at` IS NULL LIMIT 1);
SET @cat_pack = (SELECT `id` FROM `item_categories` WHERE `tenant_id` = @tenant_a AND `category_name` = 'Packaging' AND `deleted_at` IS NULL LIMIT 1);

-- Items: ingredients (kacha maal) ---------------------------------------------
INSERT INTO `items`
  (`item_name`, `item_type`, `sku`, `unit`, `cost_price`, `selling_price`, `is_purchased`, `is_produced`, `is_sold`, `shelf_life_days`, `low_stock_threshold`, `status`, `category_id`, `tenant_id`)
VALUES
  ('Flour (Maida)',   'ingredient', 'ING-FLOUR', 'kg',    120.00, 0.00, 1, 0, 0, 180, 20.000, 'active', @cat_ing, @tenant_a),
  ('Sugar (Cheeni)',  'ingredient', 'ING-SUGAR', 'kg',    140.00, 0.00, 1, 0, 0, 365, 15.000, 'active', @cat_ing, @tenant_a),
  ('Butter',          'ingredient', 'ING-BUTTER','kg',    900.00, 0.00, 1, 0, 0, 60,  5.000,  'active', @cat_ing, @tenant_a),
  ('Eggs',            'ingredient', 'ING-EGG',   'dozen', 300.00, 0.00, 1, 0, 0, 21,  10.000, 'active', @cat_ing, @tenant_a),
  ('Cocoa Powder',    'ingredient', 'ING-COCOA', 'kg',    1600.00,0.00, 1, 0, 0, 365, 3.000,  'active', @cat_ing, @tenant_a);

-- Items: finished bakery goods -------------------------------------------------
INSERT INTO `items`
  (`item_name`, `item_type`, `sku`, `unit`, `cost_price`, `selling_price`, `is_purchased`, `is_produced`, `is_sold`, `shelf_life_days`, `low_stock_threshold`, `status`, `category_id`, `tenant_id`)
VALUES
  ('Chocolate Cake (1 lb)', 'finished', 'CAKE-CHOC', 'piece', 600.00, 1200.00, 0, 1, 1, 3, 5.000,  'active', @cat_cake,  @tenant_a),
  ('Vanilla Cake (1 lb)',   'finished', 'CAKE-VAN',  'piece', 550.00, 1100.00, 0, 1, 1, 3, 5.000,  'active', @cat_cake,  @tenant_a),
  ('Cream Roll',            'finished', 'SNK-ROLL',  'piece', 40.00,  90.00,   0, 1, 1, 2, 20.000, 'active', @cat_snack, @tenant_a),
  ('Rusk (packet)',         'finished', 'SNK-RUSK',  'packet',120.00, 250.00,  0, 1, 1, 30,10.000, 'active', @cat_snack, @tenant_a);

-- Items: packaging -------------------------------------------------------------
INSERT INTO `items`
  (`item_name`, `item_type`, `sku`, `unit`, `cost_price`, `selling_price`, `is_purchased`, `is_produced`, `is_sold`, `low_stock_threshold`, `status`, `category_id`, `tenant_id`)
VALUES
  ('Cake Box (1 lb)', 'packaging', 'PKG-BOX1', 'piece', 25.00, 0.00, 1, 0, 0, 50.000, 'active', @cat_pack, @tenant_a);

SET @it_flour  = (SELECT `id` FROM `items` WHERE `tenant_id` = @tenant_a AND `sku` = 'ING-FLOUR' LIMIT 1);
SET @it_sugar  = (SELECT `id` FROM `items` WHERE `tenant_id` = @tenant_a AND `sku` = 'ING-SUGAR' LIMIT 1);
SET @it_butter = (SELECT `id` FROM `items` WHERE `tenant_id` = @tenant_a AND `sku` = 'ING-BUTTER' LIMIT 1);
SET @it_egg    = (SELECT `id` FROM `items` WHERE `tenant_id` = @tenant_a AND `sku` = 'ING-EGG' LIMIT 1);
SET @it_cocoa  = (SELECT `id` FROM `items` WHERE `tenant_id` = @tenant_a AND `sku` = 'ING-COCOA' LIMIT 1);
SET @it_choc   = (SELECT `id` FROM `items` WHERE `tenant_id` = @tenant_a AND `sku` = 'CAKE-CHOC' LIMIT 1);
SET @it_van    = (SELECT `id` FROM `items` WHERE `tenant_id` = @tenant_a AND `sku` = 'CAKE-VAN' LIMIT 1);
SET @it_roll   = (SELECT `id` FROM `items` WHERE `tenant_id` = @tenant_a AND `sku` = 'SNK-ROLL' LIMIT 1);

-- Suppliers --------------------------------------------------------------------
INSERT INTO `suppliers` (`supplier_name`, `contact_person`, `phone`, `email`, `city`, `status`, `tenant_id`) VALUES
  ('Al-Barkat Flour Mills', 'Imran Sheikh', '+92 300 5556666', 'sales@albarkat.pk', 'Lahore', 'active', @tenant_a),
  ('Metro Cash & Carry',    'Procurement Desk', '+92 42 111 222 333', 'orders@metro.pk', 'Lahore', 'active', @tenant_a);

-- Opening stock: batches + rollup levels at Main Branch ------------------------
-- Ingredients
INSERT INTO `stock_batches` (`batch_no`, `source_type`, `qty_received`, `qty_remaining`, `unit_cost`, `made_on`, `expiry_date`, `status`, `item_id`, `branch_id`, `tenant_id`) VALUES
  ('B-OPEN-FLOUR', 'opening', 100.000, 100.000, 120.00, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 180 DAY), 'active', @it_flour,  @br_main, @tenant_a),
  ('B-OPEN-SUGAR', 'opening', 60.000,  60.000,  140.00, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 300 DAY), 'active', @it_sugar,  @br_main, @tenant_a),
  ('B-OPEN-BUTTER','opening', 20.000,  20.000,  900.00, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 45 DAY),  'active', @it_butter, @br_main, @tenant_a),
  ('B-OPEN-EGG',   'opening', 30.000,  30.000,  300.00, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 18 DAY),  'active', @it_egg,    @br_main, @tenant_a),
  ('B-OPEN-COCOA', 'opening', 8.000,   8.000,   1600.00,CURDATE(), DATE_ADD(CURDATE(), INTERVAL 300 DAY), 'active', @it_cocoa,  @br_main, @tenant_a);
-- Finished goods (small stock, near-term expiry to demo alerts)
INSERT INTO `stock_batches` (`batch_no`, `source_type`, `qty_received`, `qty_remaining`, `unit_cost`, `made_on`, `expiry_date`, `status`, `item_id`, `branch_id`, `tenant_id`) VALUES
  ('B-OPEN-CHOC', 'production', 6.000, 6.000, 600.00, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 2 DAY), 'active', @it_choc, @br_main, @tenant_a),
  ('B-OPEN-ROLL', 'production', 40.000,40.000,40.00,  CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 DAY), 'active', @it_roll, @br_main, @tenant_a);

INSERT INTO `stock_levels` (`available_qty`, `item_id`, `branch_id`, `tenant_id`) VALUES
  (100.000, @it_flour,  @br_main, @tenant_a),
  (60.000,  @it_sugar,  @br_main, @tenant_a),
  (20.000,  @it_butter, @br_main, @tenant_a),
  (30.000,  @it_egg,    @br_main, @tenant_a),
  (8.000,   @it_cocoa,  @br_main, @tenant_a),
  (6.000,   @it_choc,   @br_main, @tenant_a),
  (40.000,  @it_roll,   @br_main, @tenant_a);

-- Recipe: Chocolate Cake -------------------------------------------------------
INSERT INTO `recipes` (`recipe_name`, `yield_qty`, `yield_unit`, `instructions`, `prep_time_mins`, `status`, `item_id`, `tenant_id`) VALUES
  ('Chocolate Cake Recipe', 1.000, 'piece', 'Mix dry, fold in butter and eggs, bake at 180C for 35 min.', 60, 'active', @it_choc, @tenant_a);

SET @recipe_choc = (SELECT `id` FROM `recipes` WHERE `tenant_id` = @tenant_a AND `item_id` = @it_choc AND `deleted_at` IS NULL LIMIT 1);

INSERT INTO `recipe_ingredients` (`quantity`, `unit`, `notes`, `recipe_id`, `ingredient_item_id`, `tenant_id`) VALUES
  (0.400, 'kg',    'Maida',  @recipe_choc, @it_flour,  @tenant_a),
  (0.300, 'kg',    'Cheeni', @recipe_choc, @it_sugar,  @tenant_a),
  (0.200, 'kg',    NULL,     @recipe_choc, @it_butter, @tenant_a),
  (0.500, 'dozen', '6 eggs', @recipe_choc, @it_egg,    @tenant_a),
  (0.080, 'kg',    NULL,     @recipe_choc, @it_cocoa,  @tenant_a);

-- POS terminal at Main Branch (device code "1" pairs with the terminal UI) -----
INSERT INTO `pos_terminals` (`terminal_name`, `device_code`, `status`, `branch_id`, `tenant_id`) VALUES
  ('Main Counter', '1', 'active', @br_main, @tenant_a);

-- CRM: a couple of walk-in customers ------------------------------------------
INSERT INTO `crm_customers` (`customer_name`, `phone`, `email`, `status`, `tenant_id`) VALUES
  ('Walk-in Customer', '+92 300 0000000', NULL, 'active', @tenant_a),
  ('Fatima Noor',      '+92 321 4445555', 'fatima@example.pk', 'active', @tenant_a);

-- -----------------------------------------------------------------------------
-- Done
-- -----------------------------------------------------------------------------
SELECT 'Bakery sample data loaded.' AS message;
SELECT `company_name`, `login_portal`, `owner_email` FROM `wh_tenants` WHERE `deleted_at` IS NULL;
SELECT `module_name` FROM `modules` WHERE `deleted_at` IS NULL ORDER BY `id`;
SELECT `item_name`, `item_type`, `unit` FROM `items` WHERE `tenant_id` = @tenant_a ORDER BY `item_type`, `item_name`;

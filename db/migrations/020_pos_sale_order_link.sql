-- Link POS sales to Order Management orders so terminal checkouts appear in OM (with payment).

ALTER TABLE `pos_sales`
  ADD COLUMN `order_id` INT NULL DEFAULT NULL AFTER `crm_customers_id`,
  ADD UNIQUE INDEX `uk_pos_sales_order_id` (`order_id` ASC),
  ADD CONSTRAINT `fk_pos_sales_orders`
    FOREIGN KEY (`order_id`)
    REFERENCES `orders` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

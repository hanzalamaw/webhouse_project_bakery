-- Add optional bank account link for one-time expenses (Payment via).
ALTER TABLE `finance_expenses`
  ADD COLUMN `bank_account_id` INT NULL DEFAULT NULL AFTER `sub_category_id`,
  ADD INDEX `fk_finance_expenses_bank_idx` (`bank_account_id` ASC),
  ADD CONSTRAINT `fk_finance_expenses_bank`
    FOREIGN KEY (`bank_account_id`)
    REFERENCES `finance_bank_accounts` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

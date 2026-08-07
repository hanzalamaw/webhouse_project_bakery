import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createPool, closePool } from "../src/db/pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env"), override: true });

const db = await createPool();
try {
  try {
    await db.query(
      `ALTER TABLE finance_expenses
       ADD COLUMN bank_account_id INT NULL DEFAULT NULL AFTER sub_category_id`
    );
    console.log("added bank_account_id");
  } catch (e) {
    console.log("bank_account_id:", e.code || e.message);
  }

  try {
    await db.query(
      `ALTER TABLE finance_expenses ADD INDEX fk_finance_expenses_bank_idx (bank_account_id)`
    );
    console.log("added index");
  } catch (e) {
    console.log("index:", e.code || e.message);
  }

  try {
    await db.query(
      `ALTER TABLE finance_expenses
       ADD CONSTRAINT fk_finance_expenses_bank
       FOREIGN KEY (bank_account_id)
       REFERENCES finance_bank_accounts (id)
       ON DELETE SET NULL
       ON UPDATE CASCADE`
    );
    console.log("added FK");
  } catch (e) {
    console.log("fk:", e.code || e.message);
  }

  const [rows] = await db.query("SHOW COLUMNS FROM finance_expenses");
  console.log(rows.map((r) => r.Field).join(", "));
} finally {
  await closePool(db);
}

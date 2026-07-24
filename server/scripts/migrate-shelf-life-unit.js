import dotenv from "dotenv";
import { createPool, closePool } from "../src/db/pool.js";

dotenv.config();

const db = await createPool();

try {
  await db.query(
    `ALTER TABLE items
     ADD COLUMN shelf_life_unit VARCHAR(20) NOT NULL DEFAULT 'days'
     AFTER shelf_life_days`
  );
  console.log("OK: added items.shelf_life_unit");
} catch (e) {
  const msg = String(e.message || "");
  if (msg.includes("Duplicate column")) {
    console.log("SKIP: items.shelf_life_unit already exists");
  } else {
    throw e;
  }
} finally {
  await closePool();
}

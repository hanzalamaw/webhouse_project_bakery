import dotenv from "dotenv";
import { createPool, closePool } from "../src/db/pool.js";

dotenv.config();

const db = await createPool();

async function dropTable(table) {
  try {
    await db.query(`DROP TABLE IF EXISTS \`${table}\``);
    console.log(`OK: dropped ${table}`);
  } catch (e) {
    const msg = String(e.message || "");
    console.warn(`WARN: could not drop ${table}: ${msg}`);
  }
}

try {
  await dropTable("crm_leads");
  await dropTable("order_assignments");
} finally {
  await closePool();
}

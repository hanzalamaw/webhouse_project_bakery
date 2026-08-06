import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createPool, closePool } from "../src/db/pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
dotenv.config({ path: envPath, override: true });

console.log("env file:", envPath, "DB_HOST=", process.env.DB_HOST);

const cols = [
  ["invoice_accent_color", "VARCHAR(7) NOT NULL DEFAULT '#E11D48'"],
  ["company_address", "VARCHAR(255) NULL"],
  ["company_phone", "VARCHAR(45) NULL"],
];

const db = await createPool();
try {
  for (const [name, def] of cols) {
    try {
      await db.query(`ALTER TABLE organization_settings ADD COLUMN ${name} ${def}`);
      console.log("added", name);
    } catch (e) {
      console.log(name + ":", e.code || e.message);
    }
  }
  const [rows] = await db.query("SHOW COLUMNS FROM organization_settings");
  console.log(rows.map((r) => r.Field).join(", "));
} finally {
  await closePool(db);
}

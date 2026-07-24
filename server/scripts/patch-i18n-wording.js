import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, "../../client/src/i18n/messages.js");
let src = fs.readFileSync(file, "utf8");

// Direct key overrides (nav/module wording)
const keyOverrides = {
  en: {
    "module.production": "Production",
    "module.production.desc": "Recipes and baking — make items and use up ingredients.",
    "module.finance": "Hisaab",
    "module.finance.desc": "Expenses, bills, transactions and reporting.",
    "nav.recipes": "Recipes",
    "nav.createRecipe": "Create Recipe",
    "nav.manageRecipes": "Manage Recipes",
    "nav.baking": "Baking",
    "nav.newBake": "New Bake / Production Run",
    "nav.manageRuns": "Manage Runs",
    "nav.customerPayments": "Customer Payments",
  },
  ur: {
    "module.production": "Production",
    "module.production.desc": "Recipes اور baking — چیزیں بنائیں اور مواد استعمال کریں۔",
    "module.finance": "حساب",
    "module.finance.desc": "اخراجات، بلز، ٹرانزیکشنز اور رپورٹس۔",
    "nav.recipes": "Recipes",
    "nav.createRecipe": "Create Recipe",
    "nav.manageRecipes": "Manage Recipes",
    "nav.baking": "Baking",
    "nav.newBake": "New Bake / Production Run",
    "nav.manageRuns": "Manage Runs",
    "nav.customerPayments": "کسٹمر پیسے",
  },
  roman: {
    "module.production": "Production",
    "module.production.desc": "Recipes aur baking — cheezen banayein aur samaan use karein.",
    "module.finance": "Hisaab",
    "module.finance.desc": "Kharchay, bills, transactions aur reports.",
    "nav.recipes": "Recipes",
    "nav.createRecipe": "Create Recipe",
    "nav.manageRecipes": "Manage Recipes",
    "nav.baking": "Baking",
    "nav.newBake": "New Bake / Production Run",
    "nav.manageRuns": "Manage Runs",
    "nav.customerPayments": "Customer paisay",
  },
};

function setKey(pack, key, value) {
  const re = new RegExp(`("${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}":\\s*)("[^"]*"|'[^']*')`);
  const packStart = src.indexOf(`  ${pack}: {`);
  if (packStart < 0) throw new Error("pack " + pack);
  let depth = 0;
  let i = packStart + (`  ${pack}: `).length;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  const packBody = src.slice(packStart, i);
  if (re.test(packBody)) {
    const updated = packBody.replace(re, `$1${JSON.stringify(value)}`);
    src = src.slice(0, packStart) + updated + src.slice(i);
  } else {
    src = src.slice(0, i) + `\n    ${JSON.stringify(key)}: ${JSON.stringify(value)},` + src.slice(i);
  }
}

for (const [pack, map] of Object.entries(keyOverrides)) {
  for (const [k, v] of Object.entries(map)) setKey(pack, k, v);
}

// English-key UI strings: [ur, roman]
const ui = {
  // Keep English loanwords
  Recipe: ["Recipe", "Recipe"],
  Recipes: ["Recipes", "Recipes"],
  "Recipes (Nuskhay)": ["Recipes", "Recipes"],
  "Create Recipe": ["Create Recipe", "Create Recipe"],
  "Edit Recipe": ["Edit Recipe", "Edit Recipe"],
  "Manage Recipes": ["Manage Recipes", "Manage Recipes"],
  "Delete recipe": ["Recipe ڈیلیٹ کریں", "Recipe delete karein"],
  "Recipe details": ["Recipe کی تفصیل", "Recipe ki tafseel"],
  Production: ["Production", "Production"],
  "Production (Baking)": ["Production", "Production"],
  "Production Runs": ["Production Runs", "Production Runs"],
  "Production run": ["Production run", "Production run"],
  Baking: ["Baking", "Baking"],
  "Bake Now": ["Bake Now", "Bake Now"],
  "Bake details": ["Bake کی تفصیل", "Bake ki tafseel"],
  "Cancel bake": ["Bake کینسل کریں", "Bake cancel karein"],
  "Bake #": ["Bake #", "Bake #"],
  Hisaab: ["حساب", "Hisaab"],
  "Finance & Accounting": ["حساب", "Hisaab"],
  "Customer Payments": ["کسٹمر پیسے", "Customer paisay"],

  // Common table / toolbar
  Status: ["سٹیٹس", "Status"],
  Type: ["قسم", "Type"],
  Customer: ["کسٹمر", "Customer"],
  Company: ["کمپنی", "Company"],
  Phone: ["فون", "Phone"],
  Email: ["ای میل", "Email"],
  Tags: ["ٹیگز", "Tags"],
  Created: ["بنایا گیا", "Created"],
  "Created By": ["بنانے والا", "Created by"],
  Amount: ["رقم", "Raqam"],
  Payment: ["پیمنٹ", "Payment"],
  "Payment Method": ["پیمنٹ کا طریقہ", "Payment method"],
  Method: ["طریقہ", "Method"],
  Channel: ["چینل", "Channel"],
  City: ["شہر", "Shehar"],
  Fulfillment: ["فلفلمنٹ", "Fulfillment"],
  "Order #": ["آرڈر #", "Order #"],
  Supplier: ["سپلائر", "Supplier"],
  Contact: ["رابطہ", "Rabta"],
  POs: ["پی اوز", "POs"],
  Store: ["اسٹور", "Store"],
  Terminals: ["ٹرمینلز", "Terminals"],
  "Opening balance": ["اوپننگ بیلنس", "Opening balance"],
  "Finished item": ["تیار چیز", "Tayyar cheez"],
  "Branch (Shop)": ["شاخ (دکان)", "Shakh (dukaan)"],
  Reason: ["وجہ", "Wajah"],
  Refunded: ["ریفنڈ ہوا", "Refunded"],
  Actions: ["ایکشنز", "Actions"],
  Name: ["نام", "Naam"],
  SKU: ["SKU", "SKU"],
  Unit: ["یونٹ", "Unit"],
  Category: ["کیٹگری", "Category"],
  Qty: ["مقدار", "Miqdaar"],
  Quantity: ["مقدار", "Miqdaar"],
  Price: ["قیمت", "Qeemat"],
  Cost: ["کاسٹ", "Cost"],
  Total: ["ٹوٹل", "Total"],
  Balance: ["بیلنس", "Balance"],
  Date: ["تاریخ", "Tareekh"],
  Notes: ["نوٹس", "Notes"],
  Item: ["چیز", "Cheez"],
  Branch: ["شاخ", "Shakh"],
  Available: ["دستیاب", "Dastyab"],
  Reserved: ["ریزروڈ", "Reserved"],
  Damaged: ["خراب", "Kharab"],
  Expiry: ["ایکسپائری", "Expiry"],
  Batch: ["بیچ", "Batch"],
  Product: ["پروڈکٹ", "Product"],
  Products: ["پروڈکٹس", "Products"],
  Revenue: ["آمدنی", "Aamdani"],
  Sales: ["سیلز", "Sales"],
  Orders: ["آرڈرز", "Orders"],
  Users: ["یوزرز", "Users"],
  Role: ["رول", "Role"],
  Username: ["یوزر نیم", "Username"],
  Active: ["ایکٹو", "Active"],
  Inactive: ["ان ایکٹو", "Inactive"],

  // Toolbar / filters / buttons
  "Search…": ["تلاش…", "Talash…"],
  "Search...": ["تلاش...", "Talash..."],
  "All years": ["تمام سال", "Tamam saal"],
  "From date": ["تاریخ سے", "Tareekh se"],
  "To date": ["تاریخ تک", "Tareekh tak"],
  "Filter by year": ["سال سے فلٹر", "Saal se filter"],
  FY: ["مالی سال", "FY"],
  All: ["تمام", "Tamam"],
  Clear: ["صاف کریں", "Saaf karein"],
  Close: ["بند کریں", "Band karein"],
  Filter: ["فلٹر", "Filter"],
  "No records found.": ["کوئی ریکارڈ نہیں ملا۔", "Koi record nahi mila."],
  "No rows match the current filters.": ["فلٹر سے کوئی رو نہیں ملی۔", "Filter se koi row nahi mili."],
  "No matching values": ["کوئی میچ نہیں", "Koi match nahi"],
  "No matches": ["کوئی میچ نہیں", "Koi match nahi"],
  "Select all": ["سب چنیں", "Sab chunein"],
  "Stay on page": ["صفحے پر رہیں", "Page par rahein"],
  "Discard changes": ["تبدیلیاں ختم کریں", "Tabdeeliyan khatam karein"],
  "Reload without saving": ["بغیر سیو ری لوڈ", "Bila save reload"],
  "Unsaved changes": ["غیر محفوظ تبدیلیاں", "Ghair mehfooz tabdeeliyan"],
  View: ["دیکھیں", "Dekhein"],
  Manage: ["مینج", "Manage"],
  Back: ["واپس", "Wapas"],
  Next: ["اگلا", "Agla"],
  Previous: ["پچھلا", "Pichla"],
  Yes: ["ہاں", "Haan"],
  No: ["نہیں", "Nahi"],
  Confirm: ["کنفرم", "Confirm"],
  Remove: ["ہٹائیں", "Hatayein"],
  Update: ["اپڈیٹ", "Update"],
  Submit: ["جمع کریں", "Jama karein"],
  Print: ["پرنٹ", "Print"],
  Export: ["ایکسپورٹ", "Export"],
  Import: ["امپورٹ", "Import"],
  Download: ["ڈاؤن لوڈ", "Download"],
  Upload: ["اپ لوڈ", "Upload"],
  Refresh: ["ریفریش", "Refresh"],
  "Save Item": ["چیز سیو کریں", "Cheez save karein"],
  "Create Item": ["چیز بنائیں", "Cheez banayein"],
  "Manage Items": ["چیزیں مینج کریں", "Cheezen manage karein"],
  "New category": ["نئی کیٹگری", "Nayi category"],
  "Add branch": ["شاخ شامل کریں", "Shakh shamil karein"],
  "Add expense": ["خرچہ شامل کریں", "Kharcha shamil karein"],
  "Add bill": ["بل شامل کریں", "Bill shamil karein"],
  "Add account": ["اکاؤنٹ شامل کریں", "Account shamil karein"],
  Logout: ["لاگ آؤٹ", "Logout"],
  "Log Out": ["لاگ آؤٹ", "Log out"],

  // KPI / amount labels common on dashboards
  "Total orders": ["کل آرڈرز", "Kul orders"],
  "Total sales": ["کل سیلز", "Kul sales"],
  "Total revenue": ["کل آمدنی", "Kul aamdani"],
  "Total customers": ["کل کسٹمرز", "Kul customers"],
  "Total amount": ["کل رقم", "Kul raqam"],
  "Paid amount": ["ادا شدہ رقم", "Ada shuda raqam"],
  "Pending amount": ["باقی رقم", "Baqi raqam"],
  "Payable amount": ["قابل ادائیگی رقم", "Qabil-e-adigi raqam"],
  "Opening cash": ["اوپننگ کیش", "Opening cash"],
  "Cash in drawer": ["ڈراور میں کیش", "Drawer mein cash"],
  "Low stock": ["کم اسٹاک", "Kam stock"],
  "Expiring soon": ["جلد ایکسپائر", "Jald expire"],
  "This month": ["اس مہینے", "Is mahine"],
  Today: ["آج", "Aaj"],
  Week: ["ہفتہ", "Hafta"],
  Month: ["مہینہ", "Mahina"],
  Year: ["سال", "Saal"],
  "Cost price (PKR)": ["کاسٹ پرائس (PKR)", "Cost price (PKR)"],
  "Selling price (PKR)": ["سیلنگ پرائس (PKR)", "Selling price (PKR)"],
  "Discount (PKR)": ["ڈسکاؤنٹ (PKR)", "Discount (PKR)"],
  "Tax (PKR)": ["ٹیکس (PKR)", "Tax (PKR)"],
  "Total price (PKR)": ["ٹوٹل پرائس (PKR)", "Total price (PKR)"],
  "Item name": ["چیز کا نام", "Cheez ka naam"],
  "SKU (optional)": ["SKU (آپشنل)", "SKU (optional)"],
  "Item type": ["چیز کی قسم", "Cheez ki qisam"],
  "Low stock alert": ["کم اسٹاک الرٹ", "Kam stock alert"],
  "Variant label": ["ویریئنٹ لیبل", "Variant label"],
  "Parent item (optional)": ["پیرنٹ چیز (آپشنل)", "Parent cheez (optional)"],
  "Shelf life": ["شیلف لائف", "Shelf life"],
  "Company name": ["کمپنی کا نام", "Company ka naam"],
  "No one": ["کوئی نہیں", "Koi nahi"],
  None: ["کوئی نہیں", "Koi nahi"],
  Optional: ["آپشنل", "Optional"],
  Required: ["ضروری", "Zaroori"],
  Description: ["تفصیل", "Tafseel"],
  Address: ["پتہ", "Pata"],
  Location: ["لوکیشن", "Location"],
  Code: ["کوڈ", "Code"],
  Reference: ["ریفرنس", "Reference"],
  "Due date": ["ڈیو ڈیٹ", "Due date"],
  "Start date": ["شروع تاریخ", "Shuru tareekh"],
  "End date": ["ختم تاریخ", "Khatam tareekh"],
  Title: ["عنوان", "Title"],
  Message: ["میسج", "Message"],
  Details: ["تفصیل", "Tafseel"],
  Summary: ["خلاصہ", "Khulasa"],
  Overview: ["جائزہ", "Jaiza"],
};

function upsertEnglishKeys(pack, entries) {
  const start = src.indexOf(`  ${pack}: {`);
  if (start < 0) throw new Error(pack);
  let depth = 0;
  let i = start + (`  ${pack}: `).length;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  let body = src.slice(start, i);
  const lines = [];
  for (const [k, pair] of Object.entries(entries)) {
    const val = pack === "en" ? k : pack === "ur" ? pair[0] : pair[1];
    const re = new RegExp(`("${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}":\\s*)("[^"]*")`);
    if (re.test(body)) {
      body = body.replace(re, `$1${JSON.stringify(val)}`);
    } else {
      lines.push(`    ${JSON.stringify(k)}: ${JSON.stringify(val)},`);
    }
  }
  if (lines.length) {
    body = body + "\n    // Auto UI strings\n" + lines.join("\n") + "\n";
  }
  src = src.slice(0, start) + body + src.slice(i);
}

upsertEnglishKeys("en", ui);
upsertEnglishKeys("ur", ui);
upsertEnglishKeys("roman", ui);

fs.writeFileSync(file, src);
console.log("patched messages", fs.statSync(file).size);

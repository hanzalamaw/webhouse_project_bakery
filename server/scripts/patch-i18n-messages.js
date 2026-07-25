import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, "../../client/src/i18n/messages.js");
let src = fs.readFileSync(file, "utf8");

const page = {
  Dashboard: ["ڈیش بورڈ", "Dashboard"],
  "User Management": ["یوزر مینجمنٹ", "User management"],
  "Roles & Permissions": ["رولز اور پرمیشنز", "Roles aur permissions"],
  "Audit Logs": ["آڈٹ لاگز", "Audit logs"],
  Sessions: ["سیشنز", "Sessions"],
  "Organization Settings": ["کمپنی سیٹنگز", "Company settings"],
  "Plan & Subscription": ["پلان اور سبسکرپشن", "Plan aur subscription"],
  "Activity Alerts": ["ایکٹیویٹی الرٹس", "Activity alerts"],
  "Help Center": ["مدد", "Madad"],
  Madad: ["مدد", "Madad"],
  "Manage Items": ["چیزیں مینج کریں", "Cheezen manage karein"],
  "Manage Items (Cheezen)": ["چیزیں مینج کریں", "Cheezen manage karein"],
  "Create Item": ["چیز بنائیں", "Cheez banayein"],
  "Edit Item": ["چیز ایڈٹ کریں", "Cheez edit karein"],
  Categories: ["کیٹگریز", "Categories"],
  "Bulk Import / Export": ["بلک امپورٹ / ایکسپورٹ", "Bulk import / export"],
  Branches: ["برانچز", "Branches"],
  "Stock In": ["اسٹاک ان", "Stock in"],
  "Stock Out": ["اسٹاک آؤٹ", "Stock out"],
  Transfers: ["ٹرانسفرز", "Transfers"],
  "Transfers between branches": ["برانچز کے درمیان ٹرانسفر", "Branches ke darmiyan transfer"],
  "Movement History": ["موومنٹ ہسٹری", "Movement history"],
  "Stock Movement History": ["اسٹاک موومنٹ ہسٹری", "Stock movement history"],
  "Batches / Expiry": ["بیچز / ایکسپائری", "Batches / expiry"],
  Suppliers: ["سپلائرز", "Suppliers"],
  "Purchase Orders": ["پرچیز آرڈرز", "Purchase orders"],
  Wastage: ["ویسٹیج", "Wastage"],
  "Create category": ["کیٹگری بنائیں", "Category banayein"],
  "Edit category": ["کیٹگری ایڈٹ کریں", "Category edit karein"],
  "Delete item": ["چیز ڈیلیٹ کریں", "Cheez delete karein"],
  "Delete branch": ["برانچ ڈیلیٹ کریں", "Branch delete karein"],
  "Delete supplier": ["سپلائر ڈیلیٹ کریں", "Supplier delete karein"],
  "Delete purchase order": ["پرچیز آرڈر ڈیلیٹ کریں", "Purchase order delete karein"],
  "Delete category": ["کیٹگری ڈیلیٹ کریں", "Category delete karein"],
  "Basic information": ["بنیادی معلومات", "Bunyadi maloomat"],
  Pricing: ["قیمت", "Qeemat"],
  "Category & parent": ["کیٹگری اور پیرنٹ", "Category aur parent"],
  "Opening stock (optional)": ["اوپننگ اسٹاک (آپشنل)", "Opening stock (optional)"],
  "Stock by branch": ["برانچ کے حساب سے اسٹاک", "Branch ke hisaab se stock"],
  "Name, type, unit, and status.": ["نام، قسم، یونٹ اور سٹیٹس۔", "Naam, type, unit aur status."],
  "Cost, selling price, discount, and tax.": ["کاسٹ، سیلنگ پرائس، ڈسکاؤنٹ اور ٹیکس۔", "Cost, selling price, discount aur tax."],
  "Assign a category. Optional parent for variants.": [
    "کیٹگری لگائیں۔ ویریئنٹ کے لیے پیرنٹ اختیاری ہے۔",
    "Category lagayein. Variant ke liye parent optional hai.",
  ],
  "Starting quantity at one or more branches.": [
    "ایک یا زیادہ برانچز پر شروع کا اسٹاک۔",
    "Ek ya zyada branches par shuru ka stock.",
  ],
  "Current quantities. Change stock via Stock In / Stock Out / Transfers.": [
    "موجودہ مقدار۔ اسٹاک ان / آؤٹ / ٹرانسفر سے تبدیل کریں۔",
    "Mojuda miqdaar. Stock in / out / transfer se badlein.",
  ],
  "Production (Baking)": ["پیداوار (پکانا)", "Paidaawar (Pakana)"],
  Recipes: ["نسخے", "Nuskhay"],
  "Recipes (Nuskhay)": ["نسخے", "Nuskhay"],
  "Create Recipe": ["نسخہ بنائیں", "Nuskha banayein"],
  "Edit Recipe": ["نسخہ ایڈٹ کریں", "Nuskha edit karein"],
  "Manage Recipes": ["نسخے مینج کریں", "Nuskhay manage karein"],
  "Production Runs": ["پروڈکشن رنز", "Production runs"],
  "Bake Now": ["ابھی بیک کریں", "Abhi bake karein"],
  "Bake details": ["بیک کی تفصیل", "Bake ki tafseel"],
  "Recipe details": ["نسخے کی تفصیل", "Nuskhe ki tafseel"],
  "Delete recipe": ["نسخہ ڈیلیٹ کریں", "Nuskha delete karein"],
  "Cancel bake": ["بیک کینسل کریں", "Bake cancel karein"],
  "Quick Actions": ["کوئیک ایکشنز", "Quick actions"],
  "Quick actions": ["کوئیک ایکشنز", "Quick actions"],
  "Recent Bakes": ["حالیہ بیکس", "Haaliya bakes"],
  "Ingredients (Kacha Maal)": ["اجزاء (کچا مال)", "Ajzaa (Kacha maal)"],
  "Ingredients used (Kacha Maal)": ["استعمال شدہ اجزاء (کچا مال)", "Istemaal shuda ajzaa (Kacha maal)"],
  "Finished bakery item": ["تیار بیکری چیز", "Tayyar bakery cheez"],
  "Finished products": ["تیار پروڈکٹس", "Tayyar products"],
  Ingredients: ["اجزاء", "Ajzaa"],
  "Ingredient quantities": ["اجزاء کی مقدار", "Ajzaa ki miqdaar"],
  "Ingredients preview": ["اجزاء کا پریویو", "Ajzaa ka preview"],
  "Production run": ["پروڈکشن رن", "Production run"],
  Recipe: ["نسخہ", "Nuskha"],
  POS: ["پی او ایس", "POS"],
  Stores: ["اسٹورز", "Stores"],
  "Create Store": ["اسٹور بنائیں", "Store banayein"],
  "Edit Store": ["اسٹور ایڈٹ کریں", "Store edit karein"],
  Sales: ["سیلز", "Sales"],
  "Cash registers": ["کیش رجسٹرز", "Cash registers"],
  "Manage Products": ["پروڈکٹس مینج کریں", "Products manage karein"],
  "Delete product": ["پروڈکٹ ڈیلیٹ کریں", "Product delete karein"],
  "Delete store": ["اسٹور ڈیلیٹ کریں", "Store delete karein"],
  "Delete terminal": ["ٹرمینل ڈیلیٹ کریں", "Terminal delete karein"],
  "Delete outlet": ["آؤٹ لیٹ ڈیلیٹ کریں", "Outlet delete karein"],
  Terminals: ["ٹرمینلز", "Terminals"],
  Outlets: ["آؤٹ لیٹس", "Outlets"],
  "Store details": ["اسٹور کی تفصیل", "Store ki tafseel"],
  "Store hours": ["اسٹور کے اوقات", "Store ke auqaat"],
  "Recent sales": ["حالیہ سیلز", "Haaliya sales"],
  "Register shifts": ["رجسٹر شفٹس", "Register shifts"],
  Products: ["پروڈکٹس", "Products"],
  "Stock Transfers": ["اسٹاک ٹرانسفرز", "Stock transfers"],
  "Transfer details": ["ٹرانسفر کی تفصیل", "Transfer ki tafseel"],
  "Create customer": ["کسٹمر بنائیں", "Customer banayein"],
  "End session": ["سیشن ختم کریں", "Session khatam karein"],
  "All POS transactions across outlets and terminals.": [
    "تمام آؤٹ لیٹس اور ٹرمینلز کی پی او ایس سیلز۔",
    "Tamam outlets aur terminals ki POS sales.",
  ],
  "Order Management": ["آرڈر مینجمنٹ", "Order management"],
  Order: ["آرڈر", "Order"],
  Payments: ["پیمنٹس", "Payments"],
  "Record Payment": ["پیمنٹ ریکارڈ کریں", "Payment record karein"],
  "Edit Payment": ["پیمنٹ ایڈٹ کریں", "Payment edit karein"],
  "Delete payment": ["پیمنٹ ڈیلیٹ کریں", "Payment delete karein"],
  "Delete order": ["آرڈر ڈیلیٹ کریں", "Order delete karein"],
  "Cancellation Management": ["کینسلیشن مینجمنٹ", "Cancellation management"],
  "Returns Management": ["واپسی مینجمنٹ", "Wapsi management"],
  "Exchange Management": ["بدلہ مینجمنٹ", "Badla management"],
  "Refund Management": ["رقم واپسی مینجمنٹ", "Raqam wapsi management"],
  "Invoice & Slip Printing": ["انوائس اور سلپ پرنٹنگ", "Invoice aur slip printing"],
  "Import / Export": ["امپورٹ / ایکسپورٹ", "Import / export"],
  "Order Import / Export": ["آرڈر امپورٹ / ایکسپورٹ", "Order import / export"],
  "Record return": ["واپسی ریکارڈ کریں", "Wapsi record karein"],
  "Record refund": ["رقم واپسی ریکارڈ کریں", "Raqam wapsi record karein"],
  "Record cancellation": ["کینسلیشن ریکارڈ کریں", "Cancellation record karein"],
  "Create Exchange": ["بدلہ بنائیں", "Badla banayein"],
  "Create Order": ["آرڈر بنائیں", "Order banayein"],
  "Edit Order": ["آرڈر ایڈٹ کریں", "Order edit karein"],
  "Payment details": ["پیمنٹ کی تفصیل", "Payment ki tafseel"],
  "Return details": ["واپسی کی تفصیل", "Wapsi ki tafseel"],
  "Refund details": ["رقم واپسی کی تفصیل", "Raqam wapsi ki tafseel"],
  "Cancellation details": ["کینسلیشن کی تفصیل", "Cancellation ki tafseel"],
  "Exchange details": ["بدلے کی تفصیل", "Badle ki tafseel"],
  "Customer & delivery": ["کسٹمر اور ڈیلیوری", "Customer aur delivery"],
  "Order status": ["آرڈر سٹیٹس", "Order status"],
  "Recent orders": ["حالیہ آرڈرز", "Haaliya orders"],
  Customers: ["کسٹمرز", "Customers"],
  "Create Customer": ["کسٹمر بنائیں", "Customer banayein"],
  "Edit Customer": ["کسٹمر ایڈٹ کریں", "Customer edit karein"],
  "Delete customer": ["کسٹمر ڈیلیٹ کریں", "Customer delete karein"],
  Complaints: ["شکایات", "Shikayatein"],
  "Complaints & Support": ["شکایات اور سپورٹ", "Shikayatein aur support"],
  "Customer Growth": ["کسٹمر گروتھ", "Customer growth"],
  "Recent Activity": ["حالیہ ایکٹیویٹی", "Haaliya activity"],
  "Top Customers": ["ٹاپ کسٹمرز", "Top customers"],
  "Order overview": ["آرڈر کا جائزہ", "Order ka jaiza"],
  "POS sales": ["پی او ایس سیلز", "POS sales"],
  "Activity log": ["ایکٹیویٹی لاگ", "Activity log"],
  "Customer Payments": ["کسٹمر پیسے", "Customer paisay"],
  Expenses: ["اخراجات", "Kharchay"],
  "Expense categories": ["اخراجات کی کیٹگریز", "Kharchay ki categories"],
  "Recurring Expenses": ["بار بار کے اخراجات", "Bar bar ke kharchay"],
  "Bank Accounts & Cash": ["بینک اکاؤنٹس اور کیش", "Bank accounts aur cash"],
  "Bank Accounts": ["بینک اکاؤنٹس", "Bank accounts"],
  "Vendor Bills": ["سپلائر بلز", "Supplier bills"],
  Transactions: ["ٹرانزیکشنز", "Transactions"],
  "Add expense": ["خرچہ شامل کریں", "Kharcha shamil karein"],
  "Add bill": ["بل شامل کریں", "Bill shamil karein"],
  "Add account": ["اکاؤنٹ شامل کریں", "Account shamil karein"],
  "Expense details": ["خرچے کی تفصیل", "Kharchay ki tafseel"],
  "Bill details": ["بل کی تفصیل", "Bill ki tafseel"],
  "Transaction details": ["ٹرانزیکشن کی تفصیل", "Transaction ki tafseel"],
  Notes: ["نوٹس", "Notes"],
  "Company bank accounts and cash balances.": [
    "کمپنی کے بینک اکاؤنٹس اور کیش بیلنس۔",
    "Company ke bank accounts aur cash balance.",
  ],
  "Operational expenses — salaries, rent, utilities, and more.": [
    "کاروباری اخراجات — تنخواہ، کرایہ، بجلی وغیرہ۔",
    "Karobari kharchay — tankhwah, kiraya, bijli waghera.",
  ],
  Cancel: ["کینسل", "Cancel"],
  Save: ["سیو کریں", "Save karein"],
  Delete: ["ڈیلیٹ کریں", "Delete karein"],
  Edit: ["ایڈٹ", "Edit"],
  Create: ["بنائیں", "Banayein"],
  "Loading…": ["لوڈ ہو رہا ہے…", "Load ho raha hai…"],
  Search: ["تلاش", "Talash"],
  "Create Branch": ["برانچ بنائیں", "Branch banayein"],
  "Edit Branch": ["برانچ ایڈٹ کریں", "Branch edit karein"],
  "Create Supplier": ["سپلائر بنائیں", "Supplier banayein"],
  "Edit Supplier": ["سپلائر ایڈٹ کریں", "Supplier edit karein"],
  "Create Purchase Order": ["پرچیز آرڈر بنائیں", "Purchase order banayein"],
  "Record wastage": ["ویسٹیج ریکارڈ کریں", "Wastage record karein"],
  Category: ["کیٹگری", "Category"],
  Product: ["پروڈکٹ", "Product"],
  Store: ["اسٹور", "Store"],
  "Quantities & notes": ["مقدار اور نوٹس", "Miqdaar aur notes"],
  "Record info": ["ریکارڈ کی معلومات", "Record ki maloomat"],
  Item: ["چیز", "Cheez"],
  Branch: ["برانچ", "Branch"],
  Returning: ["واپس ہو رہی چیز", "Wapas ho rahi cheez"],
  Replacement: ["بدلہ", "Badla"],
  Reason: ["وجہ", "Wajah"],
};

const replacements = [
  ['"chrome.helpCenter": "Help Center"', '"chrome.helpCenter": "Madad"'],
  ['"chrome.helpCenter": "مدد مرکز"', '"chrome.helpCenter": "مدد"'],
  ['"chrome.helpCenter": "Madad center"', '"chrome.helpCenter": "Madad"'],
  ['"module.crm.desc": "Customers, leads and complaints."', '"module.crm.desc": "Customers and complaints."'],
  ['"module.crm.desc": "کسٹمرز، لیڈز اور شکایات۔"', '"module.crm.desc": "کسٹمرز اور شکایات۔"'],
  ['"module.crm.desc": "Customers, leads aur shikayatein."', '"module.crm.desc": "Customers aur shikayatein."'],
  ['"nav.customerPayments": "کسٹمر وصولی"', '"nav.customerPayments": "کسٹمر پیسے"'],
  ['"nav.customerPayments": "Customer wasooli"', '"nav.customerPayments": "Customer paisay"'],
];

for (const [a, b] of replacements) src = src.split(a).join(b);
src = src.replace(/\n\s*"nav\.assignments":[^,\n]+,/g, "");
src = src.replace(/\n\s*"nav\.leads":[^,\n]+,/g, "");

// Remove previous page-title injections if re-run
src = src.replace(/\n\s*\/\/ Page titles \(English-key auto-translate\)[\s\S]*?(?=\n  \})/g, "\n");

function linesFor(lang) {
  return Object.entries(page)
    .map(([k, v]) => {
      const val = lang === "en" ? k : lang === "ur" ? v[0] : v[1];
      return `    ${JSON.stringify(k)}: ${JSON.stringify(val)},`;
    })
    .join("\n");
}

function insertIntoPack(text, packName, lines) {
  const start = text.indexOf(`  ${packName}: {`);
  if (start < 0) throw new Error(`missing pack ${packName}`);
  let depth = 0;
  let i = start + `  ${packName}: `.length;
  for (; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return `${text.slice(0, i)}\n    // Page titles (English-key auto-translate)\n${lines}\n${text.slice(i)}`;
}

src = insertIntoPack(src, "en", linesFor("en"));
src = insertIntoPack(src, "ur", linesFor("ur"));
src = insertIntoPack(src, "roman", linesFor("roman"));

fs.writeFileSync(file, src);
console.log("OK messages.js", fs.statSync(file).size);

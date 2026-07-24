const fs = require("fs");
const path = require("path");

const file = path.resolve(__dirname, "../../client/src/i18n/messages.js");
let src = fs.readFileSync(file, "utf8");

const entries = {
  en: {
    "Total Users": "Total Users",
    "Live Sessions": "Live Sessions",
    "Billing Due": "Billing Due",
    "Security Alerts": "Security Alerts",
    "User Capacity": "User Capacity",
    "Active users vs plan limit": "Active users vs plan limit",
    "Assigned Modules": "Assigned Modules",
    "Audit Events": "Audit Events",
    "In selected range": "In selected range",
    "Plan": "Plan",
    "Login Activity": "Login Activity",
    "Session starts over the last 6 months": "Session starts over the last 6 months",
    "Users by Status": "Users by Status",
    "Alerts by Type": "Alerts by Type",
    "Users by Role": "Users by Role",
    "Module Access": "Module Access",
    "Recent Activity": "Recent Activity",
    "Recent Alerts": "Recent Alerts",
    "Recent Sessions": "Recent Sessions",
    "Organization Health": "Organization Health",
    "Share of active users in your organization": "Share of active users in your organization",
  },
  ur: {
    "Total Users": "کل یوزرز",
    "Live Sessions": "لائیو سیشنز",
    "Billing Due": "بلنگ بقایا",
    "Security Alerts": "سیکیورٹی الرٹس",
    "User Capacity": "یوزر صلاحیت",
    "Active users vs plan limit": "فعال یوزرز بمقابلہ پلان حد",
    "Assigned Modules": "تفویض شدہ ماڈیولز",
    "Audit Events": "آڈٹ ایونٹس",
    "In selected range": "منتخب مدت میں",
    "Plan": "پلان",
    "Login Activity": "لاگ اِن سرگرمی",
    "Session starts over the last 6 months": "گزشتہ ۶ مہینوں میں سیشن شروع",
    "Users by Status": "اسٹیٹس کے حساب سے یوزرز",
    "Alerts by Type": "قسم کے حساب سے الرٹس",
    "Users by Role": "رول کے حساب سے یوزرز",
    "Module Access": "ماڈیول رسائی",
    "Recent Activity": "حالیہ سرگرمی",
    "Recent Alerts": "حالیہ الرٹس",
    "Recent Sessions": "حالیہ سیشنز",
    "Organization Health": "کمپنی کی حالت",
    "Share of active users in your organization": "آپ کی کمپنی میں فعال یوزرز کا حصہ",
  },
  roman: {
    "Total Users": "Kul users",
    "Live Sessions": "Live sessions",
    "Billing Due": "Billing baqiya",
    "Security Alerts": "Security alerts",
    "User Capacity": "User capacity",
    "Active users vs plan limit": "Active users vs plan had",
    "Assigned Modules": "Assigned modules",
    "Audit Events": "Audit events",
    "In selected range": "Selected range mein",
    "Plan": "Plan",
    "Login Activity": "Login activity",
    "Session starts over the last 6 months": "Pichle 6 mahinon mein session starts",
    "Users by Status": "Status ke hisaab se users",
    "Alerts by Type": "Type ke hisaab se alerts",
    "Users by Role": "Role ke hisaab se users",
    "Module Access": "Module access",
    "Recent Activity": "Haaliya activity",
    "Recent Alerts": "Haaliya alerts",
    "Recent Sessions": "Haaliya sessions",
    "Organization Health": "Company ki haalat",
    "Share of active users in your organization": "Aapki company mein active users ka hissa",
  },
};

function patchPack(src, pack, dict) {
  const marker = `  ${pack}: {`;
  const start = src.indexOf(marker);
  if (start < 0) throw new Error("pack not found " + pack);
  let i = start + marker.length;
  let depth = 1;
  while (i < src.length && depth > 0) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") depth--;
    i++;
  }
  const blockStart = start + marker.length;
  const blockEnd = i - 1;
  let block = src.slice(blockStart, blockEnd);
  // Ensure we insert before the closing of the pack (trim trailing whitespace in block end)
  let added = 0;
  const lines = [];
  for (const [k, v] of Object.entries(dict)) {
    const esc = JSON.stringify(k);
    if (block.includes(esc + ":")) continue;
    lines.push(`    ${esc}: ${JSON.stringify(v)},`);
    added++;
  }
  if (lines.length) {
    block = block.replace(/\s*$/, "\n") + lines.join("\n") + "\n";
  }
  return { src: src.slice(0, blockStart) + block + src.slice(blockEnd), added };
}

let total = 0;
for (const pack of ["en", "ur", "roman"]) {
  const r = patchPack(src, pack, entries[pack]);
  src = r.src;
  total += r.added;
  console.log(pack, r.added);
}
fs.writeFileSync(file, src);
console.log("total", total);

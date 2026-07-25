const fs = require("fs");
const path = require("path");

const file = path.resolve(__dirname, "../../client/src/i18n/messages.js");
let src = fs.readFileSync(file, "utf8");

// Fix smashed closing braces
src = src.replace(/("Suspended": "[^"]*"),\}/g, "$1,\n  },");

const extra = {
  en: {
    "Available stock": "Available stock",
    "Units across all branches": "Units across all branches",
    "Stock value (cost)": "Stock value (cost)",
    "Available × cost price": "Available × cost price",
    "Wastage (30 days)": "Wastage (30 days)",
    "Wastage cost": "Wastage cost",
    "Barbaadi cost": "Wastage cost",
    "Inactive": "Inactive",
  },
  ur: {
    "Available stock": "دستیاب اسٹاک",
    "Units across all branches": "تمام برانچز میں یونٹس",
    "Stock value (cost)": "اسٹاک ویلیو (لاگت)",
    "Available × cost price": "دستیاب × لاگت قیمت",
    "Wastage (30 days)": "ویسٹیج (۳۰ دن)",
    "Wastage cost": "ویسٹیج کی لاگت",
    "Barbaadi cost": "ویسٹیج کی لاگت",
    "Inactive": "غیر فعال",
    "Active": "فعال",
  },
  roman: {
    "Available stock": "Dastyab stock",
    "Units across all branches": "Tamam branches mein units",
    "Stock value (cost)": "Stock value (cost)",
    "Available × cost price": "Dastyab × cost price",
    "Wastage (30 days)": "Wastage (30 din)",
    "Wastage cost": "Wastage ki cost",
    "Barbaadi cost": "Wastage ki cost",
    "Inactive": "Inactive",
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
  let added = 0;
  for (const [k, v] of Object.entries(dict)) {
    const esc = JSON.stringify(k);
    // for Active in ur, force overwrite
    if (pack === "ur" && k === "Active") {
      const re = new RegExp(`${esc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*"[^"]*",`);
      if (re.test(block)) {
        block = block.replace(re, `${esc}: ${JSON.stringify(v)},`);
        added++;
        continue;
      }
    }
    if (block.includes(esc + ":")) continue;
    block += `\n    ${esc}: ${JSON.stringify(v)},`;
    added++;
  }
  return { src: src.slice(0, blockStart) + block + src.slice(blockEnd), added };
}

let total = 0;
for (const pack of ["en", "ur", "roman"]) {
  const r = patchPack(src, pack, extra[pack]);
  src = r.src;
  total += r.added;
  console.log(pack, r.added);
}
fs.writeFileSync(file, src);
console.log("total", total);

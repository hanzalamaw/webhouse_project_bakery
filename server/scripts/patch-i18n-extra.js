import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, "../../client/src/i18n/messages.js");
let src = fs.readFileSync(file, "utf8");

const extra = {
  "You have unsaved changes. Reloading will discard them.": [
    "آپ کی تبدیلیاں سیو نہیں ہوئیں۔ ری لوڈ سے ختم ہو جائیں گی۔",
    "Aap ki tabdeeliyan save nahi huin. Reload se khatam ho jayengi.",
  ],
  "You have unsaved changes. Save your work or discard changes before leaving this page.": [
    "آپ کی تبدیلیاں سیو نہیں ہوئیں۔ صفحہ چھوڑنے سے پہلے سیو کریں یا ختم کریں۔",
    "Aap ki tabdeeliyan save nahi huin. Page chhorne se pehle save karein ya khatam karein.",
  ],
  "Recipes and baking runs — turn ingredients into finished bakery items.": [
    "Recipes اور baking runs — اجزاء سے تیار بیکری چیزیں بنائیں۔",
    "Recipes aur baking runs — ajzaa se tayyar bakery cheezen banayein.",
  ],
};

function upsert(pack) {
  const start = src.indexOf(`  ${pack}: {`);
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
  const add = [];
  for (const [k, v] of Object.entries(extra)) {
    const val = pack === "en" ? k : pack === "ur" ? v[0] : v[1];
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`("${escaped}":\\s*)("[^"]*")`);
    if (re.test(body)) body = body.replace(re, `$1${JSON.stringify(val)}`);
    else add.push(`    ${JSON.stringify(k)}: ${JSON.stringify(val)},`);
  }
  src = src.slice(0, start) + body + (add.length ? `\n${add.join("\n")}\n` : "") + src.slice(i);
}

upsert("en");
upsert("ur");
upsert("roman");
fs.writeFileSync(file, src);
console.log("ok", fs.statSync(file).size);

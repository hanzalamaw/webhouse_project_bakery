const fs = require("fs");
const path = "c:/Tayyab/webhouse_project_bakery/client/src/portals/tenant-portal";

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = d + "/" + e.name;
    if (e.isDirectory()) walk(p, acc);
    else if (/\.jsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const files = walk(path);
const titles = new Set();
const descs = new Set();
const formTitles = new Set();
const formDescs = new Set();

for (const f of files) {
  const s = fs.readFileSync(f, "utf8");
  for (const m of s.matchAll(/<PageHeader[\s\S]*?title="([^"]+)"/g)) titles.add(m[1]);
  for (const m of s.matchAll(/title=\{isEdit \? "([^"]+)" : "([^"]+)"\}/g)) {
    titles.add(m[1]);
    titles.add(m[2]);
  }
  for (const m of s.matchAll(/<PageHeader[\s\S]*?description="([^"]+)"/g)) descs.add(m[1]);
  for (const m of s.matchAll(/ModulePlaceholder[\s\S]*?title="([^"]+)"/g)) titles.add(m[1]);
  for (const m of s.matchAll(/ModulePlaceholder[\s\S]*?description="([^"]+)"/g)) descs.add(m[1]);
  for (const m of s.matchAll(/FormBlock title="([^"]+)"/g)) formTitles.add(m[1]);
  for (const m of s.matchAll(/FormBlock title="[^"]+" description="([^"]+)"/g)) formDescs.add(m[1]);
  for (const m of s.matchAll(/ConfirmDeleteModal[^>]*title="([^"]+)"/g)) titles.add(m[1]);
  for (const m of s.matchAll(/title="((?:Delete|Create|Edit|Record|Add|Cancel) [^"]+)"/g)) titles.add(m[1]);
}

console.log("=== TITLES ===");
[...titles].sort().forEach((t) => console.log(t));
console.log("=== FORM_TITLES ===");
[...formTitles].sort().forEach((t) => console.log(t));
console.log("=== DESCS ===");
[...descs].sort().forEach((t) => console.log(t));
console.log("=== FORM_DESCS ===");
[...formDescs].sort().forEach((t) => console.log(t));

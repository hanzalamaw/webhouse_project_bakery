const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const files = [
  "client/src/portals/tenant-portal/modules/admin/pages/Dashboard.jsx",
  "client/src/portals/tenant-portal/modules/inventory-procurement/pages/Dashboard.jsx",
  "client/src/portals/tenant-portal/modules/production/pages/Dashboard.jsx",
  "client/src/portals/tenant-portal/modules/order-management/pages/Dashboard.jsx",
  "client/src/portals/tenant-portal/modules/finance/pages/Dashboard.jsx",
  "client/src/portals/tenant-portal/modules/crm/pages/Dashboard.jsx",
  "client/src/portals/tenant-portal/modules/pos/pages/Dashboard.jsx",
  "client/src/portals/tenant-portal/modules/pos/pages/registers/TerminalLogsView.jsx",
  "client/src/portals/tenant-portal/modules/pos/pages/stores/StoreView.jsx",
];

function stripFn(src, name) {
  const re = new RegExp(
    `\\r?\\nfunction ${name}\\([\\s\\S]*?\\r?\\n\\}\\r?\\n`,
    "m"
  );
  if (!re.test(src)) {
    console.log("  no match for", name);
    return src;
  }
  return src.replace(re, "\n");
}

for (const rel of files) {
  const p = path.join(root, rel);
  let s = fs.readFileSync(p, "utf8");
  const hadKpi = /function KpiCard\(/.test(s);
  const hadPanel = /function Panel\(/.test(s);
  const hadKpiShort = /function Kpi\(/.test(s) && !/function KpiCard\(/.test(s);

  if (hadKpi) s = stripFn(s, "KpiCard");
  if (hadKpiShort) {
    // inventory uses Kpi — rename usages to KpiCard after strip+import
    s = stripFn(s, "Kpi");
    s = s.replace(/<Kpi\b/g, "<KpiCard").replace(/<\/Kpi>/g, "</KpiCard>");
  }
  if (hadPanel) s = stripFn(s, "Panel");

  if (!s.includes("components/KpiPanel") && (hadKpi || hadPanel || hadKpiShort)) {
    const parts = rel.split("/");
    const fromFileDir = parts.slice(2, -1);
    const ups = "../".repeat(fromFileDir.length);
    const importPath = `${ups}components/KpiPanel`;
    const importLine = `import { KpiCard, Panel } from "${importPath}";\n`;
    const m = s.match(/import .+ from ["'][.\/]+components\/[^"']+["'];\r?\n/);
    if (m) {
      s = s.replace(m[0], m[0].replace(/\r?\n$/, "\n") + importLine);
    } else {
      s = s.replace(/^(import .+;\r?\n)/m, (line) => line.replace(/\r?\n$/, "\n") + importLine);
    }
  }

  fs.writeFileSync(p, s);
  console.log("patched", rel, {
    hadKpi,
    hadPanel,
    hadKpiShort,
    stillKpi: /function KpiCard\(/.test(s) || /function Kpi\(/.test(s),
    stillPanel: /function Panel\(/.test(s),
    hasImport: s.includes("components/KpiPanel"),
  });
}

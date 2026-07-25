function escapeCsvField(value) {
  const s = String(value ?? "");
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function detectDelimiter(text) {
  const firstLine = String(text || "").split(/\r?\n/).find((l) => l.trim()) || "";
  const commas = (firstLine.match(/,/g) || []).length;
  const semicolons = (firstLine.match(/;/g) || []).length;
  return semicolons > commas ? ";" : ",";
}

/** RFC 4180-style parser; handles quoted delimiters and newlines inside fields. */
function parseCsvRows(text, delimiter) {
  const s = String(text || "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  const endRow = () => {
    row.push(field);
    field = "";
    if (row.some((cell) => String(cell).trim())) rows.push(row);
    row = [];
  };

  for (let i = 0; i < s.length; i++) {
    const c = s[i];

    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      endRow();
    } else if (c !== "\r") {
      field += c;
    }
  }
  endRow();

  return rows;
}

export function parseCsv(text) {
  const rows = parseCsvRows(text, detectDelimiter(text));
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => String(h).trim().replace(/^\uFEFF/, ""));
  return rows.slice(1).map((values) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = String(values[i] ?? "").trim();
    });
    return obj;
  });
}

export function toCsv(headers, rows) {
  const header = headers.map(escapeCsvField).join(",");
  const body = (rows || []).map((r) => headers.map((h) => escapeCsvField(r[h])).join(","));
  return [header, ...body].join("\r\n");
}

export function downloadCsv(filename, headers, rows) {
  const blob = new Blob([toCsv(headers, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

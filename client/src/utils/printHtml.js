/**
 * Print HTML through a hidden iframe (no new browser tab).
 * The OS print dialog still appears so the cashier can pick a printer.
 */
export function printHtml(html, { title = "Print", delayMs = 200 } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const iframe = document.createElement("iframe");
      iframe.setAttribute("aria-hidden", "true");
      iframe.setAttribute("title", title);
      iframe.style.cssText =
        "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
      document.body.appendChild(iframe);

      const win = iframe.contentWindow;
      const doc = win?.document;
      if (!win || !doc) {
        iframe.remove();
        reject(new Error("Unable to prepare the print frame."));
        return;
      }

      doc.open();
      doc.write(html);
      doc.close();

      const cleanup = () => {
        setTimeout(() => {
          try {
            iframe.remove();
          } catch {
            /* ignore */
          }
        }, 1000);
        resolve();
      };

      const trigger = () => {
        try {
          win.focus();
          win.print();
        } finally {
          cleanup();
        }
      };

      const waitForAssets = async () => {
        const base = Math.max(50, Number(delayMs) || 200);
        const images = Array.from(doc.images || []);
        await Promise.all(
          images.map(
            (img) =>
              new Promise((res) => {
                if (img.complete) return res();
                img.onload = () => res();
                img.onerror = () => res();
                setTimeout(res, 1500);
              })
          )
        );
        if (doc.fonts?.ready) {
          try {
            await Promise.race([doc.fonts.ready, new Promise((r) => setTimeout(r, 1200))]);
          } catch {
            /* ignore */
          }
        }
        setTimeout(trigger, base);
      };

      if (doc.readyState === "complete") {
        waitForAssets();
      } else {
        iframe.onload = () => waitForAssets();
      }
    } catch (err) {
      reject(err);
    }
  });
}

const POS_PRINTER_KEY = "wh_pos_receipt_printer_label";

export function getPosPrinterLabel() {
  try {
    return localStorage.getItem(POS_PRINTER_KEY) || "";
  } catch {
    return "";
  }
}

export function setPosPrinterLabel(label) {
  try {
    if (label) localStorage.setItem(POS_PRINTER_KEY, label);
    else localStorage.removeItem(POS_PRINTER_KEY);
  } catch {
    /* ignore */
  }
}

/** Opens the print dialog with a short setup page so the cashier can pick their thermal printer. */
export function openPrinterChooser(label = "Receipt printer") {
  const safe = String(label || "Receipt printer").replace(/[<>&"]/g, "");
  return printHtml(
    `<!doctype html><html><head><title>Select printer</title>
      <style>
        @page { size: 80mm auto; margin: 4mm; }
        body { font-family: Arial, sans-serif; width: 72mm; margin: 0 auto; font-size: 12px; text-align: center; }
        h1 { font-size: 14px; margin: 8px 0; }
        p { margin: 6px 0; color: #333; }
      </style></head><body>
        <h1>Select receipt printer</h1>
        <p>${safe}</p>
        <p>Choose your thermal / POS printer in this dialog, then print.</p>
        <p>Windows/macOS will remember it for the next receipt.</p>
      </body></html>`,
    { title: "Select printer" }
  );
}

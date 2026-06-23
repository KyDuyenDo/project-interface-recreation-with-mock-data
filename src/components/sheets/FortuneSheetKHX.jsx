/**
 * FortuneSheetWrapper
 * Wraps @fortune-sheet/react for read/edit of KHX and BAO_CAO sheets.
 * Falls back gracefully if FortuneSheet fails to load.
 */
import { useEffect, useRef, useState } from "react";

let FS = null;
let fsLoading = false;
let fsLoaded = false;

async function loadFortuneSheet() {
  if (fsLoaded) return FS;
  if (fsLoading) return new Promise((r) => setTimeout(() => r(FS), 500));
  fsLoading = true;
  try {
    const mod = await import("@fortune-sheet/react");
    await import("@fortune-sheet/react/dist/index.css");
    FS = mod.Workbook;
    fsLoaded = true;
  } catch (e) {
    console.warn("FortuneSheet load failed:", e);
    fsLoaded = true; // don't retry
  }
  fsLoading = false;
  return FS;
}

/**
 * Build FortuneSheet data from KHX sheet data returned by the API.
 * API shape: { factory, year, month, n_days, lines: [{line, days:{1:[{order_id,qty,...}]}, daily_total:{1:n}}] }
 */
function buildFSData(sheetData) {
  if (!sheetData) return [];

  const { lines, n_days, year, month } = sheetData;
  const celldata = [];

  // Row 0: header — day numbers
  celldata.push({ r: 0, c: 0, v: { v: "LINE", ct: { fa: "General", t: "g" }, bl: 1 } });
  for (let d = 1; d <= n_days; d++) {
    celldata.push({
      r: 0, c: d,
      v: { v: `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`,
           ct: { fa: "General", t: "g" }, bl: 1,
           bg: "#e0e7ff", fc: "#3730a3" },
    });
  }
  celldata.push({ r: 0, c: n_days + 1, v: { v: "TOTAL", ct: { fa: "General", t: "g" }, bl: 1, bg: "#fef3c7" } });

  // Data rows
  lines.forEach((line, ri) => {
    const row = ri + 1;
    celldata.push({ r: row, c: 0, v: { v: line.line, ct: { fa: "General", t: "g" }, bl: 1, bg: "#f1f5f9" } });
    let rowTotal = 0;
    for (let d = 1; d <= n_days; d++) {
      const cells = line.days?.[d] || [];
      const total = line.daily_total?.[d] || 0;
      rowTotal += total;
      const isLate = cells.some((c) => c.is_late);
      const isFrozen = cells.some((c) => c.is_frozen);
      const label = cells.slice(0, 2).map((c) => `${c.order_id}(${c.qty})`).join("\n");
      celldata.push({
        r: row, c: d,
        v: {
          v: total > 0 ? total : "",
          ct: { fa: "General", t: total > 0 ? "n" : "g" },
          bg: isLate ? "#fee2e2" : isFrozen ? "#dbeafe" : undefined,
          ps: label ? { isShow: true, value: label } : undefined,
        },
      });
    }
    celldata.push({ r: row, c: n_days + 1, v: { v: rowTotal, ct: { fa: "General", t: "n" }, bl: 1, bg: "#fef3c7" } });
  });

  return [{
    name: `${year}-${String(month).padStart(2,"0")}`,
    celldata,
    row: lines.length + 2,
    column: n_days + 2,
  }];
}

export function FortuneSheetKHX({ data, onCellClick, className }) {
  const [Workbook, setWorkbook] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    loadFortuneSheet().then((W) => setWorkbook(() => W));
  }, []);

  const sheets = buildFSData(data);

  if (!Workbook) {
    return (
      <div className={`flex items-center justify-center bg-slate-50 ${className}`}>
        <div className="text-sm text-slate-400">Loading spreadsheet engine…</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={className} style={{ height: "100%", width: "100%" }}>
      <Workbook
        data={sheets}
        options={{
          showtoolbar: true,
          showinfobar: false,
          showstatisticBar: false,
          sheetRightClickConfig: { delete: false, copy: false },
          cellRightClickConfig: { copy: true, paste: false },
          hook: {
            cellClick: (cell, position, sheet) => {
              onCellClick?.(cell, position, sheet);
            },
          },
        }}
      />
    </div>
  );
}

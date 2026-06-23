import { useState, useMemo, useEffect } from "react";
import { useQueries } from "@tanstack/react-query";
import { useRuns, useActiveRun, useKHXPlanSheets } from "../../hooks";
import { runsApi } from "../../api";
import { PageLayout, Topbar } from "../../components/layout";
import { Spinner } from "../../components/ui";
import { Download } from "lucide-react";
import { clsx } from "clsx";
import "./khx-plan.css";

// ── Constants ────────────────────────────────────────────────────────────────
const FIELD_KEYS   = ["ly","ry","model","crd","pd","material","customer","size","ngay_chot","go_thieu"];
const FIELD_LABELS = {
  ly: "LY", ry: "RY", model: "Model / PO Class", crd: "CRD / Country / SDD",
  pd: "PD / ART / XH", material: "Material / Qty", customer: "Customer",
  size: "SIZE SỐ", ngay_chot: "Ngày chốt", go_thieu: "Dư/Thiếu",
};
const WD_LABEL = ["日","月","火","水","木","金","土"];
const N_ROWS   = 23; // 10 slot0 + 10 slot1 + Tồn + Plan + AN

// ── Lazy-load FortuneSheet (same pattern as FortuneSheetKHX.jsx) ─────────────
let _FS = null, _loading = false, _loaded = false;
async function loadFS() {
  if (_loaded) return _FS;
  if (_loading) return new Promise(r => setTimeout(() => r(_FS), 500));
  _loading = true;
  try {
    const mod = await import("@fortune-sheet/react");
    await import("@fortune-sheet/react/dist/index.css");
    _FS = mod.Workbook;
    _loaded = true;
  } catch (e) {
    console.warn("FortuneSheet load failed:", e);
    _loaded = true;
  }
  _loading = false;
  return _FS;
}


// ── Build FortuneSheet sheet object from API data ────────────────────────────
function buildFSSheet(sheet, allDays, sundaySet) {
  const celldata = [];
  const mergeMap = {};
  const nDays  = allDays.length;
  const nLines = sheet.lines.length;

  const C0   = 0;             // LINE name column
  const C1   = 1;             // Label column
  const cD   = (i) => 2 + i; // Day column (0-based i → grid col)
  const CTTL = 2 + nDays;
  const CSLT = 3 + nDays;

  // Cell type helpers
  const mkCt = (t = "g") => ({ fa: "General", t });
  const addC = (r, col, v, s = {}) => {
    celldata.push({
      r, c: col,
      v: {
        v: v ?? "",
        m: v != null ? String(v) : "",
        ct: typeof v === "number" ? mkCt("n") : mkCt("g"),
        ...s,
      },
    });
  };
  const addMerge = (r, col, rs, cs) => {
    if (rs > 1 || cs > 1) mergeMap[`${r}_${col}`] = { r, c: col, rs, cs };
  };

  // Grand plan total
  const planByDayTotal = {};
  let grandTotal = 0;
  sheet.lines.forEach((ln) =>
    Object.entries(ln.plan_by_day).forEach(([d, v]) => {
      planByDayTotal[d] = (planByDayTotal[d] || 0) + (v || 0);
      grandTotal += v || 0;
    }),
  );

  // ── Row 0: Title ────────────────────────────────────────────────────
  addC(0, C0, "", { bg: "#7c3aed" });
  addC(0, C1,
    `${sheet.zone} — T${sheet.month}/${String(sheet.year).slice(2)} — KẾ HOẠCH SẢN XUẤT`,
    { bg: "#5b21b6", fc: "#ffffff", bl: 1, fs: 12, ht: 0, vt: 0 },
  );
  addMerge(0, C1, 1, nDays + 1); // label col + all day cols
  addC(0, CTTL, "", { bg: "#1e1b4b" });
  addC(0, CSLT, grandTotal, { bg: "#fff7c2", fc: "#1e1b4b", bl: 1, fs: 12, ht: 0, vt: 0, ct: mkCt("n") });

  // ── Row 1: Date numbers ─────────────────────────────────────────────
  addC(1, C0, "", { bg: "#ffe9b8" });
  addC(1, C1, "D/T", { bg: "#ffe9b8", fc: "#5b4324", bl: 1, ht: 0, vt: 0 });
  allDays.forEach((d, i) => {
    const sun = sundaySet.has(d);
    addC(1, cD(i), d, {
      bg: sun ? "#dce8f5" : "#ffe9b8", fc: sun ? "#5a7fa0" : "#5b4324",
      bl: 1, ht: 0, vt: 0, ct: mkCt("n"),
    });
  });
  addC(1, CTTL, "TTL",    { bg: "#ffe9b8", fc: "#5b4324", bl: 1, ht: 0, vt: 0 });
  addC(1, CSLT, "SL TỒN", { bg: "#ffe9b8", fc: "#5b4324", bl: 1, ht: 0, vt: 0 });

  // ── Row 2: Weekdays ─────────────────────────────────────────────────
  addC(2, C0, "", { bg: "#fff4d4" });
  addC(2, C1, "LINE", { bg: "#fff4d4", fc: "#6b5024", bl: 1, ht: 0, vt: 0 });
  allDays.forEach((d, i) => {
    const sun = sundaySet.has(d);
    const wd  = new Date(sheet.year, sheet.month - 1, d).getDay();
    addC(2, cD(i), WD_LABEL[wd], {
      bg: sun ? "#dce8f5" : "#fff4d4", fc: sun ? "#5a7fa0" : "#6b5024",
      bl: sun ? 1 : 0, ht: 0, vt: 0,
    });
  });
  addC(2, CTTL, "", { bg: "#fff4d4" });
  addC(2, CSLT, "", { bg: "#fff4d4" });

  // ── Row 3: Hours ────────────────────────────────────────────────────
  const totalHrs = allDays.filter(d => !sundaySet.has(d)).length * 9;
  addC(3, C0, "", { bg: "#fff9e4" });
  addC(3, C1, "H 工時", { bg: "#fff9e4", fc: "#7a5a2a", bl: 1, ht: 0, vt: 0 });
  allDays.forEach((d, i) => {
    const sun = sundaySet.has(d);
    addC(3, cD(i), sun ? "" : 9, {
      bg: sun ? "#dce8f5" : "#fff9e4", fc: sun ? "#5a7fa0" : "#7a5a2a",
      ht: 0, vt: 0, ct: sun ? mkCt() : mkCt("n"),
    });
  });
  addC(3, CTTL, totalHrs, { bg: "#fff9e4", fc: "#7a5a2a", bl: 1, ht: 0, vt: 0, ct: mkCt("n") });
  addC(3, CSLT, "", { bg: "#fff9e4" });

  // ── LINE blocks ──────────────────────────────────────────────────────
  sheet.lines.forEach((line, lineIdx) => {
    const R0 = 4 + lineIdx * N_ROWS;

    // Last active working-day index (in allDays) for each (slotIdx, order_id)
    const orderLastDayIdx = [{}, {}];
    allDays.forEach((d, i) => {
      if (sundaySet.has(d)) return;
      [0, 1].forEach((si) => {
        const slot = line.day_slots[String(d)]?.[String(si)];
        if (slot?.order_id) orderLastDayIdx[si][slot.order_id] = i;
      });
    });

    let cumTon = 0;
    const tonByDay = {};
    allDays.forEach((d) => {
      // tồn = plan - actual (dương → thiếu; âm → dư)
      cumTon += (line.plan_by_day[String(d)] || 0) - (line.actual_by_day[String(d)] || 0);
      tonByDay[d] = cumTon;
    });
    const planTot   = Object.values(line.plan_by_day).reduce((s, v)   => s + (v || 0), 0);
    const actualTot = Object.values(line.actual_by_day).reduce((s, v) => s + (v || 0), 0);

    // LINE NAME — vertical, merged 23 rows
    addC(R0, C0, line.line_id, { bg: "#f3e8ff", fc: "#5b21b6", bl: 1, fs: 9, ht: 0, vt: 0, tr: 4 });
    addMerge(R0, C0, N_ROWS, 1);

    // Field rows j=0..19
    for (let j = 0; j < 20; j++) {
      const gr       = R0 + j;
      const slotIdx  = j < 10 ? 0 : 1;
      const fieldIdx = j < 10 ? j : j - 10;
      const fieldKey = FIELD_KEYS[fieldIdx];
      const isGoThieu = fieldIdx === 9;
      const isNgay    = fieldIdx === 8;

      addC(gr, C1, FIELD_LABELS[fieldKey] || "", {
        bg: "#fafafa", fc: isGoThieu ? "#0369a1" : "#555555",
        it: isGoThieu ? 0 : 1, bl: isGoThieu ? 1 : 0, fs: 10, vt: 0, tb: 2,
      });

      // Day-by-day rendering — no merge cells, each day column gets order data
      allDays.forEach((d, i) => {
        const col  = cD(i);
        if (sundaySet.has(d)) { addC(gr, col, "", { bg: "#dce8f5" }); return; }
        const slot = line.day_slots[String(d)]?.[String(slotIdx)];

        if (isGoThieu) {
          if (!slot) { addC(gr, col, "", { bg: "#fafafa" }); return; }
          const isLast = orderLastDayIdx[slotIdx][slot.order_id] === i;
          if (isLast) {
            const defVal   = slot.go_thieu_val ?? 0;
            const actQty   = slot.actual_qty   ?? 0;
            const notStart = actQty === 0;
            addC(gr, col,
              notStart  ? "Chưa SX"
              : defVal > 0 ? `-${defVal.toLocaleString()}`
              : defVal < 0 ? `+${Math.abs(defVal).toLocaleString()}`
              : "✓",
              { bg: notStart ? "#f8fafc" : defVal > 0 ? "#fee2e2" : "#dcfce7",
                fc: notStart ? "#94a3b8" : defVal > 0 ? "#b91c1c" : "#166534",
                bl: notStart ? 0 : 1, ht: 0, vt: 0, fs: 9 },
            );
          } else {
            addC(gr, col, "", { bg: "#fafafa" });
          }
          return;
        }

        if (!slot) { addC(gr, col, "", { bg: "#fafafa" }); return; }

        const val = slot[fieldKey] ?? "";
        let bg = "#ffffff", fc = "#1a1a1a";
        if (isNgay) {
          bg = slot.ngay_chot_type === "GO" ? "#ede4fa" : "#fefef0";
          fc = slot.ngay_chot_type === "GO" ? "#5b21b6" : "#7c4a00";
        } else if (slot.is_late && (fieldKey === "ry" || fieldKey === "ly")) {
          bg = "#fff7ed";
        }
        addC(gr, col, val, { bg, fc, ht: 0, vt: 0, fs: 10, tb: 2 });
      });

      addC(gr, CTTL, "", { bg: "#ede4fa" });
      addC(gr, CSLT, "", { bg: "#faf3ff" });
    }

    // Tồn (j=20)
    const rTon = R0 + 20;
    addC(rTon, C1, "Tồn", { bg: "#f0f9ff", fc: "#0369a1", bl: 1, vt: 0 });
    allDays.forEach((d, i) => {
      if (sundaySet.has(d)) { addC(rTon, cD(i), "", { bg: "#dce8f5" }); return; }
      const v = tonByDay[d] || 0;
      addC(rTon, cD(i), v || "", {
        // dương = đang thiếu (đỏ), âm = đang dư (xanh)
        bg: v > 0 ? "#fee2e2" : v < 0 ? "#dcfce7" : "#f0f9ff",
        fc: v > 0 ? "#b91c1c" : v < 0 ? "#166534" : "#0369a1",
        ht: 0, vt: 0, ct: v ? mkCt("n") : mkCt(),
      });
    });
    addC(rTon, CTTL, "", { bg: "#ede4fa" });
    addC(rTon, CSLT, "", { bg: "#faf3ff" });

    // Plan (j=21)
    const rPlan = R0 + 21;
    addC(rPlan, C1, "Plan", { bg: "#ffffff", fc: "#c91e1e", bl: 1, vt: 0 });
    allDays.forEach((d, i) => {
      if (sundaySet.has(d)) { addC(rPlan, cD(i), "", { bg: "#dce8f5" }); return; }
      const v = line.plan_by_day[String(d)] || 0;
      addC(rPlan, cD(i), v || "", { bg: "#ffffff", fc: "#c91e1e", ht: 0, vt: 0, ct: v ? mkCt("n") : mkCt() });
    });
    addC(rPlan, CTTL, planTot || "", {
      bg: "#ede4fa", fc: "#4a2b8a", bl: 1, ht: 2, vt: 0, ct: planTot ? mkCt("n") : mkCt(),
    });
    addC(rPlan, CSLT, "", { bg: "#faf3ff" });

    // AN / Actual (j=22)
    const rAct = R0 + 22;
    addC(rAct, C1, "AN", { bg: "#ffffff", fc: "#111111", bl: 1, vt: 0 });
    allDays.forEach((d, i) => {
      if (sundaySet.has(d)) { addC(rAct, cD(i), "", { bg: "#dce8f5" }); return; }
      const v = line.actual_by_day[String(d)] || 0;
      addC(rAct, cD(i), v || "", { bg: "#ffffff", fc: "#111111", ht: 0, vt: 0, ct: v ? mkCt("n") : mkCt() });
    });
    addC(rAct, CTTL, actualTot || "", {
      bg: "#ede4fa", fc: "#4a2b8a", bl: 1, ht: 2, vt: 0, ct: actualTot ? mkCt("n") : mkCt(),
    });
    // diff = plan - actual: dương = thiếu (đỏ), âm = dư (xanh)
    const diff = planTot - actualTot;
    addC(rAct, CSLT, diff || "", {
      bg: diff > 0 ? "#fee2e2" : diff < 0 ? "#dcfce7" : "#faf3ff",
      fc: diff > 0 ? "#b91c1c" : diff < 0 ? "#166534" : "#4a2b8a",
      ht: 2, vt: 0, ct: diff ? mkCt("n") : mkCt(),
    });
  });

  // ── TOTAL row ────────────────────────────────────────────────────────
  const RTOT = 4 + nLines * N_ROWS;
  addC(RTOT, C0, "TOTAL", { bg: "#1e1b4b", fc: "#fff7c2", bl: 1, fs: 11, ht: 0, vt: 0 });
  addC(RTOT, C1, `Plan ${sheet.zone} T${sheet.month}`, { bg: "#312974", fc: "#fff7c2", bl: 1, fs: 11, vt: 0 });
  allDays.forEach((d, i) => {
    const sun = sundaySet.has(d);
    const v   = planByDayTotal[String(d)] || 0;
    addC(RTOT, cD(i), !sun && v ? v : "", {
      bg: sun ? "#dce8f5" : "#1e1b4b", fc: sun ? "#8aafcc" : "#fff7c2",
      ht: 0, vt: 0, ct: !sun && v ? mkCt("n") : mkCt(),
    });
  });
  addC(RTOT, CTTL, grandTotal || "", {
    bg: "#fff7c2", fc: "#1e1b4b", bl: 1, fs: 11, ht: 0, vt: 0, ct: grandTotal ? mkCt("n") : mkCt(),
  });
  addC(RTOT, CSLT, "", { bg: "#1e1b4b" });

  // ── Column widths & row heights ──────────────────────────────────────
  // Scan max text length per day column to auto-size widths
  const PX_PER_CHAR = 7.5;
  const COL_PAD     = 16;
  const COL_MIN     = 80;
  const COL_MAX     = 260;

  const dayMaxLen = {}; // dayIndex → max char count across all lines/slots/fields
  allDays.forEach((d, i) => {
    if (sundaySet.has(d)) return;
    let max = 4;
    sheet.lines.forEach((ln) => {
      [0, 1].forEach((si) => {
        const slot = ln.day_slots[String(d)]?.[String(si)];
        if (!slot) return;
        FIELD_KEYS.forEach((k) => {
          const v = slot[k];
          if (v != null) max = Math.max(max, String(v).length);
        });
      });
    });
    dayMaxLen[i] = max;
  });

  const columnlen = { [C0]: 80, [C1]: 180, [CTTL]: 72, [CSLT]: 72 };
  allDays.forEach((d, i) => {
    columnlen[cD(i)] = sundaySet.has(d)
      ? 34
      : Math.min(COL_MAX, Math.max(COL_MIN, Math.ceil(dayMaxLen[i] * PX_PER_CHAR) + COL_PAD));
  });

  const rowlen = { 0: 56, 1: 22, 2: 22, 3: 22 };
  for (let r = 4; r <= RTOT; r++) rowlen[r] = 36;

  return {
    name: `${sheet.zone} T${sheet.month}/${sheet.year}`,
    id:   `${sheet.zone}-${sheet.year}-${sheet.month}`,
    row:    RTOT + 1,
    column: CSLT + 1,
    celldata,
    config: {
      merge:     mergeMap,
      columnlen,
      rowlen,
    },
    frozen: { type: "both", range: { row_focus: 3, column_focus: 1 } },
  };
}

// ── Page component ────────────────────────────────────────────────────────────
export default function KHXPlanPage() {
  const { data: runsData } = useRuns({ lifecycle_status: "accepted,verifying,active", page_size: 50 });
  const { data: activeRun } = useActiveRun();
  const runs = runsData?.items || runsData || [];
  const [runId,      setRunId]      = useState(null);
  const [activeZone, setActiveZone] = useState(null);
  const [Workbook,   setWorkbook]   = useState(null);

  // Lazy-load FortuneSheet
  useEffect(() => { loadFS().then(W => setWorkbook(() => W)); }, []);

  const activeRunId = runId || activeRun?.id || runs[0]?.id;
  const { data: sheetsResp } = useKHXPlanSheets(activeRunId);
  const sheets = sheetsResp?.sheets || [];

  const zoneGroups = useMemo(() => {
    const g = {};
    sheets.forEach((s) => { if (!g[s.zone]) g[s.zone] = []; g[s.zone].push(s); });
    return g;
  }, [sheets]);

  const zones      = Object.keys(zoneGroups);
  const currentZone = activeZone || zones[0];
  const zoneSheets  = zoneGroups[currentZone] || [];

  // Load all sheets for current zone in parallel — each becomes a native FortuneSheet tab
  const sheetQueries = useQueries({
    queries: zoneSheets.map((s) => ({
      queryKey: ["khx-plan", activeRunId, s.zone, s.year, s.month],
      queryFn:  () => runsApi.khxPlan(activeRunId, s.zone, s.year, s.month),
      enabled:  !!(activeRunId && s.zone && s.year && s.month),
    })),
  });

  // All queries must have data before mounting Workbook — FortuneSheet only reads `data` on mount
  const allReady  = sheetQueries.length > 0 && sheetQueries.every((q) => !!q.data);
  const isLoading = !Workbook || (zoneSheets.length > 0 && !allReady);

  const fsData = useMemo(() => {
    if (!allReady) return [];
    return sheetQueries
      .map((q) => q.data)
      .filter(Boolean)
      .map((sheet) => {
        const sundaySet = new Set(sheet.sunday_days || []);
        const allDays   = sheet.all_days || [];
        if (!allDays.length) return null;
        return buildFSSheet(sheet, allDays, sundaySet);
      })
      .filter(Boolean);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allReady, sheetQueries.map((q) => q.dataUpdatedAt).join(",")]);

  return (
    <PageLayout>
      <Topbar title="KHX Plan — Kế Hoạch Sản Xuất" subtitle="Nhóm theo LPD / End Gò · Plan từ SCBZCL · Sản lượng từ SCBB">
        <select className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
          value={activeRunId || ""}
          onChange={(e) => { setRunId(+e.target.value); setActiveZone(null); }}>
          {runs.map((r) => <option key={r.id} value={r.id}>#{r.id} · {r.label}</option>)}
        </select>
        <button className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
          <Download size={14} /> Export
        </button>
      </Topbar>

      {/* Zone tabs */}
      <div className="flex shrink-0 items-center gap-0 border-b border-slate-200 bg-white px-4">
        {zones.map((z) => (
          <button key={z} onClick={() => setActiveZone(z)}
            className={clsx(
              "flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition",
              currentZone === z
                ? "border-violet-600 text-violet-700"
                : "border-transparent text-slate-500 hover:text-slate-700",
            )}>
            {z}
            <span className={clsx("rounded-full px-2 py-0.5 text-xs font-semibold",
              currentZone === z ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500")}>
              {(zoneGroups[z] || []).reduce((s, sh) => s + (sh.n_orders || 0), 0)}
            </span>
          </button>
        ))}
      </div>

      {/* Spreadsheet area — sheet tabs rendered natively inside FortuneSheet */}
      <div className="flex flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner />
          </div>
        ) : !zoneSheets.length ? (
          <div className="flex flex-1 items-center justify-center text-slate-400 text-sm">
            Chọn một khu vực để xem kế hoạch.
          </div>
        ) : fsData.length > 0 ? (
          <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
            <Workbook
              key={currentZone}
              data={fsData}
              options={{
                showtoolbar:      false,
                showinfobar:      false,
                showstatisticBar: false,
                showsheetbar:     true,
                sheetRightClickConfig: { delete: false, copy: false, rename: false, insert: false, hide: false },
                cellRightClickConfig:  { copy: true, paste: false },
              }}
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center"><Spinner /></div>
        )}
      </div>
    </PageLayout>
  );
}

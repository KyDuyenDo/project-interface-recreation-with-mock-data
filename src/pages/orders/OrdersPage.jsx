import { useState, useCallback, useMemo, useRef } from "react";
import { Workbook } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";
import { useBaoCao, usePatchBaoCao, useDebounce } from "../../hooks";
import { PageLayout, Topbar, FilterBar } from "../../components/layout";
import { Spinner } from "../../components/ui";
import { Search, Download, ChevronDown, X, SlidersHorizontal, RefreshCw, Save } from "lucide-react";
import { clsx } from "clsx";

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 100;

const INIT = {
  search: "",
  lpd_from: "",
  lpd_to: "",
};

// ── Row colour bands ──────────────────────────────────────────────────────────
const EVEN_BG       = "#f8fafc";
const ODD_BG        = "#ffffff";
const GA_PENDING_BG = "#fef9c3"; // yellow-100 — in GA plan, chưa vào ERP
const IN_PROD_BG    = "#f0fdf4"; // green-50   — in GA plan + có PDSCH

// ── Editable cell highlight ───────────────────────────────────────────────────
const EDIT_BG = "#fffbeb"; // amber-50

// ─── Column definitions ───────────────────────────────────────────────────────
// source = null            → always empty (not yet available)
// source = "__LEAN_MAY__"  → computed: LEAN if contains "_L", else ""
// source = "__LEAN_GO__"   → computed: LEAN if contains "_G", else ""
// source = "__STITCH_BAL__"→ computed: QTY - Stitching
// source = "__GO_BAL__"    → computed: QTY - Assemble
// source = "X(YYYY/MM)"   → toYearMonth(row[X])
// source = "SDD-LPD"      → diffDays(SDD, LPD)
// editable = true          → user can edit; stored in pdsch_user_overrides
const COLUMNS = [
  // ── ERP / Production fields ──────────────────────────────────────────────
  { header: "FTY RY NO.",                   source: "ZLBH" },
  { header: "PROD. PERIOD",                 source: "PSDT(YYYY/MM)" },
  { header: "ORDER NO.",                    source: "RY" },
  { header: "CUST ORDER NO.",               source: "KHPO" },
  { header: "CLASS",                        source: "SPECID" },
  { header: "CUSTOMER",                     source: "CUSTNAME" },
  { header: "COUNTRY",                      source: "COUNTRY" },
  { header: "MODEL NAME",                   source: "XieMing" },
  { header: "ART NO.",                      source: "Article" },
  { header: "LEAD TIME",                    source: "LEADTIME" },
  { header: "TOOL",                         source: "DDMH" },
  { header: "LAST",                         source: "XTMH" },
  { header: "CUTTING DIE",                  source: "DAOMH" },
  { header: "Q'TY",                         source: "QTY" },
  { header: "RECEIVE",                      source: "DDRQ" },
  { header: "PLAN DATE",                    source: "PlanDate" },
  { header: "PM",                           source: "PlanDate(YYYY/MM)" },
  { header: "CRD",                          source: "CRD" },
  { header: "CRD Month",                    source: "CRD(YYYY/MM)" },
  { header: "SDD",                          source: "SDD" },
  { header: "SDD Month",                    source: "SDD(YYYY/MM)" },
  { header: "LPD",                          source: "LPD" },
  { header: "LPD Month",                    source: "LPD(YYYY/MM)" },
  { header: "SLIP PAGE",                    source: "SDD-LPD" },
  { header: "UPPER MATERIAL ETA",           source: "UPMETA" },
  { header: "LINE MAY",                     source: "__LEAN_MAY__", editable: true },
  { header: "PROD. START DATE",             source: "PSDT" },
  { header: "PROD. STITCHING FINISH DATE",  source: "PEDT" },
  { header: "STITCHING FINISHED Q'TY",      source: "Stitching" },
  { header: "STITCHING BAL",               source: "__STITCH_BAL__" },
  { header: "LINE GO",                      source: "__LEAN_GO__" },
  { header: "PROD. ASS. START DATE",        source: "ga_go_start" },
  { header: "PROD. FINISH DATE",            source: "ga_go_end" },
  { header: "FINISHED Q'TY",               source: "Assemble" },
  { header: "BAL",                          source: "__GO_BAL__" },
  { header: "Stock Qty",                    source: "OnTimeQty" },
  // ── GA planning fields (thông tin mới, không trùng với ERP) ──────────────
  { header: "NGUỒN",                        source: "source" },
  { header: "GA TRẠNG THÁI",              source: "ga_state" },
  // ── User-editable fields ──────────────────────────────────────────────────
  { header: "Warehouse Bal",               source: "warehouse_bal",         editable: true },
  { header: "ngày nhập KTP OK",            source: "ngay_nhap_ktp_ok",      editable: true },
  { header: "XUẤT HÀNG DỰ KIẾN",          source: "xuat_hang_du_kien",     editable: true },
  { header: "EX-FACTORY",                  source: "ex_factory",            editable: true },
  { header: "INSPECTION DATE",             source: "inspection_date",       editable: true },
  { header: "LO inspection result",        source: "lo_inspection_result",  editable: true },
  { header: "REMARK",                      source: "remark",                editable: true },
  { header: "PODD",                        source: "podd",                  editable: true },
  { header: "PRODUCTION No",              source: "production_no",          editable: true },
  { header: "GC MM",                       source: "gc_mm",                 editable: true },
  { header: "REMARK GC CHI TIẾT",         source: "remark_gc_chi_tiet",    editable: true },
];

// Editable column indices (0-based) – precomputed for performance
const EDITABLE_COL_INDICES = new Set(
  COLUMNS.map((c, i) => (c.editable ? i : -1)).filter((i) => i >= 0)
);

// Map from column index to field name (for PATCH body)
const COL_TO_FIELD = Object.fromEntries(
  COLUMNS.flatMap((c, i) =>
    c.editable && c.source && !c.source.startsWith("__") ? [[i, c.source]] : []
  )
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toYearMonth(v) {
  if (!v) return "";
  const s = String(v).trim();
  const m = s.match(/^(\d{4})[-/](\d{2})/);
  if (m) return `${m[1]}/${m[2]}`;
  return s;
}

function diffDays(a, b) {
  if (!a || !b) return "";
  const na = new Date(String(a).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"));
  const nb = new Date(String(b).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"));
  if (isNaN(na) || isNaN(nb)) return "";
  return Math.round((na - nb) / 86_400_000);
}

function resolveCell(col, row) {
  const { source } = col;
  if (source === null) return "";

  if (source === "__LEAN_MAY__") {
    const lean = row["LEAN"] ?? row["lean"] ?? "";
    if (lean.includes("_L")) return lean;
    return row["ga_line_may"] ?? "";   // fallback: GA plan (ga_pending / in_production)
  }
  if (source === "__LEAN_GO__") {
    const lean = row["LEAN"] ?? row["lean"] ?? "";
    if (lean.includes("_G")) return lean;
    return row["ga_line_go"] ?? "";    // fallback: GA plan
  }
  if (source === "__STITCH_BAL__") {
    const qty   = parseFloat(row["QTY"]   ?? row["qty"]   ?? 0) || 0;
    const stitch = parseFloat(row["Stitching"] ?? row["stitching"] ?? 0) || 0;
    return qty - stitch;
  }
  if (source === "__GO_BAL__") {
    const qty     = parseFloat(row["QTY"]     ?? row["qty"]     ?? 0) || 0;
    const assemble = parseFloat(row["Assemble"] ?? row["assemble"] ?? 0) || 0;
    return qty - assemble;
  }
  if (source === "SDD-LPD") {
    return diffDays(row["SDD"] ?? row["sdd"], row["LPD"] ?? row["lpd"]);
  }

  // YYYY/MM computed columns
  const mmMatch = source.match(/^(.+)\(YYYY\/MM\)$/);
  if (mmMatch) {
    const key = mmMatch[1];
    return toYearMonth(row[key] ?? row[key.toLowerCase()]);
  }

  // Direct lookup (case-insensitive fallback)
  if (row[source] !== undefined) return row[source] ?? "";
  const lower = source.toLowerCase();
  if (row[lower] !== undefined) return row[lower] ?? "";
  return "";
}

// ─── FortuneSheet data builder ────────────────────────────────────────────────
function buildSheetData(rows) {
  if (!rows.length) {
    return {
      celldata: [{ r: 0, c: 0, v: { v: "No data", m: "No data", ct: { fa: "General", t: "s" } } }],
      row: 2, column: 1,
    };
  }

  const celldata = [];

  // Row 0 — headers
  COLUMNS.forEach((col, c) => {
    const bg = col.editable ? "#dbeafe" : "#1e3a5f"; // blue-100 for editable headers
    const fc = col.editable ? "#1e3a8a" : "#ffffff";
    celldata.push({
      r: 0, c,
      v: { v: col.header, m: col.header, bg, fc, bl: 1, ct: { fa: "General", t: "s" } },
    });
  });

  // Rows 1..n — data
  rows.forEach((row, ri) => {
    const src = row.source ?? "erp_only";
    const baseRowBg =
      src === "ga_pending"    ? GA_PENDING_BG :
      src === "in_production" ? IN_PROD_BG    :
      ri % 2 === 0            ? EVEN_BG       : ODD_BG;
    COLUMNS.forEach((col, c) => {
      const raw  = resolveCell(col, row);
      const isNum = typeof raw === "number";
      const str   = raw === "" || raw == null ? "" : String(raw).trim();
      const bg    = col.editable ? EDIT_BG : baseRowBg;
      celldata.push({
        r: ri + 1, c,
        v: {
          v: isNum ? raw : str,
          m: str,
          bg,
          ct: { fa: isNum ? "General" : "@", t: isNum ? "n" : "s" },
        },
      });
    });
  }); 

  return { celldata, row: rows.length + 1, column: COLUMNS.length };
}

// ─── Active filter count ──────────────────────────────────────────────────────
function activeCount(f) {
  return (
    (f.search ? 1 : 0) +
    (f.lpd_from || f.lpd_to ? 1 : 0)
  );
}

function buildQueryParams(f, page) {
  const p = { page, page_size: PAGE_SIZE };
  if (f.search)    p.search   = f.search;
  if (f.lpd_from)  p.lpd_from = f.lpd_from;
  if (f.lpd_to)    p.lpd_to   = f.lpd_to;
  return p;
}

// ─── DateRangeChip ────────────────────────────────────────────────────────────
function DateRangeChip({ label, from, to, onFromChange, onToChange }) {
  const [open, setOpen] = useState(false);
  const active = from || to;
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className={clsx(
          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition whitespace-nowrap",
          active
            ? "border-blue-400 bg-blue-50 text-blue-700"
            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
        )}>
        {label}
        {active && <span className="text-blue-500">●</span>}
        <ChevronDown size={12} className={clsx("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1.5 min-w-[260px] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">From</label>
                <input type="date" value={from} onChange={(e) => onFromChange(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">To</label>
                <input type="date" value={to} onChange={(e) => onToChange(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
              </div>
            </div>
            {active && (
              <button onClick={() => { onFromChange(""); onToChange(""); }}
                className="mt-2 w-full rounded-lg border border-slate-200 py-1 text-center text-[10px] text-slate-400 hover:bg-slate-50">
                Clear range
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Pagination strip ─────────────────────────────────────────────────────────
function PagStrip({ page, total, pageSize, onChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center gap-2 border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)}
        className="rounded border border-slate-200 px-2 py-0.5 disabled:opacity-40 hover:bg-slate-50">‹</button>
      <span>Page {page} / {totalPages} &nbsp;·&nbsp; {total.toLocaleString()} rows</span>
      <button disabled={page >= totalPages} onClick={() => onChange(page + 1)}
        className="rounded border border-slate-200 px-2 py-0.5 disabled:opacity-40 hover:bg-slate-50">›</button>
    </div>
  );
}

// ─── Edit queue display ───────────────────────────────────────────────────────
function PendingSaveBar({ queue, onSave, onDiscard, isSaving }) {
  const count = Object.keys(queue).length;
  if (!count) return null;
  return (
    <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-800">
      <span className="font-medium">{count} row{count > 1 ? "s" : ""} edited — unsaved</span>
      <button
        onClick={onSave}
        disabled={isSaving}
        className="flex items-center gap-1 rounded-full bg-amber-600 px-3 py-1 text-white hover:bg-amber-700 disabled:opacity-50"
      >
        <Save size={11} /> {isSaving ? "Saving…" : "Save all"}
      </button>
      <button onClick={onDiscard} className="text-amber-600 hover:underline">Discard</button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const [filters, setFilters] = useState(INIT);
  const [page, setPage]       = useState(1);

  // Pending cell edits: { zlbh: { field: newValue, … } }
  const [editQueue, setEditQueue] = useState({});

  const { mutateAsync: patchRow, isPending: isSaving } = usePatchBaoCao();

  const setFilter = useCallback((patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }, []);
  const resetAll = () => { setFilters(INIT); setPage(1); };

  const debouncedSearch  = useDebounce(filters.search, 400);
  const debouncedLpdFrom = useDebounce(filters.lpd_from, 1200);
  const debouncedLpdTo   = useDebounce(filters.lpd_to, 1200);

  const queryParams = buildQueryParams(
    { ...filters, search: debouncedSearch, lpd_from: debouncedLpdFrom, lpd_to: debouncedLpdTo },
    page,
  );

  const { data, isLoading, isFetching } = useBaoCao(queryParams);
  const pdschRows   = data?.items       ?? [];
  const gaPending   = data?.ga_pending  ?? [];
  const total       = data?.total       ?? 0;
  const gaPendingCt = data?.ga_pending_count ?? 0;
  const active      = activeCount(filters);

  // ga_pending rows always appear first (not paginated), then PDSCH rows
  const rows = [...gaPending, ...pdschRows];

  // Track current rows in a ref so the Workbook cell-change handler can read them
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  // Handle cell edits — fires only on user-initiated commits, NOT when data prop changes
  const handleCellUpdateBefore = useCallback((r, c, value) => {
    if (r === 0 || !EDITABLE_COL_INDICES.has(c)) return false;
    const field = COL_TO_FIELD[c];
    const rowData = rowsRef.current[r - 1];
    if (!field || !rowData) return false;
    const zlbh = String(rowData["ZLBH"] ?? "").trim();
    if (!zlbh) return false;
    setEditQueue((prev) => ({
      ...prev,
      [zlbh]: { ...(prev[zlbh] || {}), [field]: String(value?.v ?? value ?? "") },
    }));
    return true;
  }, []);

  // Save all pending edits
  const handleSaveAll = useCallback(async () => {
    for (const [zlbh, fields] of Object.entries(editQueue)) {
      await patchRow({ zlbh, body: fields });
    }
    setEditQueue({});
  }, [editQueue, patchRow]);

  // Build FortuneSheet sheets config
  const sheets = useMemo(() => {
    const { celldata, row, column } = buildSheetData(rows);

    // Column widths — wider for text-heavy columns
    const colWidths = COLUMNS.reduce((acc, col, i) => {
      const hlen = col.header.length;
      acc[i] = hlen > 18 ? 180 : hlen > 12 ? 140 : 110;
      return acc;
    }, {});

    return [
      {
        name: "BAO_CAO_SO_DUOI",
        id: "main",
        row:    Math.max(row, 50),
        column: Math.max(column, COLUMNS.length),
        celldata,
        frozen: { type: "row", count: 1 },
        config: { columnlen: colWidths },
      },
    ];
  }, [rows]);

  return (
    <PageLayout>
      <Topbar title="BAO_CAO_SO_DUOI" subtitle="Tiến độ sản xuất · GA plan + PDSCH">
        <button
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          onClick={() => window.print()}
        >
          <Download size={14} /> Export
        </button>
      </Topbar>

      {/* ── Filter bar ── */}
      <FilterBar>
        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="rounded-full border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs placeholder:text-slate-400 focus:border-blue-400 focus:outline-none w-60"
            placeholder="Tìm mã đơn hàng, article…"
            value={filters.search}
            onChange={(e) => setFilter({ search: e.target.value })}
          />
        </div>

        <div className="h-5 w-px bg-slate-200" />

        <DateRangeChip
          label="LPD range"
          from={filters.lpd_from}
          to={filters.lpd_to}
          onFromChange={(v) => setFilter({ lpd_from: v })}
          onToChange={(v) => setFilter({ lpd_to: v })}
        />

        {active > 0 && (
          <>
            <div className="h-5 w-px bg-slate-200" />
            <div className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
              <SlidersHorizontal size={12} /> {active} filter{active > 1 ? "s" : ""}
            </div>
            <button
              onClick={resetAll}
              className="flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-50 transition"
            >
              <X size={11} /> Reset
            </button>
          </>
        )}

        <div className="flex-1" />

        {isFetching && !isLoading && (
          <span className="flex items-center gap-1 text-[11px] text-blue-500 animate-pulse">
            <RefreshCw size={11} className="animate-spin" /> Refreshing…
          </span>
        )}
        <span className="text-xs text-slate-400">
          {total.toLocaleString()} PDSCH · page {page}
        </span>
        {gaPendingCt > 0 && (
          <span className="rounded-full bg-yellow-50 border border-yellow-200 px-2.5 py-1 text-[10px] font-semibold text-yellow-700">
            {gaPendingCt} chờ ERP
          </span>
        )}
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-600">
          {COLUMNS.length} cols
        </span>
      </FilterBar>

      {/* ── Pending save bar ── */}
      <PendingSaveBar
        queue={editQueue}
        onSave={handleSaveAll}
        onDiscard={() => setEditQueue({})}
        isSaving={isSaving}
      />

      {/* ── Sheet area ── */}
      <div className="flex flex-col" style={{ height: "calc(100vh - 116px)" }}>
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner size={36} />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-hidden">
              <Workbook
                data={sheets}
                showToolbar={true}
                showFormulaBar={true}
                showSheetTabs={true}
                allowEdit={true}
                onCellUpdateBefore={handleCellUpdateBefore}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
            <PagStrip page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
          </>
        )}
      </div>
    </PageLayout>
  );
}

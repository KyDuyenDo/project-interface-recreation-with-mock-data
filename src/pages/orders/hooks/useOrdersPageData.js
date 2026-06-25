import { useState, useCallback, useMemo, useRef } from "react";
import { useBaoCao, usePatchBaoCao, useDebounce } from "../../../hooks";

const PAGE_SIZE = 100;

const INIT = {
  search: "",
  lpd_from: "",
  lpd_to: "",
};

// Row colors
const EVEN_BG       = "#f8fafc";
const ODD_BG        = "#ffffff";
const GA_PENDING_BG = "#fef9c3";
const IN_PROD_BG    = "#f0fdf4";
const EDIT_BG       = "#fffbeb";

export const COLUMNS = [
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
  { header: "NGUỒN",                        source: "source" },
  { header: "GA TRẠNG THÁI",              source: "ga_state" },
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

const EDITABLE_COL_INDICES = new Set(
  COLUMNS.map((c, i) => (c.editable ? i : -1)).filter((i) => i >= 0)
);

const COL_TO_FIELD = Object.fromEntries(
  COLUMNS.flatMap((c, i) =>
    c.editable && c.source && !c.source.startsWith("__") ? [[i, c.source]] : []
  )
);

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
    return row["ga_line_may"] ?? "";
  }
  if (source === "__LEAN_GO__") {
    const lean = row["LEAN"] ?? row["lean"] ?? "";
    if (lean.includes("_G")) return lean;
    return row["ga_line_go"] ?? "";
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

  const mmMatch = source.match(/^(.+)\(YYYY\/MM\)$/);
  if (mmMatch) {
    const key = mmMatch[1];
    return toYearMonth(row[key] ?? row[key.toLowerCase()]);
  }

  if (row[source] !== undefined) return row[source] ?? "";
  const lower = source.toLowerCase();
  if (row[lower] !== undefined) return row[lower] ?? "";
  return "";
}

function buildSheetData(rows) {
  if (!rows.length) {
    return {
      celldata: [{ r: 0, c: 0, v: { v: "No data", m: "No data", ct: { fa: "General", t: "s" } } }],
      row: 2, column: 1,
    };
  }

  const celldata = [];

  COLUMNS.forEach((col, c) => {
    const bg = col.editable ? "#dbeafe" : "#1e3a5f";
    const fc = col.editable ? "#1e3a8a" : "#ffffff";
    celldata.push({
      r: 0, c,
      v: { v: col.header, m: col.header, bg, fc, bl: 1, ct: { fa: "General", t: "s" } },
    });
  });

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

export function useOrdersPageData() {
  const [filters, setFilters] = useState(INIT);
  const [page, setPage]       = useState(1);
  const [editQueue, setEditQueue] = useState({});

  const { mutateAsync: patchRow, isPending: isSaving } = usePatchBaoCao();

  const setFilter = useCallback((patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }, []);

  const resetAll = () => {
    setFilters(INIT);
    setPage(1);
  };

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

  const rows = useMemo(() => [...gaPending, ...pdschRows], [gaPending, pdschRows]);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;

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

  const handleSaveAll = useCallback(async () => {
    for (const [zlbh, fields] of Object.entries(editQueue)) {
      await patchRow({ zlbh, body: fields });
    }
    setEditQueue({});
  }, [editQueue, patchRow]);

  const sheets = useMemo(() => {
    const { celldata, row, column } = buildSheetData(rows);

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

  return {
    filters,
    page,
    setPage,
    editQueue,
    setEditQueue,
    isSaving,
    setFilter,
    resetAll,
    isLoading,
    isFetching,
    total,
    gaPendingCt,
    active,
    sheets,
    handleCellUpdateBefore,
    handleSaveAll,
    pageSize: PAGE_SIZE,
  };
}

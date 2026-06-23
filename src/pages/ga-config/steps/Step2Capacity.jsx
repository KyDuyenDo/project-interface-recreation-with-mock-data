import { useState, useMemo, useEffect, useRef, memo, useCallback } from "react";
import { wizardStateApi } from "../../../api";
import {
  ChevronLeft, ChevronRight, RefreshCw, Loader2, Info, X,
  Upload, FileSpreadsheet, AlertTriangle, Eye,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useQuery } from "@tanstack/react-query";
import {
  useModelLineFrequency, useLinePool, useGcDepartments,
} from "../../../hooks/useWizard";
import { shoeTargetsApi } from "../../../api";
import { vnNow } from "../../../utils";
import PriorityMatrixTab from "../components/PriorityMatrixTab";

const BTN    = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SM = "inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

function modelKey(article, cutting_die) {
  return `${article}||${cutting_die || ""}`;
}

function getDefaultRange() {
  const to = vnNow();
  const from = vnNow(); from.setUTCFullYear(from.getUTCFullYear() - 1);
  return { date_from: from.toISOString().slice(0, 10), date_to: to.toISOString().slice(0, 10) };
}

function lineTypeOf(lineId, depName) {
  const s = (depName || lineId || "").toUpperCase();
  if (/M\d+$/.test(s) || /_M\d/.test(s) || s.includes("_M")) return "may";
  if (/G\d+$/.test(s) || /_G\d/.test(s) || s.includes("_G")) return "go";
  return "unknown";
}

// Build shoe-type groups from a set of order IDs + knownOrdersMap
function buildShoeTypes(selectedIds, knownOrdersMap) {
  if (!selectedIds?.size || !knownOrdersMap) return [];
  const groups = new Map();
  for (const id of selectedIds) {
    const o = knownOrdersMap[id];
    if (!o?.article) continue;
    const k = modelKey(o.article, o.cutting_die);
    if (!groups.has(k)) {
      groups.set(k, {
        key: k, article: o.article, cutting_die: o.cutting_die,
        styles: new Set(), tools: new Set(), lastDies: new Set(), orderIds: [],
      });
    }
    const g = groups.get(k);
    g.orderIds.push(id);
    if (o.style)    g.styles.add(o.style);
    if (o.tool)     g.tools.add(o.tool);
    if (o.last_die) g.lastDies.add(o.last_die);
  }
  return [...groups.values()]
    .map(g => ({
      key: g.key, article: g.article, cutting_die: g.cutting_die,
      style:    [...g.styles].join(" / "),
      tool:     [...g.tools].join(", "),
      last_die: [...g.lastDies].join(", "),
      orderIds: g.orderIds,
    }))
    .sort((a, b) => a.article.localeCompare(b.article));
}

// ─── NewModelImportModal ──────────────────────────────────────────────────────
// 3-step: upload → map columns → review/confirm
// onConfirm({[modelKey]: {[lineId]: qty}})
function NewModelImportModal({ noHistShoeTypes, onConfirm, onClose }) {
  const MODAL_STEP = { UPLOAD: 0, MAP: 1, REVIEW: 2 };
  const fileRef = useRef(null);
  const [step,      setStep]      = useState(MODAL_STEP.UPLOAD);
  const [fileName,  setFileName]  = useState("");
  const [headers,   setHeaders]   = useState([]);
  const [rows,      setRows]      = useState([]);
  const [colArt,    setColArt]    = useState("");
  const [colLine,   setColLine]   = useState("");
  const [colQty,    setColQty]    = useState("");
  const [dragOver,  setDragOver]  = useState(false);
  const [error,     setError]     = useState("");

  const parseFile = useCallback((file) => {
    if (!file) return;
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (!data || data.length < 2) { setError("File không có dữ liệu."); return; }
        const sheetRange = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]) : null;
        const numCols = sheetRange ? sheetRange.e.c + 1 : (data[0] || []).length;
        const hdrs = Array.from({ length: numCols }, (_, i) =>
          String((data[0] || [])[i] || `Cột ${i + 1}`).trim()
        );
        const dataRows = data.slice(1).map(row =>
          Object.fromEntries(hdrs.map((h, i) => [h, String(row[i] ?? "").trim()]))
        );
        setHeaders(hdrs);
        setRows(dataRows);
        setFileName(file.name);
        setColArt(hdrs.find(h => /article|mã.*giày|style.*code/i.test(h)) || hdrs[0] || "");
        setColLine(hdrs.find(h => /line|chuyền|dep_no|line.*id/i.test(h)) || hdrs[1] || "");
        setColQty(hdrs.find(h => /qty|sản.*lượng|target|mục.*tiêu/i.test(h)) || hdrs[2] || "");
        setStep(MODAL_STEP.MAP);
      } catch { setError("Không đọc được file. Hãy dùng định dạng .xlsx, .xls hoặc .csv."); }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const reviewRows = useMemo(() => {
    if (!colArt || !colLine || !colQty) return [];
    const articleMap = new Map(noHistShoeTypes.map(st => [st.article.toUpperCase(), st]));
    return rows.map(row => {
      const art = String(row[colArt]  || "").trim().toUpperCase();
      const lid = String(row[colLine] || "").trim();
      const qty = parseInt(row[colQty] || "0", 10);
      return { art, lid, qty, st: articleMap.get(art) || null };
    }).filter(r => r.art && r.lid);
  }, [rows, colArt, colLine, colQty, noHistShoeTypes]);

  function handleConfirm() {
    const map = {};
    for (const r of reviewRows) {
      if (!r.st || !r.lid || r.qty <= 0) continue;
      if (!map[r.st.key]) map[r.st.key] = {};
      map[r.st.key][r.lid] = r.qty;
    }
    onConfirm(map);
  }

  const stepLabels = ["Upload", "Ghép cột", "Xác nhận"];
  const knownCount = reviewRows.filter(r => r.st).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-[680px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <div className="text-sm font-bold text-gray-900">Import sản lượng mục tiêu</div>
            <div className="text-xs text-gray-500 mt-0.5">Nhập file Excel để định nghĩa sản lượng mục tiêu theo chuyền cho model mới</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={16} /></button>
        </div>

        {/* Step indicator */}
        <div className="flex border-b border-gray-100 px-4">
          {stepLabels.map((s, i) => (
            <div key={s} className={["flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors",
              i === step ? "border-blue-600 text-blue-700" : i < step ? "border-green-400 text-green-700" : "border-transparent text-gray-400",
            ].join(" ")}>
              <span className={["w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                i === step ? "bg-blue-600 text-white" : i < step ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400",
              ].join(" ")}>
                {i < step ? "✓" : i + 1}
              </span>
              {s}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {step === MODAL_STEP.UPLOAD && (
            <div>
              <div
                className={["border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
                  dragOver ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300",
                ].join(" ")}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); parseFile(e.dataTransfer.files[0]); }}
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={32} className="mx-auto mb-3 text-gray-300" />
                <div className="text-sm font-medium text-gray-700">Kéo thả hoặc click để chọn file</div>
                <div className="text-xs text-gray-400 mt-1">.xlsx, .xls, .csv</div>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => parseFile(e.target.files[0])} />
              {error && (
                <div className="flex items-center gap-1.5 text-xs text-red-500 mt-3">
                  <AlertTriangle size={12} /> {error}
                </div>
              )}
              <div className="mt-4 text-xs text-gray-500 bg-gray-50 rounded-lg p-3 space-y-1">
                <div className="font-medium text-gray-700">Cấu trúc file mẫu:</div>
                <div className="font-mono">Article | Line ID | Target Qty</div>
                <div className="font-mono text-gray-400">XL100   | LHGA1M01 | 500</div>
              </div>
            </div>
          )}

          {step === MODAL_STEP.MAP && (
            <div className="space-y-4">
              <div className="text-xs text-gray-500">
                File: <span className="font-medium text-gray-700">{fileName}</span> · {rows.length} dòng dữ liệu
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Cột Article", value: colArt, set: setColArt },
                  { label: "Cột Line ID (chuyền)", value: colLine, set: setColLine },
                  { label: "Cột Sản lượng mục tiêu", value: colQty, set: setColQty },
                ].map(({ label, value, set }) => (
                  <div key={label}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{label} <span className="text-red-500">*</span></label>
                    <select className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                      value={value} onChange={e => set(e.target.value)}>
                      <option value="">— Chọn cột —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              {colArt && colLine && colQty && (
                <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-100">
                  <div className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Xem trước (5 dòng đầu)</div>
                  <table className="w-full text-xs">
                    <thead className="bg-white border-y border-gray-100">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium text-gray-500">Article</th>
                        <th className="px-2 py-1.5 text-left font-medium text-gray-500">Line ID</th>
                        <th className="px-2 py-1.5 text-right font-medium text-gray-500">Target Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 5).map((r, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-2 py-1 font-mono text-gray-700">{r[colArt]  || "—"}</td>
                          <td className="px-2 py-1 font-mono text-gray-700">{r[colLine] || "—"}</td>
                          <td className="px-2 py-1 text-right text-gray-700">{r[colQty]  || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {step === MODAL_STEP.REVIEW && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs">
                <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{knownCount} khớp model mới</span>
                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">{reviewRows.length - knownCount} không khớp</span>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-72 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium text-gray-500">Article</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500">Line ID</th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500">Target Qty</th>
                      <th className="px-2 py-2 text-center font-medium text-gray-500">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewRows.map((r, i) => (
                      <tr key={i} className={["border-t border-gray-100", r.st ? "" : "opacity-40"].join(" ")}>
                        <td className="px-2 py-1.5 font-mono font-semibold text-gray-700">{r.art}</td>
                        <td className="px-2 py-1.5 font-mono text-gray-600">{r.lid}</td>
                        <td className="px-2 py-1.5 text-right text-gray-700">{r.qty.toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-center">
                          {r.st
                            ? <span className="text-green-600 text-[10px] font-medium">✓ Khớp</span>
                            : <span className="text-gray-400 text-[10px]">Không tìm thấy</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-2">
          {step > MODAL_STEP.UPLOAD && (
            <button className={`${BTN_SM} bg-white text-gray-600 border-gray-200 hover:bg-gray-50`}
              onClick={() => setStep(s => s - 1)}>
              Quay lại
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className={`${BTN_SM} bg-white text-gray-600 border-gray-200 hover:bg-gray-50`}>Hủy</button>
          {step === MODAL_STEP.MAP && (
            <button disabled={!colArt || !colLine || !colQty}
              className={`${BTN_SM} bg-blue-600 text-white border-blue-600 hover:bg-blue-700`}
              onClick={() => setStep(MODAL_STEP.REVIEW)}>
              Xem trước
            </button>
          )}
          {step === MODAL_STEP.REVIEW && (
            <button disabled={knownCount === 0}
              className={`${BTN_SM} bg-blue-600 text-white border-blue-600 hover:bg-blue-700`}
              onClick={handleConfirm}>
              Xác nhận ({knownCount} dòng)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── NewModelTab ──────────────────────────────────────────────────────────────
function NewModelTab({
  noHistRegularShoeTypes, noHistGcShoeTypes,
  freqData, extFreqData, freqLoading, extFreqLoading,
  lineTypeFromPool, allMayLines, allGoLines, allGcLines,
  depNameById, floorById, aliasById,
  priorityConfig, onPriorityConfigChange,
  refreshKey,
  importedTargetQty = {},
  onImportedTargetQtyChange,
  readOnly = false,
}) {
  const [showImport, setShowImport] = useState(false);
  const [importResult, setImportResult] = useState(null); // {lines, models}

  const combinedFreqData = useMemo(() => [...(freqData || []), ...(extFreqData || [])], [freqData, extFreqData]);
  const noHistShoeTypes  = useMemo(() => [...noHistRegularShoeTypes, ...noHistGcShoeTypes], [noHistRegularShoeTypes, noHistGcShoeTypes]);
  const gcKeySet = useMemo(() => new Set(noHistGcShoeTypes.map(st => st.key)), [noHistGcShoeTypes]);
  const hasNoHist = noHistRegularShoeTypes.length > 0 || noHistGcShoeTypes.length > 0;
  const isLoading = freqLoading || extFreqLoading;

  function handleImportConfirm(map) {
    // 1. Store imported target quantities (lifted to parent)
    onImportedTargetQtyChange?.(prev => {
      const next = { ...prev };
      for (const [mk, lineMap] of Object.entries(map)) {
        next[mk] = { ...(next[mk] || {}), ...lineMap };
      }
      return next;
    });

    // 2. Auto-add imported lines into priority config so they appear in the matrix
    // Compute delta synchronously using current priorityConfig snapshot
    let totalLines = 0;
    const modelsAffected = new Set();
    const delta = {};
    for (const [mk, lineMap] of Object.entries(map)) {
      const isGc = gcKeySet.has(mk);
      const existing = { ...(priorityConfig[mk] || {}) };
      for (const lid of Object.keys(lineMap)) {
        const lt = lineTypeFromPool[lid] || lineTypeOf(lid, depNameById[lid] || "");
        const col = isGc
          ? (lt === "go" ? "go_primary" : "gc_primary")
          : (lt === "go" ? "go_primary" : "may_primary");
        const cur = existing[col] || [];
        if (!cur.includes(lid)) {
          existing[col] = [...cur, lid];
          totalLines++;
          modelsAffected.add(mk);
        }
      }
      delta[mk] = existing;
    }
    if (Object.keys(delta).length) {
      onPriorityConfigChange(prev => ({ ...prev, ...delta }));
    }

    setImportResult({ lines: totalLines, models: modelsAffected.size });
    setShowImport(false);
  }

  const commonProps = { lineTypeFromPool, allMayLines, allGoLines, allGcLines, depNameById, floorById, aliasById, priorityConfig, onPriorityConfigChange, showToolbar: false, importedTargetQty, onRefetch: () => {}, refreshKey, readOnly };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-1 shrink-0">
        <div className="text-xs text-gray-500">Model mới — chưa có lịch sử sản xuất trong 18 tháng qua</div>
        {isLoading && <Loader2 size={12} className="animate-spin text-blue-400" />}
        {importResult && (
          <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full font-medium">
            ✓ Đã import {importResult.lines} chuyền cho {importResult.models} model
          </span>
        )}
        <div className="flex-1" />
        {hasNoHist && !readOnly && (
          <button className={`${BTN_SM} bg-green-600 text-white border-green-600 hover:bg-green-700`}
            onClick={() => setShowImport(true)}>
            <FileSpreadsheet size={12} /> Import sản lượng mục tiêu
          </button>
        )}
      </div>

      {!hasNoHist ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 gap-2">
          <Info size={16} />
          <span className="text-sm">Tất cả model đã có lịch sử sản xuất trong 18 tháng qua</span>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto space-y-6">
          {noHistRegularShoeTypes.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg mb-2 inline-block">
                Đơn thường · {noHistRegularShoeTypes.length} model mới
              </div>
              <PriorityMatrixTab mode="regular" shoeTypes={noHistRegularShoeTypes} freqData={combinedFreqData} freqLoading={false} {...commonProps} />
            </div>
          )}
          {noHistGcShoeTypes.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-orange-700 bg-orange-50 px-3 py-1.5 rounded-lg mb-2 inline-block">
                Đơn gia công · {noHistGcShoeTypes.length} model mới
              </div>
              <PriorityMatrixTab mode="gc" shoeTypes={noHistGcShoeTypes} freqData={combinedFreqData} freqLoading={false} {...commonProps} />
            </div>
          )}
        </div>
      )}

      {showImport && (
        <NewModelImportModal noHistShoeTypes={noHistShoeTypes} onConfirm={handleImportConfirm} onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}

// ─── Step2Capacity ────────────────────────────────────────────────────────────
export default function Step2Capacity({
  selectedRegularIds, selectedGcIds, knownOrdersMap,
  priorityConfig, onPriorityConfigChange,
  workingHoursPerDay, onWorkingHoursChange,
  capChoices, onCapChoicesChange,
  importedTargetQty, onImportedTargetQtyChange,
  draftRunId,
  onPrev, onNext,
  onLoadingChange,
  readOnly = false,
}) {
  const [dateRange,  setDateRange]  = useState(getDefaultRange);
  const [activeTab,  setActiveTab]  = useState(
    () => selectedRegularIds?.size > 0 ? "regular" : "gc"
  );
  const [refreshKey, setRefreshKey] = useState(0);

  // Line pool + GC departments (shared across tabs)
  const { data: linePoolData } = useLinePool();
  const { data: gcDeptData   } = useGcDepartments();

  // Shoe model targets — for badge + popover highlight
  const { data: shoeTargets = [] } = useQuery({
    queryKey: ["shoe-targets"],
    queryFn: () => shoeTargetsApi.list({ limit: 2000 }),
    staleTime: 5 * 60 * 1000,
  });
  const shoeTargetMap = useMemo(() => {
    const m = {};
    for (const t of shoeTargets) {
      m[t.model_name] = t;
      m[t.model_name.toLowerCase()] = t;
    }
    return m;
  }, [shoeTargets]);

  // Build shoe types per order type
  const regularShoeTypes = useMemo(() => buildShoeTypes(selectedRegularIds, knownOrdersMap), [selectedRegularIds, knownOrdersMap]);
  const gcShoeTypes      = useMemo(() => buildShoeTypes(selectedGcIds,      knownOrdersMap), [selectedGcIds,      knownOrdersMap]);

  // Combined articles for frequency query
  const allArticles = useMemo(() => {
    const s = new Set([...regularShoeTypes.map(st => st.article), ...gcShoeTypes.map(st => st.article)]);
    return [...s];
  }, [regularShoeTypes, gcShoeTypes]);

  const freqParams = useMemo(() => {
    if (!allArticles.length) return null;
    return { ...dateRange, articles: allArticles };
  }, [dateRange, allArticles]);

  const { data: freqData, isLoading: freqLoading, refetch: refetchFreq } = useModelLineFrequency(freqParams);

  // No-history articles → extended query (6 more months back)
  const freqArticleSet = useMemo(() => new Set((freqData || []).map(m => m.article)), [freqData]);

  const noHistArticles = useMemo(() => {
    if (!freqData) return [];
    return allArticles.filter(a => !freqArticleSet.has(a));
  }, [freqData, allArticles, freqArticleSet]);

  const extFreqParams = useMemo(() => {
    if (!noHistArticles.length) return null;
    const from = new Date(dateRange.date_from + "T00:00:00Z");
    from.setUTCMonth(from.getUTCMonth() - 6);
    return { date_from: from.toISOString().slice(0, 10), date_to: dateRange.date_to, articles: noHistArticles };
  }, [noHistArticles, dateRange]);

  const { data: extFreqData, isLoading: extFreqLoading, refetch: refetchExt } = useModelLineFrequency(extFreqParams);

  const isDataLoading = freqLoading || extFreqLoading;
  useEffect(() => {
    onLoadingChange?.(isDataLoading);
  }, [isDataLoading, onLoadingChange]);

  const extFreqArticleSet = useMemo(() => new Set((extFreqData || []).map(m => m.article)), [extFreqData]);

  // No-history shoe types (not in 1-year OR 18-month window)
  const noHistRegularShoeTypes = useMemo(() =>
    regularShoeTypes.filter(st => !freqArticleSet.has(st.article) && !extFreqArticleSet.has(st.article)),
    [regularShoeTypes, freqArticleSet, extFreqArticleSet]
  );
  const noHistGcShoeTypes = useMemo(() =>
    gcShoeTypes.filter(st => !freqArticleSet.has(st.article) && !extFreqArticleSet.has(st.article)),
    [gcShoeTypes, freqArticleSet, extFreqArticleSet]
  );

  // Derived maps from line pool + GC dept data
  const depNameById = useMemo(() => {
    const m = {};
    if (freqData) {
      freqData.forEach(model => {
        (model.lines     || []).forEach(l => { if (l.dep_name) m[l.line_id] = l.dep_name; });
        (model.gc_lines  || []).forEach(l => { if (l.dep_name) m[l.line_id] = l.dep_name; });
      });
    }
    for (const l of (linePoolData || [])) { if (l.dep_no && l.dep_name) m[l.dep_no] = l.dep_name; }
    for (const d of (gcDeptData   || [])) { if (d.dep_no && d.dep_name && !m[d.dep_no]) m[d.dep_no] = d.dep_name; }
    return m;
  }, [freqData, linePoolData, gcDeptData]);

  const lineTypeFromPool = useMemo(() => {
    const m = {};
    for (const l of (linePoolData || [])) { if (l.dep_no) m[l.dep_no] = l.line_type; }
    return m;
  }, [linePoolData]);

  const floorById = useMemo(() => {
    const m = {};
    for (const l of (linePoolData || [])) { if (l.dep_no && l.floor_id) m[l.dep_no] = l.floor_id; }
    return m;
  }, [linePoolData]);

  const aliasById = useMemo(() => {
    const m = {};
    for (const l of (linePoolData || [])) { if (l.dep_no && l.line_alias) m[l.dep_no] = l.line_alias; }
    return m;
  }, [linePoolData]);

  const { allMayLines, allGoLines, allGcLines } = useMemo(() => {
    const maySet = new Set(); const goSet = new Set(); const gcSet = new Set();
    for (const l of (linePoolData || [])) {
      if (!l.dep_no) continue;
      if (l.line_type === "may") maySet.add(l.dep_no);
      else if (l.line_type === "go") goSet.add(l.dep_no);
    }
    if (freqData) {
      freqData.forEach(m => (m.lines || []).forEach(l => {
        if (lineTypeFromPool[l.line_id]) return;
        const t = lineTypeOf(l.line_id, l.dep_name);
        if (t === "may") maySet.add(l.line_id);
        else if (t === "go") goSet.add(l.line_id);
      }));
    }
    for (const d of (gcDeptData || [])) { if (d.dep_no) gcSet.add(d.dep_no); }
    if (freqData) {
      freqData.forEach(m => (m.gc_lines || []).forEach(l => { if (l.line_id) gcSet.add(l.line_id); }));
    }
    return { allMayLines: [...maySet].sort(), allGoLines: [...goSet].sort(), allGcLines: [...gcSet].sort() };
  }, [linePoolData, freqData, lineTypeFromPool, gcDeptData]);


  function handleRefresh() {
    setRefreshKey(k => k + 1);
    refetchFreq();
    if (noHistArticles.length) refetchExt();
  }

  const TABS = [
    { key: "regular", label: "Đơn thường",   count: regularShoeTypes.length },
    { key: "gc",      label: "Đơn gia công",  count: gcShoeTypes.length      },
    { key: "new",     label: "Model mới",     count: noHistRegularShoeTypes.length + noHistGcShoeTypes.length, warn: true },
  ];

  // Auto-save capacities + priorities to draft run (debounced 1.5 s)
  const saveTimer = useRef(null);
  useEffect(() => {
    if (!draftRunId || readOnly) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      wizardStateApi.putCapacities(draftRunId, {
        working_hours_per_day: workingHoursPerDay,
        cap_choices: capChoices,
      }).catch(() => {});
      wizardStateApi.putPriorities(draftRunId, { priority_config: priorityConfig }).catch(() => {});
      if (Object.keys(importedTargetQty || {}).length) {
        wizardStateApi.putNewModelTargets(draftRunId, { targets: importedTargetQty }).catch(() => {});
      }
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [draftRunId, priorityConfig, capChoices, workingHoursPerDay, importedTargetQty]);

  // Auto-populate capChoices with shoe_target → history defaults for entries not yet explicitly set.
  // Runs once when shoe/freq data is ready; functional update ensures existing user choices are
  // never overwritten (new entries are spread BEFORE prevTab so prev wins on key collision).
  useEffect(() => {
    if (readOnly) return;
    if (!shoeTargetMap || Object.keys(shoeTargetMap).length === 0) return;
    if (!regularShoeTypes.length && !gcShoeTypes.length) return;

    // Build modeQty lookup: "ART||DIE" → { lineId → modeQty }
    const modeQtyByMkLine = {};
    for (const m of (freqData || [])) {
      const mk = `${m.article}||${m.cutting_die || ""}`;
      for (const l of [...(m.lines || []), ...(m.gc_lines || [])]) {
        if ((l.mode_qty ?? 0) > 0) {
          if (!modeQtyByMkLine[mk]) modeQtyByMkLine[mk] = {};
          modeQtyByMkLine[mk][l.line_id] = l.mode_qty;
        }
      }
    }

    const defaultsRegular = {};
    const defaultsGc = {};

    function computeDefaults(shoeTypeList, out) {
      for (const st of shoeTypeList) {
        const mk = st.key;
        const assign = priorityConfig[mk] || {};
        const allLines = [
          ...(assign.may_primary || []),
          ...(assign.may_backup  || []),
          ...(assign.go_primary  || []),
          ...(assign.go_backup   || []),
          ...(assign.gc_primary  || []),
          ...(assign.gc_backup   || []),
        ].filter(Boolean);
        if (!allLines.length) continue;

        let targetQty = 0;
        if (st.style) {
          for (const sn of st.style.split(" / ").map(s => s.trim())) {
            const t = shoeTargetMap[sn] || shoeTargetMap[sn.toLowerCase()];
            if (t && t.pairs_per_hour > 0) {
              targetQty = Math.round(t.pairs_per_hour * (workingHoursPerDay ?? 8));
              break;
            }
          }
        }

        for (const lineId of allLines) {
          const choiceKey = `${lineId}||${mk}`;
          if (targetQty > 0) {
            out[choiceKey] = { mode: "shoe_target", custom_qty: targetQty };
          } else {
            const hist = modeQtyByMkLine[mk]?.[lineId] ?? 0;
            if (hist > 0) out[choiceKey] = { mode: "recommended", custom_qty: hist };
          }
        }
      }
    }

    computeDefaults(regularShoeTypes, defaultsRegular);
    computeDefaults(gcShoeTypes, defaultsGc);

    const hasRegular = Object.keys(defaultsRegular).length > 0;
    const hasGc      = Object.keys(defaultsGc).length > 0;
    if (!hasRegular && !hasGc) return;

    onCapChoicesChange(prev => {
      const prevRegular = prev?.regular || {};
      const prevGc      = prev?.gc      || {};
      // Only add keys that don't already exist in prev (prev always wins)
      const regChanged = hasRegular && Object.keys(defaultsRegular).some(k => !prevRegular[k]);
      const gcChanged  = hasGc      && Object.keys(defaultsGc).some(k => !prevGc[k]);
      if (!regChanged && !gcChanged) return prev;
      return {
        ...prev,
        regular: regChanged ? { ...defaultsRegular, ...prevRegular } : prevRegular,
        gc:      gcChanged  ? { ...defaultsGc,      ...prevGc      } : prevGc,
      };
    });
  }, [shoeTargetMap, priorityConfig, freqData, workingHoursPerDay, regularShoeTypes, gcShoeTypes, readOnly, onCapChoicesChange]); // eslint-disable-line react-hooks/exhaustive-deps

  // Per-tab capChoices helpers
  function makeCapChoicesChange(tabMode) {
    return (updater) => onCapChoicesChange?.(prev => ({
      ...prev,
      [tabMode]: typeof updater === "function" ? updater(prev[tabMode] || {}) : updater,
    }));
  }

  // Common props for PriorityMatrixTab instances
  const matrixProps = {
    freqData, freqLoading,
    lineTypeFromPool, allMayLines, allGoLines, allGcLines,
    depNameById, floorById, aliasById,
    priorityConfig, onPriorityConfigChange,
    showToolbar: true, refreshKey,
    onRefetch: handleRefresh,
    shoeTargetMap,
    workingHoursPerDay,
  };

  return (
    <div className="flex flex-col h-full gap-3" style={{ maxWidth: 1400, margin: "0 auto", width: "100%" }}>
      {readOnly && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg shrink-0">
          <Eye size={12} /> Kế hoạch đã chạy — chỉ xem, không thể chỉnh sửa
        </div>
      )}
      <div className="flex flex-col gap-3 flex-1 min-h-0">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm shrink-0">
        <div className="flex items-center border-b border-gray-200">
          {TABS.map(tab => (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={["flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px",
                activeTab === tab.key
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-500 hover:text-gray-700",
              ].join(" ")}>
              {tab.label}
              {tab.count > 0 && (
                <span className={["text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                  tab.warn && tab.count > 0
                    ? "bg-amber-100 text-amber-700"
                    : activeTab === tab.key
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-500",
                ].join(" ")}>{tab.count}</span>
              )}
            </button>
          ))}
          <div className="flex-1" />
          {/* Working hours per day */}
          <div className="flex items-center gap-1.5 px-3 border-r border-gray-200 py-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">Giờ/ngày:</span>
            <input
              type="number" min="1" max="24"
              className="w-12 px-1.5 py-1 text-xs border border-gray-200 rounded text-center disabled:opacity-50 disabled:cursor-not-allowed"
              value={workingHoursPerDay ?? 8}
              disabled={readOnly}
              onChange={e => !readOnly && onWorkingHoursChange?.(Math.max(1, Math.min(24, Number(e.target.value) || 8)))}
            />
          </div>
          {/* Date range + refresh (shared) */}
          <div className="flex items-center gap-1.5 px-4">
            <input type="date" className="px-2 py-1 text-xs border border-gray-200 rounded"
              value={dateRange.date_from} onChange={e => setDateRange(r => ({ ...r, date_from: e.target.value }))} />
            <span className="text-xs text-gray-400">→</span>
            <input type="date" className="px-2 py-1 text-xs border border-gray-200 rounded"
              value={dateRange.date_to} onChange={e => setDateRange(r => ({ ...r, date_to: e.target.value }))} />
            <button className="p-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
              onClick={handleRefresh} title="Tải lại dữ liệu">
              <RefreshCw size={13} className={freqLoading || extFreqLoading ? "animate-spin text-blue-500" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* Always-mounted tab panels */}
      <div className="flex-1 min-h-0" style={{ display: activeTab === "regular" ? "" : "none" }}>
        <PriorityMatrixTab mode="regular" shoeTypes={regularShoeTypes}
          capChoices={capChoices?.regular || {}}
          onCapChoicesChange={makeCapChoicesChange("regular")}
          readOnly={readOnly}
          {...matrixProps} />
      </div>
      <div className="flex-1 min-h-0" style={{ display: activeTab === "gc" ? "" : "none" }}>
        <PriorityMatrixTab mode="gc" shoeTypes={gcShoeTypes}
          capChoices={capChoices?.gc || {}}
          onCapChoicesChange={makeCapChoicesChange("gc")}
          readOnly={readOnly}
          {...matrixProps} />
      </div>
      <div className="flex-1 min-h-0" style={{ display: activeTab === "new" ? "" : "none" }}>
        <NewModelTab
          noHistRegularShoeTypes={noHistRegularShoeTypes}
          noHistGcShoeTypes={noHistGcShoeTypes}
          freqData={freqData}
          extFreqData={extFreqData}
          freqLoading={freqLoading}
          extFreqLoading={extFreqLoading}
          lineTypeFromPool={lineTypeFromPool}
          allMayLines={allMayLines} allGoLines={allGoLines} allGcLines={allGcLines}
          depNameById={depNameById} floorById={floorById} aliasById={aliasById}
          priorityConfig={priorityConfig} onPriorityConfigChange={onPriorityConfigChange}
          refreshKey={refreshKey}
          importedTargetQty={importedTargetQty}
          onImportedTargetQtyChange={onImportedTargetQtyChange}
          readOnly={readOnly}
        />
      </div>

      </div>{/* end pointer-events wrapper */}

      {/* Navigation */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-3 flex items-center gap-3 shrink-0">
        <button className={`${BTN} bg-white text-gray-700 border-gray-200 hover:bg-gray-50`} onClick={onPrev}>
          <ChevronLeft size={14} /> Bước trước
        </button>
        <div className="flex-1" />
        <span className="text-xs text-gray-400">Cấu hình tự lưu khi chuyển bước</span>
        <button
          disabled={freqLoading || extFreqLoading}
          className={`${BTN} bg-blue-600 text-white border-blue-600 hover:bg-blue-700`}
          onClick={onNext}>
          {freqLoading || extFreqLoading ? (
            <>Đang tải dữ liệu... <Loader2 size={14} className="animate-spin ml-1 inline" /></>
          ) : (
            <>Bước tiếp <ChevronRight size={14} /></>
          )}
        </button>
      </div>
    </div>
  );
}
/**
 * ExcelImportModal — parse an .xlsx/.xls/.csv file client-side,
 * let user pick which column holds order codes, then check against ERP.
 *
 * Props:
 *   onConfirm(foundIds: string[]) — called when user confirms selection
 *   onClose()
 */
import { useState, useRef, useCallback } from "react";
import {
  X, Upload, FileSpreadsheet, ChevronDown, CheckCircle2,
  AlertTriangle, Loader2, ArrowRight,
} from "lucide-react";
import * as XLSX from "xlsx";
import { ordersApi } from "../../../api";

const STEP = { UPLOAD: "upload", PICK: "pick", CHECK: "check", CONFIRM: "confirm" };

function Badge({ children, color = "gray" }) {
  const cls = {
    gray:   "bg-gray-100 text-gray-700",
    green:  "bg-green-100 text-green-700",
    red:    "bg-red-100 text-red-700",
    yellow: "bg-yellow-100 text-yellow-700",
    blue:   "bg-blue-100 text-blue-700",
  }[color];
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{children}</span>;
}

export default function ExcelImportModal({ onConfirm, onClose }) {
  const fileRef        = useRef(null);
  const [step,         setStep]         = useState(STEP.UPLOAD);
  const [fileName,     setFileName]     = useState("");
  const [headers,      setHeaders]      = useState([]);       // column names
  const [rows,         setRows]         = useState([]);       // array of row objects
  const [selectedCol,  setSelectedCol]  = useState("");
  const [parsedCodes,  setParsedCodes]  = useState([]);       // raw codes from selected col
  const [found,        setFound]        = useState([]);
  const [notFound,     setNotFound]     = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [dragOver,     setDragOver]     = useState(false);
  const [error,        setError]        = useState("");

  // ── Parse file ────────────────────────────────────────────────────────────
  const parseFile = useCallback((file) => {
    if (!file) return;
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (!data || data.length < 2) {
          setError("File không có dữ liệu (cần ít nhất 1 dòng header + dữ liệu).");
          return;
        }
        const sheetRange = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]) : null;
        const numCols = sheetRange ? sheetRange.e.c + 1 : (data[0] || []).length;
        const firstRow = data[0] || [];
        const hdrs = Array.from({ length: numCols }, (_, i) =>
          String(firstRow[i] || `Cột ${i + 1}`).trim()
        );
        const dataRows = data.slice(1).map(row =>
          Object.fromEntries(hdrs.map((h, i) => [h, String(row[i] ?? "").trim()]))
        );
        setHeaders(hdrs);
        setRows(dataRows);
        setFileName(file.name);
        // Auto-select first column that looks like order codes
        const guessCol = hdrs.find(h =>
          /order|orderno|mã đ|scbh|đơn/i.test(h)
        ) || hdrs[0];
        setSelectedCol(guessCol);
        setStep(STEP.PICK);
      } catch (err) {
        setError("Không đọc được file. Hãy dùng định dạng .xlsx, .xls hoặc .csv.");
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  function handleFileInput(e) {
    parseFile(e.target.files?.[0]);
    e.target.value = "";
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    parseFile(e.dataTransfer.files?.[0]);
  }

  // ── Extract codes from selected column ───────────────────────────────────
  function extractCodes(col) {
    const codes = rows
      .map(r => String(r[col] ?? "").trim().toUpperCase())
      .filter(Boolean);
    return [...new Set(codes)]; // deduplicate
  }

  // ── Check against ERP ─────────────────────────────────────────────────────
  async function runCheck() {
    const codes = extractCodes(selectedCol);
    if (!codes.length) {
      setError("Cột đã chọn không có dữ liệu.");
      return;
    }
    setParsedCodes(codes);
    setLoading(true);
    setError("");
    try {
      const res = await ordersApi.bulkLookup(codes);
      setFound(res.found || []);
      setNotFound(res.not_found || []);
      setStep(STEP.CONFIRM);
    } catch {
      setError("Lỗi khi kiểm tra với hệ thống. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    // Fetch full order details so knownOrdersMap can be populated in Step 2.
    // page_size capped at 1000 — paginate if needed.
    const PAGE = 1000;
    let orderDetails = [];
    try {
      const totalPages = Math.ceil(found.length / PAGE);
      for (let p = 1; p <= totalPages; p++) {
        const chunk = found.slice((p - 1) * PAGE, p * PAGE);
        const res = await ordersApi.list({
          order_ids: chunk,
          include_sizes: false,
          page_size: PAGE,
        });
        if (res?.items?.length) orderDetails.push(...res.items);
      }
    } catch (_) {
      // non-fatal
    }
    onConfirm(found, orderDetails);
  }

  // ── Preview: first few values in selected column ──────────────────────────
  const previewValues = selectedCol
    ? extractCodes(selectedCol).slice(0, 6)
    : [];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <FileSpreadsheet size={18} className="text-green-600" />
          <span className="font-semibold text-gray-900 text-sm">Import mã đơn từ Excel</span>
          <div className="ml-auto flex items-center gap-3">
            {/* Step indicator */}
            <div className="flex items-center gap-1 text-xs text-gray-400">
              {[
                { k: STEP.UPLOAD,  n: 1, label: "File"    },
                { k: STEP.PICK,    n: 2, label: "Cột"     },
                { k: STEP.CONFIRM, n: 3, label: "Xác nhận" },
              ].map((s, i, arr) => (
                <span key={s.k} className="flex items-center gap-1">
                  <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center
                    ${step === s.k
                      ? "bg-blue-600 text-white"
                      : [STEP.PICK, STEP.CHECK, STEP.CONFIRM].indexOf(step) >= i
                        ? "bg-green-500 text-white"
                        : "bg-gray-100 text-gray-400"}`}>
                    {s.n}
                  </span>
                  <span className={step === s.k ? "text-gray-700 font-medium" : "text-gray-400"}>{s.label}</span>
                  {i < arr.length - 1 && <ArrowRight size={10} className="text-gray-300 mx-0.5" />}
                </span>
              ))}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded p-0.5">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-5 min-h-[240px]">

          {/* ── Step 1: Upload ── */}
          {step === STEP.UPLOAD && (
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
                ${dragOver ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload size={28} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-700">Kéo thả hoặc click để chọn file</p>
              <p className="text-xs text-gray-400 mt-1">.xlsx · .xls · .csv</p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
          )}

          {/* ── Step 2: Pick column ── */}
          {step === STEP.PICK && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                <FileSpreadsheet size={13} className="text-green-500" />
                <span className="font-medium text-gray-700 truncate">{fileName}</span>
                <Badge color="blue">{rows.length} dòng</Badge>
                <Badge color="gray">{headers.length} cột</Badge>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Chọn cột chứa mã đơn hàng
                </label>
                <div className="relative">
                  <select
                    className="w-full px-3 py-2 pr-8 rounded-lg border border-gray-200 text-sm bg-white
                               focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none"
                    value={selectedCol}
                    onChange={e => setSelectedCol(e.target.value)}
                  >
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Preview */}
              {previewValues.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">
                    Xem trước ({extractCodes(selectedCol).length} mã duy nhất):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {previewValues.map(v => (
                      <span key={v} className="px-2 py-0.5 rounded bg-gray-100 text-xs font-mono text-gray-700">{v}</span>
                    ))}
                    {extractCodes(selectedCol).length > 6 && (
                      <span className="px-2 py-0.5 text-xs text-gray-400">+{extractCodes(selectedCol).length - 6} nữa…</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Confirm results ── */}
          {step === STEP.CONFIRM && (
            <div className="flex flex-col gap-4">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3 text-center">
                  <div className="text-2xl font-bold text-gray-800">{parsedCodes.length}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Mã trong file</div>
                </div>
                <div className="rounded-xl border border-green-100 bg-green-50 px-3 py-3 text-center">
                  <div className="text-2xl font-bold text-green-700">{found.length}</div>
                  <div className="text-xs text-green-600 mt-0.5">Tìm thấy</div>
                </div>
                <div className={`rounded-xl border px-3 py-3 text-center
                  ${notFound.length ? "border-red-100 bg-red-50" : "border-gray-100 bg-gray-50"}`}>
                  <div className={`text-2xl font-bold ${notFound.length ? "text-red-600" : "text-gray-400"}`}>
                    {notFound.length}
                  </div>
                  <div className={`text-xs mt-0.5 ${notFound.length ? "text-red-500" : "text-gray-400"}`}>
                    Không tìm thấy
                  </div>
                </div>
              </div>

              {/* Not-found list */}
              {notFound.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-red-600 flex items-center gap-1 mb-1.5">
                    <AlertTriangle size={11} /> Đơn hàng không tồn tại trong hệ thống:
                  </p>
                  <div className="max-h-28 overflow-y-auto rounded-lg border border-red-100 bg-red-50/50 px-3 py-2 flex flex-wrap gap-1.5">
                    {notFound.map(id => (
                      <span key={id} className="px-2 py-0.5 rounded bg-red-100 text-xs font-mono text-red-700">{id}</span>
                    ))}
                  </div>
                </div>
              )}

              {found.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2.5">
                  <AlertTriangle size={14} />
                  Không có đơn hàng nào khớp. Hãy kiểm tra lại cột đã chọn.
                </div>
              )}

              {found.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
                  <CheckCircle2 size={13} />
                  Xác nhận sẽ chọn <strong>{found.length}</strong> đơn hàng tìm thấy vào danh sách.
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-3">
              <AlertTriangle size={12} /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          {step !== STEP.UPLOAD && (
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200
                         text-sm text-gray-600 bg-white hover:bg-gray-50 transition-colors"
              onClick={() => { setStep(STEP.UPLOAD); setError(""); }}>
              ← Đổi file
            </button>
          )}
          <div className="flex-1" />

          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200
                       text-sm text-gray-600 bg-white hover:bg-gray-50 transition-colors"
            onClick={onClose}>
            Hủy
          </button>

          {step === STEP.PICK && (
            <button
              disabled={!selectedCol || loading}
              onClick={runCheck}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg border
                         bg-blue-600 text-white text-sm font-medium hover:bg-blue-700
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {loading
                ? <><Loader2 size={13} className="animate-spin" /> Đang kiểm tra…</>
                : <>Kiểm tra hệ thống <ArrowRight size={13} /></>}
            </button>
          )}

          {step === STEP.CONFIRM && found.length > 0 && (
            <button
              onClick={handleConfirm}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg border
                         bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors">
              <CheckCircle2 size={13} />
              Chọn {found.length} đơn
            </button>
          )}

          {step === STEP.CONFIRM && found.length === 0 && (
            <button
              onClick={() => setStep(STEP.PICK)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-gray-200
                         bg-white text-gray-700 text-sm hover:bg-gray-50 transition-colors">
              ← Chọn lại cột
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

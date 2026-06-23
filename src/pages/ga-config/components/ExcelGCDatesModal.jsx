/**
 * ExcelGCDatesModal — import GC (outsource) start/end dates from Excel.
 *
 * User maps THREE columns:
 *   - Mã đơn hàng (order ID)
 *   - Ngày bắt đầu GC (start date)
 *   - Ngày kết thúc GC (end date)
 *
 * onConfirm({ orderId: { start_date, end_date } })
 */
import { useState, useRef, useCallback } from "react";
import {
  X, Upload, FileSpreadsheet, ChevronDown,
  CheckCircle2, AlertTriangle, ArrowRight, Calendar,
} from "lucide-react";
import * as XLSX from "xlsx";

const STEP = { UPLOAD: "upload", PICK: "pick", CONFIRM: "confirm" };

function guessCol(headers, patterns) {
  return headers.find(h => patterns.some(p => p.test(h))) || "";
}

function parseExcelDate(raw) {
  if (!raw && raw !== 0) return null;
  if (typeof raw === "number") {
    const d = XLSX.SSF.parse_date_code(raw);
    if (!d) return null;
    const mm = String(d.m).padStart(2, "0");
    const dd = String(d.d).padStart(2, "0");
    return `${d.y}-${mm}-${dd}`;
  }
  const s = String(raw).trim();
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return s;
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  return null;
}

function isValidIso(s) {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default function ExcelGCDatesModal({ gcOrderIds, onConfirm, onClose }) {
  const fileRef    = useRef(null);
  const [step,     setStep]     = useState(STEP.UPLOAD);
  const [fileName, setFileName] = useState("");
  const [headers,  setHeaders]  = useState([]);
  const [rawRows,  setRawRows]  = useState([]);
  const [idCol,    setIdCol]    = useState("");
  const [startCol, setStartCol] = useState("");
  const [endCol,   setEndCol]   = useState("");
  const [matched,  setMatched]  = useState({});
  const [skipped,  setSkipped]  = useState([]);
  const [badRows,  setBadRows]  = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [error,    setError]    = useState("");

  const parseFile = useCallback((file) => {
    if (!file) return;
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array", cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });
        if (!data || data.length < 2) {
          setError("File không có dữ liệu (cần ít nhất 1 dòng header + dữ liệu).");
          return;
        }
        const sheetRange = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]) : null;
        const numCols = sheetRange ? sheetRange.e.c + 1 : (data[0] || []).length;
        const hdrs = Array.from({ length: numCols }, (_, i) =>
          String((data[0] || [])[i] || `Cột ${i + 1}`).trim()
        );
        const rows = data.slice(1).map(row =>
          Object.fromEntries(hdrs.map((h, i) => [h, row[i] ?? ""]))
        );
        setHeaders(hdrs);
        setRawRows(rows);
        setFileName(file.name);
        setIdCol(guessCol(hdrs,    [/order|orderno|mã đ|scbh|đơn/i]) || hdrs[0] || "");
        setStartCol(guessCol(hdrs, [/bắt đầu|start|từ ngày|begin/i]) || hdrs[1] || "");
        setEndCol(guessCol(hdrs,   [/kết thúc|end|đến ngày|finish|lhg/i]) || hdrs[2] || "");
        setStep(STEP.PICK);
      } catch {
        setError("Không đọc được file. Hãy dùng .xlsx, .xls hoặc .csv.");
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  function handleFileInput(e) { parseFile(e.target.files?.[0]); e.target.value = ""; }
  function handleDrop(e) { e.preventDefault(); setDragOver(false); parseFile(e.dataTransfer.files?.[0]); }

  const preview = rawRows.slice(0, 5).map(r => ({
    id:    String(r[idCol]    ?? "").trim().toUpperCase(),
    start: parseExcelDate(r[startCol]),
    end:   parseExcelDate(r[endCol]),
  }));

  function runProcess() {
    const matchedMap = {};
    const skippedList = [];
    const badList = [];

    rawRows.forEach(r => {
      const id    = String(r[idCol]    ?? "").trim().toUpperCase();
      const start = parseExcelDate(r[startCol]);
      const end   = parseExcelDate(r[endCol]);
      if (!id) return;
      if (!isValidIso(start) && !isValidIso(end)) { badList.push(id); return; }
      if (!gcOrderIds.has(id)) { skippedList.push(id); return; }
      const entry = {};
      if (isValidIso(start)) entry.start_date = start;
      if (isValidIso(end))   entry.end_date   = end;
      matchedMap[id] = entry;
    });

    setMatched(matchedMap);
    setSkipped([...new Set(skippedList)]);
    setBadRows([...new Set(badList)]);
    setStep(STEP.CONFIRM);
  }

  const matchedCount = Object.keys(matched).length;
  const totalInFile  = new Set(
    rawRows.map(r => String(r[idCol] ?? "").trim().toUpperCase()).filter(Boolean)
  ).size;

  const colsReady = idCol && startCol && endCol &&
    idCol !== startCol && idCol !== endCol;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <FileSpreadsheet size={18} className="text-orange-500" />
          <span className="font-semibold text-gray-900 text-sm">Import ngày gia công từ Excel</span>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs text-gray-400">
              {[
                { k: STEP.UPLOAD,  n: 1, label: "File"    },
                { k: STEP.PICK,    n: 2, label: "Cột"     },
                { k: STEP.CONFIRM, n: 3, label: "Kết quả" },
              ].map((s, i, arr) => (
                <span key={s.k} className="flex items-center gap-1">
                  <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                    step === s.k
                      ? "bg-orange-500 text-white"
                      : [STEP.PICK, STEP.CONFIRM].indexOf(step) >= i
                        ? "bg-green-500 text-white"
                        : "bg-gray-100 text-gray-400"
                  }`}>{s.n}</span>
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
        <div className="px-5 py-5 min-h-[280px]">

          {/* Step 1: Upload */}
          {step === STEP.UPLOAD && (
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                dragOver ? "border-orange-400 bg-orange-50" : "border-gray-200 hover:border-orange-300 hover:bg-gray-50"
              }`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload size={28} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-700">Kéo thả hoặc click để chọn file</p>
              <p className="text-xs text-gray-400 mt-1">.xlsx · .xls · .csv</p>
              <p className="text-xs text-gray-400 mt-3">
                Cấu trúc file: <span className="font-mono">Mã đơn | Ngày bắt đầu GC | Ngày kết thúc GC</span>
              </p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileInput} />
            </div>
          )}

          {/* Step 2: Pick columns */}
          {step === STEP.PICK && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                <FileSpreadsheet size={13} className="text-orange-500" />
                <span className="font-medium text-gray-700 truncate">{fileName}</span>
                <span className="ml-auto shrink-0">{rawRows.length} dòng · {headers.length} cột</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Mã đơn hàng",     value: idCol,    set: setIdCol,    accent: "blue"   },
                  { label: "Ngày bắt đầu GC",  value: startCol, set: setStartCol, accent: "orange" },
                  { label: "Ngày kết thúc GC", value: endCol,   set: setEndCol,   accent: "orange" },
                ].map(({ label, value, set, accent }) => (
                  <div key={label}>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">{label}</label>
                    <div className="relative">
                      <select
                        className={`w-full px-3 py-2 pr-8 rounded-lg border text-xs bg-white
                          focus:outline-none focus:ring-2 appearance-none ${
                          accent === "orange"
                            ? "border-orange-200 focus:ring-orange-400"
                            : "border-gray-200 focus:ring-blue-400"
                        }`}
                        value={value}
                        onChange={e => set(e.target.value)}
                      >
                        <option value="">— Chọn cột —</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                ))}
              </div>

              {preview.length > 0 && idCol && (startCol || endCol) && (
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">Xem trước ({rawRows.length} dòng):</p>
                  <div className="rounded-lg border border-gray-100 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500">
                          <th className="px-3 py-1.5 text-left font-medium">Mã đơn</th>
                          <th className="px-3 py-1.5 text-left font-medium">Bắt đầu GC</th>
                          <th className="px-3 py-1.5 text-left font-medium">Kết thúc GC</th>
                          <th className="px-3 py-1.5 text-center font-medium">OK?</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row, i) => {
                          const ok = row.id && (isValidIso(row.start) || isValidIso(row.end));
                          return (
                            <tr key={i} className="border-t border-gray-50">
                              <td className="px-3 py-1.5 font-mono text-gray-800">{row.id || "—"}</td>
                              <td className="px-3 py-1.5 text-gray-700">
                                {row.start || (startCol ? <span className="text-red-400">Lỗi</span> : "—")}
                              </td>
                              <td className="px-3 py-1.5 text-gray-700">
                                {row.end || (endCol ? <span className="text-red-400">Lỗi</span> : "—")}
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                {ok
                                  ? <CheckCircle2 size={12} className="mx-auto text-green-500" />
                                  : <AlertTriangle size={12} className="mx-auto text-red-400" />}
                              </td>
                            </tr>
                          );
                        })}
                        {rawRows.length > 5 && (
                          <tr className="border-t border-gray-50">
                            <td colSpan={4} className="px-3 py-1.5 text-center text-gray-400 italic">
                              +{rawRows.length - 5} dòng nữa…
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Results */}
          {step === STEP.CONFIRM && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Trong file",  value: totalInFile,    color: "gray"   },
                  { label: "Khớp & nhập", value: matchedCount,   color: "green"  },
                  { label: "Bỏ qua",      value: skipped.length + badRows.length, color: skipped.length + badRows.length > 0 ? "yellow" : "gray" },
                ].map(c => (
                  <div key={c.label} className={`rounded-xl border px-2 py-3 text-center ${
                    c.color === "green"  ? "border-green-100 bg-green-50"  :
                    c.color === "yellow" ? "border-amber-100 bg-amber-50"  :
                                          "border-gray-100 bg-gray-50"
                  }`}>
                    <div className={`text-xl font-bold ${
                      c.color === "green"  ? "text-green-700"  :
                      c.color === "yellow" ? "text-amber-700"  :
                                             "text-gray-700"
                    }`}>{c.value}</div>
                    <div className={`text-[10px] mt-0.5 ${
                      c.color === "green"  ? "text-green-600"  :
                      c.color === "yellow" ? "text-amber-600"  :
                                             "text-gray-500"
                    }`}>{c.label}</div>
                  </div>
                ))}
              </div>

              {skipped.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-amber-600 flex items-center gap-1 mb-1">
                    <AlertTriangle size={11} /> Không nằm trong danh sách GC:
                  </p>
                  <div className="max-h-16 overflow-y-auto rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 flex flex-wrap gap-1.5">
                    {skipped.map(id => (
                      <span key={id} className="px-2 py-0.5 rounded bg-amber-100 text-[10px] font-mono text-amber-700">{id}</span>
                    ))}
                  </div>
                </div>
              )}

              {badRows.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-red-600 flex items-center gap-1 mb-1">
                    <AlertTriangle size={11} /> Cả hai ngày đều không đọc được:
                  </p>
                  <div className="max-h-16 overflow-y-auto rounded-lg border border-red-100 bg-red-50/50 px-3 py-2 flex flex-wrap gap-1.5">
                    {badRows.map(id => (
                      <span key={id} className="px-2 py-0.5 rounded bg-red-100 text-[10px] font-mono text-red-700">{id}</span>
                    ))}
                  </div>
                </div>
              )}

              {matchedCount === 0 ? (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2.5">
                  <AlertTriangle size={14} />
                  Không có đơn nào khớp. Kiểm tra lại cột mã đơn hoặc danh sách Step 1.
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
                  <CheckCircle2 size={13} />
                  Xác nhận sẽ cập nhật ngày GC cho <strong>{matchedCount}</strong> đơn hàng.
                </div>
              )}
            </div>
          )}

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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 bg-white hover:bg-gray-50 transition-colors"
              onClick={() => { setStep(STEP.UPLOAD); setError(""); }}>
              ← Đổi file
            </button>
          )}
          <div className="flex-1" />
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 bg-white hover:bg-gray-50 transition-colors"
            onClick={onClose}>
            Hủy
          </button>

          {step === STEP.PICK && (
            <button
              disabled={!colsReady}
              onClick={runProcess}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              Xử lý <ArrowRight size={13} />
            </button>
          )}

          {step === STEP.CONFIRM && matchedCount > 0 && (
            <button
              onClick={() => onConfirm(matched)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors">
              <Calendar size={13} />
              Cập nhật {matchedCount} đơn
            </button>
          )}

          {step === STEP.CONFIRM && matchedCount === 0 && (
            <button
              onClick={() => setStep(STEP.PICK)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm hover:bg-gray-50 transition-colors">
              ← Chọn lại cột
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

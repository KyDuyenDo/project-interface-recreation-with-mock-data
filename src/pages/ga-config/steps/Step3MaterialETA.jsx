import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Info, X, Loader2, FileSpreadsheet, Eye } from "lucide-react";
import { useWizardMaterialEtas } from "../../../hooks/useWizard";
import ExcelNvlImportModal from "../components/ExcelNvlImportModal";

const BTN    = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SM = "inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const INPUT  = "px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors";
const BADGE  = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium";

export default function Step3MaterialETA({ selectedIds, materialEtaOverrides, setMaterialEtaOverrides, onPrev, onNext, readOnly = false }) {
  const [showImport, setShowImport] = useState(false);
  const orderList = useMemo(() => [...selectedIds], [selectedIds]);
  const { data: etaRows, isLoading } = useWizardMaterialEtas(orderList);

  const dbEtaMap = useMemo(() => {
    const m = {};
    (Array.isArray(etaRows) ? etaRows : []).forEach(r => { if (r.order_id) m[r.order_id] = r; });
    return m;
  }, [etaRows]);

  function setEta(id, date) {
    setMaterialEtaOverrides(prev => {
      const next = { ...prev };
      date ? (next[id] = date) : delete next[id];
      return next;
    });
  }

  const emptyContent = selectedIds.size === 0 ? (
    <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm bg-amber-50 text-amber-800 border border-amber-100">
      <Info size={14} className="shrink-0 mt-0.5" /> Chưa chọn đơn — quay lại Bước 1
    </div>
  ) : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm max-w-[1180px] mx-auto">
      {/* Head */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-gray-100">
        <div className="flex-1">
          <div className="text-sm font-semibold text-gray-900">Bước 3 · NVL về</div>
          <div className="text-xs text-gray-500 mt-0.5">Nhập ngày dự kiến NVL về — lịch sẽ tránh bố trí may trước ngày đó.</div>
        </div>
        {readOnly && (
          <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200">
            <Eye size={11} /> Chỉ xem
          </span>
        )}
        <div className="ml-auto">
          <button
            className={`${BTN_SM} bg-green-50 text-green-700 border-green-200 hover:bg-green-100`}
            onClick={() => setShowImport(true)}
            disabled={selectedIds.size === 0 || readOnly}>
            <FileSpreadsheet size={13} /> Import Excel
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {emptyContent ?? (
          <>
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm bg-blue-50 text-blue-800 border border-blue-100 mb-4">
              <Info size={15} className="shrink-0 mt-0.5" />
              <span>
                Mặc định mọi đơn là OK (vật liệu sẵn sàng). Nhập ngày dự kiến nếu NVL chưa về —
                lịch sẽ tránh bố trí may trước ngày đó.
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-600 mb-3">
              <span className={`${BADGE} bg-green-100 text-green-700`}>OK</span>
              {selectedIds.size - Object.keys(materialEtaOverrides).length} đơn
              <span className={`${BADGE} bg-amber-100 text-amber-700 ml-2`}>Dự kiến</span>
              {Object.keys(materialEtaOverrides).length} đơn
            </div>

            {isLoading ? (
              <div className="py-8 text-center text-gray-400">
                <Loader2 size={24} className="animate-spin mx-auto text-blue-500" />
              </div>
            ) : (
              <div className="max-h-[55vh] overflow-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {["ORDERNO", "DB (hiện có)", "Override (lần chạy này)", "Trạng thái"].map((h, i) => (
                        <th key={h} className={`px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide ${i >= 2 ? "text-center" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...selectedIds].map(id => {
                      const db       = dbEtaMap[id];
                      const override = materialEtaOverrides[id] ?? "";
                      return (
                        <tr key={id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono text-xs font-semibold text-gray-900">{id}</td>
                          <td className="px-3 py-2 text-center">
                            {db?.eta_date
                              ? <span className={`${BADGE} bg-blue-100 text-blue-700`}>{db.eta_date}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <input
                                className={`${INPUT}`}
                                style={{ width: 160 }}
                                type="date"
                                value={override}
                                disabled={readOnly}
                                onChange={e => setEta(id, e.target.value)}
                              />
                              {override && !readOnly && (
                                <button
                                  className={`${BTN_SM} bg-transparent border-transparent text-gray-400 hover:bg-gray-100`}
                                  onClick={() => setEta(id, "")}>
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`${BADGE} ${override ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                              {override ? "Dự kiến" : "OK"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 px-5 py-3 border-t border-gray-100 bg-gray-50">
        <button className={`${BTN} bg-white text-gray-700 border-gray-200 hover:bg-gray-50`} onClick={onPrev}>
          <ChevronLeft size={14} /> Bước trước
        </button>
        <div className="flex-1" />
        <button className={`${BTN} bg-blue-600 text-white border-blue-600 hover:bg-blue-700`} onClick={onNext}>
          Bước tiếp <ChevronRight size={14} />
        </button>
      </div>

      {showImport && (
        <ExcelNvlImportModal
          selectedIds={selectedIds}
          onClose={() => setShowImport(false)}
          onConfirm={(etaMap) => {
            setMaterialEtaOverrides(prev => ({ ...prev, ...etaMap }));
            setShowImport(false);
          }}
        />
      )}
    </div>
  );
}

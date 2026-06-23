import { useState } from "react";
import { X, Loader2, Check } from "lucide-react";
import { useImpactAnalysis, useEditGene } from "../../../hooks/useRuns";

const BTN = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const INPUT = "w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors";

export default function ImpactDialog({ runId, target, onClose, onApply }) {
  const [line,    setLine]    = useState(target.line_go ?? target.line_may ?? "");
  const [goStart, setGoStart] = useState(target.go_start ?? "");
  const [goEnd,   setGoEnd]   = useState(target.go_end ?? "");

  const impactMut  = useImpactAnalysis(runId);
  const editGeneMut = useEditGene(runId);
  const impact = impactMut.data;
  const dirty  = line !== (target.line_go ?? target.line_may) || goStart !== target.go_start || goEnd !== target.go_end;

  function reset(setter, val) { setter(val); impactMut.reset(); }

  function analyze() {
    impactMut.mutate({ order_id: target.order_id ?? target.scbh, line_go: line, go_start: goStart, go_end: goEnd });
  }

  function apply() {
    editGeneMut.mutate(
      { orderId: target.order_id ?? target.scbh, body: { line_go: line, go_start: goStart, go_end: goEnd } },
      { onSuccess: () => { onApply?.(); onClose(); } },
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-900">
              Sửa lịch · {target.order_id ?? target.scbh}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {target.article} · {(target.qty_total ?? 0).toLocaleString()} đôi · CRD {target.crd ?? "—"}
            </div>
          </div>
          <button className={`${BTN} border-transparent bg-transparent text-gray-400 hover:bg-gray-100 p-1.5`} onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Chuyền gò",    val: line,    orig: target.line_go ?? target.line_may, type: "text", set: v => reset(setLine, v) },
              { label: "Ngày bắt đầu", val: goStart, orig: target.go_start, type: "date", set: v => reset(setGoStart, v) },
              { label: "Ngày kết thúc", val: goEnd,  orig: target.go_end,   type: "date", set: v => reset(setGoEnd, v) },
            ].map(f => (
              <div key={f.label}>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  {f.label}{" "}
                  {f.val !== f.orig && <span className="text-amber-600">(thay đổi)</span>}
                </label>
                <input className={INPUT} type={f.type} value={f.val} onChange={e => f.set(e.target.value)} />
              </div>
            ))}
          </div>

          {dirty && !impact && (
            <button className={`${BTN} bg-white text-gray-700 border-gray-200 hover:bg-gray-50`} onClick={analyze} disabled={impactMut.isPending}>
              {impactMut.isPending
                ? <><Loader2 size={13} className="animate-spin" /> Đang phân tích…</>
                : "Phân tích tác động"}
            </button>
          )}

          {impact && (
            <div className="mt-3 bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 text-sm font-semibold text-gray-700">
                Tác động lên {impact.n_affected ?? 0} đơn
              </div>
              <div className="grid grid-cols-3 divide-x divide-gray-100 text-center py-3">
                <div className="px-4">
                  <div className="text-xs text-gray-400 mb-1">Delta fitness</div>
                  <div className={`text-2xl font-bold ${(impact.fitness_delta ?? 0) < 0 ? "text-green-700" : "text-red-700"}`}>
                    {(impact.fitness_delta ?? 0) > 0 ? "+" : ""}{impact.fitness_delta ?? "—"}
                  </div>
                </div>
                <div className="px-4">
                  <div className="text-xs text-gray-400 mb-1">On-time trước→sau</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {impact.ontime_before ?? "—"} → {impact.ontime_after ?? "—"}
                  </div>
                </div>
                <div className="px-4">
                  <div className="text-xs text-gray-400 mb-1">Xung đột mới</div>
                  <div className={`text-2xl font-bold ${(impact.conflicts ?? 0) > 0 ? "text-red-700" : "text-green-700"}`}>
                    {impact.conflicts ?? 0}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button className={`${BTN} bg-white text-gray-700 border-gray-200 hover:bg-gray-50`} onClick={onClose}>Hủy</button>
          <button
            className={`${BTN} bg-blue-600 text-white border-blue-600 hover:bg-blue-700`}
            disabled={!dirty || editGeneMut.isPending}
            onClick={apply}>
            {editGeneMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {" "}Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
}

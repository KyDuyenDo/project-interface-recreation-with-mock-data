import { useState, useEffect } from "react";
import { X, Check, AlertTriangle, Loader2, Calendar } from "lucide-react";
import { useAcceptRun, useSchedulePeriods, useCreatePeriod, useRunGenes } from "../../../hooks";
import { vnToday, vnNow } from "../../../utils";

const BTN   = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const INPUT = "px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors w-full";
const NEW_SENTINEL = "__new__";

export default function AcceptRunDialog({ run, onClose, onAccept }) {
  const today = vnToday();
  const [note,             setNote]             = useState(`Lịch hiện hành — ${today}`);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [newLabel, setNewLabel] = useState(() => {
    const d = vnNow();
    return `Lịch chính thức T${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
  });
  const [newStart, setNewStart] = useState("");
  const [newEnd,   setNewEnd]   = useState("");

  const { data: periodsData }               = useSchedulePeriods();
  const { mutate: createPeriod, isPending: isCreating } = useCreatePeriod();
  const { mutate: acceptRun,    isPending: isAccepting } = useAcceptRun();
  const { data: genes }                     = useRunGenes(run?.id);

  const periods   = periodsData?.items || periodsData || [];
  const isPending = isCreating || isAccepting;
  const isNew     = selectedPeriodId === NEW_SENTINEL;

  useEffect(() => {
    if (isNew && genes && genes.length > 0) {
      let minDate = null;
      let maxDate = null;

      genes.forEach(g => {
        const dates = [g.sew_start, g.sew_end, g.go_start, g.go_end].filter(Boolean);
        dates.forEach(d => {
          const dateStr = d.slice(0, 10);
          if (!minDate || dateStr < minDate) minDate = dateStr;
          if (!maxDate || dateStr > maxDate) maxDate = dateStr;
        });
      });

      if (minDate) setNewStart(minDate);
      if (maxDate) setNewEnd(maxDate);
    }
  }, [isNew, genes]);

  const canSubmit = !isPending && (
    (selectedPeriodId && !isNew) ||
    (isNew && newLabel && newStart && newEnd)
  );

  const handleAccept = () => {
    const doAccept = (periodId) =>
      acceptRun({ id: run.id, note, period_id: periodId }, {
        onSuccess: () => { onClose(); onAccept?.(); },
      });

    if (isNew) {
      createPeriod(
        { label: newLabel, period_start: newStart, period_end: newEnd },
        { onSuccess: (p) => doAccept(p.id) },
      );
    } else {
      doAccept(+selectedPeriodId);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex-1 text-sm font-semibold text-gray-900">
            Chấp nhận lịch{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">#{run.id}</code>
          </div>
          <button className={`${BTN} border-transparent bg-transparent text-gray-400 hover:bg-gray-100 p-1.5`} onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Run summary */}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-gray-500">Run</dt>
            <dd className="font-medium text-gray-900"><strong>#{run.id}</strong> · {run.label}</dd>
            <dt className="text-gray-500">Đơn đã lập</dt>
            <dd className="font-medium text-gray-900">{run.scheduled_count ?? "—"}</dd>
            <dt className="text-gray-500">On-time</dt>
            <dd className="font-medium text-gray-900">{run.on_time_pct != null ? `${run.on_time_pct}%` : "—"}</dd>
          </dl>

          {/* Period selector */}
          <div>
            <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1.5">
              <Calendar size={12} /> Giai đoạn lập lịch
            </label>
            <select className={INPUT} value={selectedPeriodId} onChange={e => setSelectedPeriodId(e.target.value)}>
              <option value="">— Chọn giai đoạn —</option>
              {periods.map(p => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.period_start && p.period_end
                    ? ` · ${p.period_start.slice(0, 10)} – ${p.period_end.slice(0, 10)}`
                    : ""}
                </option>
              ))}
              <option value={NEW_SENTINEL}>+ Tạo giai đoạn mới…</option>
            </select>
          </div>

          {/* New period inline form */}
          {isNew && (
            <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 space-y-2">
              <div className="text-xs font-medium text-violet-700">Giai đoạn mới</div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">Nhãn</label>
                <input
                  className={INPUT}
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  placeholder="VD: Lịch chính thức T05/2026"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Ngày bắt đầu</label>
                  <input type="date" className={INPUT} value={newStart} onChange={e => setNewStart(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Ngày kết thúc</label>
                  <input type="date" className={INPUT} value={newEnd} onChange={e => setNewEnd(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Ghi chú</label>
            <input className={INPUT} value={note} onChange={e => setNote(e.target.value)} />
          </div>

          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm bg-amber-50 text-amber-800 border border-amber-100">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            Lịch hiện tại trong giai đoạn sẽ bị đánh dấu "đã thay thế". Thao tác ghi vào nhật ký kiểm toán.
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button className={`${BTN} bg-white text-gray-700 border-gray-200 hover:bg-gray-50`} onClick={onClose}>
            Hủy
          </button>
          <button
            className={`${BTN} bg-blue-600 text-white border-blue-600 hover:bg-blue-700`}
            disabled={!canSubmit}
            onClick={handleAccept}>
            {isPending
              ? <Loader2 size={13} className="animate-spin" />
              : <Check size={13} />}
            {isNew ? "Tạo giai đoạn & Chấp nhận" : "Chấp nhận lịch"}
          </button>
        </div>
      </div>
    </div>
  );
}

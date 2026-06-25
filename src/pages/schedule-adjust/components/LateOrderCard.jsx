import { AlertCircle, MessageSquare } from "lucide-react";
import { clsx } from "clsx";
import { fmtDate } from "../../../utils";

const DELAY_COLOR_CFG = {
  orange: { badge: "bg-orange-100 text-orange-700 border-orange-200", bar: "border-l-orange-400" },
  amber: { badge: "bg-amber-100 text-amber-700 border-amber-200", bar: "border-l-amber-400" },
  purple: { badge: "bg-purple-100 text-purple-700 border-purple-200", bar: "border-l-purple-400" },
  blue: { badge: "bg-blue-100 text-blue-700 border-blue-200", bar: "border-l-blue-400" },
  red: { badge: "bg-red-100 text-red-700 border-red-200", bar: "border-l-red-400" },
  slate: { badge: "bg-slate-100 text-slate-600 border-slate-200", bar: "border-l-slate-300" },
};

export default function LateOrderCard({ order, note, onNoteChange }) {
  const cfg = DELAY_COLOR_CFG[order.delay_color] || DELAY_COLOR_CFG.slate;

  return (
    <div className={clsx("rounded-xl border border-slate-200 border-l-4 bg-white p-4 flex flex-col gap-2.5", cfg.bar)}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-bold text-slate-800">{order.order_id}</span>
            {order.article && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-xs text-slate-500 truncate">{order.article}</span>
              </>
            )}
            {order.customer && <span className="text-xs text-slate-400 italic truncate">{order.customer}</span>}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px]">
            <span className="text-slate-500">
              CRD: <strong className="text-red-600">{fmtDate(order.crd)}</strong>
            </span>
            {order.go_end && (
              <span className="text-slate-500">
                Gò xong: <strong className="text-slate-700">{fmtDate(order.go_end)}</strong>
              </span>
            )}
            {order.days_late > 0 && (
              <span className="inline-flex items-center gap-1 font-bold text-red-600">
                <AlertCircle size={10} /> +{order.days_late} ngày
              </span>
            )}
          </div>
        </div>
        {order.delay_label && (
          <span className={clsx("shrink-0 rounded-full border text-[10px] font-semibold px-2.5 py-0.5 whitespace-nowrap", cfg.badge)}>
            {order.delay_label}
          </span>
        )}
      </div>

      {/* System delay note */}
      {order.delay_note && (
        <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 leading-relaxed border border-slate-100">
          {order.delay_note}
        </p>
      )}

      {/* Planner note input */}
      <div className="flex items-start gap-2">
        <MessageSquare size={12} className="text-slate-400 shrink-0 mt-2" />
        <textarea
          rows={2}
          value={note}
          onChange={e => onNoteChange(order.order_id, e.target.value)}
          placeholder="Thêm ghi chú xử lý của planner..."
          className="flex-1 text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 placeholder:text-slate-300 transition"
        />
      </div>
    </div>
  );
}

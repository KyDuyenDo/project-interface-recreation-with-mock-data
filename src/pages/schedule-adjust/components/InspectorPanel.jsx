import { useState } from "react";
import { ArrowLeft, Lock, AlertTriangle } from "lucide-react";
import { clsx } from "clsx";
import { useToast } from "../../../components/ui/overlays";
import { fmtDate } from "../../../utils";

const FROZEN_UNTIL = "2026-06-25";

export default function InspectorPanel({ order, onClose }) {
  const [note, setNote] = useState("");
  const toast = useToast();

  if (!order) return null;
  const isLate = order.crd && order.go_end > order.crd;
  const isFrozen = order.go_start && order.go_start <= FROZEN_UNTIL;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 shrink-0 bg-white">
        <button onClick={onClose} className="rounded-md p-1 hover:bg-slate-100 text-slate-500 transition">
          <ArrowLeft size={15} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-xs font-semibold text-slate-800 truncate">{order.order_id}</div>
          <div className="text-[10px] text-slate-400 truncate">{order.article}</div>
        </div>
        {isLate && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 shrink-0">
            <AlertTriangle size={10} /> Trễ
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5 text-xs bg-white">
        {[
          ["Khách hàng", order.customer || "—"],
          ["Chuyền gò", order.line_go || order.line || "—"],
          ["Chuyền may", order.line_may || "—"],
          ["Số lượng", order.qty_total ? order.qty_total.toLocaleString("vi-VN") + " đôi" : "—"],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <span className="text-slate-400 shrink-0">{k}</span>
            <span className="font-medium text-slate-700 text-right">{v}</span>
          </div>
        ))}
        <hr className="border-slate-100" />
        {[
          ["Bắt đầu gò", fmtDate(order.go_start), false],
          ["Kết thúc gò", fmtDate(order.go_end), false],
          ["CRD", fmtDate(order.crd), isLate],
        ].map(([k, v, hi]) => (
          <div key={k} className="flex justify-between gap-2">
            <span className="text-slate-400 shrink-0">{k}</span>
            <span className={clsx("font-medium text-right", hi ? "text-red-600" : "text-slate-700")}>{v}</span>
          </div>
        ))}
        <hr className="border-slate-100" />
        {isFrozen ? (
          <div className="flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
            <Lock size={12} className="text-slate-400 shrink-0 mt-0.5" />
            <p className="text-slate-500 leading-snug">
              Đơn này đang trong <strong>vùng đóng băng</strong> — đã vào sản xuất.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block font-medium text-slate-600">Ghi chú điều chỉnh</label>
            <textarea
              rows={3}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Lý do điều chỉnh..."
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
            />
            <button
              onClick={() => {
                toast("Đã lưu ghi chú", "success");
                onClose();
              }}
              className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
            >
              Lưu ghi chú
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

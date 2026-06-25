import { useState } from "react";
import { Check, X, RotateCcw, Clock, CheckCircle2, AlertTriangle, Layers } from "lucide-react";
import { clsx } from "clsx";
import RejectDialog from "./RejectDialog";

const BTN_XS = "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const REASON_LABEL = { wrong_model: "Sai dạng giày", no_capacity: "Không đủ năng lực" };

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function DecisionBadge({ decision }) {
  if (!decision || decision.status === null) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border bg-gray-50 text-gray-400 border-gray-200">
        <Clock size={10} /> Chưa đánh giá
      </span>
    );
  }
  if (decision.status === "accepted") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
        <CheckCircle2 size={10} /> Dự kiến chấp nhận
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border bg-red-50 text-red-600 border-red-200">
      <AlertTriangle size={10} /> Dự kiến từ chối
    </span>
  );
}

export default function OrdersTable({ orders, isSupport, decisions, onAccept, onReject, onUndo, submitted }) {
  const [rejectTarget, setRejectTarget] = useState(null);

  if (!orders.length) {
    return (
      <div className="flex items-center justify-center py-6 text-xs text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
        Không có đơn hàng {isSupport ? "phụ" : "chính"} nào
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Mã đơn</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Article</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Model</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-500">Sản lượng</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Deadline</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Ngày SX</th>
              {isSupport && <th className="px-3 py-2 text-left font-semibold text-gray-500">Chuyền chính</th>}
              <th className="px-3 py-2 text-left font-semibold text-gray-500 min-w-[200px]">Đánh giá</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o, i) => {
              const dec = decisions[o.order_id] || { status: null };
              const isEvaluated = dec.status !== null && dec.status !== undefined;
              return (
                <tr key={o.id || o.order_id}
                  className={clsx("border-b border-gray-100 transition-colors",
                    dec.status === "accepted" ? "bg-emerald-50/40" :
                    dec.status === "rejected" ? "bg-red-50/30" :
                    i % 2 === 0 ? "bg-white hover:bg-blue-50/20" : "bg-gray-50/40 hover:bg-blue-50/20"
                  )}>
                  <td className="px-3 py-2.5 font-mono font-bold text-blue-700">{o.order_id || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-600">{o.article || "—"}</td>
                  <td className="px-3 py-2.5 font-medium text-gray-800">{o.model || "—"}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-gray-900">
                    {o.qty ? o.qty.toLocaleString() : "—"}
                    <span className="text-gray-400 font-normal ml-0.5">đôi</span>
                  </td>
                  <td className={clsx("px-3 py-2.5 font-medium",
                    o.crd && new Date(o.crd) < new Date() ? "text-red-600" : "text-gray-700"
                  )}>{fmtDate(o.crd)}</td>
                  <td className="px-3 py-2.5 text-gray-500">
                    {o.prod_start ? `${fmtDate(o.prod_start)} → ${fmtDate(o.prod_end)}` : "—"}
                  </td>
                  {isSupport && (
                    <td className="px-3 py-2.5">
                      {o.main_line_id ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                          <Layers size={9} /> {o.main_line_id}
                        </span>
                      ) : "—"}
                    </td>
                  )}
                  <td className="px-3 py-2.5">
                    {submitted ? (
                      <DecisionBadge decision={dec} />
                    ) : !isEvaluated ? (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => onAccept(o.order_id)}
                          className={`${BTN_XS} bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100`}>
                          <Check size={10} /> Chấp nhận
                        </button>
                        <button onClick={() => setRejectTarget(o)}
                          className={`${BTN_XS} bg-red-50 text-red-600 border-red-200 hover:bg-red-100`}>
                          <X size={10} /> Từ chối
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <DecisionBadge decision={dec} />
                        {dec.status === "rejected" && dec.reason && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-600 border border-red-200 font-medium">
                            {REASON_LABEL[dec.reason] || dec.reason}
                          </span>
                        )}
                        <button onClick={() => onUndo(o.order_id)}
                          className={`${BTN_XS} bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100`}
                          title="Hoàn tác đánh giá">
                          <RotateCcw size={9} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rejectTarget && (
        <RejectDialog
          orderId={rejectTarget.order_id}
          orderLabel={`${rejectTarget.order_id} · ${rejectTarget.model || ""}`}
          onClose={() => setRejectTarget(null)}
          onConfirm={(reason, note) => {
            onReject(rejectTarget.order_id, reason, note);
            setRejectTarget(null);
          }}
        />
      )}
    </>
  );
}

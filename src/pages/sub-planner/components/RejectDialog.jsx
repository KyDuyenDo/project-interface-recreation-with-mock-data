import { useState } from "react";
import { AlertTriangle, X, ShieldAlert, TrendingDown, Check, MessageSquare } from "lucide-react";
import { clsx } from "clsx";

const BTN_SM = "inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const REJECT_REASONS = [
  { key: "wrong_model",  label: "Sai dạng giày",    desc: "Model được phân công không phù hợp với năng lực của chuyền.", Icon: ShieldAlert, color: "red" },
  { key: "no_capacity",  label: "Không đủ năng lực", desc: "Sản lượng vượt quá công suất của chuyền trong giai đoạn này.", Icon: TrendingDown, color: "orange" },
];

export default function RejectDialog({ orderId, orderLabel, onClose, onConfirm }) {
  const [reason, setReason] = useState(null);
  const [note,   setNote]   = useState("");
  const colorMap = {
    red:    { border: "border-red-300",    bg: "bg-red-50",    text: "text-red-700",    ring: "ring-red-200" },
    orange: { border: "border-orange-300", bg: "bg-orange-50", text: "text-orange-700", ring: "ring-orange-200" },
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            <div>
              <div className="text-sm font-bold text-gray-900">Từ chối đơn hàng</div>
              <div className="text-[11px] text-gray-400 font-mono">{orderLabel || orderId}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X size={15} /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-500">Chọn lý do từ chối đơn hàng này:</p>
          {REJECT_REASONS.map(r => {
            const c = colorMap[r.color];
            const sel = reason === r.key;
            return (
              <button key={r.key} onClick={() => setReason(r.key)}
                className={clsx("w-full text-left p-3 rounded-xl border-2 transition-all",
                  sel ? `${c.border} ${c.bg} ring-2 ${c.ring}` : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                )}>
                <div className="flex items-center gap-2 mb-1">
                  <r.Icon size={15} className={sel ? c.text : "text-gray-400"} />
                  <span className={clsx("text-sm font-semibold", sel ? c.text : "text-gray-700")}>{r.label}</span>
                  {sel && <Check size={13} className={c.text + " ml-auto"} />}
                </div>
                <p className="text-xs text-gray-500 ml-6">{r.desc}</p>
              </button>
            );
          })}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              <MessageSquare size={11} className="inline mr-1" />Ghi chú thêm (tuỳ chọn)
            </label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-300 resize-none"
              placeholder="Mô tả chi tiết vấn đề..."
            />
          </div>
        </div>
        <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className={`${BTN_SM} bg-white text-gray-600 border-gray-200 hover:bg-gray-50 flex-1 justify-center`}>Huỷ</button>
          <button disabled={!reason} onClick={() => { onConfirm(reason, note); onClose(); }}
            className={`${BTN_SM} bg-red-600 text-white border-red-600 hover:bg-red-700 flex-1 justify-center`}>
            <X size={12} /> Xác nhận từ chối
          </button>
        </div>
      </div>
    </div>
  );
}

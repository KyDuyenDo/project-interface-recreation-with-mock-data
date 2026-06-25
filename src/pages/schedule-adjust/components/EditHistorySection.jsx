import { History } from "lucide-react";
import { clsx } from "clsx";
import { fmtDate } from "../../../utils";

export default function EditHistorySection({ edits }) {
  const LABELS = { move: "Di chuyển", add: "Thêm mới", delete: "Xóa", qty_change: "Sửa SL" };
  const ACTION_CLS = {
    move: "bg-blue-50 text-blue-700",
    add: "bg-emerald-50 text-emerald-700",
    delete: "bg-red-50 text-red-700",
    qty_change: "bg-amber-50 text-amber-700",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
        <History size={13} className="text-slate-500" />
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Lịch sử chỉnh sửa phiên này</span>
        {edits.length > 0 && (
          <span className="ml-auto rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5">
            {edits.length} thay đổi
          </span>
        )}
      </div>
      {!edits?.length ? (
        <div className="flex items-center justify-center py-12 text-sm text-slate-400">
          Chưa có chỉnh sửa nào trong phiên này.
        </div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
              <tr>
                {["Giờ", "Mã đơn", "Hành động", "Chuyền cũ → mới", "Ngày cũ → mới", "Người TH"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold text-slate-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {edits.map((e, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap font-mono text-[11px]">
                    {e.changed_at
                      ? new Date(e.changed_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono font-bold text-slate-700">
                    {e.order_id || e.chunk_id?.split("|")[0] || "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={clsx(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        ACTION_CLS[e.action] || "bg-slate-100 text-slate-600"
                      )}
                    >
                      {LABELS[e.action] || e.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {e.old_line && e.new_line && e.old_line !== e.new_line ? (
                      <span>
                        {e.old_line} <span className="text-slate-400 mx-1">→</span>
                        <strong className="text-slate-800">{e.new_line}</strong>
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-600">
                    {e.old_date && e.new_date && e.old_date !== e.new_date ? (
                      <span>
                        {fmtDate(e.old_date)} <span className="text-slate-400 mx-1">→</span>
                        <strong className="text-slate-800">{fmtDate(e.new_date)}</strong>
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{e.changed_by || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

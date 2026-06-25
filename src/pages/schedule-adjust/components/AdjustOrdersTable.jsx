import { useState, useMemo } from "react";
import { Lock } from "lucide-react";
import { clsx } from "clsx";
import { fmtDate } from "../../../utils";

const FROZEN_UNTIL = "2026-06-25";

export default function AdjustOrdersTable({ orders, chunks, onSelectOrder }) {
  const [search, setSearch] = useState("");

  const lastDates = useMemo(() => {
    const m = {};
    for (const c of chunks) {
      if (!m[c.order_id] || c.date > m[c.order_id]) m[c.order_id] = c.date;
    }
    return m;
  }, [chunks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? orders.filter(o => o.order_id?.toLowerCase().includes(q) || o.article?.toLowerCase().includes(q)) : orders;
  }, [orders, search]);

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-3 py-2 border-b border-slate-200 shrink-0">
        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
          Bảng đơn · chuyền của tôi ({orders.length})
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm mã đơn..."
          className="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs focus:border-blue-400 focus:bg-white focus:outline-none transition"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">Không có đơn nào</div>
        ) : (
          filtered.map(o => {
            const last = lastDates[o.order_id];
            const isLate = o.crd && last && last > o.crd;
            const isFrozen = o.go_start && o.go_start <= FROZEN_UNTIL;
            return (
              <button
                key={o.order_id}
                onClick={() => onSelectOrder(o)}
                className="w-full text-left border-b border-slate-100 px-3 py-2.5 hover:bg-blue-50/55 transition"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: o.color || "#6366f1" }} />
                  <span className="font-mono text-xs font-semibold text-slate-800 flex-1 truncate">{o.order_id}</span>
                  {isFrozen && <Lock size={11} className="text-slate-300 shrink-0" />}
                  {isLate && !isFrozen && (
                    <span className="text-[10px] font-semibold text-red-600 bg-red-50 rounded px-1.5 shrink-0">Trễ</span>
                  )}
                  {!isLate && !isFrozen && (
                    <span className="text-[10px] font-semibold text-green-600 bg-green-50 rounded px-1.5 shrink-0">OK</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 ml-4">
                  <span
                    className={clsx(
                      "rounded px-1.5 py-0.5 font-semibold",
                      (o.line_go || "").startsWith("A")
                        ? "bg-violet-100 text-violet-600"
                        : (o.line_go || "").startsWith("B")
                        ? "bg-blue-100 text-blue-600"
                        : "bg-teal-100 text-teal-600"
                    )}
                  >
                    {o.line_go || o.line || "—"}
                  </span>
                  <span>
                    CRD: <strong className={isLate ? "text-red-500" : "text-slate-600"}>{fmtDate(o.crd)}</strong>
                  </span>
                  <span className="ml-auto">{last ? fmtDate(last) : "—"}</span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

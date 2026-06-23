import { useMemo } from "react";
import { AlertTriangle, Package, CheckCircle2 } from "lucide-react";
import { vnToday } from "../../../utils";

const BADGE = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium";

export default function ScheduleTracking({ orders = [], chunks = [] }) {
  // Last chunk date per order (for late detection)
  const lastDates = useMemo(() => {
    const m = {};
    for (const c of chunks) {
      if (!m[c.order_id] || c.date > m[c.order_id]) m[c.order_id] = c.date;
    }
    return m;
  }, [chunks]);

  // Covered qty per order
  const coveredQty = useMemo(() => {
    const m = {};
    for (const c of chunks) m[c.order_id] = (m[c.order_id] ?? 0) + c.qty;
    return m;
  }, [chunks]);

  const { lateOrders, unscheduledOrders, onTimeCount } = useMemo(() => {
    const late    = [];
    const unsched = [];
    let onTime    = 0;

    for (const o of orders) {
      const oid = o.order_id;

      // IN_PROGRESS orders are already in ERP production — qty_total = full ERP
      // order qty while coveredQty = only GA-scheduled GO chunks, so the gap
      // is misleading. Gate to 0 so they never appear as "chưa sắp xong".
      if (o.state === "IN_PROGRESS") {
        const last = lastDates[oid];
        if (last && o.crd && last > o.crd) {
          const delayDays = Math.round(
            (new Date(last + "T00:00:00").getTime() - new Date(o.crd + "T00:00:00").getTime()) / 86400000
          );
          late.push({ ...o, lastDate: last, delayDays });
        } else {
          onTime++;
        }
        continue;
      }

      const remQty = Math.max(0, (o.qty_total ?? 0) - (coveredQty[oid] ?? 0));

      if (remQty > 0) {
        unsched.push({ ...o, remainingQty: remQty });
      } else {
        const last = lastDates[oid];
        if (last && o.crd && last > o.crd) {
          const delayDays = Math.round(
            (new Date(last + "T00:00:00").getTime() - new Date(o.crd + "T00:00:00").getTime()) / 86400000
          );
          late.push({ ...o, lastDate: last, delayDays });
        } else {
          onTime++;
        }
      }
    }

    return {
      lateOrders:        late.sort((a, b) => (b.lastDate ?? "").localeCompare(a.lastDate ?? "")),
      unscheduledOrders: unsched.sort((a, b) => (a.crd ?? "").localeCompare(b.crd ?? "")),
      onTimeCount:       onTime,
    };
  }, [orders, coveredQty, lastDates]);

  return (
    <div className="flex flex-col gap-4">
      {/* KPI bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertTriangle size={18} className="text-red-500 shrink-0" />
          <div>
            <div className="text-[10px] text-red-400 font-semibold uppercase">Trễ hạn</div>
            <div className="text-xl font-bold text-red-700">{lateOrders.length}</div>
            <div className="text-[11px] text-red-500">đơn đã sắp xong</div>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <Package size={18} className="text-amber-500 shrink-0" />
          <div>
            <div className="text-[10px] text-amber-400 font-semibold uppercase">Chưa sắp xong</div>
            <div className="text-xl font-bold text-amber-700">{unscheduledOrders.length}</div>
            <div className="text-[11px] text-amber-500">còn tồn qty</div>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
          <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
          <div>
            <div className="text-[10px] text-emerald-400 font-semibold uppercase">Đúng tiến độ</div>
            <div className="text-xl font-bold text-emerald-700">{onTimeCount}</div>
            <div className="text-[11px] text-emerald-500">đơn hoàn thành</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Col 1 — Late orders (fully scheduled, last chunk date > crd) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-500" />
            <span className="text-sm font-semibold text-gray-800">Trễ hạn sau khi sắp xong</span>
            {lateOrders.length > 0 && (
              <span className={`${BADGE} bg-red-100 text-red-700`}>{lateOrders.length}</span>
            )}
          </div>
          <div className="text-[11px] text-gray-400 -mt-1">Đơn đã sắp đủ sản lượng nhưng ngày SX cuối vượt hạn chót.</div>

          {lateOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400 border border-dashed border-gray-200 rounded-xl">
              <CheckCircle2 size={28} className="text-emerald-400 mb-2" />
              <div className="text-sm">Không có đơn trễ 🎉</div>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {["Đơn","Article","Hạn","SX cuối","Trễ"].map(h => (
                      <th key={h} className="px-2.5 py-2 text-[10px] font-semibold text-gray-500 uppercase text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lateOrders.map(o => (
                    <tr key={o.order_id} className="border-b border-gray-50 last:border-0 hover:bg-red-50/30">
                      <td className="px-2.5 py-2 whitespace-nowrap">
                        <span className="w-2 h-2 rounded-full inline-block mr-1 align-middle"
                          style={{ background: o.color ?? "#64748b" }} />
                        <span className="font-mono font-bold text-gray-900">{o.order_id}</span>
                      </td>
                      <td className="px-2.5 py-2 text-gray-500 max-w-[100px] truncate">{o.article ?? "—"}</td>
                      <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{o.crd ?? "—"}</td>
                      <td className="px-2.5 py-2 text-red-700 font-medium whitespace-nowrap">{o.lastDate}</td>
                      <td className="px-2.5 py-2 text-red-700 font-bold whitespace-nowrap">+{o.delayDays}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Col 2 — Unscheduled (remaining qty > 0) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Package size={14} className="text-amber-500" />
            <span className="text-sm font-semibold text-gray-800">Đơn chưa sắp xong</span>
            {unscheduledOrders.length > 0 && (
              <span className={`${BADGE} bg-amber-100 text-amber-700`}>{unscheduledOrders.length}</span>
            )}
          </div>
          <div className="text-[11px] text-gray-400 -mt-1">Sản lượng còn tồn, cần sắp tiếp vào lịch trước hạn chót.</div>

          {unscheduledOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400 border border-dashed border-gray-200 rounded-xl">
              <CheckCircle2 size={28} className="text-emerald-400 mb-2" />
              <div className="text-sm">Đã sắp hết toàn bộ đơn ✓</div>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {["Đơn","Article","Còn tồn","/ Tổng","Hạn"].map(h => (
                      <th key={h} className="px-2.5 py-2 text-[10px] font-semibold text-gray-500 uppercase text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {unscheduledOrders.map(o => {
                    const overdue = o.crd && o.crd < vnToday();
                    return (
                      <tr key={o.order_id} className="border-b border-gray-50 last:border-0 hover:bg-amber-50/30">
                        <td className="px-2.5 py-2 whitespace-nowrap">
                          <span className="w-2 h-2 rounded-full inline-block mr-1 align-middle"
                            style={{ background: o.color ?? "#64748b" }} />
                          <span className="font-mono font-bold text-gray-900">{o.order_id}</span>
                        </td>
                        <td className="px-2.5 py-2 text-gray-500 max-w-[100px] truncate">{o.article ?? "—"}</td>
                        <td className="px-2.5 py-2 font-bold text-amber-700 whitespace-nowrap">
                          {o.remainingQty.toLocaleString()}
                        </td>
                        <td className="px-2.5 py-2 text-gray-400 whitespace-nowrap">
                          {(o.qty_total ?? 0).toLocaleString()}
                        </td>
                        <td className={`px-2.5 py-2 whitespace-nowrap font-medium ${overdue ? "text-red-700" : "text-gray-600"}`}>
                          {o.crd ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { CheckCircle2, Layers } from "lucide-react";
import { clsx } from "clsx";

const CAPACITY_DAY = 1200;

export default function LineInfoPanel({ lineId, tasks, scheduleData, decisions }) {
  const cap      = scheduleData?.capacity_per_day ?? CAPACITY_DAY;
  const days     = scheduleData?.days ?? [];
  const todayDay = days.find(d => d.is_today);
  const todayQty = todayDay ? todayDay.orders.reduce((s, o) => s + o.qty, 0) : 0;
  const utilPct  = Math.round((todayQty / cap) * 100);
  const totalQty = tasks.filter(t => t.order_id).reduce((s, t) => s + (t.qty || 0), 0);

  const orderTasks = tasks.filter(t => t.order_id);
  const evaluated  = orderTasks.filter(t => decisions[t.order_id]?.status !== null && decisions[t.order_id]?.status !== undefined).length;
  const total      = orderTasks.length;
  const allDone    = evaluated === total && total > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-6 items-start">
      <div>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Mã chuyền</div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-bold bg-blue-100 text-blue-700 border border-blue-200">
          <Layers size={12} /> {lineId}
        </span>
      </div>
      <div>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Công suất mục tiêu</div>
        <div className="text-sm font-bold text-gray-800">{cap.toLocaleString()} <span className="font-normal text-gray-400 text-xs">đôi/ngày</span></div>
      </div>
      <div>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Sử dụng hôm nay</div>
        <div className="flex items-center gap-2">
          <div className="text-sm font-bold text-gray-800">{utilPct}%</div>
          <div className="w-20 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className={clsx("h-full rounded-full", utilPct > 90 ? "bg-red-400" : utilPct > 70 ? "bg-amber-400" : "bg-green-400")}
              style={{ width: `${Math.min(utilPct, 100)}%` }} />
          </div>
        </div>
      </div>
      <div>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Tổng sản lượng phân công</div>
        <div className="text-sm font-bold text-gray-800">{totalQty.toLocaleString()} <span className="font-normal text-gray-400 text-xs">đôi</span></div>
      </div>
      <div className="ml-auto">
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Đánh giá đơn hàng</div>
        {allDone ? (
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
            <CheckCircle2 size={13} className="text-emerald-500" />
            {total}/{total} đơn đã xử lý — Sẵn sàng gửi
          </div>
        ) : (
          <div className="text-sm font-bold text-gray-800">
            {evaluated}<span className="text-gray-400 font-normal">/{total}</span>
            <span className="text-xs font-normal text-gray-400 ml-1">đơn đã xử lý</span>
          </div>
        )}
        <div className="mt-1.5 w-32 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div className={clsx("h-full rounded-full transition-all", allDone ? "bg-emerald-400" : "bg-blue-400")}
            style={{ width: total > 0 ? `${(evaluated / total) * 100}%` : "0%" }} />
        </div>
      </div>
    </div>
  );
}

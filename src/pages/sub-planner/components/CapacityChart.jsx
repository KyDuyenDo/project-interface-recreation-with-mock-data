import { useState, useEffect, useRef } from "react";
import { BarChart2, Activity } from "lucide-react";
import { clsx } from "clsx";

const COL_W        = 40;
const BAR_MAX_H    = 160;
const CAPACITY_DAY = 1200;

const PALETTE = [
  "#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444","#ec4899",
  "#8b5cf6","#14b8a6","#f97316","#84cc16","#06b6d4","#d946ef",
];
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
const orderColor = id => PALETTE[hashStr(id || "") % PALETTE.length];

const Y_AXIS_W = 44;
const GRID_LINES = [0.25, 0.5, 0.75, 1.0];

export default function CapacityChart({ lineId, scheduleData }) {
  const scrollRef  = useRef(null);
  const todayRef   = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const days = scheduleData?.days || [];
  const cap  = scheduleData?.capacity_per_day || CAPACITY_DAY;

  useEffect(() => {
    if (todayRef.current && scrollRef.current) {
      const el = todayRef.current;
      const c  = scrollRef.current;
      c.scrollLeft = Math.max(0, el.offsetLeft - c.offsetWidth / 2 + COL_W / 2);
    }
  }, [days.length]);

  if (!days.length) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200 gap-2">
        <Activity size={16} className="text-gray-300" /> Không có dữ liệu lịch sản xuất
      </div>
    );
  }

  const colourMap = {};
  days.forEach(d => (d.orders || []).forEach(o => {
    if (!colourMap[o.order_id]) colourMap[o.order_id] = orderColor(o.order_id);
  }));

  const legendOrders = [];
  const seen = new Set();
  days.forEach(d => (d.orders || []).forEach(o => {
    if (!seen.has(o.order_id)) { seen.add(o.order_id); legendOrders.push(o); }
  }));

  const CHART_H    = BAR_MAX_H;
  const LABEL_H    = 36;
  const TOTAL_H    = CHART_H + LABEL_H;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
          <BarChart2 size={14} className="text-blue-500" />
          Biểu đồ công suất · <span className="text-blue-600">{lineId}</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-slate-200 inline-block border border-slate-300" />
            Trống
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-blue-400 inline-block opacity-80" />
            Lịch SX
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-0.5 h-3.5 rounded-full bg-red-500 inline-block" />
            Hôm nay
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded-full bg-red-300 inline-block border-dashed border-t border-red-300" />
            100% công suất
          </span>
          <span className="font-semibold text-gray-400">{cap.toLocaleString()} đôi/ngày</span>
        </div>
      </div>

      <div className="flex" style={{ height: TOTAL_H + 8 }}>
        <div className="shrink-0 relative border-r border-gray-100" style={{ width: Y_AXIS_W, height: TOTAL_H + 8 }}>
          <div className="absolute inset-0 pt-1 pb-9 flex flex-col justify-between items-end pr-2">
            {[...GRID_LINES].reverse().map(pct => (
              <div key={pct} className="text-[9px] text-gray-400 font-medium leading-none">
                {Math.round(cap * pct / 1000)}k
              </div>
            ))}
            <div className="text-[9px] text-gray-300 font-medium leading-none">0</div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden select-none relative" style={{ height: TOTAL_H + 8 }}>
          <div className="absolute inset-0 pt-1 pointer-events-none" style={{ width: Math.max(days.length * COL_W + 16, 100) }}>
            {GRID_LINES.map(pct => (
              <div key={pct} className="absolute left-0 right-0"
                style={{
                  top: `${(1 - pct) * CHART_H + 4}px`,
                  borderTop: pct === 1 ? "1.5px dashed #fca5a5" : "1px dashed #e5e7eb",
                }} />
            ))}
          </div>

          <div className="flex items-end relative" style={{ width: days.length * COL_W + 16, paddingLeft: 8, paddingRight: 8, paddingTop: 4, height: TOTAL_H + 8 }}>
            {days.map((day, di) => {
              const total   = (day.orders || []).reduce((s, o) => s + o.qty, 0);
              const fillPct = Math.min(total / cap, 1);
              const isToday = day.is_today;
              const isPast  = day.is_past;
              const isFirst = day.date.slice(8) === "01";
              const monthNum = parseInt(day.date.slice(5, 7));
              const dayNum   = day.date.slice(8);

              let accPct = 0;
              const segs = (day.orders || []).map(o => {
                const p = Math.min(o.qty / cap, 1 - accPct);
                const s = { ...o, p, yPct: accPct, color: colourMap[o.order_id] };
                accPct += p;
                return s;
              });

              return (
                <div
                  key={day.date}
                  ref={isToday ? todayRef : undefined}
                  className="flex flex-col items-center shrink-0 relative group"
                  style={{ width: COL_W }}
                  onMouseEnter={() => setTooltip({ day, total })}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {isFirst && di > 0 && (
                    <div className="absolute left-0 top-0 bottom-9 w-px bg-blue-200 z-10" />
                  )}

                  {isToday && (
                    <div className="absolute inset-0 bottom-0 rounded-sm"
                      style={{ background: "rgba(239,68,68,0.04)", top: 0, bottom: LABEL_H - 4 }} />
                  )}

                  <div
                    className="relative shrink-0 overflow-hidden group-hover:ring-1 group-hover:ring-blue-300 transition-all"
                    style={{
                      width: COL_W - 4,
                      height: CHART_H,
                      background: isPast ? "#f1f5f9" : "#f0f4f8",
                      borderRadius: "3px 3px 0 0",
                      border: isToday ? "1.5px solid #ef4444" : "1px solid transparent",
                    }}
                  >
                    {segs.map((seg, si) => (
                      <div key={seg.order_id + si}
                        className="absolute left-0 right-0 transition-opacity"
                        style={{
                          bottom: `${seg.yPct * 100}%`,
                          height: `${seg.p * 100}%`,
                          background: seg.color,
                          opacity: isPast ? 0.35 : 0.85,
                          minHeight: seg.p > 0 ? 2 : 0,
                        }}
                      />
                    ))}

                    {fillPct >= 1 && (
                      <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-500 opacity-80" />
                    )}

                    {isToday && (
                      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-red-400 opacity-60" />
                    )}
                  </div>

                  <div className="flex flex-col items-center justify-start pt-1" style={{ height: LABEL_H }}>
                    {isToday ? (
                      <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-red-500 text-white leading-none">HN</span>
                    ) : (
                      <span className={clsx("text-[9px] leading-none font-medium",
                        isPast ? "text-gray-300" : "text-gray-500"
                      )}>
                        {dayNum}
                      </span>
                    )}
                    {isFirst && (
                      <span className="text-[9px] font-bold text-blue-400 leading-none mt-0.5">
                        T{monthNum}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {tooltip && (
            <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 z-20
              bg-gray-900 text-white text-[11px] rounded-lg px-3 py-2 shadow-lg whitespace-nowrap"
              style={{ minWidth: 160 }}>
              <div className="font-bold mb-1">{tooltip.day.date}</div>
              <div className="flex items-center gap-1">
                <span className="text-gray-400">Sản lượng:</span>
                <span className="font-semibold">{tooltip.total.toLocaleString()}</span>
                <span className="text-gray-400">/ {cap.toLocaleString()} đôi</span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-gray-700 overflow-hidden">
                <div className={clsx("h-full rounded-full",
                  tooltip.total / cap >= 1 ? "bg-red-400" :
                  tooltip.total / cap >= 0.75 ? "bg-amber-400" : "bg-emerald-400"
                )} style={{ width: `${Math.min(tooltip.total / cap, 1) * 100}%` }} />
              </div>
              <div className="text-gray-400 text-[10px] mt-0.5">
                {Math.round(tooltip.total / cap * 100)}% công suất
              </div>
            </div>
          )}
        </div>
      </div>

      {legendOrders.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2 border-t border-gray-100 bg-gray-50/50">
          {legendOrders.map(o => (
            <span key={o.order_id} className="flex items-center gap-1.5 text-[10px] text-gray-600">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: colourMap[o.order_id], opacity: 0.85 }} />
              <span className="font-mono font-semibold">{o.order_id}</span>
              {o.model && <span className="text-gray-400">· {o.model}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GanttChart({ rows }) {
  if (!rows.length) return (
    <div className="py-12 text-center text-sm text-gray-400">Không có đơn nào.</div>
  );

  const allDates = rows.flatMap(r => [r.go_start, r.go_end]).filter(Boolean).sort();
  const startDate = new Date(allDates[0]);
  const endDate   = new Date(allDates[allDates.length - 1]);
  const totalDays = Math.max(1, Math.round((endDate - startDate) / 86400000) + 1);
  const dayOffset = d => Math.max(0, Math.round((new Date(d) - startDate) / 86400000));
  const daySpan   = (s, e) => Math.max(1, Math.round((new Date(e) - new Date(s)) / 86400000) + 1);

  const headerDates = Array.from({ length: totalDays }, (_, i) => {
    const d = new Date(startDate); d.setDate(d.getDate() + i); return d;
  });

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: Math.max(600, totalDays * 20) }}>
        {/* Date header */}
        <div className="flex border-b border-gray-100 pb-1 mb-1">
          <div className="w-36 shrink-0" />
          <div className="flex-1 relative h-4">
            {headerDates.map((d, i) => {
              if (d.getDate() !== 1 && d.getDay() !== 1) return null;
              const pct = (i / totalDays) * 100;
              return (
                <span
                  key={i}
                  className="absolute text-[9px] text-gray-400 -translate-x-1/2"
                  style={{ left: `${pct}%` }}>
                  {d.getDate() === 1 ? `${d.getMonth() + 1}/${d.getDate()}` : `${d.getDate()}`}
                </span>
              );
            })}
          </div>
        </div>

        {/* Rows */}
        {rows.map(r => {
          if (!r.go_start || !r.go_end) return null;
          const offset  = (dayOffset(r.go_start) / totalDays) * 100;
          const width   = (daySpan(r.go_start, r.go_end) / totalDays) * 100;
          const isLate  = r.is_late || (r.crd && r.go_end > r.crd);
          return (
            <div key={r.order_id ?? r.scbh} className="flex items-center mb-1">
              <div className="w-36 shrink-0 pr-2 text-[10px] font-mono text-gray-600 truncate leading-tight">
                {r.order_id ?? r.scbh}
                <span className="ml-1 text-[9px] text-gray-400">{r.line_go ?? r.line_may}</span>
              </div>
              <div className="flex-1 relative h-6 bg-gray-100 rounded overflow-hidden">
                <div
                  className={`absolute top-0 bottom-0 rounded text-[9px] text-white flex items-center px-1 overflow-hidden
                    ${isLate ? "bg-red-400" : "bg-blue-500"}`}
                  style={{ left: `${offset}%`, width: `${width}%` }}
                  title={`${r.order_id ?? r.scbh} · ${r.go_start} → ${r.go_end}`}>
                  {width > 5 ? (r.article ?? "") : ""}
                </div>
              </div>
            </div>
          );
        })}

        {/* Legend */}
        <div className="flex gap-4 mt-2 text-[10px] text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />On-time
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-red-400 inline-block" />Trễ (go_end &gt; CRD)
          </span>
        </div>
      </div>
    </div>
  );
}

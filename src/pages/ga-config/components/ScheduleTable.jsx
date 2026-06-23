import { useState, useMemo, Fragment } from "react";
import { Search, ChevronDown, ChevronRight } from "lucide-react";

const BADGE = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium";

export default function ScheduleTable({ chunks = [], edits = {} }) {
  const [search,    setSearch]    = useState("");
  const [from,      setFrom]      = useState("");
  const [to,        setTo]        = useState("");
  const [collapsed, setCollapsed] = useState({});

  // First / last chunk date per order
  const spans = useMemo(() => {
    const sp = {};
    for (const c of chunks) {
      if (!sp[c.order_id]) sp[c.order_id] = { start: c.date, end: c.date };
      else {
        if (c.date < sp[c.order_id].start) sp[c.order_id].start = c.date;
        if (c.date > sp[c.order_id].end)   sp[c.order_id].end   = c.date;
      }
    }
    return sp;
  }, [chunks]);

  // Total covered qty per order (for % calculation)
  const coveredQty = useMemo(() => {
    const m = {};
    for (const c of chunks) m[c.order_id] = (m[c.order_id] ?? 0) + c.qty;
    return m;
  }, [chunks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return chunks.filter(c => {
      if (q && !(
        c.order_id.toLowerCase().includes(q) ||
        c.article.toLowerCase().includes(q)  ||
        c.line.toLowerCase().includes(q)
      )) return false;
      if (from && c.date < from) return false;
      if (to   && c.date > to)   return false;
      return true;
    });
  }, [chunks, search, from, to]);

  // Group by line, sorted by date within group
  const grouped = useMemo(() => {
    const m = {};
    for (const c of filtered) {
      (m[c.line] = m[c.line] || []).push(c);
    }
    for (const l of Object.keys(m)) {
      m[l].sort((a, b) => a.date.localeCompare(b.date) || a.order_id.localeCompare(b.order_id));
    }
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const toggleLine = (line) =>
    setCollapsed(prev => ({ ...prev, [line]: !prev[line] }));

  const editedCount = Object.keys(edits).length;

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg">
        <span className="text-xs text-gray-500">{filtered.length} dòng</span>
        {editedCount > 0 && (
          <span className="text-xs text-amber-600 font-medium">· {editedCount} đã chỉnh</span>
        )}
        <div className="flex-1" />
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 w-48"
            placeholder="Tìm đơn, article, chuyền…"
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <input type="date"
          className="text-xs border border-gray-200 rounded-lg bg-white px-2 py-1.5 w-32 focus:outline-none"
          value={from} onChange={e => setFrom(e.target.value)} />
        <span className="text-gray-300 text-sm">→</span>
        <input type="date"
          className="text-xs border border-gray-200 rounded-lg bg-white px-2 py-1.5 w-32 focus:outline-none"
          value={to} onChange={e => setTo(e.target.value)} />
      </div>

      {/* Table */}
      <div className="max-h-[58vh] overflow-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 border-b border-gray-200">
              {["#","Đơn","Article","Ngày SX","May từ","May đến","Gò từ","Gò đến","Cặp (%)","Status"].map(h => (
                <th key={h} className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide text-left whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map(([line, rows]) => {
              const isOpen   = !collapsed[line];
              const grpQty   = rows.reduce((s, r) => s + r.qty, 0);
              const lateRows = rows.filter(r => {
                  const end = r.sew_end ?? spans[r.order_id]?.end ?? "";
                  return !!end && end > (r.crd ?? "9999");
                });
              return (
                <Fragment key={line}>
                  <tr className="bg-slate-50 border-b border-gray-200 cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => toggleLine(line)}>
                    <td colSpan={10} className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        {isOpen
                          ? <ChevronDown size={13} className="text-gray-400 shrink-0" />
                          : <ChevronRight size={13} className="text-gray-400 shrink-0" />}
                        <code className="text-xs font-bold text-gray-800 bg-gray-200 px-2 py-0.5 rounded">{line}</code>
                        <span className="text-[11px] text-gray-500">{rows.length} chunk · {grpQty.toLocaleString()} đôi</span>
                        {lateRows.length > 0 && (
                          <span className={`${BADGE} bg-red-100 text-red-700`}>{lateRows.length} trễ</span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {isOpen && rows.map((r, i) => {
                    const orderEnd = r.sew_end ?? spans[r.order_id]?.end ?? "";
                    const late     = !!orderEnd && orderEnd > (r.crd ?? "9999");
                    const edited = !!edits[r.id];
                    const pct    = r.total_qty > 0
                      ? Math.round((coveredQty[r.order_id] ?? 0) / r.total_qty * 100)
                      : 0;
                    const lpd    = r.lpd ?? r.crd ?? null;
                    // sew_start/sew_end: GA-computed order-level dates, cross-line consistent.
                    // Fall back to chunk-span min/max only for older runs without those fields.
                    const mayTu  = r.sew_start ?? spans[r.order_id]?.start ?? "—";
                    const mayDen = r.sew_end   ?? spans[r.order_id]?.end   ?? "—";
                    const goTu   = r.go_start  ?? "—";
                    const goDen  = r.go_end    ?? "—";
                    return (
                      <tr key={r.id}
                        className={`border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors
                          ${late ? "bg-red-50/40" : edited ? "bg-amber-50/30" : ""}`}>
                        <td className="px-3 py-1.5 text-[11px] text-gray-400 text-right w-8 select-none">{i + 1}</td>
                        <td className="px-3 py-1.5 font-mono text-[11px] font-bold text-gray-900 whitespace-nowrap">
                          <span className="w-2 h-2 rounded-full inline-block mr-1.5 align-middle shrink-0"
                            style={{ background: r.color ?? "#64748b" }} />
                          {r.order_id}
                        </td>
                        <td className="px-3 py-1.5 text-[11px] text-gray-600 max-w-[120px] truncate">{r.article || "—"}</td>
                        <td className="px-3 py-1.5 text-[11px] text-gray-700 whitespace-nowrap font-medium">{r.date}</td>
                        <td className="px-3 py-1.5 text-[11px] text-gray-500 whitespace-nowrap">{mayTu}</td>
                        <td className={`px-3 py-1.5 text-[11px] whitespace-nowrap font-medium ${late ? "text-red-700" : "text-gray-600"}`}>
                          {mayDen}
                          {lpd && lpd !== mayDen
                            ? <span className="ml-1 text-[9px] text-red-400 font-normal">LPD {lpd}</span>
                            : lpd
                              ? <span className="ml-1 text-[9px] text-gray-400 font-normal">LPD</span>
                              : null}
                        </td>
                        <td className="px-3 py-1.5 text-[11px] text-orange-600 whitespace-nowrap">{goTu}</td>
                        <td className="px-3 py-1.5 text-[11px] text-orange-700 font-medium whitespace-nowrap">{goDen}</td>
                        <td className="px-3 py-1.5 text-[11px] font-medium text-gray-900 whitespace-nowrap text-right">
                          {r.qty.toLocaleString()}
                          {r.total_qty > 0 && (
                            <span className="text-gray-400 font-normal ml-1">({pct}%)</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          {late
                            ? <span className={`${BADGE} bg-red-100 text-red-700`}>Trễ</span>
                            : edited
                              ? <span className={`${BADGE} bg-amber-100 text-amber-700`}>Đã sửa · OK</span>
                              : <span className={`${BADGE} bg-emerald-100 text-emerald-700`}>OK</span>}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
            {grouped.length === 0 && (
              <tr>
                <td colSpan={10} className="py-16 text-center text-sm text-gray-400">
                  Không có dữ liệu
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

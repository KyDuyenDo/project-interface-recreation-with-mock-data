import { useState, useMemo, useRef, useEffect } from "react";
import { Search, X, Loader2, AlertTriangle, Edit2, Info } from "lucide-react";
import { useRunOutputLineload } from "../../../hooks/useRuns";
import { vnMonth } from "../../../utils";

const PALETTE = [
  "#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444","#ec4899",
  "#8b5cf6","#14b8a6","#f97316","#84cc16","#06b6d4","#d946ef",
  "#3b82f6","#22c55e","#eab308","#fb7185","#a855f7","#0891b2",
];
function hash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
const orderColor = (id) => PALETTE[hash(id || "") % PALETTE.length];

const DAYS_VI   = ["CN","T2","T3","T4","T5","T6","T7"];
const weekday   = (d) => DAYS_VI[new Date(d + "T00:00:00Z").getUTCDay()];
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

function fillStyle(actual, target) {
  if (!target || actual === 0) return { bg: "", text: "text-gray-400" };
  const r = actual / target;
  if (r >= 0.9) return { bg: "bg-emerald-50", text: "text-emerald-700" };
  if (r >= 0.6) return { bg: "bg-amber-50",   text: "text-amber-700"   };
  return              { bg: "bg-red-50",       text: "text-red-700"     };
}

// ─── ScheduleCalendar ────────────────────────────────────────────────────────
// Props lifted to Step6Edit: chunks, setChunks, edits, setEdits

export default function ScheduleCalendar({ runId, orders, chunks, initialChunks, setChunks, edits, setEdits, onChunkChanged, usingFallback, hasDailyData, viewOnly = false }) {
  const [month,       setMonth]       = useState(null);
  const [search,      setSearch]      = useState("");
  const [rangeFrom,   setRangeFrom]   = useState("");
  const [rangeTo,     setRangeTo]     = useState("");
  const [rangeKind,   setRangeKind]   = useState("sx");
  const [stageFilter, setStageFilter] = useState("all");
  const [addCtx,    setAddCtx]    = useState(null);
  const [alloc,     setAlloc]     = useState(null);
  const [editChunk, setEditChunk] = useState(null);
  const dragId    = useRef(null);
  const scrollRef = useRef(null);

  const { data: lineloadData, isLoading } = useRunOutputLineload(runId);

  // Baseline coverage from the original GA output (before any user edits).
  // initialChunks is the raw apiChunks from Step6Edit — never changes for a given run.
  const baselineCovered = useMemo(() => {
    const m = {};
    for (const c of (initialChunks ?? chunks))
      m[c.order_id] = (m[c.order_id] ?? 0) + c.qty;
    return m;
  }, [initialChunks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Current total coverage (all stages combined).
  const currentCovered = useMemo(() => {
    const m = {};
    for (const c of chunks) m[c.order_id] = (m[c.order_id] ?? 0) + c.qty;
    return m;
  }, [chunks]);

  // remaining = baseline − current.
  // • Initially 0 for every order (baseline = current) — nothing shown.
  // • After the user deletes any chunk: current drops → remaining > 0 → order appears.
  // • IN_PROGRESS orders are always 0 (their SEW is in actual production, not the calendar).
  const remainingMap = useMemo(() => {
    const m = {};
    for (const o of orders) {
      const oid = o.order_id;
      if (o.state === "IN_PROGRESS") { m[oid] = 0; continue; }
      m[oid] = Math.max(0, (baselineCovered[oid] ?? 0) - (currentCovered[oid] ?? 0));
    }
    return m;
  }, [orders, baselineCovered, currentCovered]);

  // Per-size coverage from baseline GA output (never changes for a given run)
  const baselineSizesMap = useMemo(() => {
    const m = {};
    for (const c of (initialChunks ?? chunks)) {
      if (!c.sizes) continue;
      m[c.order_id] ??= {};
      for (const [sz, q] of Object.entries(c.sizes))
        m[c.order_id][sz] = (m[c.order_id][sz] ?? 0) + Number(q);
    }
    return m;
  }, [initialChunks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Per-size coverage from current chunks (updates as user edits)
  const currentSizesCovered = useMemo(() => {
    const m = {};
    for (const c of chunks) {
      if (!c.sizes) continue;
      m[c.order_id] ??= {};
      for (const [sz, q] of Object.entries(c.sizes))
        m[c.order_id][sz] = (m[c.order_id][sz] ?? 0) + Number(q);
    }
    return m;
  }, [chunks]);

  // Max available per size when editing a specific chunk
  const maxSizesForChunk = useMemo(() => {
    if (!editChunk) return {};
    const oid   = editChunk.order_id;
    const base  = baselineSizesMap[oid] ?? {};
    const curr  = currentSizesCovered[oid] ?? {};
    const csz   = editChunk.sizes ?? {};
    const allSz = new Set([...Object.keys(base), ...Object.keys(csz)]);
    const result = {};
    for (const sz of allSz) {
      result[sz] = (csz[sz] ?? 0) + Math.max(0, (base[sz] ?? 0) - (curr[sz] ?? 0));
    }
    return result;
  }, [editChunk, baselineSizesMap, currentSizesCovered]);

  // Months derived from chunks
  const months = useMemo(() => {
    const s = new Set();
    for (const c of chunks) if (c.date) s.add(c.date.slice(0, 7));
    return [...s].sort();
  }, [chunks]);

  const currentMonth = month ?? months[0] ?? vnMonth();
  const [yy, mm] = currentMonth.split("-").map(Number);
  const days = Array.from({ length: daysInMonth(yy, mm) }, (_, i) =>
    `${currentMonth}-${String(i + 1).padStart(2, "0")}`
  );

  const lineloadRows = useMemo(
    () => lineloadData?.rows ?? lineloadData?.items ?? [],
    [lineloadData],
  );
  const allLines = useMemo(() => {
    const s = new Set();
    for (const r of lineloadRows) if (r.line) s.add(r.line);
    for (const c of chunks)       if (c.line) s.add(c.line);
    return [...s].sort();
  }, [lineloadRows, chunks]);

  const lineTarget = useMemo(() => {
    const m = {};
    for (const r of lineloadRows)
      if (r.line && r.day_capacity > 0 && !m[r.line]) m[r.line] = r.day_capacity;
    return m;
  }, [lineloadRows]);

  const lineDepName = useMemo(() => {
    const m = {};
    for (const r of lineloadRows)
      if (r.line && r.dep_name && !m[r.line]) m[r.line] = r.dep_name;
    return m;
  }, [lineloadRows]);

  const q = search.trim().toLowerCase();
  const chunkVisible = (c) => {
    if (q && !(c.order_id.toLowerCase().includes(q) || c.line.toLowerCase().includes(q) || c.article.toLowerCase().includes(q))) return false;
    if (rangeFrom || rangeTo) {
      const val = rangeKind === "deadline" ? (c.crd ?? c.date) : c.date;
      if (rangeFrom && val < rangeFrom) return false;
      if (rangeTo   && val > rangeTo)   return false;
    }
    if (stageFilter === "new" && c.state !== "NEW")             return false;
    if (stageFilter === "ip"  && c.state !== "IN_PROGRESS")     return false;
    if (stageFilter === "tl"  && c.state !== "FUTURE_PLANNED")  return false;
    return true;
  };

  const cellMap = useMemo(() => {
    const m = {};
    for (const c of chunks) {
      if (!c.date.startsWith(currentMonth) || !chunkVisible(c)) continue;
      const k = `${c.line}|${c.date}`;
      (m[k] = m[k] || []).push(c);
    }
    return m;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunks, currentMonth, q, rangeFrom, rangeTo, rangeKind, stageFilter]);

  const visibleLines = allLines.filter(l => {
    if (!q) return true;
    if (l.toLowerCase().includes(q)) return true;
    return days.some(d => (cellMap[`${l}|${d}`]?.length ?? 0) > 0);
  });

  // ── Mutation helpers ──────────────────────────────────────────────────────
  const moveChunk = (id, line, date) => {
    if (viewOnly) return;
    const cur = chunks.find(c => c.id === id);
    if (cur && cur.line === line && cur.date === date) return;
    setChunks(chunks.map(c => c.id === id ? { ...c, line, date } : c));
    setEdits(prev => ({ ...prev, [id]: true }));
    onChunkChanged?.({
      action: "move", order_id: cur?.order_id ?? id,
      chunk_id: typeof cur?.chunk_id === "number" ? cur.chunk_id : null,
      old_line: cur?.line ?? null, new_line: line,
      old_date: cur?.date ?? null, new_date: date,
      stage: cur?.stage ?? null,
    });
  };
  const deleteChunk = (id) => {
    if (viewOnly) return;
    const cur = chunks.find(c => c.id === id);
    setChunks(chunks.filter(c => c.id !== id));
    onChunkChanged?.({
      action: "delete", order_id: cur?.order_id ?? id,
      chunk_id: typeof cur?.chunk_id === "number" ? cur.chunk_id : null,
      old_line: cur?.line ?? null, old_date: cur?.date ?? null,
      old_qty: cur?.qty ?? null, stage: cur?.stage ?? null,
    });
  };
  const addChunk    = (order_id, line, date, qty) => {
    if (viewOnly) return;
    const o = orders.find(x => x.order_id === order_id);
    if (!o) return;
    const nc = {
      id:       `new|${order_id}|${line}|${date}|${Date.now()}`,
      order_id, article: o.article ?? "", line, date,
      qty:      Math.max(0, qty),
      sizes:    {}, color: orderColor(order_id),
      crd:      o.crd  ?? null, lpd: o.lpd ?? null,
      is_late:  false,  total_qty: o.qty_total ?? 0,
      go_start: o.go_start ?? null, go_end: o.go_end ?? null,
      sew_start: o.sew_start ?? null, sew_end: o.sew_end ?? null,
      state:    o.state     ?? null,
      stage:    null,
    };
    setChunks([...chunks, nc]);
    setEdits(prev => ({ ...prev, [nc.id]: true }));
    onChunkChanged?.({
      action: "add", order_id,
      chunk_id: null, new_line: line, new_date: date, new_qty: qty,
    });
  };
  const updateChunk = (id, qty, sizes) => {
    if (viewOnly) return;
    if (qty <= 0) { deleteChunk(id); return; }
    const cur = chunks.find(c => c.id === id);
    setChunks(chunks.map(c => c.id === id ? { ...c, qty, ...(sizes != null && { sizes }) } : c));
    setEdits(prev => ({ ...prev, [id]: true }));
    onChunkChanged?.({
      action: "qty_change", order_id: cur?.order_id ?? id,
      chunk_id: typeof cur?.chunk_id === "number" ? cur.chunk_id : null,
      old_qty: cur?.qty ?? null, new_qty: qty,
      old_line: cur?.line ?? null, new_line: cur?.line ?? null,
      old_date: cur?.date ?? null, new_date: cur?.date ?? null,
      stage: cur?.stage ?? null,
      sizes: sizes ?? null,
    });
  };

  const onGridDragOver = (e) => {
    const el = scrollRef.current; if (!el) return;
    const r = el.getBoundingClientRect(); const E = 80;
    if (e.clientX > r.right  - E) el.scrollLeft += 18;
    if (e.clientX < r.left   + E) el.scrollLeft -= 18;
    if (e.clientY > r.bottom - E) el.scrollTop  += 12;
    if (e.clientY < r.top    + E) el.scrollTop  -= 12;
  };

  const unscheduledCount = useMemo(
    () => orders.filter(o => (remainingMap[o.order_id] ?? 0) > 0).length,
    [orders, remainingMap],
  );
  const editedCount = Object.keys(edits).length;

  // Count SEW vs GO chunks in current view for the legend
  const { sewCount, goCount } = useMemo(() => {
    let s = 0, g = 0;
    for (const c of chunks) {
      if (c.stage === "SEW") s++;
      else if (c.stage === "GO" || c.stage === "A") g++;
    }
    return { sewCount: s, goCount: g };
  }, [chunks]);

  // Dynamically compute which orders are late based on current (edited) chunks.
  // chunk.is_late is the original GA flag and goes stale after user moves/adds chunks.
  const lateOrderIds = useMemo(() => {
    const lastDate = {};
    const crdMap   = {};
    for (const c of chunks) {
      if (!c.order_id) continue;
      if (!lastDate[c.order_id] || c.date > lastDate[c.order_id])
        lastDate[c.order_id] = c.date;
      if (c.crd && !crdMap[c.order_id]) crdMap[c.order_id] = c.crd;
    }
    const late = new Set();
    for (const [oid, last] of Object.entries(lastDate)) {
      const crd = crdMap[oid];
      if (crd && last > crd) late.add(oid);
    }
    return late;
  }, [chunks]);

  return (
    <div className="flex flex-col gap-3">
      {/* Fallback / data-source banner */}
      {usingFallback && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          <AlertTriangle size={13} className="shrink-0 mt-0.5 text-amber-500" />
          <div>
            <span className="font-semibold">Đang hiển thị ước tính —</span>
            {" "}dữ liệu ngày chi tiết chưa có (hoặc chưa lưu). Lịch được tính xấp xỉ từ ngày gò dự kiến.
            Kết quả có thể sai so với lịch thực tế của GA.
          </div>
        </div>
      )}
      {hasDailyData && (sewCount > 0 || goCount > 0) && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 text-blue-700 text-xs">
          <Info size={12} className="shrink-0" />
          <span className="font-medium">Dữ liệu GA thực tế</span>
          {sewCount > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />May ({sewCount} chunk)</span>}
          {goCount  > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />Gò ({goCount} chunk)</span>}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex gap-0.5 bg-white border border-gray-200 rounded-lg p-0.5">
          {months.map(m => (
            <button key={m} onClick={() => setMonth(m)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap
                ${currentMonth === m ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:bg-gray-100"}`}>
              {"Tháng " + String(Number(m.slice(5))) + "/" + m.slice(2, 4)}
            </button>
          ))}
        </div>

        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className={`w-2 h-2 rounded-full ${unscheduledCount > 0 ? "bg-amber-400" : "bg-emerald-400"}`} />
          {unscheduledCount > 0 ? `${unscheduledCount} đơn còn tồn` : "Đã phủ hết"}
        </span>

        {editedCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
            <Edit2 size={11} /> {editedCount} đã chỉnh
          </span>
        )}

        <div className="flex-1" />

        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 w-44"
            placeholder="Tìm đơn / chuyền…"
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select className="text-xs border border-gray-200 rounded-lg bg-white px-2 py-1.5 focus:outline-none"
          value={rangeKind} onChange={e => setRangeKind(e.target.value)}>
          <option value="sx">Ngày SX</option>
          <option value="deadline">Hạn chót</option>
        </select>

        <input type="date"
          className="text-xs border border-gray-200 rounded-lg bg-white px-2 py-1.5 w-32 focus:outline-none"
          value={rangeFrom} onChange={e => setRangeFrom(e.target.value)} />
        <span className="text-gray-300 text-sm">→</span>
        <input type="date"
          className="text-xs border border-gray-200 rounded-lg bg-white px-2 py-1.5 w-32 focus:outline-none"
          value={rangeTo} onChange={e => setRangeTo(e.target.value)} />

        <select className="text-xs border border-gray-200 rounded-lg bg-white px-2 py-1.5 focus:outline-none"
          value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
          <option value="all">Tất cả</option>
          <option value="new">Mới</option>
          <option value="ip">IP</option>
          <option value="tl">TL</option>
        </select>

        {(search || rangeFrom || rangeTo || stageFilter !== "all") && (
          <button onClick={() => { setSearch(""); setRangeFrom(""); setRangeTo(""); setStageFilter("all"); }}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded-lg hover:bg-gray-100">
            Xóa lọc
          </button>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="py-16 text-center">
          <Loader2 className="animate-spin mx-auto text-blue-500" size={24} />
          <div className="text-xs text-gray-400 mt-2">Đang tải lịch sản xuất…</div>
        </div>
      ) : (
        <div ref={scrollRef}
          className="overflow-auto border border-gray-200 rounded-lg"
          style={{ maxHeight: "62vh" }}
          onDragOver={onGridDragOver}>
          <table className="border-collapse" style={{ tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 bg-slate-100 border-r border-b border-gray-200 text-left px-3 py-2 text-xs font-semibold text-gray-600"
                  style={{ minWidth: 118 }}>
                  Chuyền
                </th>
                {days.map(d => {
                  const w = weekday(d); const wknd = w === "CN";
                  return (
                    <th key={d}
                      className={`sticky top-0 z-10 border-r border-b border-gray-200 px-1 py-1.5 text-center
                        ${wknd ? "bg-slate-200" : "bg-slate-50"}`}
                      style={{ minWidth: 112 }}>
                      <div className="text-[13px] font-bold text-gray-800">{d.slice(-2)}</div>
                      <div className="text-[9px] text-gray-400 uppercase">{w}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visibleLines.map(line => (
                <tr key={line}>
                  <td className="sticky left-0 z-10 bg-white border-r border-b border-gray-200 px-3 py-2 align-top whitespace-nowrap"
                    style={{ minWidth: 118 }}>
                    <div className="text-xs font-bold text-gray-800">{lineDepName[line] ?? line}</div>
                    {lineDepName[line] && (
                      <div className="text-[10px] text-gray-500 font-mono">{line}</div>
                    )}
                    {lineTarget[line] && (
                      <div className="text-[10px] text-gray-400">T: {lineTarget[line].toLocaleString()}</div>
                    )}
                  </td>
                  {days.map(date => {
                    const k   = `${line}|${date}`;
                    const cs  = cellMap[k] ?? [];
                    const act = cs.reduce((a, c) => a + c.qty, 0);
                    const tgt = lineTarget[line] ?? 0;
                    const { bg, text } = fillStyle(act, tgt);
                    const wknd = weekday(date) === "CN";
                    return (
                      <td key={date}
                        className={`border-r border-b border-gray-100 align-top p-1 transition-colors
                          ${wknd ? "bg-slate-50" : cs.length === 0 ? "bg-white hover:bg-blue-50/20" : bg || "bg-white"}`}
                        style={{ minWidth: 112, verticalAlign: "top" }}
                        onDragOver={e => { if (viewOnly) return; e.preventDefault(); e.currentTarget.classList.add("ring-2", "ring-blue-400", "ring-inset"); }}
                        onDragLeave={e => {
                          if (viewOnly) return;
                          if (!e.currentTarget.contains(e.relatedTarget))
                            e.currentTarget.classList.remove("ring-2", "ring-blue-400", "ring-inset");
                        }}
                        onDrop={e => {
                          if (viewOnly) return;
                          e.preventDefault();
                          e.currentTarget.classList.remove("ring-2", "ring-blue-400", "ring-inset");
                          const id = dragId.current; dragId.current = null;
                          if (id) moveChunk(id, line, date);
                        }}
                        onContextMenu={e => { if (viewOnly) return; e.preventDefault(); setAddCtx({ line, date, x: e.clientX, y: e.clientY }); }}>
                        <div className="flex flex-col gap-0.5 min-h-5">
                          {cs.map(c => (
                            <OrderTag key={c.id} chunk={c} edited={!!edits[c.id]}
                              isLate={lateOrderIds.has(c.order_id)}
                              onDragStart={() => dragId.current = c.id}
                              onClick={() => setEditChunk(c)}
                              onDelete={() => deleteChunk(c.id)}
                              viewOnly={viewOnly} />
                          ))}
                        </div>
                        {act > 0 && (
                          <div className={`mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${text} flex items-center gap-1`}>
                            {act.toLocaleString()}
                            {tgt > 0 && <span className="opacity-50 font-normal">/{tgt.toLocaleString()}</span>}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {visibleLines.length === 0 && (
                <tr>
                  <td colSpan={days.length + 1} className="py-16 text-center text-sm text-gray-400">
                    Không có dữ liệu cho tháng này
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-gray-400 px-0.5">
        <span className="font-semibold text-gray-500">Màu ô:</span>
        <span><span className="inline-block w-3 h-2 rounded bg-red-100 align-middle mr-1" />{"< 60% mục tiêu"}</span>
        <span><span className="inline-block w-3 h-2 rounded bg-amber-100 align-middle mr-1" />60–90%</span>
        <span><span className="inline-block w-3 h-2 rounded bg-emerald-100 align-middle mr-1" />≥ 90%</span>
        <span className="text-gray-200">|</span>
        <span className="font-semibold text-gray-500">Thẻ đơn:</span>
        <span><span className="text-[8px] font-bold text-blue-600 bg-blue-100 px-0.5 rounded mr-1 align-middle">S</span>May</span>
        <span><span className="text-[8px] font-bold text-orange-600 bg-orange-100 px-0.5 rounded mr-1 align-middle">A</span>Gò</span>
        <span><span className="text-[8px] font-bold text-purple-600 bg-purple-100 px-0.5 rounded mr-1 align-middle">GC</span>Gia công ngoài</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 align-middle mr-1" />Chưa có size</span>
        <span><span className="inline-block w-3 h-3 rounded border-2 border-red-500 align-middle mr-1" />Trễ hạn</span>
        <span className="text-gray-200">|</span>
        <span>kéo đổi chuyền/ngày · <strong className="text-gray-500">chuột phải</strong> thêm · nhấn xem/sửa · × xóa</span>
      </div>

      {addCtx && (
        <AddOrderMenu orders={orders} remainingMap={remainingMap} ctx={addCtx}
          onPick={(oid) => { setAlloc({ order_id: oid, line: addCtx.line, date: addCtx.date }); setAddCtx(null); }}
          onClose={() => setAddCtx(null)} />
      )}

      {alloc && (() => {
        const o   = orders.find(x => x.order_id === alloc.order_id);
        const rem = remainingMap[alloc.order_id] ?? 0;
        return (
          <AllocDialog order={o} remaining={rem} alloc={alloc}
            onConfirm={(qty) => { addChunk(alloc.order_id, alloc.line, alloc.date, qty); setAlloc(null); }}
            onClose={() => setAlloc(null)} />
        );
      })()}

      {editChunk && (
        <ChunkEditDialog
          chunk={editChunk}
          remainingForOrder={remainingMap[editChunk.order_id] ?? 0}
          orderSizes={orders.find(o => o.order_id === editChunk.order_id)?.sizes ?? {}}
          maxSizesForChunk={maxSizesForChunk}
          edited={!!edits[editChunk.id]}
          onSave={(qty, sizes) => { updateChunk(editChunk.id, qty, sizes); setEditChunk(null); }}
          onDelete={() => { deleteChunk(editChunk.id); setEditChunk(null); }}
          onClose={() => setEditChunk(null)}
          viewOnly={viewOnly} />
      )}
    </div>
  );
}

// ─── OrderTag ─────────────────────────────────────────────────────────────────

const IS_GC_LINE = (line) => /^JAZ/i.test(line ?? "");

function OrderTag({ chunk, edited, isLate, onDragStart, onClick, onDelete, viewOnly }) {
  const col      = chunk.color;
  const isGo     = chunk.stage === "GO" || chunk.stage === "A";
  const isSew    = chunk.stage === "SEW";
  const isGC     = IS_GC_LINE(chunk.line);
  const isFuture = chunk.state === "FUTURE_PLANNED";
  const isFrozen = chunk.state === "IN_PROGRESS";
  const noSize   = !chunk.sizes || Object.keys(chunk.sizes).length === 0;

  const bgAlpha     = isFrozen ? "18" : isFuture ? "14" : "bb";
  const borderAlpha = isFrozen ? "44" : isFuture ? "33" : "ff";
  const borderStyle = isFuture ? "dashed" : "solid";
  const chipOpacity = isFrozen ? 0.6 : isFuture ? 0.65 : 1;

  // Left accent bar color
  const accentColor = isLate ? "#ef4444" : isGo ? "#fb923c" : isFrozen ? "#f97316" : col;

  const title = [
    `${chunk.order_id} · ${chunk.qty.toLocaleString()} đôi`,
    isFrozen ? "Đang sản xuất (IN_PROGRESS)" : isFuture ? "Kế hoạch tương lai (FUTURE_PLANNED)" : "Đơn mới",
    isGo ? "Giai đoạn gò (A)" : isSew ? "Giai đoạn may (S)" : "",
    isGC   ? "GC / Gia công ngoài" : "",
    noSize && isSew ? "Chưa có dữ liệu size" : "",
    isLate ? `TRỄ HẠN (CRD: ${chunk.crd ?? "?"})` : "",
    edited ? "Đã chỉnh sửa" : "",
  ].filter(Boolean).join(" · ");

  const qtyLabel = chunk.qty > 999
    ? `${(chunk.qty / 1000).toFixed(1)}k`
    : chunk.qty.toLocaleString();

  return (
    <div draggable={!viewOnly}
      className={`group flex rounded overflow-hidden cursor-grab select-none
        ${isLate  ? "ring-2 ring-red-500 ring-offset-0" : ""}
        ${edited && !isLate ? "ring-1 ring-amber-400" : ""}`}
      style={{
        background: isLate ? "#fef2f2" : col + bgAlpha,
        border: isLate
          ? "1.5px solid #ef4444"
          : `1px ${borderStyle} ${isGo ? "#fb923c" + borderAlpha : col + borderAlpha}`,
        opacity: noSize && isSew ? Math.min(chipOpacity, 0.85) : chipOpacity,
        cursor: viewOnly ? "default" : "grab",
      }}
      onDragStart={e => {
        if (viewOnly) { e.preventDefault(); return; }
        onDragStart();
        e.dataTransfer.effectAllowed = "move";
        try { e.dataTransfer.setData("text/plain", chunk.id); } catch (_) {}
      }}
      onClick={e => { e.stopPropagation(); onClick(); }}
      title={title}>

      {/* Left accent bar */}
      <span className="w-1 shrink-0 self-stretch" style={{ background: accentColor }} />

      {/* Card body */}
      <div className="flex-1 min-w-0 px-1.5 py-0.5">
        {/* Row 1 — order ID */}
        <div className={`font-mono font-bold text-[11px] leading-tight truncate
          ${isLate ? "text-red-800" : isFrozen ? "text-gray-900" : "text-gray-800"}`}>
          {chunk.order_id ?? "—"}
        </div>

        {/* Row 2 — qty + badges + delete */}
        <div className="flex items-center gap-0.5 mt-0.5">
          <span className={`text-[10px] font-medium mr-0.5 leading-none ${isLate ? "text-red-500" : "text-gray-500"}`}>{qtyLabel}</span>

          {isLate && <span className="text-[8px] font-bold text-red-600 bg-red-100 px-0.5 rounded leading-none" title={`Trễ hạn CRD ${chunk.crd}`}>!</span>}
          {isGo  && <span className="text-[8px] font-bold text-orange-600 bg-orange-100 px-0.5 rounded leading-none">A</span>}
          {isSew && <span className="text-[8px] font-bold text-blue-600   bg-blue-100   px-0.5 rounded leading-none">S</span>}
          {isFrozen         && <span className="text-[8px] font-bold text-orange-700 bg-orange-200 px-0.5 rounded leading-none" title="Đang sản xuất">IP</span>}
          {isFuture && !isGC && <span className="text-[8px] font-bold text-violet-600 bg-violet-100 px-0.5 rounded leading-none" title="Đơn tương lai">TL</span>}
          {isGC             && <span className="text-[8px] font-bold text-purple-600 bg-purple-100 px-0.5 rounded leading-none">GC</span>}
          {noSize && isSew  && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Chưa có size" />}

          {!viewOnly && (
            <button
              className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 leading-none font-bold text-[12px] shrink-0 pl-1"
              onClick={e => { e.stopPropagation(); onDelete(); }}>
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AddOrderMenu ─────────────────────────────────────────────────────────────

const SOURCE_FILTERS = [
  { key: "ALL",            label: "Tất cả",   cls: "text-gray-600 bg-gray-100",          active: "bg-gray-700 text-white" },
  { key: "NEW",            label: "Mới",      cls: "text-emerald-700 bg-emerald-50",     active: "bg-emerald-600 text-white" },
  { key: "IN_PROGRESS",   label: "Đang SX",  cls: "text-orange-700 bg-orange-50",       active: "bg-orange-500 text-white" },
  { key: "FUTURE_PLANNED", label: "Tương lai", cls: "text-violet-700 bg-violet-50",      active: "bg-violet-600 text-white" },
];

function AddOrderMenu({ orders, remainingMap, ctx, onPick, onClose }) {
  const [q,      setQ]      = useState("");
  const [source, setSource] = useState("ALL");
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const pool = orders.filter(o => (remainingMap[o.order_id] ?? 0) > 0);

  // count per source for the badges
  const counts = useMemo(() => {
    const m = { ALL: 0, NEW: 0, IN_PROGRESS: 0, FUTURE_PLANNED: 0 };
    for (const o of pool) {
      m.ALL++;
      const s = o.state ?? "NEW";
      if (s in m) m[s]++;
    }
    return m;
  }, [pool]);

  const list = pool
    .filter(o => source === "ALL" || (o.state ?? "NEW") === source)
    .filter(o => !q || o.order_id.toLowerCase().includes(q.toLowerCase()) || (o.article ?? "").toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.crd ?? "").localeCompare(b.crd ?? ""))
    .slice(0, 60);

  const top  = Math.min(ctx.y, window.innerHeight - 380);
  const left = Math.min(ctx.x, window.innerWidth  - 305);

  return (
    <div ref={ref}
      className="fixed z-50 w-76 bg-white border border-gray-200 rounded-xl shadow-xl p-3 flex flex-col gap-2"
      style={{ top, left, width: 300 }}>
      <div className="text-xs text-gray-500">
        Thêm vào <strong className="text-gray-800">{ctx.line}</strong> · {ctx.date}
      </div>

      <input autoFocus
        className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
        placeholder="Tìm mã đơn / article…"
        value={q} onChange={e => setQ(e.target.value)}
      />

      {/* Source filter pills */}
      <div className="flex gap-1 flex-wrap">
        {SOURCE_FILTERS.map(f => {
          const cnt = counts[f.key] ?? 0;
          const isActive = source === f.key;
          return (
            <button key={f.key}
              onClick={() => setSource(f.key)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors
                ${isActive ? f.active : f.cls} hover:opacity-90`}>
              {f.label}
              <span className={`text-[9px] font-bold opacity-75`}>{cnt}</span>
            </button>
          );
        })}
      </div>

      <div className="max-h-56 overflow-auto flex flex-col gap-0.5">
        {list.map(o => {
          const rem  = remainingMap[o.order_id] ?? 0;
          const col  = orderColor(o.order_id);
          const st   = o.state ?? "NEW";
          const stCfg = SOURCE_FILTERS.find(f => f.key === st);
          return (
            <button key={o.order_id}
              className="flex items-stretch gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-left w-full"
              onClick={() => onPick(o.order_id)}>
              <span className="w-1 rounded-full shrink-0 my-1" style={{ background: col }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-gray-900 truncate">{o.order_id}</span>
                  <span className="text-[10px] text-gray-400 truncate">{o.article}</span>
                  {stCfg && st !== "NEW" && (
                    <span className={`text-[8px] font-bold px-1 py-0.5 rounded shrink-0 ${stCfg.cls}`}>
                      {st === "IN_PROGRESS" ? "IP" : "TL"}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  còn <strong className="text-amber-600">{rem.toLocaleString()}</strong>/{(o.qty_total ?? 0).toLocaleString()} đôi · hạn {o.crd ?? "—"}
                </div>
              </div>
            </button>
          );
        })}
        {list.length === 0 && (
          <div className="py-6 text-center text-xs text-gray-400">Không có đơn phù hợp</div>
        )}
      </div>
    </div>
  );
}

// ─── AllocDialog ──────────────────────────────────────────────────────────────

function AllocDialog({ order, remaining, alloc, onConfirm, onClose }) {
  const [qty, setQty] = useState(remaining);
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-80" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="font-bold text-gray-900 text-sm">Thêm đơn vào lịch</div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            {alloc.order_id} → <strong>{alloc.line}</strong> · {alloc.date}
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Còn tồn: <strong className="text-amber-600">{remaining.toLocaleString()}</strong> đôi</span>
            {order?.crd && <span className="text-gray-500">Hạn: <strong className="text-gray-700">{order.crd}</strong></span>}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 shrink-0">Số lượng:</label>
            <input type="number" min={1} max={remaining}
              className="flex-1 text-center text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={qty}
              onChange={e => setQty(Math.min(remaining, Math.max(0, parseInt(e.target.value || "0", 10))))} />
            <button onClick={() => setQty(remaining)}
              className="text-xs text-blue-600 hover:text-blue-700 px-2 py-1.5 rounded-lg hover:bg-blue-50 font-medium">
              Lấy hết
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose}
            className="text-xs text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50">
            Hủy
          </button>
          <div className="flex-1" />
          <button disabled={qty <= 0}
            onClick={() => onConfirm(qty)}
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            Xác nhận thêm
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Size sort helper ─────────────────────────────────────────────────────────

function parseSizeKey(k) {
  const s = String(k).trim().toUpperCase();
  if (s.endsWith("K")) { const n = parseFloat(s.slice(0, -1)); return isNaN(n) ? 9999 : 1000 + n; }
  const n = parseFloat(s);
  return isNaN(n) ? 9999 : n;
}

// ─── ChunkSizeTable ───────────────────────────────────────────────────────────

function ChunkSizeTable({ chunkSizes, orderSizes, chunkQty }) {
  // Build merged size list from both chunk (actual today) and order (required total)
  const allSizes = useMemo(() => {
    const keys = new Set([
      ...Object.keys(chunkSizes ?? {}),
      ...Object.keys(orderSizes  ?? {}),
    ]);
    return [...keys]
      .filter(k => Number(chunkSizes?.[k] ?? 0) > 0 || Number(orderSizes?.[k] ?? 0) > 0)
      .sort((a, b) => parseSizeKey(a) - parseSizeKey(b));
  }, [chunkSizes, orderSizes]);

  if (allSizes.length === 0) return null;

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-gray-500 uppercase">Size ngày này</span>
        <span className="text-[10px] text-gray-400">{chunkQty.toLocaleString()} đôi tổng chunk</span>
      </div>
      <div className="max-h-36 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white border-b border-gray-100">
            <tr>
              <th className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase text-left">Cỡ</th>
              <th className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase text-right">Hôm nay</th>
              <th className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase text-right">Đơn cần</th>
              <th className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {allSizes.map(size => {
              const today = Number(chunkSizes?.[size] ?? 0);
              const total = Number(orderSizes?.[size]  ?? 0);
              const pct   = chunkQty > 0 ? Math.round(today / chunkQty * 100) : 0;
              return (
                <tr key={size} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-1 font-bold text-gray-800">{size}</td>
                  <td className="px-3 py-1 text-right font-medium text-gray-900">
                    {today > 0 ? today.toLocaleString() : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-1 text-right text-gray-400">
                    {total > 0 ? total.toLocaleString() : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-1 text-right text-gray-400 text-[10px]">
                    {today > 0 ? `${pct}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ChunkEditDialog ──────────────────────────────────────────────────────────

function ChunkEditDialog({ chunk, remainingForOrder, orderSizes, maxSizesForChunk, edited, onSave, onDelete, onClose, viewOnly }) {
  const [editing,    setEditing]    = useState(false);
  const [qty,        setQty]        = useState(chunk.qty);
  const [sizeInputs, setSizeInputs] = useState(() => {
    const s = {};
    for (const [k, v] of Object.entries(chunk.sizes ?? {})) s[k] = Number(v);
    return s;
  });

  const col      = chunk.color;
  const maxQty   = chunk.qty + remainingForOrder;
  const hasSizes = Object.keys(chunk.sizes ?? {}).length > 0;

  // When editing with sizes active, total = sum of per-size inputs
  const sizeTotal = useMemo(
    () => Object.values(sizeInputs).reduce((a, v) => a + v, 0),
    [sizeInputs],
  );
  const effectiveQty = hasSizes && editing ? sizeTotal : qty;

  const sortedSizes = useMemo(
    () => Object.keys(sizeInputs).sort((a, b) => Number(a) - Number(b)),
    [sizeInputs],
  );

  function handleSizeChange(sz, raw) {
    const max     = maxSizesForChunk?.[sz] ?? Infinity;
    const parsed  = parseInt(raw, 10);
    const clamped = Math.min(max, Math.max(0, isNaN(parsed) ? 0 : parsed));
    setSizeInputs(prev => ({ ...prev, [sz]: clamped }));
  }

  function handleCancel() {
    setEditing(false);
    setQty(chunk.qty);
    const s = {};
    for (const [k, v] of Object.entries(chunk.sizes ?? {})) s[k] = Number(v);
    setSizeInputs(s);
  }

  function handleSave() {
    if (hasSizes && editing) {
      // filter out zero-qty sizes so sizes_json stays clean
      const clean = {};
      for (const [sz, q] of Object.entries(sizeInputs)) if (q > 0) clean[sz] = q;
      onSave(sizeTotal, clean);
    } else {
      onSave(qty, null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-[460px] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: col }} />
            <div>
              <div className="font-bold text-gray-900">{chunk.order_id}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">{chunk.article} · {chunk.line} · {chunk.date}</div>
            </div>
          </div>
          <button className="text-gray-400 hover:text-gray-600 ml-4" onClick={onClose}><X size={15} /></button>
        </div>

        <div className="p-5 space-y-3 max-h-[75vh] overflow-auto">
          {chunk.is_late && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
              <AlertTriangle size={12} /> Trễ tiến độ
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-2">
            {[
              ["Tổng đơn hàng", (chunk.total_qty ?? 0).toLocaleString() + " đôi"],
              ["Chunk này",     effectiveQty.toLocaleString() + " đôi"],
              ["Còn tồn đơn",  remainingForOrder.toLocaleString() + " đôi"],
              ["Hạn chót",     chunk.crd ?? "—"],
            ].map(([k, v]) => (
              <div key={k} className="bg-gray-50 rounded-lg px-3 py-2">
                <div className="text-[10px] text-gray-400 font-semibold uppercase">{k}</div>
                <div className="font-bold text-gray-900 text-sm mt-0.5">{v}</div>
              </div>
            ))}
          </div>

          {/* Per-size section */}
          {hasSizes && (
            <div className="rounded-lg border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  {editing ? "Chỉnh số lượng theo cỡ" : "Chi tiết theo cỡ"}
                </span>
                {editing && (
                  <span className="text-[11px] text-blue-600 font-medium">
                    Tổng: {sizeTotal.toLocaleString()} đôi
                  </span>
                )}
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="px-3 py-1.5 text-left font-semibold text-gray-500">Cỡ</th>
                    {editing ? (
                      <>
                        <th className="px-3 py-1.5 text-right font-semibold text-gray-500">Số lượng</th>
                        <th className="px-3 py-1.5 text-right font-semibold text-gray-500">Tối đa</th>
                        <th className="px-3 py-1.5 text-right font-semibold text-gray-500"></th>
                      </>
                    ) : (
                      <>
                        <th className="px-3 py-1.5 text-right font-semibold text-gray-500">Đang lên lịch</th>
                        <th className="px-3 py-1.5 text-right font-semibold text-gray-500">Tổng đơn</th>
                        <th className="px-3 py-1.5 text-right font-semibold text-gray-500">%</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sortedSizes.map(sz => {
                    const maxForSz = maxSizesForChunk?.[sz] ?? sizeInputs[sz];
                    const orderSz  = Number(orderSizes?.[sz] ?? 0);
                    const cur      = sizeInputs[sz] ?? 0;
                    const pct      = maxForSz > 0 ? Math.round(cur / maxForSz * 100) : 0;
                    return (
                      <tr key={sz} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                        <td className="px-3 py-1.5 font-bold text-gray-800">{sz}</td>
                        {editing ? (
                          <>
                            <td className="px-3 py-1.5 text-right">
                              <input
                                type="number" min={0} max={maxForSz}
                                value={cur}
                                disabled={viewOnly}
                                onChange={e => handleSizeChange(sz, e.target.value)}
                                className="w-20 text-right text-xs border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-50"
                              />
                            </td>
                            <td className="px-3 py-1.5 text-right text-gray-400">{maxForSz.toLocaleString()}</td>
                            <td className="px-2 py-1.5 text-right">
                              {!viewOnly && (
                                <button
                                  onClick={() => handleSizeChange(sz, String(maxForSz))}
                                  className="text-[10px] text-blue-600 hover:text-blue-800 font-medium px-1.5 py-0.5 rounded hover:bg-blue-50">
                                  Hết
                                </button>
                              )}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-1.5 text-right font-medium text-gray-900">
                              {cur > 0 ? cur.toLocaleString() : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-3 py-1.5 text-right text-gray-400">
                              {orderSz > 0 ? orderSz.toLocaleString() : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-3 py-1.5 text-right text-gray-400 text-[10px]">
                              {cur > 0 ? `${pct}%` : "—"}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Fallback total-qty input (for chunks without size breakdown) */}
          {!hasSizes && editing && (
            <div>
              <label className="text-[11px] text-gray-500 block mb-1.5">
                Số lượng (tối đa {maxQty.toLocaleString()}):
              </label>
              <input type="number" min={0} max={maxQty}
                disabled={viewOnly}
                className="w-full text-center text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
                value={qty}
                onChange={e => setQty(Math.min(maxQty, Math.max(0, parseInt(e.target.value || "0", 10))))} />
            </div>
          )}

          {edited && !editing && (
            <div className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
              <Edit2 size={11} /> Đã chỉnh sửa
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          {!viewOnly && (
            <button onClick={onDelete}
              className="text-xs text-red-600 hover:text-red-700 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 flex items-center gap-1">
              <X size={11} /> Xóa khỏi lịch
            </button>
          )}
          <div className="flex-1" />
          {!viewOnly && !editing && (
            <button onClick={() => setEditing(true)}
              className="text-xs text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50">
              Chỉnh sửa
            </button>
          )}
          {editing && (
            <button onClick={handleCancel}
              className="text-xs text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50">
              Hủy
            </button>
          )}
          <button onClick={onClose}
            className="text-xs text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50">
            Đóng
          </button>
          {editing && !viewOnly && (
            <button onClick={handleSave}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">
              Lưu thay đổi
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

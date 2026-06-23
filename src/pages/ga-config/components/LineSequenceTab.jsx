/**
 * LineSequenceTab — nối đuôi (tail-chain) view for Step 6.
 *
 * Three independent section groups — each line gets its own block:
 *   MAY (SEW)  — regular sewing lines, keyed by line_may
 *   GÒ         — assembly lines, keyed by line_go
 *   GIA CÔNG   — subcontractor lines (JAZ-prefix or "gia công" in name), keyed by line_may
 *
 * An order with both line_may and line_go appears in TWO blocks:
 *   - Its MAY/GIA CÔNG block (sew dates)
 *   - Its GÒ block (go dates)
 *
 * Similarity: dao (cutting_die) +1.0, article +0.5.
 */
import { useMemo, useState, Fragment } from "react";
import { Loader2, Search, AlertTriangle, Clock, ChevronDown, ChevronRight } from "lucide-react";
import { useRunGenes, useRunPdschRunning } from "../../../hooks/useRuns";

const BADGE = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium";

// Identify subcontractor (gia công) lines
const isGcLine = (rawId, displayName) =>
  /^JAZ/i.test(rawId ?? "") || /(gia.?công)/i.test(displayName ?? "");

// Similarity: dao (+1.0) + article (+0.5)
function simScore(a, b) {
  if (!a || !b) return 0;
  const t = v => (v ?? "").trim();
  const die = !!(t(a.cutting_die) && t(a.cutting_die) === t(b.cutting_die));
  const art = !!(t(a.article)     && t(a.article)     === t(b.article));
  return (die ? 1.0 : 0) + (art ? 0.5 : 0);
}

const PALETTE = [
  "bg-blue-100 text-blue-700",
  "bg-green-100 text-green-700",
  "bg-purple-100 text-purple-700",
  "bg-orange-100 text-orange-700",
  "bg-pink-100 text-pink-700",
  "bg-cyan-100 text-cyan-700",
  "bg-rose-100 text-rose-700",
  "bg-indigo-100 text-indigo-700",
  "bg-yellow-100 text-yellow-700",
  "bg-teal-100 text-teal-700",
];

// ── Helper functions for source filtering ──────────────────────────────────────

function matchesSource(o, filter) {
  if (filter === "all") return true;
  const isGa   = o._src === "ga";
  const isProd = o._src === "prod";
  const isLean = o._src === "lean";
  const isIp   = isGa && o.state === "IN_PROGRESS";
  const isFp   = isGa && o.state === "FUTURE_PLANNED";
  const isNew  = isGa && !isIp && !isFp;

  if (filter === "ga_new") return isNew;
  if (filter === "prod") return isProd;
  if (filter === "ga_ip") return isIp;
  if (filter === "lean") return isLean;
  if (filter === "ga_fp") return isFp;
  return true;
}

function hasMatchingOrders(data, filter) {
  if (filter === "all") return true;
  const matches = (list, src) => list.some(o => matchesSource({ ...o, _src: src }, filter));
  return (
    matches(data.prod, "prod") ||
    matches(data.lean, "lean") ||
    matches(data.ga, "ga")
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function LineSequenceTab({ runId, orders }) {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");

  const { data: genesData, isLoading: genesLoading } = useRunGenes(runId, { page_size: 2000 });
  const { data: pdschData, isLoading: pdschLoading } = useRunPdschRunning(runId);

  const metaMap = useMemo(() => {
    const raw = Array.isArray(genesData) ? genesData : (genesData?.items ?? genesData?.genes ?? []);
    const m = {};
    raw.forEach(g => {
      m[g.order_id] = {
        cutting_die:  g.cutting_die  ?? "",
        tool:         g.tool         ?? "",
        last:         g.last         ?? "",
        style:        g.style        ?? "",
        article:      g.article      ?? "",
        dep_name_may: g.dep_name_may ?? "",
        dep_name_go:  g.dep_name_go  ?? "",
      };
    });
    return m;
  }, [genesData]);

  const dieColorMap = useMemo(() => {
    const dies = [...new Set(Object.values(metaMap).map(m => m.cutting_die).filter(Boolean))].sort();
    const m = {};
    dies.forEach((d, i) => { m[d] = PALETTE[i % PALETTE.length]; });
    return m;
  }, [metaMap]);

  const pdschOrders = useMemo(() => pdschData?.orders ?? [], [pdschData]);

  const gaOrders = useMemo(() =>
    orders.map(o => ({ ...o, ...(metaMap[o.order_id ?? o.scbh] ?? {}) })),
  [orders, metaMap]);

  // ── Build three section maps: sew, go, gc ────────────────────────────────────
  // Each entry: { ga: [], prod: [], lean: [] }
  const { sewLines, goLines, gcLines } = useMemo(() => {
    const sew = {}, go = {}, gc = {};

    const ensureKey = (map, key) => {
      if (!map[key]) map[key] = { ga: [], prod: [], lean: [] };
    };

    // GA genes
    gaOrders.forEach(o => {
      const mayKey = o.dep_name_may || o.line_may;
      const goKey  = o.dep_name_go  || o.line_go;

      if (mayKey) {
        const target = isGcLine(o.line_may, o.dep_name_may) ? gc : sew;
        ensureKey(target, mayKey);
        target[mayKey].ga.push(o);
      }
      if (goKey) {
        ensureKey(go, goKey);
        go[goKey].ga.push(o);
      }
    });

    // PDSCH orders
    pdschOrders.forEach(o => {
      const slot = o.source === "production" ? "prod" : "lean";

      if (o.line_may) {
        const target = isGcLine("", o.line_may) ? gc : sew;
        ensureKey(target, o.line_may);
        target[o.line_may][slot].push(o);
      }
      if (o.line_go) {
        ensureKey(go, o.line_go);
        go[o.line_go][slot].push(o);
      }
    });

    // Sort each group
    const byDate = key => (a, b) => (a[key] ?? "") < (b[key] ?? "") ? -1 : 1;
    const sortAll = (map, gaKey) =>
      Object.values(map).forEach(d => {
        d.ga.sort(byDate(gaKey));
        d.prod.sort(byDate("psdt"));
        d.lean.sort(byDate("psdt"));
      });

    sortAll(sew, "sew_start");
    sortAll(gc,  "sew_start");
    sortAll(go,  "go_start");

    const toSorted = map => Object.entries(map).sort(([a], [b]) => a < b ? -1 : 1);
    return { sewLines: toSorted(sew), goLines: toSorted(go), gcLines: toSorted(gc) };
  }, [gaOrders, pdschOrders]);

  const totalDieChanges = useMemo(() => {
    let n = 0;
    [...sewLines, ...gcLines].forEach(([, d]) => {
      for (let i = 1; i < d.ga.length; i++)
        if (simScore(d.ga[i], d.ga[i - 1]) < 1.0) n++;
    });
    return n;
  }, [sewLines, gcLines]);

  const totalLines = sewLines.length + goLines.length + gcLines.length;
  const isLoading = genesLoading || pdschLoading;
  const q = search.trim().toLowerCase();
  const lineFilter = line => !q || line.toLowerCase().includes(q);

  return (
    <div className="flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-3 shrink-0">
        <strong className="text-sm text-gray-900">Nối đuôi theo chuyền</strong>
        <span className="text-xs text-gray-400">
          {totalLines} chuyền · {orders.length} đơn GA
        </span>
        {(pdschData?.total ?? 0) > 0 && (
          <span className={`${BADGE} bg-amber-100 text-amber-700`}>
            <Clock size={10} /> {pdschData.total} PDSCH
          </span>
        )}
        {totalDieChanges > 0 && (
          <span className={`${BADGE} bg-red-100 text-red-700`}>
            <AlertTriangle size={10} /> {totalDieChanges} đổi dao
          </span>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs bg-white text-gray-700
                       focus:outline-none focus:ring-2 focus:ring-blue-400 font-medium"
          >
            <option value="all">Tất cả nguồn</option>
            <option value="ga_new">GA mới</option>
            <option value="prod">Đang SX</option>
            <option value="ga_ip">IP · nối đuôi</option>
            <option value="lean">KH tương lai</option>
            <option value="ga_fp">TL · GA</option>
          </select>

          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <Search size={12} />
            </span>
            <input
              className="pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white
                         focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ width: 140 }}
              placeholder="Lọc chuyền…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-gray-400">
          <Loader2 size={24} className="animate-spin mx-auto text-blue-500" />
        </div>
      ) : (
        <div className="space-y-4">
          <SectionGroup
            title="MAY (SEW)"
            color="blue"
            lines={sewLines}
            isSew
            dieColorMap={dieColorMap}
            lineFilter={lineFilter}
            sourceFilter={sourceFilter}
          />
          <SectionGroup
            title="GÒ (ASSEMBLY)"
            color="emerald"
            lines={goLines}
            isSew={false}
            dieColorMap={dieColorMap}
            lineFilter={lineFilter}
            sourceFilter={sourceFilter}
          />
          <SectionGroup
            title="GIA CÔNG"
            color="purple"
            lines={gcLines}
            isSew
            dieColorMap={dieColorMap}
            lineFilter={lineFilter}
            sourceFilter={sourceFilter}
          />
        </div>
      )}
    </div>
  );
}

// ── SectionGroup ───────────────────────────────────────────────────────────────

const SECTION_COLORS = {
  blue:    { hdr: "bg-blue-600",    text: "text-white", badge: "bg-blue-500/70" },
  emerald: { hdr: "bg-emerald-600", text: "text-white", badge: "bg-emerald-500/70" },
  purple:  { hdr: "bg-purple-600",  text: "text-white", badge: "bg-purple-500/70" },
};

function SectionGroup({ title, color, lines, isSew, dieColorMap, lineFilter, sourceFilter }) {
  const [open, setOpen] = useState(true);
  const filtered = lines.filter(([line, data]) => lineFilter(line) && hasMatchingOrders(data, sourceFilter));
  if (filtered.length === 0) return null;

  const { hdr, text, badge } = SECTION_COLORS[color];

  return (
    <div>
      <button
        className={`w-full flex items-center gap-2 px-3 py-2 ${hdr} ${text} rounded-lg mb-2 text-left`}
        onClick={() => setOpen(o => !o)}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="font-bold text-sm">{title}</span>
        <span className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full ${badge}`}>
          {filtered.length} chuyền
        </span>
      </button>
      {open && (
        <div className="space-y-2 ml-1">
          {filtered.map(([line, data]) => (
            <LineBlock
              key={line}
              line={line}
              data={data}
              dieColorMap={dieColorMap}
              isSew={isSew}
              sourceFilter={sourceFilter}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── LineBlock ──────────────────────────────────────────────────────────────────

function LineBlock({ line, data, dieColorMap, isSew, sourceFilter }) {
  const tagged = useMemo(() => ({
    prod: data.prod.map(o => ({ ...o, _src: "prod" })),
    lean: data.lean.map(o => ({ ...o, _src: "lean" })),
    ga:   data.ga.map(o =>   ({ ...o, _src: "ga"   })),
  }), [data]);

  const filteredTagged = useMemo(() => {
    const prod = tagged.prod.filter(o => matchesSource(o, sourceFilter));
    const lean = tagged.lean.filter(o => matchesSource(o, sourceFilter));
    const ga   = tagged.ga.filter(o => matchesSource(o, sourceFilter));
    return { prod, lean, ga };
  }, [tagged, sourceFilter]);

  const dieChanges = useMemo(() => {
    let n = 0;
    for (let i = 1; i < filteredTagged.ga.length; i++)
      if (simScore(filteredTagged.ga[i], filteredTagged.ga[i - 1]) < 1.0) n++;
    return n;
  }, [filteredTagged.ga]);

  const dies = useMemo(() => {
    const all = [...filteredTagged.prod, ...filteredTagged.lean, ...filteredTagged.ga];
    return [...new Set(all.map(o => o.cutting_die).filter(Boolean))];
  }, [filteredTagged]);

  const gaIpCount  = filteredTagged.ga.filter(o => o.state === "IN_PROGRESS").length;
  const gaFpCount  = filteredTagged.ga.filter(o => o.state === "FUTURE_PLANNED").length;
  const gaNewCount = filteredTagged.ga.length - gaIpCount - gaFpCount;
  const total = filteredTagged.prod.length + filteredTagged.lean.length + filteredTagged.ga.length;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2 flex-wrap">
          <code className="font-bold text-sm text-gray-900">{line}</code>
          <span className="text-xs text-gray-400">{total} đơn</span>
          {filteredTagged.prod.length > 0 && (
            <span className={`${BADGE} bg-amber-100 text-amber-700`}>
              <Clock size={9} /> {filteredTagged.prod.length} đang SX
            </span>
          )}
          {filteredTagged.lean.length > 0 && (
            <span className={`${BADGE} bg-slate-100 text-slate-600`}>
              {filteredTagged.lean.length} KH tương lai
            </span>
          )}
          {gaIpCount > 0 && (
            <span className={`${BADGE} bg-orange-100 text-orange-700`}>
              <Clock size={9} /> {gaIpCount} IP nối đuôi
            </span>
          )}
          {gaNewCount > 0 && (
            <span className={`${BADGE} bg-blue-100 text-blue-700`}>
              {gaNewCount} GA mới
            </span>
          )}
          {gaFpCount > 0 && (
            <span className={`${BADGE} bg-violet-100 text-violet-700`}>
              {gaFpCount} TL
            </span>
          )}
          {dieChanges > 0 && (
            <span className={`${BADGE} bg-red-100 text-red-700`}>
              <AlertTriangle size={9} /> {dieChanges} đổi dao
            </span>
          )}
        </div>
        {dies.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1 flex-wrap">
            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide shrink-0">
              DAOMH:
            </span>
            {dies.map(d => (
              <span
                key={d}
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${dieColorMap[d] ?? "bg-gray-100 text-gray-600"}`}
              >
                {d}
              </span>
            ))}
          </div>
        )}
      </div>

      <OrderTable
        prod={filteredTagged.prod}
        lean={filteredTagged.lean}
        ga={filteredTagged.ga}
        dieColorMap={dieColorMap}
        isSew={isSew}
        showTransitions={sourceFilter === "all"}
      />
    </div>
  );
}

// ── OrderTable ─────────────────────────────────────────────────────────────────

function OrderTable({ prod, lean, ga, dieColorMap, isSew, showTransitions }) {
  const combined = [...prod, ...lean, ...ga];
  if (combined.length === 0) return null;

  const COLS = [
    ["#",                           "w-8 text-center"],
    ["Đơn",                         "text-left"],
    ["Article",                     "text-left"],
    ["Tên giày",                    "text-left"],
    ["DAOMH",                       "text-left"],
    [isSew ? "May từ" : "Gò từ",   "text-left"],
    [isSew ? "May đến" : "Gò đến", "text-left"],
    ["Cặp",                         "text-right"],
    ["Nguồn",                       "text-center"],
  ];

  // Track which group dividers have already been emitted
  const shown = { lean: false, ga_ip: false, ga_new: false, ga_fp: false };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            {COLS.map(([h, cls]) => (
              <th
                key={h}
                className={`px-2 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide ${cls}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {combined.map((o, i) => {
            const prev   = i > 0 ? combined[i - 1] : null;
            const isGa   = o._src === "ga";
            const isProd = o._src === "prod";
            const isLean = o._src === "lean";
            const isIp   = isGa && o.state === "IN_PROGRESS";
            const isFp   = isGa && o.state === "FUTURE_PLANNED";
            const isNew  = isGa && !isIp && !isFp;

            const dateFrom  = isGa ? (isSew ? o.sew_start : o.go_start) : o.psdt;
            const dateTo    = isGa ? (isSew ? o.sew_end   : o.go_end)   : (o.lpd ?? o.pedt);
            const qty       = isGa ? (o.qty_total ?? 0) : (o.qty ?? 0);
            const qtyActual = isProd ? (isSew ? o.actual_qty_sew : o.actual_qty_go) : null;
            const isLate    = o.is_late || (isGa && o.crd && dateTo > o.crd);

            // Emit one divider per group, first occurrence only
            let divider = null;
            if (isLean && !shown.lean) {
              shown.lean = true;
              divider = (
                <tr key={`div-lean-${i}`}>
                  <td colSpan={COLS.length} className="px-3 py-0.5 text-[9px] font-semibold text-slate-500 uppercase tracking-wide bg-slate-50 border-y border-slate-100">
                    Đơn kế hoạch (PDSCH tương lai)
                  </td>
                </tr>
              );
            } else if (isIp && !shown.ga_ip) {
              shown.ga_ip = true;
              divider = (
                <tr key={`div-gaip-${i}`}>
                  <td colSpan={COLS.length} className="px-3 py-0.5 text-[9px] font-bold text-orange-600 uppercase tracking-wide bg-orange-50 border-y border-orange-100">
                    ↓ Đang sản xuất · GA sắp phần còn lại (IN_PROGRESS)
                  </td>
                </tr>
              );
            } else if (isNew && !shown.ga_new) {
              shown.ga_new = true;
              divider = (
                <tr key={`div-ganew-${i}`}>
                  <td colSpan={COLS.length} className="px-3 py-0.5 text-[9px] font-bold text-blue-600 uppercase tracking-wide bg-blue-50 border-y border-blue-100">
                    ↓ Đơn mới GA sắp xếp
                  </td>
                </tr>
              );
            } else if (isFp && !shown.ga_fp) {
              shown.ga_fp = true;
              divider = (
                <tr key={`div-gafp-${i}`}>
                  <td colSpan={COLS.length} className="px-3 py-0.5 text-[9px] font-bold text-violet-600 uppercase tracking-wide bg-violet-50 border-y border-violet-100">
                    ↓ Đơn tương lai (PDSCH kế hoạch · chưa đến ngày)
                  </td>
                </tr>
              );
            }

            return (
              <Fragment key={`${o._src}-${o.order_id ?? i}`}>
                {divider}
                {prev && <TransitionRow prev={prev} cur={o} colCount={COLS.length} />}
                <OrderRow
                  o={o}
                  seq={i + 1}
                  dieColorMap={dieColorMap}
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  qty={qty}
                  qtyActual={qtyActual}
                  isLate={isLate}
                />
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── OrderRow ───────────────────────────────────────────────────────────────────

function OrderRow({ o, seq, dieColorMap, dateFrom, dateTo, qty, qtyActual, isLate }) {
  const isGa   = o._src === "ga";
  const isProd = o._src === "prod";
  const isIp   = isGa && o.state === "IN_PROGRESS";
  const isFp   = isGa && o.state === "FUTURE_PLANNED";

  const rowCls = isProd
    ? "bg-amber-50/30 hover:bg-amber-50/60"
    : o._src === "lean"
    ? "bg-slate-50/20 hover:bg-slate-50/40"
    : isIp
    ? "bg-orange-50/30 hover:bg-orange-50/50"
    : isFp
    ? "bg-violet-50/20 hover:bg-violet-50/40"
    : (isLate ? "bg-red-50/40" : "");

  let sourceBadge, sourceLabel;
  if (!isGa) {
    sourceBadge = isProd ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600";
    sourceLabel = isProd ? "Đang SX" : "KH tương lai";
  } else if (isIp) {
    sourceBadge = "bg-orange-100 text-orange-700";
    sourceLabel = "IP · nối đuôi";
  } else if (isFp) {
    sourceBadge = "bg-violet-100 text-violet-700";
    sourceLabel = "TL · GA";
  } else {
    sourceBadge = "bg-blue-100 text-blue-700";
    sourceLabel = "GA mới";
  }

  const pct = (isProd && qtyActual != null && qty > 0)
    ? Math.round((qtyActual / qty) * 100) : null;

  return (
    <tr className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors ${rowCls}`}>
      <td className="px-2 py-1.5 text-[11px] text-gray-400 text-center">{seq}</td>
      <td className="px-2 py-1.5 font-mono text-[11px] font-bold text-gray-900 whitespace-nowrap">
        {o.order_id ?? o.scbh}
        {(isProd || isIp) && (
          <span
            className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-orange-400 align-middle"
            title="Đang sản xuất"
          />
        )}
      </td>
      <td className="px-2 py-1.5 text-[11px] text-gray-700 whitespace-nowrap">
        {o.article || <span className="text-gray-300">—</span>}
      </td>
      {/* Tên giày */}
      <td className="px-2 py-1.5 text-[11px] text-gray-700 whitespace-nowrap max-w-[140px] truncate" title={o.style}>
        {o.style || <span className="text-gray-300">—</span>}
      </td>
      {/* DAOMH */}
      <td className="px-2 py-1.5 whitespace-nowrap">
        {o.cutting_die
          ? <span className={`${BADGE} ${dieColorMap?.[o.cutting_die] ?? "bg-gray-100 text-gray-600"}`}>{o.cutting_die}</span>
          : <span className="text-gray-300 text-[11px]">—</span>}
      </td>
      <td className="px-2 py-1.5 text-[11px] text-gray-700 font-mono whitespace-nowrap">
        {dateFrom ?? "—"}
      </td>
      <td className="px-2 py-1.5 text-[11px] font-mono whitespace-nowrap">
        <span className="text-gray-700">{dateTo ?? "—"}</span>
        {!isGa && o.lpd && <span className="ml-1 text-[9px] text-slate-400">LPD</span>}
      </td>
      <td className="px-2 py-1.5 text-[11px] text-right font-medium text-gray-900 whitespace-nowrap">
        {qty.toLocaleString()}
        {pct !== null && <span className="ml-1 text-[9px] text-amber-600">({pct}%)</span>}
      </td>
      <td className="px-2 py-1.5 text-center whitespace-nowrap">
        <span className={`${BADGE} ${sourceBadge}`}>{sourceLabel}</span>
        {isGa && isLate && <span className={`ml-1 ${BADGE} bg-red-100 text-red-700`}>Trễ</span>}
      </td>
    </tr>
  );
}

// ── TransitionRow ──────────────────────────────────────────────────────────────

function TransitionRow({ prev, cur, colCount }) {
  if (!prev || !cur) return null;
  const t = v => (v ?? "").trim();
  const dieMatch = !!(t(prev.cutting_die) && t(prev.cutting_die) === t(cur.cutting_die));
  const artMatch = !!(t(prev.article)     && t(prev.article)     === t(cur.article));
  const sim = (dieMatch ? 1.0 : 0) + (artMatch ? 0.5 : 0);

  const bgCls   = sim >= 1.0 ? "bg-green-50/40 border-green-100"
    : sim >  0  ? "bg-amber-50/70 border-amber-200"
    :             "bg-red-50/70 border-red-200";
  const textCls = sim >= 1.0 ? "text-green-700"
    : sim >  0  ? "text-amber-700 font-semibold"
    :             "text-red-700 font-bold";
  const label   = sim >= 1.5 ? "✓✓ cùng dao + article"
    : sim >= 1.0 ? "✓ cùng dao"
    : sim >  0  ? "~khác dao, cùng article"
    :             "ĐỔI DAO";

  return (
    <tr className={`border-y ${bgCls}`}>
      <td colSpan={colCount} className="px-3 py-0.5">
        <div className="flex items-center gap-3 text-[9px] leading-4 flex-wrap">
          <span className={`shrink-0 ${textCls}`}>↕ {label}</span>
          <span className="text-gray-200 shrink-0">|</span>
          <span className={`shrink-0 ${dieMatch ? "text-green-600 font-medium" : "text-gray-300"}`}>
            {dieMatch ? "✓" : "·"} DAO {dieMatch ? "+1.0" : "—"}
          </span>
          <span className={`shrink-0 ${artMatch ? "text-green-600 font-medium" : "text-gray-300"}`}>
            {artMatch ? "✓" : "·"} Article {artMatch ? "+0.5" : "—"}
          </span>
          {!dieMatch && prev.cutting_die && cur.cutting_die && (
            <span className="shrink-0 text-red-400">
              {prev.cutting_die} → {cur.cutting_die}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

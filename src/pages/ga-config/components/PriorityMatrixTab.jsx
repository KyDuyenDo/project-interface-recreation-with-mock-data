import { useState, useMemo, useEffect, useRef, memo, useCallback } from "react";
import {
  X, Search, Filter, Loader2, Info, RefreshCw, List,
} from "lucide-react";
import { useLineProduction } from "../../../hooks/useWizard";
import { vnNow } from "../../../utils";

function modelKey(article, cutting_die) {
  return `${article}||${cutting_die || ""}`;
}

function lineTypeOf(lineId, depName) {
  const s = (depName || lineId || "").toUpperCase();
  if (/M\d+$/.test(s) || /_M\d/.test(s) || s.includes("_M")) return "may";
  if (/G\d+$/.test(s) || /_G\d/.test(s) || s.includes("_G")) return "go";
  return "unknown";
}

// ─── OrdersDropdown ───────────────────────────────────────────────────────────
function OrdersDropdown({ orderIds }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  if (!orderIds?.length) return null;
  return (
    <div className="relative">
      <button
        className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        title={`${orderIds.length} đơn hàng trong nhóm này`}>
        <List size={11} />
        <span className="text-[10px] font-medium">{orderIds.length}</span>
      </button>
      {open && (
        <div ref={ref} className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[160px] max-h-52 overflow-auto">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-1">{orderIds.length} đơn hàng</div>
          {orderIds.map(id => (
            <div key={id} className="text-[11px] font-mono text-gray-700 px-1.5 py-0.5 hover:bg-gray-50 rounded select-all">{id}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── LineTag ──────────────────────────────────────────────────────────────────
const LineTag = memo(function LineTag({
  lineId, depName, configKey, rank, isActive, hasPdsch,
  warnQty, onActivate, onRemove, onDragStart, onDragEnd,
  readOnly = false,
}) {
  const isPrimary = configKey.includes("primary");
  const isGc  = configKey.startsWith("gc");
  const isMay = configKey.startsWith("may");
  const rankColor = rank === -1 ? "#7c3aed"
    : rank <= 1 ? "#059669"
    : rank <= 3 ? "#0284c7"
    : rank <= 6 ? "#64748b"
    : "#d97706";
  const label = depName || lineId;
  const groupLabel = isGc ? "GC" : isMay ? "May" : "Gò";

  return (
    <span
      draggable={!readOnly}
      onDragStart={readOnly ? undefined : onDragStart}
      onDragEnd={readOnly ? undefined : onDragEnd}
      onClick={(e) => { e.stopPropagation(); onActivate(e); }}
      className={[
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold cursor-pointer select-none transition-all",
        isGc
          ? "bg-orange-100 text-orange-800 border border-orange-300 hover:bg-orange-200"
          : isPrimary
            ? isMay
              ? "bg-blue-100 text-blue-800 border border-blue-300 hover:bg-blue-200"
              : "bg-green-100 text-green-800 border border-green-300 hover:bg-green-200"
            : isMay
              ? "bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100"
              : "bg-green-50 text-green-600 border border-green-200 hover:bg-green-100",
        isActive ? "ring-2 ring-offset-1 ring-blue-400 shadow" : "",
      ].join(" ")}
      title={`${label}${hasPdsch ? " · đang SX" : ""} · hạng #${rank === -1 ? "đang SX" : rank} trong nhóm ${groupLabel}`}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: rankColor }} />
      {label}
      {hasPdsch && <span className="text-[8px] font-bold text-purple-600 leading-none">●</span>}
      {warnQty  && <span className="text-[9px] font-bold text-red-500 leading-none" title="Chưa có sản lượng mục tiêu">!</span>}
      {!readOnly && (
        <button
          className="ml-0.5 opacity-40 hover:opacity-100 hover:text-red-600 transition-opacity shrink-0"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="Xóa"><X size={9} /></button>
      )}
    </span>
  );
});

// ─── DropCell ─────────────────────────────────────────────────────────────────
function DropCell({
  mk, configKey, lines, freqByLine, depNameById, pdschDepNos,
  activeLineKey, onActivate, onRemove, onDrop, onContextMenu, dragRef,
  noQtyCheck, readOnly = false,
}) {
  const [over, setOver] = useState(false);
  const isGc  = configKey.startsWith("gc");
  const isMay = configKey.startsWith("may");
  const overCls = isGc ? "bg-orange-50" : isMay ? "bg-blue-50" : "bg-green-50";

  return (
    <td
      className={["px-2 py-1.5 align-top min-w-[140px] border-r border-gray-100", over ? overCls : ""].join(" ")}
      onDragOver={readOnly ? undefined : (e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={readOnly ? undefined : () => setOver(false)}
      onDrop={readOnly ? undefined : (e) => { e.preventDefault(); setOver(false); onDrop(mk, configKey); }}
      onContextMenu={readOnly ? undefined : (e) => { e.preventDefault(); onContextMenu(mk, configKey, e); }}
    >
      <div className="flex flex-col gap-0.5 min-h-[22px] items-start">
        {lines.map(lid => (
          <LineTag
            key={lid}
            lineId={lid}
            depName={depNameById?.[lid] || lid}
            configKey={configKey}
            rank={freqByLine?.[lid] ?? 99}
            hasPdsch={pdschDepNos?.has(lid)}
            warnQty={noQtyCheck ? noQtyCheck(lid) : false}
            isActive={activeLineKey === `${lid}|||${mk}|||${configKey}`}
            onActivate={(e) => onActivate(lid, mk, configKey, e)}
            onRemove={() => onRemove(mk, configKey, lid)}
            onDragStart={(e) => {
              dragRef.current = { lineId: lid, fromMk: mk, fromConfigKey: configKey };
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => { dragRef.current = null; }}
            readOnly={readOnly}
          />
        ))}
        {lines.length === 0 && !readOnly && (
          <span className="text-[10px] text-gray-300 italic leading-5">chuột phải</span>
        )}
      </div>
    </td>
  );
}

// ─── CapacityPopover ──────────────────────────────────────────────────────────
const POP_W = 300;
const POP_H = 420;

function CapacityPopover({ lineId, depName, modelKeyStr, pos, freqData, capChoices, importedTargetQty, floorById, aliasById, shoeTargetEntry, workingHoursPerDay, onChoose, onClose, readOnly = false }) {
  const ref = useRef(null);
  const [mk_art, mk_die] = modelKeyStr.split("||");
  const modelEntry = freqData?.find(m => m.article === mk_art && (m.cutting_die || "") === (mk_die || ""));
  const lineEntry = modelEntry?.lines?.find(l => l.line_id === lineId)
    ?? modelEntry?.gc_lines?.find(l => l.line_id === lineId);
  const importedQty = importedTargetQty?.[modelKeyStr]?.[lineId] ?? 0;
  const modeQty = lineEntry?.mode_qty ?? importedQty;
  const pdschOrders = [
    ...(modelEntry?.current_future    || []),
    ...(modelEntry?.gc_current_future || []),
  ].filter(c => c.dep_no === lineId);
  const choiceKey = `${lineId}||${modelKeyStr}`;
  const saved = capChoices[choiceKey];
  const targetQty = shoeTargetEntry ? Math.round(shoeTargetEntry.pairs_per_hour * (workingHoursPerDay ?? 8)) : 0;
  const [mode, setMode] = useState(saved?.mode || (targetQty > 0 ? "shoe_target" : "recommended"));
  const [custom, setCustom] = useState(saved?.custom ?? modeQty);
  const effective = mode === "custom" ? (+custom || 0) : mode === "shoe_target" ? targetQty : modeQty;

  const left = Math.max(8, Math.min(pos.x - POP_W / 2, window.innerWidth - POP_W - 8));
  const top  = pos.y - POP_H - 8 > 8 ? pos.y - POP_H - 8 : pos.y + 24;

  const lastDate = lineEntry?.last_date;
  const daysSinceLast = lastDate ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86_400_000) : null;
  const recencyLabel = daysSinceLast === null ? null
    : daysSinceLast <= 30  ? { text: "Gần đây (≤ 30 ngày)", cls: "text-green-600 bg-green-50" }
    : daysSinceLast <= 90  ? { text: "3 tháng trước",        cls: "text-blue-600 bg-blue-50" }
    : daysSinceLast <= 180 ? { text: "6 tháng trước",        cls: "text-amber-600 bg-amber-50" }
    :                        { text: `${Math.floor(daysSinceLast / 30)} tháng trước`, cls: "text-gray-500 bg-gray-100" };

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  return (
    <div ref={ref} className="fixed z-50 bg-white rounded-xl border border-gray-200 shadow-xl p-4"
      style={{ width: POP_W, top, left }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-bold text-sm text-gray-900">{depName || lineId}</div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {floorById?.[lineId] && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{floorById[lineId]}</span>
            )}
            {aliasById?.[lineId] && <span className="text-[10px] text-gray-500">{aliasById[lineId]}</span>}
            <span className="text-[10px] text-gray-400">{mk_art}{mk_die ? ` · ${mk_die}` : ""}</span>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 ml-2 shrink-0"><X size={14} /></button>
      </div>

      {pdschOrders.length > 0 && (
        <div className="bg-purple-50 rounded-lg px-3 py-2.5 mb-3 border border-purple-100">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
            <span className="text-[11px] font-semibold text-purple-700 uppercase tracking-wide">Đang/Sắp sản xuất · {pdschOrders.length} đơn</span>
          </div>
          <div className="space-y-1 max-h-32 overflow-auto">
            {pdschOrders.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-[10px]">
                <span className="font-mono font-semibold text-purple-800">{c.order_no}</span>
                <span className="text-purple-500 text-right">
                  {c.start ? `${c.start.slice(5)} → ${c.end?.slice(5) || "?"}` : "GC"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History section */}
      {lineEntry ? (
        <div className="bg-gray-50 rounded-lg px-3 py-2.5 mb-3 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Tần suất lịch sử</span>
            {recencyLabel && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${recencyLabel.cls}`}>{recencyLabel.text}</span>
            )}
          </div>
          {lineEntry.windows?.length > 0 && (() => {
            const wins = [...lineEntry.windows].reverse();
            const maxDays = Math.max(...wins.map(w => w.days), 1);
            return (
              <div className="mb-2">
                <div className="flex gap-0.5 items-end" style={{ height: 28 }}>
                  {wins.map((w, i) => {
                    const isNewest = i === wins.length - 1;
                    const h = w.days > 0 ? Math.max(3, Math.round(w.days / maxDays * 24)) : 2;
                    const cls = w.days === 0 ? "bg-gray-100" : isNewest ? "bg-blue-500" : "bg-blue-300";
                    return <div key={i} className={`flex-1 rounded-sm ${cls}`} style={{ height: h }} title={`${w.from?.slice(0,7)}: ${w.days} ngày SX`} />;
                  })}
                </div>
                <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                  <span>{wins[0]?.from?.slice(0, 7)}</span>
                  <span className="text-blue-500 font-medium">nay</span>
                </div>
              </div>
            );
          })()}
          <div className="text-xl font-bold text-gray-900">
            {lineEntry.total_recent_days ?? lineEntry.frequency}
            <span className="text-sm font-normal text-gray-500 ml-1">ngày SX gần đây</span>
          </div>
          {lineEntry.first_date && lineEntry.last_date && (
            <div className="text-[11px] text-gray-500 mt-1">
              {lineEntry.first_date} <span className="text-gray-300 mx-1">→</span> {lineEntry.last_date}
            </div>
          )}
          {lineEntry.first_active_window !== undefined && (
            <div className="text-[10px] text-gray-400 mt-0.5">
              Giai đoạn gần nhất: {lineEntry.first_active_window === 0 ? "30 ngày qua" : `${lineEntry.first_active_window * 30}–${(lineEntry.first_active_window + 1) * 30} ngày trước`}
              {" · "}Hạng #{lineEntry.rank}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-lg px-3 py-2.5 mb-3 border border-gray-100 text-center">
          {importedQty > 0 ? (
            <div>
              <div className="text-[10px] font-semibold text-green-600 uppercase tracking-wide mb-1">Sản lượng đã import</div>
              <div className="text-xl font-bold text-green-700">{importedQty.toLocaleString()} <span className="text-sm font-normal text-gray-500">đôi/ngày</span></div>
            </div>
          ) : (
            <div className="text-xs text-gray-400 py-1">
              {pdschOrders.length > 0
                ? "Chưa có lịch sử — đang được sắp lần đầu"
                : `Chưa có lịch sử sản xuất mã ${mk_art}`}
            </div>
          )}
        </div>
      )}

      {/* Capacity target — always shown */}
      <div className="text-center mb-3">
        <div className={`text-2xl font-bold ${mode === "shoe_target" ? "text-teal-700" : "text-blue-700"}`}>
          {effective.toLocaleString()}
        </div>
        <div className="text-[11px] text-gray-500">
          đôi/ngày ·{" "}
          {mode === "shoe_target" ? "từ mục tiêu dạng giày" : mode === "custom" ? "tùy chỉnh" : "khuyến nghị lịch sử"}
        </div>
        {mode === "shoe_target" && shoeTargetEntry && (
          <div className="text-[10px] text-teal-500 mt-0.5">
            {shoeTargetEntry.pairs_per_hour}đ/h × {workingHoursPerDay ?? 8}h
          </div>
        )}
      </div>
      <div className="flex gap-1.5 mb-3">
        {[
          ...(targetQty > 0 ? [{ k: "shoe_target", label: `Mục tiêu (${targetQty.toLocaleString()})`, teal: true }] : []),
          { k: "recommended", label: modeQty > 0 ? `Lịch sử (${modeQty.toLocaleString()})` : "Lịch sử" },
          { k: "custom",      label: "Tùy chỉnh" },
        ].map(({ k, label, teal }) => (
          <button key={k}
            disabled={readOnly}
            className={`px-2 py-1 rounded text-xs border transition-colors disabled:cursor-not-allowed ${
              mode === k
                ? teal ? "bg-teal-600 text-white border-teal-600" : "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-blue-400 disabled:hover:border-gray-200"
            }`}
            onClick={() => !readOnly && setMode(k)}>{label}</button>
        ))}
      </div>
      {mode === "custom" && (
        <div className="flex items-center gap-2 mb-3">
          <input type="number" className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-400"
            value={custom} onChange={e => setCustom(e.target.value)} min={0} disabled={readOnly} />
          <span className="text-xs text-gray-500">đôi/ngày</span>
        </div>
      )}
      {readOnly ? (
        <div className="w-full px-3 py-1.5 bg-gray-100 text-gray-400 rounded-lg text-sm font-medium text-center">
          Chỉ xem
        </div>
      ) : (
        <button className="w-full px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          onClick={() => { onChoose(choiceKey, { mode, custom: +custom || modeQty }); onClose(); }}>
          Áp dụng
        </button>
      )}
    </div>
  );
}

// ─── AddLineMenu ──────────────────────────────────────────────────────────────
function AddLineMenu({ pos, modelKeyStr, configKey, currentLines, allMayLines, allGoLines, allGcLines, depNameById, floorById, aliasById, freqRankByLine, onAdd, onClose }) {
  const [q, setQ] = useState("");
  const ref = useRef(null);
  const isGc   = configKey.startsWith("gc");
  const isMay  = configKey.startsWith("may");
  const isPrimary = configKey.includes("primary");
  const allCandidates = isGc ? allGcLines : isMay ? allMayLines : allGoLines;
  const typeLabel = isGc ? "Gia công" : isMay ? "M" : "G";
  const hoverCls = isGc ? "hover:bg-orange-50" : isMay ? "hover:bg-blue-50" : "hover:bg-green-50";

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const { withFreq, withoutFreq } = useMemo(() => {
    const excl = new Set(currentLines);
    const qL = q.toLowerCase();
    const matches = (lid) => {
      if (excl.has(lid)) return false;
      if (!q) return true;
      const name  = (depNameById?.[lid] || lid).toLowerCase();
      const floor = (floorById?.[lid]   || "").toLowerCase();
      const alias = (aliasById?.[lid]   || "").toLowerCase();
      return name.includes(qL) || floor.includes(qL) || alias.includes(qL);
    };
    const with_   = allCandidates.filter(lid => freqRankByLine?.[lid] !== undefined && matches(lid));
    const without = allCandidates.filter(lid => freqRankByLine?.[lid] === undefined  && matches(lid));
    with_.sort((a, b) => (freqRankByLine[a] ?? 99) - (freqRankByLine[b] ?? 99));
    return { withFreq: with_, withoutFreq: without };
  }, [allCandidates, currentLines, q, depNameById, floorById, aliasById, freqRankByLine]);

  const withoutByFloor = useMemo(() => {
    const map = new Map();
    for (const lid of withoutFreq) {
      const floor = floorById?.[lid] || "Khác";
      if (!map.has(floor)) map.set(floor, []);
      map.get(floor).push(lid);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [withoutFreq, floorById]);

  const top  = Math.min(pos.y, window.innerHeight - 400);
  const left = Math.min(pos.x, window.innerWidth - 270);
  const total = withFreq.length + withoutFreq.length;

  const lineLabel = (lid) => {
    const dn    = depNameById?.[lid];
    const alias = aliasById?.[lid];
    if (dn && dn !== lid) return { main: dn,    sub: alias };
    if (alias)            return { main: alias,  sub: lid  };
    return                       { main: dn || lid, sub: null };
  };

  const LineRow = ({ lid, rank }) => {
    const { main, sub } = lineLabel(lid);
    return (
      <button
        className={`w-full text-left px-2 py-1 rounded flex items-center gap-1.5 ${hoverCls} transition-colors`}
        onClick={() => { onAdd(modelKeyStr, configKey, lid); onClose(); }}>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-xs font-semibold text-gray-800 leading-tight">{main}</div>
          {sub && <div className="text-[9px] text-gray-400 leading-tight">{sub}</div>}
        </div>
        {rank !== undefined && <span className="text-[10px] text-gray-400 shrink-0">#{rank}</span>}
      </button>
    );
  };

  return (
    <div ref={ref} className="fixed z-50 w-64 bg-white rounded-xl border border-gray-200 shadow-xl p-2" style={{ top, left }}>
      <div className="text-xs font-medium text-gray-500 px-1 mb-1.5">
        Thêm{" "}
        <span className={isGc ? "text-orange-600 font-semibold" : isMay ? "text-blue-600 font-semibold" : "text-green-600 font-semibold"}>
          {typeLabel}
        </span>{" "}
        {isPrimary ? "chính" : "phụ"}
      </div>
      <input autoFocus
        className="w-full px-2 py-1 text-xs border border-gray-200 rounded mb-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
        placeholder="Tìm kiếm..."
        value={q} onChange={e => setQ(e.target.value)} />
      <div className="max-h-72 overflow-auto">
        {total === 0 && <div className="text-xs text-gray-400 px-2 py-2">Không có {typeLabel} khớp</div>}
        {withFreq.length > 0 && (
          <>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-1 py-0.5">Từng làm mã này</div>
            {withFreq.map(lid => <LineRow key={lid} lid={lid} rank={freqRankByLine[lid]} />)}
          </>
        )}
        {withoutByFloor.length > 0 && (
          <>
            {withFreq.length > 0 && <div className="border-t border-gray-100 my-1" />}
            {withoutByFloor.map(([floor, lids]) => (
              <div key={floor}>
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-1 py-0.5">{floor}</div>
                {lids.map(lid => <LineRow key={lid} lid={lid} rank={undefined} />)}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── OrderMixPanel ────────────────────────────────────────────────────────────
function OrderMixPanel({ lineId, freqData, shoeTypes }) {
  const entries = useMemo(() => {
    if (!lineId || !freqData || !shoeTypes.length) return [];
    const result = [];
    for (const m of freqData) {
      const lineEntry = m.lines?.find(l => l.line_id === lineId)
        ?? (m.gc_lines || []).find(l => l.line_id === lineId);
      if (!lineEntry) continue;
      if (!shoeTypes.some(s => s.article === m.article)) continue;
      result.push({ article: m.article, cutting_die: m.cutting_die, frequency: lineEntry.frequency, rank: lineEntry.rank });
    }
    result.sort((a, b) => b.frequency - a.frequency);
    const total = result.reduce((s, e) => s + e.frequency, 0);
    return result.map(e => ({ ...e, pct: total > 0 ? Math.round(e.frequency / total * 100) : 0 }));
  }, [lineId, freqData, shoeTypes]);

  if (!lineId) return null;
  if (!entries.length) return <div className="text-xs text-gray-400 text-center py-3">Chưa từng làm mã nào trong danh sách đã chọn</div>;

  return (
    <div className="space-y-1.5">
      {entries.map(e => (
        <div key={`${e.article}||${e.cutting_die}`}>
          <div className="flex items-center justify-between text-xs mb-0.5">
            <span className="font-mono font-semibold text-gray-800">{e.article}</span>
            <span className="font-bold text-gray-700">{e.pct}%</span>
          </div>
          {e.cutting_die && <div className="text-[10px] text-gray-400 -mt-0.5 mb-0.5">{e.cutting_die}</div>}
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-400 rounded-full" style={{ width: `${e.pct}%` }} />
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">{e.frequency} ngày · hạng #{e.rank}</div>
        </div>
      ))}
    </div>
  );
}

// ─── ProductionPanel ──────────────────────────────────────────────────────────
function ProductionPanel({ lineId }) {
  const [range, setRange] = useState(() => {
    const to = vnNow(); const from = vnNow(); from.setUTCMonth(from.getUTCMonth() - 3);
    return { date_from: from.toISOString().slice(0, 10), date_to: to.toISOString().slice(0, 10) };
  });
  const PRESETS = [["3T", 3], ["6T", 6], ["1N", 12]];
  const { data: prodData, isLoading } = useLineProduction(lineId ? { line_id: lineId, ...range } : null);
  const orders = Array.isArray(prodData) ? prodData : (prodData?.items ?? []);
  const applyPreset = (m) => {
    const to = vnNow(); const from = vnNow(); from.setUTCMonth(from.getUTCMonth() - m);
    setRange({ date_from: from.toISOString().slice(0, 10), date_to: to.toISOString().slice(0, 10) });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-gray-600">Đang/đã sản xuất</span>
          <div className="flex gap-1">
            {PRESETS.map(([label, m]) => (
              <button key={label}
                className="px-1.5 py-0.5 rounded text-[10px] border border-gray-200 hover:bg-blue-50 hover:border-blue-300 text-gray-600"
                onClick={() => applyPreset(m)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-1">
          <input type="date" className="flex-1 px-1.5 py-0.5 text-[10px] border border-gray-200 rounded"
            value={range.date_from} onChange={e => setRange(r => ({ ...r, date_from: e.target.value }))} />
          <span className="text-gray-400 text-[10px] self-center">→</span>
          <input type="date" className="flex-1 px-1.5 py-0.5 text-[10px] border border-gray-200 rounded"
            value={range.date_to} onChange={e => setRange(r => ({ ...r, date_to: e.target.value }))} />
        </div>
      </div>
      <div className="flex-1 overflow-auto min-h-0">
        {isLoading ? (
          <div className="py-4 flex items-center gap-1 text-xs text-gray-400 justify-center">
            <Loader2 size={12} className="animate-spin" /> Đang tải…
          </div>
        ) : orders.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-4">Không có đơn nào</div>
        ) : (
          <table className="w-full text-[10px]">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-gray-100">
                <th className="text-left px-1.5 py-1 text-gray-400 font-medium">ĐƠN</th>
                <th className="text-left px-1.5 py-1 text-gray-400 font-medium">STYLE</th>
                <th className="text-left px-1.5 py-1 text-gray-400 font-medium">DAO · XT · DD</th>
                <th className="text-right px-1.5 py-1 text-gray-400 font-medium">ĐÔI</th>
                <th className="text-right px-1.5 py-1 text-gray-400 font-medium">TỪ→ĐẾN</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/80 align-top">
                  <td className="px-1.5 py-1">
                    <div className="font-mono font-semibold text-gray-700 text-[10px]">{o.order_id}</div>
                    <div className="text-gray-400 text-[9px]">{o.article}</div>
                  </td>
                  <td className="px-1.5 py-1 text-gray-700 leading-tight">{o.style_name || "—"}</td>
                  <td className="px-1.5 py-1 leading-tight">
                    {o.cutting_die && <div className="text-gray-500"><span className="text-gray-300">dao</span> {o.cutting_die}</div>}
                    {o.tool       && <div className="text-gray-500"><span className="text-gray-300">xt</span>  {o.tool}</div>}
                    {o.last_die   && <div className="text-gray-500"><span className="text-gray-300">dd</span>  {o.last_die}</div>}
                  </td>
                  <td className="px-1.5 py-1 text-right text-gray-700 whitespace-nowrap">{(o.total_qty || 0).toLocaleString()}</td>
                  <td className="px-1.5 py-1 text-right text-gray-400 whitespace-nowrap text-[9px]">
                    {o.first_date?.slice(5)}<br /><span className="text-gray-300">→</span>{o.last_date?.slice(5)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── LineDetailRail ───────────────────────────────────────────────────────────
function LineDetailRail({ activeLineKey, freqData, shoeTypes }) {
  if (!activeLineKey) {
    return (
      <div className="w-96 shrink-0 bg-white border border-gray-200 rounded-xl flex flex-col items-center justify-center text-center p-5 text-gray-400">
        <Info size={20} className="mb-2" />
        <div className="text-sm font-medium text-gray-500">Chọn một thẻ chuyền</div>
        <div className="text-xs mt-1">Click vào thẻ để xem tỷ trọng & lịch sử sản xuất</div>
      </div>
    );
  }
  const [lineId] = activeLineKey.split("|||");
  return (
    <div className="w-96 shrink-0 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
      <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 shrink-0">
        <div className="font-bold text-sm text-gray-900">{lineId}</div>
      </div>
      <div className="h-1/2 flex flex-col min-h-0 border-b border-gray-100">
        <div className="px-3 py-2 shrink-0">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Tỷ trọng đơn đã chọn</div>
        </div>
        <div className="flex-1 overflow-auto px-3 pb-2">
          <OrderMixPanel lineId={lineId} freqData={freqData} shoeTypes={shoeTypes} />
        </div>
      </div>
      <div className="h-1/2 flex flex-col min-h-0">
        <ProductionPanel lineId={lineId} />
      </div>
    </div>
  );
}

// ─── PriorityMatrixTab ────────────────────────────────────────────────────────
// mode: "regular" → columns: may_primary, go_primary, may_backup, go_backup
// mode: "gc"      → columns: gc_primary, gc_backup
function PriorityMatrixTab({
  mode,
  shoeTypes,
  freqData,
  freqLoading,
  lineTypeFromPool,
  allMayLines, allGoLines, allGcLines,
  depNameById, floorById, aliasById,
  priorityConfig, onPriorityConfigChange,
  showToolbar = true,
  importedTargetQty,
  onRefetch,
  refreshKey = 0,
  shoeTargetMap = {},
  workingHoursPerDay = 8,
  capChoices = {},
  onCapChoicesChange,
  readOnly = false,
}) {
  const [search,       setSearch]       = useState("");
  const [orderSearch,  setOrderSearch]  = useState("");
  const [lineSearch,   setLineSearch]   = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusMenuRef = useRef(null);
  const [activeLineKey, setActiveLineKey] = useState(null);
  const [popover, setPopover] = useState(null);
  const [addMenu, setAddMenu] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const dragRef = useRef(null);

  // model-key → style name lookup for shoe-target matching
  const styleByMk = useMemo(() => {
    const m = {};
    for (const st of shoeTypes) m[st.key] = st.style || "";
    return m;
  }, [shoeTypes]);

  // Resolve ShoeModelTarget entry for a style string (handles " / " joined values)
  const resolveTarget = useCallback((styleName) => {
    if (!styleName || !shoeTargetMap) return null;
    for (const sn of styleName.split(" / ").map(s => s.trim())) {
      const t = shoeTargetMap[sn] || shoeTargetMap[sn.toLowerCase()];
      if (t) return t;
    }
    return null;
  }, [shoeTargetMap]);

  useEffect(() => {
    if (!showStatusMenu) return;
    const h = (e) => { if (statusMenuRef.current && !statusMenuRef.current.contains(e.target)) setShowStatusMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showStatusMenu]);

  // Reset initialized when parent triggers a refresh
  useEffect(() => { setInitialized(false); }, [refreshKey]);

  const COL_DEFS = mode === "gc"
    ? [
        { configKey: "gc_primary", label: "GC chính",  color: "text-orange-700", bg: "bg-orange-50" },
        { configKey: "gc_backup",  label: "GC phụ",    color: "text-orange-500", bg: ""             },
        { configKey: "go_primary", label: "G chính",   color: "text-green-700",  bg: "bg-green-50"  },
        { configKey: "go_backup",  label: "G phụ",     color: "text-green-500",  bg: ""             },
      ]
    : [
        { configKey: "may_primary", label: "M chính", color: "text-blue-700",  bg: "bg-blue-50"  },
        { configKey: "go_primary",  label: "G chính",  color: "text-green-700", bg: "bg-green-50" },
        { configKey: "may_backup",  label: "M phụ",   color: "text-blue-500",  bg: ""            },
        { configKey: "go_backup",   label: "G phụ",    color: "text-green-500", bg: ""            },
      ];

  const getAssign = (key) => {
    const base = priorityConfig[key] || {};
    if (mode === "gc") return { gc_primary: [], gc_backup: [], go_primary: [], go_backup: [], ...base };
    return { may_primary: [], go_primary: [], may_backup: [], go_backup: [], ...base };
  };

  // Build suggested assignment per model key (mode-aware)
  const suggestedByKey = useMemo(() => {
    if (!freqData) return {};
    const map = {};
    for (const m of freqData) {
      const k = modelKey(m.article, m.cutting_die);

      if (mode === "gc") {
        const resolveType = (l) => lineTypeFromPool[l.line_id] || lineTypeOf(l.line_id, l.dep_name);
        const gcLines = m.gc_lines || [];
        const goLines = (m.lines || []).filter(l => resolveType(l) === "go");
        const thr = m.threshold ?? 0;
        const PRIMARY_MAX_WINDOW = 3;
        const qualifiesAsPrimary = (l) =>
          (l.first_active_window ?? 99) === -1 ||
          (l.first_active_window ?? 99) < PRIMARY_MAX_WINDOW;
        const gcFreqByLine = {}; gcLines.forEach((l, i) => { gcFreqByLine[l.line_id] = i + 1; });
        const goFreqByLine = {}; goLines.forEach((l, i)  => { goFreqByLine[l.line_id]  = i + 1; });
        const pdschDepNos = new Set([
          ...(m.current_future     || []).map(c => c.dep_no),
          ...(m.gc_current_future  || []).map(c => c.dep_no),
        ].filter(Boolean));
        map[k] = {
          gc_primary: gcLines.slice(0, 1).map(l => l.line_id),
          gc_backup:  gcLines.slice(1, 4).map(l => l.line_id),
          go_primary: goLines.filter(qualifiesAsPrimary).slice(0, 1).map(l => l.line_id),
          go_backup: (() => {
            const pid = goLines.filter(qualifiesAsPrimary)[0]?.line_id;
            return goLines.filter(l => l.line_id !== pid && (l.first_active_window ?? 99) <= thr).map(l => l.line_id);
          })(),
          gcFreqByLine, goFreqByLine,
          style_name: m.style_name || "",
          pdschDepNos,
          current_future: m.current_future || [],
          gc_current_future: m.gc_current_future || [],
        };
      } else {
        const resolveType = (l) => lineTypeFromPool[l.line_id] || lineTypeOf(l.line_id, l.dep_name);
        const mayLines = (m.lines || []).filter(l => resolveType(l) === "may");
        const goLines  = (m.lines || []).filter(l => resolveType(l) === "go");
        const thr = m.threshold ?? 0;
        const PRIMARY_MAX_WINDOW = 3;
        const qualifiesAsPrimary = (l) =>
          (l.first_active_window ?? 99) === -1 ||
          (l.first_active_window ?? 99) < PRIMARY_MAX_WINDOW;
        const mayFreqByLine = {}; mayLines.forEach((l, i) => { mayFreqByLine[l.line_id] = i + 1; });
        const goFreqByLine  = {}; goLines.forEach((l, i)  => { goFreqByLine[l.line_id]  = i + 1; });
        const pdschDepNos = new Set((m.current_future || []).map(c => c.dep_no).filter(Boolean));
        map[k] = {
          may_primary: mayLines.filter(qualifiesAsPrimary).slice(0, 1).map(l => l.line_id),
          go_primary:  goLines.filter(qualifiesAsPrimary).slice(0, 1).map(l => l.line_id),
          may_backup: (() => {
            const pid = mayLines.filter(qualifiesAsPrimary)[0]?.line_id;
            return mayLines.filter(l => l.line_id !== pid && (l.first_active_window ?? 99) <= thr).map(l => l.line_id);
          })(),
          go_backup: (() => {
            const pid = goLines.filter(qualifiesAsPrimary)[0]?.line_id;
            return goLines.filter(l => l.line_id !== pid && (l.first_active_window ?? 99) <= thr).map(l => l.line_id);
          })(),
          mayFreqByLine, goFreqByLine,
          style_name: m.style_name || "",
          pdschDepNos,
          current_future: m.current_future || [],
        };
      }
    }
    return map;
  }, [freqData, mode, lineTypeFromPool]);

  // Auto-init + PDSCH override
  // NOTE: both tab instances are always mounted (display:none when inactive).
  // They run their effects in the same render cycle when freqData arrives.
  // Using a functional updater (prev => ...) ensures each tab merges its own
  // delta on top of the latest state instead of overwriting the other tab.
  useEffect(() => {
    if (!freqData) return;
    const delta = {};   // only keys owned by this tab's mode
    let changed = false;

    for (const { key } of shoeTypes) {
      const sug = suggestedByKey[key];
      if (!sug) continue;
      const existing = priorityConfig[key];

      if (mode === "gc") {
        if (!existing?.gc_primary) {
          delta[key] = {
            ...(existing || {}),
            gc_primary: sug.gc_primary, gc_backup: sug.gc_backup,
            go_primary: sug.go_primary, go_backup: sug.go_backup,
          };
          changed = true;
        } else if (initialized) {
          const pdschNos = sug.pdschDepNos;
          if (pdschNos?.size) {
            const updated = { ...existing };
            let colChanged = false;
            const pdschGc = (sug.gc_primary || []).filter(lid => pdschNos.has(lid));
            if (pdschGc.length > 0 && !pdschGc.some(lid => (existing.gc_primary || []).includes(lid))) {
              updated.gc_primary = [...pdschGc, ...(existing.gc_primary || []).filter(l => !pdschGc.includes(l))];
              colChanged = true;
            }
            const pdschGo = (sug.go_primary || []).filter(lid => pdschNos.has(lid));
            if (pdschGo.length > 0 && !pdschGo.some(lid => (existing.go_primary || []).includes(lid))) {
              updated.go_primary = [...pdschGo, ...(existing.go_primary || []).filter(l => !pdschGo.includes(l))];
              colChanged = true;
            }
            if (colChanged) { delta[key] = updated; changed = true; }
          }
        }
      } else {
        if (!existing) {
          delta[key] = {
            may_primary: sug.may_primary, go_primary: sug.go_primary,
            may_backup:  sug.may_backup,  go_backup:  sug.go_backup,
          };
          changed = true;
        } else if (initialized) {
          const pdschNos = sug.pdschDepNos;
          if (!pdschNos?.size) continue;
          let colChanged = false;
          const updated = { ...existing };
          const pdschMay = sug.may_primary.filter(lid => pdschNos.has(lid));
          if (pdschMay.length > 0 && !pdschMay.some(lid => (existing.may_primary || []).includes(lid))) {
            updated.may_primary = [...pdschMay, ...(existing.may_primary || []).filter(l => !pdschMay.includes(l))];
            colChanged = true;
          }
          const pdschGo = sug.go_primary.filter(lid => pdschNos.has(lid));
          if (pdschGo.length > 0 && !pdschGo.some(lid => (existing.go_primary || []).includes(lid))) {
            updated.go_primary = [...pdschGo, ...(existing.go_primary || []).filter(l => !pdschGo.includes(l))];
            colChanged = true;
          }
          if (colChanged) { delta[key] = updated; changed = true; }
        }
      }
    }

    if (!initialized || changed) {
      setInitialized(true);
      if (changed) onPriorityConfigChange(prev => ({ ...prev, ...delta }));
    }
  }, [freqData]); // eslint-disable-line

  const handleRemove = (mk, ck, lid) => {
    if (readOnly) return;
    const cur = getAssign(mk);
    onPriorityConfigChange({ ...priorityConfig, [mk]: { ...cur, [ck]: cur[ck].filter(l => l !== lid) } });
  };

  const handleAdd = (mk, ck, lid) => {
    if (readOnly) return;
    const cur = getAssign(mk);
    if ((cur[ck] || []).includes(lid)) return;
    onPriorityConfigChange({ ...priorityConfig, [mk]: { ...cur, [ck]: [...(cur[ck] || []), lid] } });
  };

  const handleDrop = (toMk, toConfigKey) => {
    if (readOnly) return;
    const d = dragRef.current; dragRef.current = null;
    if (!d || (d.fromMk === toMk && d.fromConfigKey === toConfigKey)) return;
    const typeOf = (ck) => ck.startsWith("gc") ? "gc" : ck.startsWith("may") ? "may" : "go";
    if (typeOf(d.fromConfigKey) !== typeOf(toConfigKey)) return;
    const updates = { ...priorityConfig };
    const srcAssign = getAssign(d.fromMk);
    updates[d.fromMk] = { ...srcAssign, [d.fromConfigKey]: srcAssign[d.fromConfigKey].filter(l => l !== d.lineId) };
    const dstBase = toMk === d.fromMk ? updates[toMk] : getAssign(toMk);
    if (!(dstBase[toConfigKey] || []).includes(d.lineId)) {
      updates[toMk] = { ...dstBase, [toConfigKey]: [...(dstBase[toConfigKey] || []), d.lineId] };
    }
    onPriorityConfigChange(updates);
    setActiveLineKey(`${d.lineId}|||${toMk}|||${toConfigKey}`);
  };

  const handleActivate = (lineId, mk, ck, e) => {
    setActiveLineKey(`${lineId}|||${mk}|||${ck}`);
    setPopover({ lineId, depName: depNameById[lineId] || lineId, modelKey: mk, styleName: styleByMk[mk] || "", x: e.clientX, y: e.clientY });
    setAddMenu(null);
  };

  const handleContextMenu = (mk, ck, e) => {
    if (readOnly) return;
    setAddMenu({ modelKey: mk, configKey: ck, x: e.clientX, y: e.clientY });
    setPopover(null);
  };

  const noPrimary = shoeTypes.filter(s => {
    const a = getAssign(s.key);
    if (mode === "gc") return !(a.gc_primary || []).length && !(a.go_primary || []).length;
    return !(a.may_primary || []).length && !(a.go_primary || []).length;
  }).length;

  const STATUS_OPTIONS = mode === "gc"
    ? [
        { value: "all",        label: "Tất cả" },
        { value: "no_history", label: "Chưa có lịch sử" },
        { value: "no_gc",      label: "Thiếu GC chính" },
        { value: "no_go",      label: "Thiếu gò chính" },
      ]
    : [
        { value: "all",        label: "Tất cả" },
        { value: "no_history", label: "Chưa có lịch sử" },
        { value: "no_may",     label: "Thiếu may chính" },
        { value: "no_go",      label: "Thiếu gò chính" },
      ];

  const filtered = useMemo(() => {
    return shoeTypes.filter(st => {
      const q  = search.toLowerCase();
      const oq = orderSearch.toLowerCase().trim();
      const lq = lineSearch.toLowerCase().trim();
      if (q && !st.article.toLowerCase().includes(q) && !st.cutting_die.toLowerCase().includes(q) && !st.style.toLowerCase().includes(q)) return false;
      if (oq && !st.orderIds.some(id => id.toLowerCase().includes(oq))) return false;
      if (lq) {
        const a = getAssign(st.key);
        const allLids = [...(a.may_primary || []), ...(a.go_primary || []),
                         ...(a.gc_primary  || []), ...(a.gc_backup  || []),
                         ...(a.may_backup  || []), ...(a.go_backup  || [])];
        if (!allLids.some(lid => (depNameById[lid] || lid).toLowerCase().includes(lq))) return false;
      }
      const a   = getAssign(st.key);
      const sug = suggestedByKey[st.key];
      switch (statusFilter) {
        case "no_history": if (sug) return false; break;
        case "no_gc":  if ((a.gc_primary  || []).length) return false; break;
        case "no_may": if ((a.may_primary || []).length) return false; break;
        case "no_go":  if ((a.go_primary  || []).length) return false; break;
        default: break;
      }
      return true;
    });
  }, [shoeTypes, search, orderSearch, lineSearch, statusFilter, priorityConfig, suggestedByKey, depNameById]); // eslint-disable-line

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Stats bar */}
      {showToolbar && (
        <div className="flex items-center gap-3 px-1 shrink-0">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span><strong className="text-gray-900">{filtered.length}</strong>/{shoeTypes.length} dạng giày</span>
            {noPrimary > 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{noPrimary} thiếu chuyền chính</span>
            ) : shoeTypes.length > 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Đã gán đủ</span>
            ) : null}
          </div>
          <div className="flex-1" />
          <button className="p-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
            onClick={() => { setInitialized(false); onRefetch?.(); }} title="Tải lại dữ liệu">
            <RefreshCw size={13} />
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-1 shrink-0 flex-wrap">
        <div className="relative">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="pl-6 pr-2 py-1 text-xs border border-gray-200 rounded w-40 focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="Article / dao / tên…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="relative">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="pl-6 pr-2 py-1 text-xs border border-gray-200 rounded w-36 focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="Mã đơn hàng…" value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
        </div>
        <div className="relative">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="pl-6 pr-2 py-1 text-xs border border-gray-200 rounded w-36 focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder={mode === "gc" ? "GC / Gò…" : "May / Gò…"} value={lineSearch} onChange={e => setLineSearch(e.target.value)} />
        </div>
        <div className="relative" ref={statusMenuRef}>
          <button
            className={["inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border transition-colors",
              statusFilter !== "all" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400",
            ].join(" ")}
            onClick={() => setShowStatusMenu(v => !v)}>
            <Filter size={11} />
            {statusFilter === "all" ? "Lọc" : STATUS_OPTIONS.find(o => o.value === statusFilter)?.label}
          </button>
          {showStatusMenu && (
            <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-1 min-w-[180px]">
              {STATUS_OPTIONS.map(opt => (
                <button key={opt.value}
                  className={["w-full text-left px-3 py-1.5 text-xs rounded transition-colors",
                    statusFilter === opt.value ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-50",
                  ].join(" ")}
                  onClick={() => { setStatusFilter(opt.value); setShowStatusMenu(false); }}>
                  {statusFilter === opt.value && <span className="mr-1">✓</span>}
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {(search || orderSearch || lineSearch || statusFilter !== "all") && (
          <button className="text-[10px] text-gray-400 hover:text-red-500 underline transition-colors"
            onClick={() => { setSearch(""); setOrderSearch(""); setLineSearch(""); setStatusFilter("all"); }}>
            Xóa filter
          </button>
        )}
      </div>

      {/* Matrix + rail */}
      <div className="flex gap-3 flex-1 min-h-0">
        <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-auto">
          {freqLoading && shoeTypes.length > 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
              <Loader2 size={18} className="animate-spin text-blue-500" />
              <span className="text-sm">Đang tải dữ liệu tần suất chuyền…</span>
            </div>
          ) : shoeTypes.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
              <Info size={18} />
              <span className="text-sm">Chưa có dạng giày — hãy chọn đơn ở Bước 1 trước</span>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white z-10 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-48">Dạng giày</th>
                  {COL_DEFS.map(({ configKey, label, color, bg }) => (
                    <th key={configKey} className={`px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide ${color} ${bg}`}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(st => {
                  const assign = getAssign(st.key);
                  const sug = suggestedByKey[st.key];
                  const freqByLine = mode === "gc"
                    ? { ...(sug?.gcFreqByLine || {}), ...(sug?.goFreqByLine || {}) }
                    : { ...(sug?.mayFreqByLine || {}), ...(sug?.goFreqByLine || {}) };
                  const pdschDepNos = sug?.pdschDepNos;
                  return (
                    <tr key={st.key} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-3 py-2 border-r border-gray-100 align-top max-w-[220px]">
                        <div className="flex items-start gap-1">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <code className="text-[11px] font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{st.article}</code>
                              {st.cutting_die && <span className="text-[10px] text-gray-500 font-mono">{st.cutting_die}</span>}
                            </div>
                            {(sug?.style_name || st.style) && (() => {
                              const styleName = sug?.style_name || st.style;
                              const target = resolveTarget(styleName);
                              return (
                                <div className="flex items-center gap-1 mt-1 flex-wrap">
                                  <div className="text-[12px] font-semibold text-gray-900 leading-tight">{styleName}</div>
                                  {target && (
                                    <span
                                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 border border-teal-200 whitespace-nowrap"
                                      title={`Mục tiêu: ${target.pairs_per_hour} đ/h × ${workingHoursPerDay} giờ = ${Math.round(target.pairs_per_hour * workingHoursPerDay).toLocaleString()} đ/ngày`}>
                                      MT {target.pairs_per_hour}đ/h
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                            {!sug && !freqLoading && <div className="text-[10px] text-red-400 mt-0.5">Chưa có lịch sử</div>}
                          </div>
                          <OrdersDropdown orderIds={st.orderIds} />
                        </div>
                      </td>
                      {COL_DEFS.map(({ configKey: ck }) => (
                        <DropCell
                          key={ck}
                          mk={st.key}
                          configKey={ck}
                          lines={assign[ck] || []}
                          freqByLine={freqByLine}
                          depNameById={depNameById}
                          pdschDepNos={pdschDepNos}
                          activeLineKey={activeLineKey}
                          onActivate={handleActivate}
                          onRemove={handleRemove}
                          onDrop={handleDrop}
                          onContextMenu={handleContextMenu}
                          dragRef={dragRef}
                          noQtyCheck={importedTargetQty ? (lid) => !importedTargetQty[st.key]?.[lid] : null}
                          readOnly={readOnly}
                        />
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {showToolbar && <LineDetailRail activeLineKey={activeLineKey} freqData={freqData} shoeTypes={shoeTypes} />}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[11px] text-gray-400 px-1 shrink-0">
        {mode === "gc" ? (
          <><span className="text-orange-500">◉ GC</span><span className="text-green-500">◉ Gò</span></>
        ) : (
          <><span className="text-blue-500">◉ May</span><span className="text-green-500">◉ Gò</span></>
        )}
        <span>✦ Kéo thả cùng loại</span>
        <span>✦ Click thẻ → năng lực</span>
        <span>✦ Chuột phải → thêm chuyền</span>
      </div>

      {/* Overlays */}
      {popover && (
        <CapacityPopover
          lineId={popover.lineId}
          depName={popover.depName}
          modelKeyStr={popover.modelKey}
          pos={{ x: popover.x, y: popover.y }}
          freqData={freqData}
          capChoices={capChoices}
          importedTargetQty={importedTargetQty}
          floorById={floorById}
          aliasById={aliasById}
          shoeTargetEntry={resolveTarget(popover.styleName)}
          workingHoursPerDay={workingHoursPerDay}
          onChoose={(key, choice) => onCapChoicesChange?.(prev => ({ ...prev, [key]: choice }))}
          onClose={() => setPopover(null)}
          readOnly={readOnly}
        />
      )}
      {addMenu && (() => {
        const cur = getAssign(addMenu.modelKey);
        const allLids = [
          ...(cur.may_primary || []), ...(cur.may_backup || []),
          ...(cur.go_primary  || []), ...(cur.go_backup  || []),
          ...(cur.gc_primary  || []), ...(cur.gc_backup  || []),
        ];
        const sug = suggestedByKey[addMenu.modelKey];
        const ck  = addMenu.configKey;
        const freqRankByLine = ck.startsWith("gc")
          ? (sug?.gcFreqByLine  || {})
          : ck.startsWith("may")
            ? (sug?.mayFreqByLine || {})
            : (sug?.goFreqByLine  || {});
        return (
          <AddLineMenu
            pos={{ x: addMenu.x, y: addMenu.y }}
            modelKeyStr={addMenu.modelKey}
            configKey={addMenu.configKey}
            currentLines={allLids}
            allMayLines={allMayLines} allGoLines={allGoLines} allGcLines={allGcLines}
            depNameById={depNameById} floorById={floorById} aliasById={aliasById}
            freqRankByLine={freqRankByLine}
            onAdd={handleAdd}
            onClose={() => setAddMenu(null)}
          />
        );
      })()}
    </div>
  );
}


export default PriorityMatrixTab;
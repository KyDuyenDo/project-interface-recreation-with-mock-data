import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GitBranch, Users, AlertTriangle, Factory,
  Search, X, Plus,
} from "lucide-react";
import { usePermissions } from "../../hooks/usePermissions";
import { http } from "../../api/http";
import { MOCK_USERS } from "../../api/mockData";

// ── Constants ─────────────────────────────────────────────────────────────────
const ALL_SUB_PLANNERS = Object.values(MOCK_USERS).filter(u => u.role === "sub_planner");

const FACTORY_COLORS = {
  B: { bg: "bg-blue-100",    text: "text-blue-800",    border: "border-blue-200",   dot: "bg-blue-400"   },
  C: { bg: "bg-violet-100",  text: "text-violet-800",  border: "border-violet-200", dot: "bg-violet-400" },
  A: { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-200",dot: "bg-emerald-400"},
};
const DEFAULT_FC = FACTORY_COLORS.B;

function getFactory(lineId) { return (lineId || "").split("_")[0]; }
function lineColors(lineId) { return FACTORY_COLORS[getFactory(lineId)] || DEFAULT_FC; }

let _uid = 0;
const uid = () => String(++_uid);

// ── Search popup (fixed positioning) ─────────────────────────────────────────
function SearchPopup({ title, placeholder, items, onPick, onClose, x, y }) {
  const [q, setQ] = useState("");
  const ref   = useRef(null);
  const input = useRef(null);

  const top  = Math.min(y, window.innerHeight - 300);
  const left = Math.min(x, window.innerWidth  - 290);

  useEffect(() => {
    input.current?.focus();
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const filtered = useMemo(
    () => items.filter(it => it.label.toLowerCase().includes(q.toLowerCase())),
    [items, q],
  );

  return (
    <div
      ref={ref}
      style={{ position: "fixed", top, left, zIndex: 9999, width: 280 }}
      className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
      onContextMenu={e => e.stopPropagation()}
    >
      {/* header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 border-b border-gray-100">
        <span className="text-xs font-semibold text-gray-700">{title}</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X size={13} />
        </button>
      </div>

      {/* search */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            ref={input}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={placeholder}
            className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 bg-white"
          />
        </div>
      </div>

      {/* list */}
      <div className="max-h-56 overflow-y-auto py-1">
        {filtered.length === 0
          ? <div className="px-3 py-6 text-center text-xs text-gray-400">Không tìm thấy kết quả</div>
          : filtered.map(it => (
              <button
                key={it.id}
                className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2.5 transition-colors"
                onClick={() => { onPick(it.id); onClose(); }}
              >
                {it.icon}
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-gray-800 truncate">{it.label}</div>
                  {it.sub && <div className="text-[10px] text-gray-400 truncate">{it.sub}</div>}
                </div>
              </button>
            ))
        }
      </div>
    </div>
  );
}

// ── Tag chip ──────────────────────────────────────────────────────────────────
function Tag({ label, colorCls, onRemove }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border select-none ${colorCls}`}>
      {label}
      <button
        onMouseDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onRemove(); }}
        className="opacity-50 hover:opacity-100 transition-opacity ml-0.5"
      >
        <X size={10} />
      </button>
    </span>
  );
}

// ── Tag cell (right-click to open popup) ─────────────────────────────────────
function TagCell({ children, onContextMenu, placeholder, dropTarget, onDragOver, onDrop, onDragLeave }) {
  return (
    <div
      className={`flex flex-wrap gap-1.5 items-start content-start min-h-[52px] px-3 py-2.5 cursor-context-menu transition-colors
        ${dropTarget ? "bg-blue-50 ring-2 ring-inset ring-blue-300" : "hover:bg-gray-50/60"}`}
      onContextMenu={onContextMenu}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
    >
      {children}
      {!children?.length && (
        <span className="text-[11px] text-gray-300 italic self-center">{placeholder}</span>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LineAssignmentPage() {
  const { isMain } = usePermissions();
  const queryClient = useQueryClient();

  // rows[i] = { _id, lineIds: [], plannerUsernames: [] }
  const [rows,        setRows]        = useState([{ _id: uid(), lineIds: [], plannerUsernames: [] }]);
  const [initialized, setInitialized] = useState(false);
  const [popup,       setPopup]       = useState(null); // { rowId, col, x, y }
  const [dragging,    setDragging]    = useState(null); // { rowId, col, id }
  const [dropOver,    setDropOver]    = useState(null); // { rowId, col }

  // ── Data ─────────────────────────────────────────────────────────────────────
  const { data: assignmentsData, isLoading } = useQuery({
    queryKey: ["line-assignments"],
    queryFn: () => http.get("/lines/assignments").then(r => r.data),
  });
  const { data: linesData } = useQuery({
    queryKey: ["lines-pool"],
    queryFn: () => http.get("/lines/pool").then(r => r.data),
  });
  const allLines = linesData || [];

  // Hydrate from server into rows (group by planner)
  useEffect(() => {
    if (!assignmentsData || !linesData || initialized) return;
    const items = assignmentsData?.items || [];
    if (!items.length) { setInitialized(true); return; }

    // Group: one row per unique planner set
    const plannerMap = {};
    items.forEach(a => {
      const k = a.planner_username || "__none__";
      if (!plannerMap[k]) plannerMap[k] = [];
      plannerMap[k].push(a.line_id);
    });

    const hydrated = Object.entries(plannerMap).map(([planner, lineIds]) => ({
      _id:             uid(),
      lineIds,
      plannerUsernames: planner === "__none__" ? [] : [planner],
    }));

    setRows(hydrated.length ? hydrated : [{ _id: uid(), lineIds: [], plannerUsernames: [] }]);
    setInitialized(true);
  }, [assignmentsData, linesData, initialized]);

  // ── Save mutation ─────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: ({ line_id, planner_username }) =>
      http.put("/lines/assignments", { line_id, planner_username }).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["line-assignments"] }),
  });

  const saveRow = useCallback((row) => {
    row.plannerUsernames.forEach(u => {
      row.lineIds.forEach(lineId => {
        saveMutation.mutate({ line_id: lineId, planner_username: u });
      });
    });
  }, [saveMutation]);

  // ── Row mutations ─────────────────────────────────────────────────────────────
  const addRow = () =>
    setRows(p => [...p, { _id: uid(), lineIds: [], plannerUsernames: [] }]);

  const removeRow = (rowId) =>
    setRows(p => p.length > 1 ? p.filter(r => r._id !== rowId) : p);

  const addToCell = useCallback((rowId, col, id) => {
    setRows(prev => prev.map(r => {
      if (r._id !== rowId) return r;
      const key = col === "line" ? "lineIds" : "plannerUsernames";
      if (r[key].includes(id)) return r;
      const updated = { ...r, [key]: [...r[key], id] };
      setTimeout(() => saveRow(updated), 0);
      return updated;
    }));
  }, [saveRow]);

  const removeFromCell = useCallback((rowId, col, id) => {
    setRows(prev => prev.map(r => {
      if (r._id !== rowId) return r;
      const key = col === "line" ? "lineIds" : "plannerUsernames";
      return { ...r, [key]: r[key].filter(x => x !== id) };
    }));
  }, []);

  // ── Drag & drop ───────────────────────────────────────────────────────────────
  const handleDragStart = (rowId, col, id) => setDragging({ rowId, col, id });
  const handleDragEnd   = () => { setDragging(null); setDropOver(null); };

  const handleDrop = useCallback((toRowId, toCol) => {
    if (!dragging) return;
    const { rowId: fromRowId, col: fromCol, id } = dragging;
    if (fromRowId === toRowId && fromCol === toCol) { setDropOver(null); return; }
    if (fromCol !== toCol) { setDropOver(null); return; } // only same-col drops
    // Remove from source row, add to target row
    setRows(prev => {
      const key = toCol === "line" ? "lineIds" : "plannerUsernames";
      return prev.map(r => {
        if (r._id === fromRowId) return { ...r, [key]: r[key].filter(x => x !== id) };
        if (r._id === toRowId)   return { ...r, [key]: r[key].includes(id) ? r[key] : [...r[key], id] };
        return r;
      });
    });
    setDropOver(null);
    setDragging(null);
  }, [dragging]);

  // ── Available items ───────────────────────────────────────────────────────────
  const usedLineIds = useMemo(
    () => new Set(rows.flatMap(r => r.lineIds)),
    [rows],
  );
  const usedPlanners = useMemo(
    () => new Set(rows.flatMap(r => r.plannerUsernames)),
    [rows],
  );

  const lineItems = useCallback((rowId) =>
    allLines
      .filter(l => !usedLineIds.has(l.line_id) || rows.find(r => r._id === rowId)?.lineIds.includes(l.line_id))
      .filter(l => !usedLineIds.has(l.line_id))
      .map(l => {
        const c = lineColors(l.line_id);
        return {
          id:    l.line_id,
          label: l.line_id,
          sub:   l.line_type || "production",
          icon:  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${c.bg} ${c.text} ${c.border} shrink-0`}>{l.line_id}</span>,
        };
      }),
    [allLines, usedLineIds, rows],
  );

  const plannerItems = useCallback((rowId) =>
    ALL_SUB_PLANNERS
      .filter(u => !usedPlanners.has(u.username) || rows.find(r => r._id === rowId)?.plannerUsernames.includes(u.username))
      .filter(u => !usedPlanners.has(u.username))
      .map(u => ({
        id:    u.username,
        label: u.username,
        sub:   u.full_name,
        icon: (
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
            {u.full_name.slice(0, 2).toUpperCase()}
          </div>
        ),
      })),
    [usedPlanners, rows],
  );

  // ── Context menu ──────────────────────────────────────────────────────────────
  const openPopup = useCallback((e, rowId, col) => {
    e.preventDefault();
    setPopup({ rowId, col, x: e.clientX, y: e.clientY + 6 });
  }, []);

  const popupRow = popup ? rows.find(r => r._id === popup.rowId) : null;

  // ── Guard ─────────────────────────────────────────────────────────────────────
  if (!isMain) {
    return (
      <div className="flex flex-col h-full">
        <header className="flex items-center h-14 px-5 border-b border-gray-200 bg-white shrink-0">
          <div className="text-sm font-semibold text-gray-900">Phân chuyền</div>
        </header>
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <AlertTriangle size={28} className="mx-auto mb-2 text-amber-400" />
            <div className="text-sm font-semibold text-gray-600">Bạn không có quyền truy cập trang này.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full"
      onClick={() => setPopup(null)}
      onDragEnd={handleDragEnd}
    >
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header className="flex items-center h-14 px-5 border-b border-gray-200 bg-white shrink-0 gap-3">
        <GitBranch size={15} className="text-blue-500 shrink-0" />
        <div>
          <div className="text-sm font-semibold text-gray-900">Phân chuyền Sub-Planner</div>
          <div className="text-xs text-gray-400 mt-0.5">
            Chuột phải vào ô để thêm · Kéo tag để chuyển hàng
          </div>
        </div>
        <div className="flex-1" />
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          {rows.filter(r => r.lineIds.length && r.plannerUsernames.length).length}/{rows.length} hàng hoàn chỉnh
        </span>
      </header>

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-auto bg-gray-50 p-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Column headers */}
          <div className="grid grid-cols-[40px_1fr_1fr_36px] border-b border-gray-200 bg-gray-50">
            <div />
            <div className="px-4 py-3 flex items-center gap-2 border-r border-gray-200">
              <Factory size={13} className="text-blue-400" />
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Chuyền</span>
            </div>
            <div className="px-4 py-3 flex items-center gap-2">
              <Users size={13} className="text-purple-400" />
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Sub-Planner</span>
            </div>
            <div />
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="py-14 flex flex-col items-center gap-2 text-gray-400">
              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Đang tải...</span>
            </div>
          )}

          {/* Rows */}
          {!isLoading && rows.map((row, idx) => {
            const isDropLine    = dropOver?.rowId === row._id && dropOver?.col === "line";
            const isDropPlanner = dropOver?.rowId === row._id && dropOver?.col === "planner";

            return (
              <div
                key={row._id}
                className="grid grid-cols-[40px_1fr_1fr_36px] border-b border-gray-100 last:border-b-0 group/row hover:bg-gray-50/30 transition-colors"
              >
                {/* Row index */}
                <div className="flex items-center justify-center text-[10px] text-gray-300 font-mono border-r border-gray-100">
                  {idx + 1}
                </div>

                {/* ── Chuyền cell ─────────────────────────────────────────── */}
                <TagCell
                  placeholder="chuột phải để thêm chuyền…"
                  dropTarget={isDropLine}
                  onContextMenu={e => openPopup(e, row._id, "line")}
                  onDragOver={e => { e.preventDefault(); setDropOver({ rowId: row._id, col: "line" }); }}
                  onDrop={() => handleDrop(row._id, "line")}
                  onDragLeave={() => setDropOver(null)}
                >
                  {row.lineIds.map(lineId => {
                    const c = lineColors(lineId);
                    return (
                      <span
                        key={lineId}
                        draggable
                        onDragStart={e => { e.dataTransfer.effectAllowed = "move"; handleDragStart(row._id, "line", lineId); }}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border cursor-grab active:cursor-grabbing select-none ${c.bg} ${c.text} ${c.border}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${c.dot} shrink-0`} />
                        {lineId}
                        <button
                          onMouseDown={e => e.stopPropagation()}
                          onClick={e => { e.stopPropagation(); removeFromCell(row._id, "line", lineId); }}
                          className="opacity-50 hover:opacity-100 transition-opacity ml-0.5"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    );
                  })}
                </TagCell>

                {/* ── Sub-Planner cell ────────────────────────────────────── */}
                <TagCell
                  placeholder="chuột phải để thêm Sub-Planner…"
                  dropTarget={isDropPlanner}
                  onContextMenu={e => openPopup(e, row._id, "planner")}
                  onDragOver={e => { e.preventDefault(); setDropOver({ rowId: row._id, col: "planner" }); }}
                  onDrop={() => handleDrop(row._id, "planner")}
                  onDragLeave={() => setDropOver(null)}
                >
                  {row.plannerUsernames.map(u => (
                    <span
                      key={u}
                      draggable
                      onDragStart={e => { e.dataTransfer.effectAllowed = "move"; handleDragStart(row._id, "planner", u); }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border cursor-grab active:cursor-grabbing select-none bg-violet-100 text-violet-800 border-violet-200"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                      {u}
                      <button
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); removeFromCell(row._id, "planner", u); }}
                        className="opacity-50 hover:opacity-100 transition-opacity ml-0.5"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </TagCell>

                {/* Remove row */}
                <div className="flex items-start justify-center pt-3">
                  <button
                    onClick={e => { e.stopPropagation(); removeRow(row._id); }}
                    className="opacity-0 group-hover/row:opacity-100 text-gray-300 hover:text-red-400 transition-all p-0.5 rounded"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add row */}
          <button
            onClick={addRow}
            className="w-full flex items-center gap-2 px-5 py-3 text-xs text-gray-400 hover:text-blue-500 hover:bg-blue-50/50 transition-colors border-t border-gray-100 group"
          >
            <Plus size={14} className="group-hover:scale-110 transition-transform" />
            Thêm hàng
          </button>
        </div>
      </div>

      {/* ── Popup ────────────────────────────────────────────────────────────── */}
      {popup?.col === "line" && popupRow && (
        <SearchPopup
          title="Thêm chuyền"
          placeholder="Tìm mã chuyền..."
          items={lineItems(popup.rowId)}
          onPick={id => addToCell(popup.rowId, "line", id)}
          onClose={() => setPopup(null)}
          x={popup.x}
          y={popup.y}
        />
      )}
      {popup?.col === "planner" && popupRow && (
        <SearchPopup
          title="Thêm Sub-Planner"
          placeholder="Tìm username..."
          items={plannerItems(popup.rowId)}
          onPick={id => addToCell(popup.rowId, "planner", id)}
          onClose={() => setPopup(null)}
          x={popup.x}
          y={popup.y}
        />
      )}
    </div>
  );
}

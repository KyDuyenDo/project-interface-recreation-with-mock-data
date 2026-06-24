import { useState, useMemo, useRef, useEffect, useCallback, useId } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GitBranch, Users, Check, AlertTriangle, Factory,
  Search, X, Plus, ChevronRight,
} from "lucide-react";
import { usePermissions } from "../../hooks/usePermissions";
import { http } from "../../api/http";
import { MOCK_USERS } from "../../api/mockData";

const ALL_SUB_PLANNERS = Object.values(MOCK_USERS).filter(u => u.role === "sub_planner");

const FACTORY_COLORS = {
  B: { row: "bg-blue-50/40", header: "bg-blue-50 border-blue-200", badge: "bg-blue-100 text-blue-800 border-blue-200", dot: "bg-blue-400", text: "text-blue-700" },
  C: { row: "bg-violet-50/40", header: "bg-violet-50 border-violet-200", badge: "bg-violet-100 text-violet-800 border-violet-200", dot: "bg-violet-400", text: "text-violet-700" },
  A: { row: "bg-emerald-50/40", header: "bg-emerald-50 border-emerald-200", badge: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "bg-emerald-400", text: "text-emerald-700" },
};
const DEFAULT_COLORS = FACTORY_COLORS.B;

const PLANNER_GRADIENTS = [
  "from-blue-400 to-blue-600",
  "from-violet-400 to-purple-600",
  "from-emerald-400 to-teal-600",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-600",
];

function getFactory(lineId) { return (lineId || "").split("_")[0]; }

function plannerGradient(username) {
  const idx = ALL_SUB_PLANNERS.findIndex(u => u.username === username);
  return PLANNER_GRADIENTS[(idx < 0 ? 0 : idx) % PLANNER_GRADIENTS.length];
}

// ── Cell search popup ─────────────────────────────────────────────────────────
function CellPopup({ title, placeholder, items, onPick, onClose, style }) {
  const [q, setQ] = useState("");
  const ref   = useRef(null);
  const input = useRef(null);

  useEffect(() => {
    input.current?.focus();
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const filtered = useMemo(
    () => items.filter(it => it.label.toLowerCase().includes(q.toLowerCase())),
    [items, q],
  );

  return (
    <div
      ref={ref}
      style={style}
      className="fixed z-50 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
      onContextMenu={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 bg-gray-50">
        <span className="text-xs font-semibold text-gray-700">{title}</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
      </div>
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
      <div className="max-h-60 overflow-y-auto py-1">
        {filtered.length === 0
          ? <div className="px-3 py-6 text-center text-xs text-gray-400">Không tìm thấy kết quả</div>
          : filtered.map(it => (
              <button
                key={it.id}
                className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2.5 transition-colors"
                onClick={() => { onPick(it); onClose(); }}
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

// ── Main page ─────────────────────────────────────────────────────────────────
let _uid = 0;
const uid = () => String(++_uid);

export default function LineAssignmentPage() {
  const { isMain } = usePermissions();
  const queryClient = useQueryClient();

  // rows: [{ _id, lineId, lineType, plannerUsername, saved }]
  const [rows,        setRows]        = useState([{ _id: uid(), lineId: "", lineType: "", plannerUsername: "" }]);
  const [popup,       setPopup]       = useState(null); // { rowId, col, x, y }
  const [initialized, setInitialized] = useState(false);

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: assignmentsData, isLoading } = useQuery({
    queryKey: ["line-assignments"],
    queryFn: () => http.get("/lines/assignments").then(r => r.data),
  });
  const { data: linesData } = useQuery({
    queryKey: ["lines-pool"],
    queryFn: () => http.get("/lines/pool").then(r => r.data),
  });
  const allLines = linesData || [];

  // Hydrate rows from server (once)
  useEffect(() => {
    if (!assignmentsData || initialized || !linesData) return;
    const items = assignmentsData?.items || [];
    if (items.length === 0) return;
    const hydrated = items.map(a => {
      const info = allLines.find(l => l.line_id === a.line_id);
      return {
        _id:             uid(),
        lineId:          a.line_id,
        lineType:        info?.line_type || "",
        plannerUsername: a.planner_username || "",
      };
    });
    setRows(hydrated.length ? hydrated : [{ _id: uid(), lineId: "", lineType: "", plannerUsername: "" }]);
    setInitialized(true);
  }, [assignmentsData, linesData, initialized]);

  // ── Mutation ────────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: ({ line_id, planner_username }) =>
      http.put("/lines/assignments", { line_id, planner_username }).then(r => r.data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["line-assignments"] });
      setRows(prev => prev.map(r =>
        r.lineId === vars.line_id ? { ...r, saved: true } : r
      ));
      setTimeout(() => {
        setRows(prev => prev.map(r =>
          r.lineId === vars.line_id ? { ...r, saved: false } : r
        ));
      }, 2200);
    },
  });

  // ── Row helpers ─────────────────────────────────────────────────────────────
  const updateRow = useCallback((id, patch) => {
    setRows(prev => prev.map(r => r._id === id ? { ...r, ...patch } : r));
  }, []);

  const removeRow = useCallback((id) => {
    setRows(prev => prev.length > 1 ? prev.filter(r => r._id !== id) : prev);
  }, []);

  const addRow = () => {
    setRows(prev => [...prev, { _id: uid(), lineId: "", lineType: "", plannerUsername: "" }]);
  };

  // Pick line for a row
  const pickLine = useCallback((rowId, lineItem) => {
    updateRow(rowId, { lineId: lineItem.id, lineType: lineItem.lineType });
  }, [updateRow]);

  // Pick planner for a row
  const pickPlanner = useCallback((rowId, plannerItem, lineId) => {
    updateRow(rowId, { plannerUsername: plannerItem.id });
    if (lineId) saveMutation.mutate({ line_id: lineId, planner_username: plannerItem.id });
  }, [updateRow, saveMutation]);

  // ── Popup helpers ────────────────────────────────────────────────────────────
  const openPopup = useCallback((e, rowId, col) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setPopup({ rowId, col, x: rect.left, y: rect.bottom + 4 });
  }, []);

  // ── Available items ──────────────────────────────────────────────────────────
  const usedLineIds = useMemo(() => new Set(rows.map(r => r.lineId).filter(Boolean)), [rows]);

  const lineItems = useMemo(() =>
    allLines
      .filter(l => !usedLineIds.has(l.line_id))
      .map(l => {
        const c = FACTORY_COLORS[getFactory(l.line_id)] || DEFAULT_COLORS;
        return {
          id:       l.line_id,
          label:    l.line_id,
          sub:      l.line_type || "production",
          lineType: l.line_type || "production",
          icon:     <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${c.badge} shrink-0`}>{l.line_id}</span>,
        };
      }),
    [allLines, usedLineIds],
  );

  const plannerItems = useMemo(() =>
    ALL_SUB_PLANNERS.map((u, i) => ({
      id:    u.username,
      label: u.full_name,
      sub:   u.username,
      icon:  (
        <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${PLANNER_GRADIENTS[i % PLANNER_GRADIENTS.length]} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>
          {u.full_name.slice(0, 2).toUpperCase()}
        </div>
      ),
    })),
    [],
  );

  // ── Group rows by factory ────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const groups = [];
    const seen   = new Map(); // factory → group index
    rows.forEach((row, idx) => {
      const fac = getFactory(row.lineId) || "__empty__";
      if (!seen.has(fac)) { seen.set(fac, groups.length); groups.push({ fac, rows: [] }); }
      groups[seen.get(fac)].rows.push({ row, idx });
    });
    return groups;
  }, [rows]);

  // ── Guard ────────────────────────────────────────────────────────────────────
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

  // Current popup row
  const popupRow = popup ? rows.find(r => r._id === popup.rowId) : null;

  return (
    <div className="flex flex-col h-full" onClick={() => setPopup(null)}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center h-14 px-5 border-b border-gray-200 bg-white shrink-0 gap-3">
        <GitBranch size={15} className="text-blue-500 shrink-0" />
        <div>
          <div className="text-sm font-semibold text-gray-900">Phân chuyền Sub-Planner</div>
          <div className="text-xs text-gray-400 mt-0.5">Nhấp chuột phải vào ô để chọn chuyền hoặc Sub-Planner</div>
        </div>
        <div className="flex-1" />
        <span className="text-xs text-gray-400">{rows.filter(r => r.lineId && r.plannerUsername).length}/{rows.length} đã phân công</span>
      </header>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-auto bg-gray-50 p-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Column headers */}
          <div className="grid grid-cols-[40px_1fr_120px_1fr_36px] border-b border-gray-200 bg-gray-50">
            <div className="px-3 py-3" />
            <div className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <Factory size={12} className="text-blue-400" /> Chuyền
            </div>
            <div className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Loại</div>
            <div className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <Users size={12} className="text-purple-400" /> Sub-Planner
            </div>
            <div />
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="py-16 flex flex-col items-center gap-2 text-gray-400">
              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Đang tải...</span>
            </div>
          )}

          {/* Groups */}
          {!isLoading && grouped.map(({ fac, rows: gRows }) => {
            const c   = FACTORY_COLORS[fac] || DEFAULT_COLORS;
            const hasFactory = fac !== "__empty__";

            return (
              <div key={fac}>
                {/* Factory group header */}
                {hasFactory && (
                  <div className={`grid grid-cols-[40px_1fr_120px_1fr_36px] border-b ${c.header}`}>
                    <div />
                    <div className={`px-4 py-2 flex items-center gap-2 col-span-3`}>
                      <span className={`w-2 h-2 rounded-full ${c.dot} shrink-0`} />
                      <span className={`text-xs font-bold ${c.text}`}>Nhà máy {fac}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${c.badge}`}>
                        {gRows.length} chuyền
                      </span>
                    </div>
                    <div />
                  </div>
                )}

                {/* Rows */}
                {gRows.map(({ row }) => {
                  const planner   = ALL_SUB_PLANNERS.find(u => u.username === row.plannerUsername);
                  const factoryC  = FACTORY_COLORS[getFactory(row.lineId)] || DEFAULT_COLORS;
                  const isEmpty   = !row.lineId;
                  const isComplete= !!(row.lineId && row.plannerUsername);

                  return (
                    <div
                      key={row._id}
                      className={`grid grid-cols-[40px_1fr_120px_1fr_36px] border-b border-gray-100 hover:bg-gray-50/60 group transition-colors ${hasFactory ? factoryC.row : ""}`}
                      onClick={e => e.stopPropagation()}
                    >
                      {/* Row index */}
                      <div className="flex items-center justify-center text-[10px] text-gray-300 font-mono">
                        {row.saved
                          ? <Check size={12} className="text-green-500" />
                          : isComplete
                            ? <Check size={12} className="text-gray-300" />
                            : null
                        }
                      </div>

                      {/* ── Chuyền cell ──────────────────────────────────── */}
                      <div
                        className="px-4 py-3 flex items-center cursor-context-menu select-none relative"
                        onContextMenu={e => openPopup(e, row._id, "line")}
                      >
                        {row.lineId ? (
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${factoryC.badge}`}>
                            {row.lineId}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300 italic">Chuột phải để chọn chuyền…</span>
                        )}
                      </div>

                      {/* ── Loại cell ─────────────────────────────────────── */}
                      <div className="px-4 py-3 flex items-center">
                        <span className="text-xs text-gray-500 capitalize">{row.lineType || "—"}</span>
                      </div>

                      {/* ── Sub-Planner cell ──────────────────────────────── */}
                      <div
                        className="px-4 py-3 flex items-center gap-2.5 cursor-context-menu select-none relative"
                        onContextMenu={e => openPopup(e, row._id, "planner")}
                      >
                        {planner ? (
                          <>
                            <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${plannerGradient(planner.username)} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>
                              {planner.full_name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-gray-800 truncate">{planner.full_name}</div>
                              <div className="text-[10px] text-gray-400 truncate">{planner.username}</div>
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-gray-300 italic">Chuột phải để chọn Sub-Planner…</span>
                        )}
                      </div>

                      {/* Remove button */}
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => removeRow(row._id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all p-1 rounded"
                          title="Xóa hàng"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* ── Add row button ──────────────────────────────────────────────── */}
          <button
            onClick={addRow}
            className="w-full flex items-center gap-2 px-4 py-3 text-xs text-gray-400 hover:text-blue-500 hover:bg-blue-50/50 transition-colors border-t border-gray-100 group"
          >
            <Plus size={14} className="group-hover:scale-110 transition-transform" />
            Thêm hàng
          </button>
        </div>
      </div>

      {/* ── Cell popups ────────────────────────────────────────────────────── */}
      {popup?.col === "line" && popupRow && (
        <CellPopup
          title="Chọn chuyền"
          placeholder="Tìm mã chuyền..."
          items={lineItems}
          onPick={it => pickLine(popup.rowId, it)}
          onClose={() => setPopup(null)}
          style={{ top: popup.y, left: popup.x }}
        />
      )}

      {popup?.col === "planner" && popupRow && (
        <CellPopup
          title="Chọn Sub-Planner"
          placeholder="Tìm tên Sub-Planner..."
          items={plannerItems}
          onPick={it => pickPlanner(popup.rowId, it, popupRow.lineId)}
          onClose={() => setPopup(null)}
          style={{ top: popup.y, left: popup.x }}
        />
      )}
    </div>
  );
}

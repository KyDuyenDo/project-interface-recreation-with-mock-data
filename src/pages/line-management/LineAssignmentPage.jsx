import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GitBranch, Users, Check, AlertTriangle, Factory,
  Search, X, Plus, GripVertical,
} from "lucide-react";
import { usePermissions } from "../../hooks/usePermissions";
import { http } from "../../api/http";
import { MOCK_USERS } from "../../api/mockData";

// ── Constants ─────────────────────────────────────────────────────────────────
const ALL_SUB_PLANNERS = Object.values(MOCK_USERS).filter(u => u.role === "sub_planner");

const FACTORY_META = {
  B: { label: "Nhà máy B", color: "text-blue-700",   bg: "bg-blue-50",    border: "border-blue-200",   tagBg: "bg-blue-100",    tagText: "text-blue-800",   tagBorder: "border-blue-300",   dot: "bg-blue-400"   },
  C: { label: "Nhà máy C", color: "text-violet-700", bg: "bg-violet-50",  border: "border-violet-200", tagBg: "bg-violet-100",  tagText: "text-violet-800", tagBorder: "border-violet-300", dot: "bg-violet-400" },
  A: { label: "Nhà máy A", color: "text-emerald-700",bg: "bg-emerald-50", border: "border-emerald-200",tagBg: "bg-emerald-100", tagText: "text-emerald-800",tagBorder: "border-emerald-300",dot: "bg-emerald-400"},
};
const DEFAULT_META = FACTORY_META.B;

const PLANNER_GRADIENTS = [
  "from-blue-400 to-blue-600",
  "from-violet-400 to-purple-600",
  "from-emerald-400 to-teal-600",
  "from-amber-400 to-orange-500",
];

function getFactory(lineId) { return (lineId || "").split("_")[0]; }
function factoryMeta(fac) { return FACTORY_META[fac] || DEFAULT_META; }
function plannerGradient(username) {
  const idx = ALL_SUB_PLANNERS.findIndex(u => u.username === username);
  return PLANNER_GRADIENTS[(idx < 0 ? 0 : idx) % PLANNER_GRADIENTS.length];
}

// ── Search popup (portal-style, fixed positioning) ────────────────────────────
function CellPopup({ title, placeholder, items, onPick, onClose, x, y }) {
  const [q, setQ] = useState("");
  const ref   = useRef(null);
  const input = useRef(null);

  // Clamp so popup stays in viewport
  const clampedY = Math.min(y, window.innerHeight - 280);
  const clampedX = Math.min(x, window.innerWidth  - 300);

  useEffect(() => {
    input.current?.focus();
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
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
      style={{ position: "fixed", top: clampedY, left: clampedX, zIndex: 9999, width: 272 }}
      className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
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
      <div className="max-h-56 overflow-y-auto py-1">
        {filtered.length === 0
          ? <div className="px-3 py-6 text-center text-xs text-gray-400">Không tìm thấy kết quả</div>
          : filtered.map(it => {
              const m = factoryMeta(getFactory(it.id));
              return (
                <button
                  key={it.id}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2.5 transition-colors"
                  onClick={() => { onPick(it.id); onClose(); }}
                >
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${m.tagBg} ${m.tagText} ${m.tagBorder} shrink-0`}>
                    {it.id}
                  </span>
                  <span className="text-[10px] text-gray-400">{it.sub}</span>
                </button>
              );
            })
        }
      </div>
    </div>
  );
}

// ── Line tag (draggable) ───────────────────────────────────────────────────────
function LineTag({ lineId, username, factory, onRemove, onDragStart }) {
  const m = factoryMeta(factory);
  return (
    <span
      draggable
      onDragStart={e => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(lineId, username, factory);
      }}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border cursor-grab active:cursor-grabbing select-none
        ${m.tagBg} ${m.tagText} ${m.tagBorder}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot} shrink-0`} />
      {lineId}
      <button
        onMouseDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onRemove(lineId, username, factory); }}
        className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
      >
        <X size={10} />
      </button>
    </span>
  );
}

// ── Drop cell ─────────────────────────────────────────────────────────────────
function DropCell({ username, factory, lines, allLines, onAdd, onRemove, onDragStart, onDrop, dragging }) {
  const [over, setOver] = useState(false);
  const m = factoryMeta(factory);

  const isDragFromSameCell = dragging?.username === username && dragging?.factory === factory;
  const showDrop = over && dragging && !isDragFromSameCell;

  const handleContextMenu = e => {
    e.preventDefault();
    onAdd(username, factory, e.clientX, e.clientY);
  };

  return (
    <div
      className={`min-h-[56px] px-2.5 py-2 flex flex-wrap gap-1.5 items-start content-start transition-colors border-r border-gray-100 last:border-r-0 cursor-context-menu
        ${showDrop ? `${m.bg} ring-2 ring-inset ring-blue-300` : "hover:bg-gray-50/60"}`}
      onContextMenu={handleContextMenu}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        e.preventDefault();
        setOver(false);
        if (dragging && !isDragFromSameCell) onDrop(username, factory);
      }}
    >
      {lines.map(lineId => (
        <LineTag
          key={lineId}
          lineId={lineId}
          username={username}
          factory={factory}
          onRemove={onRemove}
          onDragStart={onDragStart}
        />
      ))}
      {lines.length === 0 && !showDrop && (
        <span className="text-[11px] text-gray-300 italic self-center">chuột phải</span>
      )}
      {showDrop && (
        <span className={`text-[11px] font-medium ${m.color} italic self-center`}>thả vào đây</span>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LineAssignmentPage() {
  const { isMain } = usePermissions();
  const queryClient = useQueryClient();

  // assignments[username][factory] = [lineId, ...]
  const [assignments,  setAssignments]  = useState({});
  const [activePlanners, setActivePlanners] = useState([]);
  const [factories,    setFactories]    = useState([]);
  const [initialized,  setInitialized]  = useState(false);
  const [dragging,     setDragging]     = useState(null); // { lineId, username, factory }
  const [popup,        setPopup]        = useState(null); // { username, factory, x, y }

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

  // Distinct factories from pool
  useEffect(() => {
    if (!allLines.length) return;
    const facs = [...new Set(allLines.map(l => getFactory(l.line_id)))].sort();
    setFactories(facs);
  }, [allLines]);

  // Hydrate from server
  useEffect(() => {
    if (!assignmentsData || !linesData || initialized) return;
    const items = assignmentsData?.items || [];

    const plannerSet   = new Set();
    const assignMap    = {};

    items.forEach(a => {
      plannerSet.add(a.planner_username || "__unassigned__");
      const fac = getFactory(a.line_id);
      if (!assignMap[a.planner_username]) assignMap[a.planner_username] = {};
      if (!assignMap[a.planner_username][fac]) assignMap[a.planner_username][fac] = [];
      assignMap[a.planner_username][fac].push(a.line_id);
    });

    const planners = ALL_SUB_PLANNERS
      .filter(u => plannerSet.has(u.username))
      .map(u => u.username);

    setActivePlanners(planners.length ? planners : [ALL_SUB_PLANNERS[0]?.username].filter(Boolean));
    setAssignments(assignMap);
    setInitialized(true);
  }, [assignmentsData, linesData, initialized]);

  // ── Mutation ─────────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: ({ line_id, planner_username }) =>
      http.put("/lines/assignments", { line_id, planner_username }).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["line-assignments"] }),
  });

  // ── Assignment helpers ────────────────────────────────────────────────────────
  const addLineToCell = useCallback((username, factory, lineId) => {
    setAssignments(prev => {
      const next = { ...prev };
      if (!next[username]) next[username] = {};
      if (!next[username][factory]) next[username][factory] = [];
      if (!next[username][factory].includes(lineId)) {
        next[username][factory] = [...next[username][factory], lineId];
      }
      return next;
    });
    saveMutation.mutate({ line_id: lineId, planner_username: username });
  }, [saveMutation]);

  const removeLineFromCell = useCallback((lineId, username, factory) => {
    setAssignments(prev => {
      const next = { ...prev };
      if (next[username]?.[factory]) {
        next[username][factory] = next[username][factory].filter(id => id !== lineId);
      }
      return next;
    });
    saveMutation.mutate({ line_id: lineId, planner_username: "" });
  }, [saveMutation]);

  const moveLineToCell = useCallback((toUsername, toFactory) => {
    if (!dragging) return;
    const { lineId, username: fromUsername, factory: fromFactory } = dragging;
    setAssignments(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      // Remove from source
      if (next[fromUsername]?.[fromFactory]) {
        next[fromUsername][fromFactory] = next[fromUsername][fromFactory].filter(id => id !== lineId);
      }
      // Add to target
      if (!next[toUsername]) next[toUsername] = {};
      if (!next[toUsername][toFactory]) next[toUsername][toFactory] = [];
      if (!next[toUsername][toFactory].includes(lineId)) {
        next[toUsername][toFactory].push(lineId);
      }
      return next;
    });
    saveMutation.mutate({ line_id: lineId, planner_username: toUsername });
    setDragging(null);
  }, [dragging, saveMutation]);

  // ── Planner management ────────────────────────────────────────────────────────
  const addPlanner = useCallback((username) => {
    setActivePlanners(prev => prev.includes(username) ? prev : [...prev, username]);
    setPopup(null);
  }, []);

  const removePlanner = useCallback((username) => {
    setActivePlanners(prev => prev.filter(u => u !== username));
    setAssignments(prev => { const n = { ...prev }; delete n[username]; return n; });
  }, []);

  // ── Popup open ────────────────────────────────────────────────────────────────
  const openCellPopup = useCallback((username, factory, x, y) => {
    setPopup({ username, factory, x, y: y + 8 });
  }, []);

  // ── Used lines (globally) ─────────────────────────────────────────────────────
  const usedLineIds = useMemo(() => {
    const s = new Set();
    Object.values(assignments).forEach(byFac =>
      Object.values(byFac).forEach(ids => ids.forEach(id => s.add(id)))
    );
    return s;
  }, [assignments]);

  // Lines available for a given factory cell (not yet used anywhere)
  const availableForFactory = useCallback((factory) =>
    allLines.filter(l => getFactory(l.line_id) === factory && !usedLineIds.has(l.line_id)),
    [allLines, usedLineIds],
  );

  // Planners not yet added
  const availablePlanners = useMemo(
    () => ALL_SUB_PLANNERS.filter(u => !activePlanners.includes(u.username)),
    [activePlanners],
  );

  // ── Popup for adding sub-planner row ─────────────────────────────────────────
  const [plannerPopup, setPlannerPopup] = useState(false);
  const plannerBtnRef = useRef(null);

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

  const totalAssigned = Object.values(assignments)
    .flatMap(byFac => Object.values(byFac).flat()).length;

  return (
    <div
      className="flex flex-col h-full"
      onClick={() => { setPopup(null); setPlannerPopup(false); }}
      onDragEnd={() => setDragging(null)}
    >
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header className="flex items-center h-14 px-5 border-b border-gray-200 bg-white shrink-0 gap-3">
        <GitBranch size={15} className="text-blue-500 shrink-0" />
        <div>
          <div className="text-sm font-semibold text-gray-900">Phân chuyền Sub-Planner</div>
          <div className="text-xs text-gray-400 mt-0.5">
            Chuột phải vào ô để thêm chuyền · Kéo thả để chuyển ô
          </div>
        </div>
        <div className="flex-1" />
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          {totalAssigned} chuyền đã phân công
        </span>
      </header>

      {/* ── Grid ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-auto bg-gray-50 p-5">
        {isLoading ? (
          <div className="bg-white rounded-xl border border-gray-200 py-20 flex flex-col items-center gap-3 text-gray-400">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Đang tải...</span>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

            {/* Column headers */}
            <div
              className="grid border-b border-gray-200 bg-gray-50"
              style={{ gridTemplateColumns: `220px repeat(${factories.length}, 1fr)` }}
            >
              {/* Left fixed header */}
              <div className="px-4 py-3 flex items-center gap-2 border-r border-gray-200">
                <Users size={13} className="text-purple-400" />
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Sub-Planner</span>
              </div>

              {/* Factory columns */}
              {factories.map(fac => {
                const m = factoryMeta(fac);
                return (
                  <div key={fac} className={`px-4 py-3 border-r border-gray-200 last:border-r-0 ${m.bg}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${m.dot} shrink-0`} />
                      <span className={`text-[11px] font-semibold ${m.color} uppercase tracking-wide`}>
                        {m.label}
                      </span>
                      <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium border ${m.tagBg} ${m.tagText} ${m.tagBorder}`}>
                        {allLines.filter(l => getFactory(l.line_id) === fac).length} chuyền
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Planner rows */}
            {activePlanners.map((username, rowIdx) => {
              const user     = ALL_SUB_PLANNERS.find(u => u.username === username);
              if (!user) return null;
              const gradient = plannerGradient(username);
              const byFac    = assignments[username] || {};

              return (
                <div
                  key={username}
                  className="grid border-b border-gray-100 last:border-b-0 hover:bg-gray-50/40 group/row transition-colors"
                  style={{ gridTemplateColumns: `220px repeat(${factories.length}, 1fr)` }}
                >
                  {/* Sub-Planner info cell */}
                  <div className="px-4 py-3 flex items-center gap-3 border-r border-gray-200 shrink-0">
                    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                      {user.full_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-gray-900 truncate">{user.full_name}</div>
                      <div className="text-[10px] text-gray-400 truncate">{user.username}</div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); removePlanner(username); }}
                      className="opacity-0 group-hover/row:opacity-100 text-gray-300 hover:text-red-400 transition-all shrink-0"
                      title="Xóa"
                    >
                      <X size={13} />
                    </button>
                  </div>

                  {/* Factory cells */}
                  {factories.map(fac => (
                    <DropCell
                      key={fac}
                      username={username}
                      factory={fac}
                      lines={byFac[fac] || []}
                      allLines={allLines}
                      onAdd={openCellPopup}
                      onRemove={removeLineFromCell}
                      onDragStart={(lineId, u, f) => setDragging({ lineId, username: u, factory: f })}
                      onDrop={moveLineToCell}
                      dragging={dragging}
                    />
                  ))}
                </div>
              );
            })}

            {/* Empty state */}
            {activePlanners.length === 0 && (
              <div className="py-16 flex flex-col items-center gap-2 text-gray-400">
                <Users size={32} className="opacity-20" />
                <div className="text-sm font-medium">Chưa có Sub-Planner nào</div>
                <div className="text-xs">Nhấn nút bên dưới để thêm</div>
              </div>
            )}

            {/* ── Add planner row ────────────────────────────────────────────── */}
            <div className="border-t border-gray-100 px-4 py-2.5 flex items-center gap-3 relative">
              <button
                ref={plannerBtnRef}
                onClick={e => { e.stopPropagation(); setPlannerPopup(p => !p); }}
                className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors group"
              >
                <Plus size={13} className="group-hover:scale-110 transition-transform" />
                Thêm Sub-Planner
              </button>

              {/* Planner search popup */}
              {plannerPopup && (
                <div
                  className="absolute bottom-full left-4 mb-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50"
                  onClick={e => e.stopPropagation()}
                >
                  <PlannerAddPopup
                    items={availablePlanners}
                    onPick={addPlanner}
                    onClose={() => setPlannerPopup(false)}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Cell popup ────────────────────────────────────────────────────────── */}
      {popup && (
        <CellPopup
          title={`Thêm chuyền — ${factoryMeta(popup.factory).label}`}
          placeholder="Tìm mã chuyền..."
          items={availableForFactory(popup.factory).map(l => ({
            id:  l.line_id,
            label: l.line_id,
            sub: l.line_type || "production",
          }))}
          onPick={lineId => {
            addLineToCell(popup.username, popup.factory, lineId);
            setPopup(null);
          }}
          onClose={() => setPopup(null)}
          x={popup.x}
          y={popup.y}
        />
      )}
    </div>
  );
}

// ── Planner add popup (used inside grid footer) ───────────────────────────────
function PlannerAddPopup({ items, onPick, onClose }) {
  const [q, setQ] = useState("");
  const input = useRef(null);
  useEffect(() => { input.current?.focus(); }, []);

  const filtered = items.filter(u =>
    u.full_name.toLowerCase().includes(q.toLowerCase()) ||
    u.username.toLowerCase().includes(q.toLowerCase())
  );

  const gradients = [
    "from-blue-400 to-blue-600",
    "from-violet-400 to-purple-600",
    "from-emerald-400 to-teal-600",
    "from-amber-400 to-orange-500",
  ];

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 bg-gray-50">
        <span className="text-xs font-semibold text-gray-700">Thêm Sub-Planner</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
      </div>
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            ref={input}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Tìm tên Sub-Planner..."
            className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 bg-white"
          />
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto py-1">
        {filtered.length === 0
          ? <div className="px-3 py-5 text-center text-xs text-gray-400">Không còn Sub-Planner nào</div>
          : filtered.map((u, i) => (
              <button
                key={u.username}
                className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2.5 transition-colors"
                onClick={() => onPick(u.username)}
              >
                <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${gradients[i % gradients.length]} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>
                  {u.full_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-800">{u.full_name}</div>
                  <div className="text-[10px] text-gray-400">{u.username}</div>
                </div>
              </button>
            ))
        }
      </div>
    </>
  );
}

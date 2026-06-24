import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GitBranch, Users, Check, AlertTriangle,
  Factory, Search, X,
} from "lucide-react";
import { usePermissions } from "../../hooks/usePermissions";
import { http } from "../../api/http";
import { MOCK_USERS } from "../../api/mockData";

const ALL_SUB_PLANNERS = Object.values(MOCK_USERS).filter(u => u.role === "sub_planner");

const FACTORY_COLORS = {
  B: { bg: "bg-blue-50",    border: "border-blue-200",   text: "text-blue-700",   badge: "bg-blue-100 text-blue-800 border-blue-200"   },
  C: { bg: "bg-violet-50",  border: "border-violet-200", text: "text-violet-700", badge: "bg-violet-100 text-violet-800 border-violet-200" },
  A: { bg: "bg-emerald-50", border: "border-emerald-200",text: "text-emerald-700",badge: "bg-emerald-100 text-emerald-800 border-emerald-200" },
};

const PLANNER_GRADIENTS = [
  "from-blue-400 to-blue-600",
  "from-violet-400 to-purple-600",
  "from-emerald-400 to-teal-600",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-600",
];

function getFactory(lineId) { return (lineId || "").split("_")[0]; }

// ── Popup with search ─────────────────────────────────────────────────────────
function AddPopup({ title, placeholder, items, onAdd, onClose }) {
  const [q, setQ] = useState("");
  const ref   = useRef(null);
  const input = useRef(null);

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
      className="absolute z-50 top-full left-0 mt-1 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
      onContextMenu={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 bg-gray-50">
        <span className="text-xs font-semibold text-gray-700">{title}</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X size={13} />
        </button>
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
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-gray-400">Không tìm thấy kết quả</div>
        ) : (
          filtered.map(it => (
            <button
              key={it.id}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2.5 transition-colors"
              onClick={() => { onAdd(it.id); onClose(); }}
            >
              {it.icon}
              <div className="min-w-0">
                <div className="text-xs font-semibold text-gray-800 truncate">{it.label}</div>
                {it.sub && <div className="text-[10px] text-gray-400 truncate">{it.sub}</div>}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LineAssignmentPage() {
  const { isMain } = usePermissions();
  const queryClient = useQueryClient();

  const [activeLines,    setActiveLines]    = useState([]);   // [lineId, ...]
  const [activePlanners, setActivePlanners] = useState([]);   // [username, ...]
  const [assignments,    setAssignments]    = useState({});   // { lineId: username }
  const [savedLines,     setSavedLines]     = useState({});   // { lineId: true } flash
  const [popup,          setPopup]          = useState(null); // "lines" | "planners" | null
  const [initialized,    setInitialized]    = useState(false);

  // ── Load existing assignments ──────────────────────────────────────────────
  const { data: assignmentsData, isLoading } = useQuery({
    queryKey: ["line-assignments"],
    queryFn: () => http.get("/lines/assignments").then(r => r.data),
  });

  const { data: linesData } = useQuery({
    queryKey: ["lines-pool"],
    queryFn: () => http.get("/lines/pool").then(r => r.data),
  });

  const allLines = linesData || [];

  // Bootstrap from server data (once)
  useEffect(() => {
    if (!assignmentsData || initialized) return;
    const items = assignmentsData?.items || [];
    const lineIds      = [...new Set(items.map(a => a.line_id))];
    const plannerNames = [...new Set(items.filter(a => a.planner_username).map(a => a.planner_username))];
    const assignMap    = {};
    items.forEach(a => { if (a.planner_username) assignMap[a.line_id] = a.planner_username; });
    setActiveLines(lineIds);
    setActivePlanners(plannerNames);
    setAssignments(assignMap);
    setInitialized(true);
  }, [assignmentsData, initialized]);

  // ── Mutation ───────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: ({ line_id, planner_username }) =>
      http.put("/lines/assignments", { line_id, planner_username }).then(r => r.data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["line-assignments"] });
      setSavedLines(s => ({ ...s, [vars.line_id]: true }));
      setTimeout(() => setSavedLines(s => { const n = { ...s }; delete n[vars.line_id]; return n; }), 2500);
    },
  });

  // ── Actions ────────────────────────────────────────────────────────────────
  const addLine     = (id) => setActiveLines(p => p.includes(id) ? p : [...p, id]);
  const removeLine  = (id) => {
    setActiveLines(p => p.filter(x => x !== id));
    setAssignments(p => { const n = { ...p }; delete n[id]; return n; });
  };
  const addPlanner    = (u) => setActivePlanners(p => p.includes(u) ? p : [...p, u]);
  const removePlanner = (u) => {
    setActivePlanners(p => p.filter(x => x !== u));
    setAssignments(p => {
      const n = { ...p };
      Object.keys(n).forEach(lid => { if (n[lid] === u) delete n[lid]; });
      return n;
    });
  };
  const assignLine = (lineId, username) => {
    setAssignments(p => ({ ...p, [lineId]: username }));
    saveMutation.mutate({ line_id: lineId, planner_username: username });
  };

  const handleContextMenu = useCallback((e, type) => {
    e.preventDefault();
    setPopup(prev => prev === type ? null : type);
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const groupedLines = useMemo(() => {
    const map = {};
    activeLines.forEach(id => {
      const prefix = getFactory(id);
      if (!map[prefix]) map[prefix] = [];
      const info = allLines.find(l => l.line_id === id) || { line_id: id, line_type: "production" };
      map[prefix].push(info);
    });
    return map;
  }, [activeLines, allLines]);

  const availableLineItems = useMemo(() =>
    allLines
      .filter(l => !activeLines.includes(l.line_id))
      .map(l => {
        const prefix = getFactory(l.line_id);
        const c = FACTORY_COLORS[prefix] || FACTORY_COLORS.B;
        return {
          id:    l.line_id,
          label: l.line_id,
          sub:   l.line_type || "production",
          icon:  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${c.badge} shrink-0`}>{l.line_id}</span>,
        };
      }),
    [allLines, activeLines],
  );

  const availablePlannerItems = useMemo(() =>
    ALL_SUB_PLANNERS
      .filter(u => !activePlanners.includes(u.username))
      .map((u, i) => ({
        id:    u.username,
        label: u.full_name,
        sub:   u.username,
        icon: (
          <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${PLANNER_GRADIENTS[i % PLANNER_GRADIENTS.length]} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>
            {u.full_name.slice(0, 2).toUpperCase()}
          </div>
        ),
      })),
    [activePlanners],
  );

  // ── Access guard ───────────────────────────────────────────────────────────
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
    <div className="flex flex-col h-full">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center h-14 px-5 border-b border-gray-200 bg-white shrink-0 gap-3">
        <GitBranch size={15} className="text-blue-500 shrink-0" />
        <div>
          <div className="text-sm font-semibold text-gray-900">Phân chuyền Sub-Planner</div>
          <div className="text-xs text-gray-400 mt-0.5">Chỉ định chuyền cho từng Sub-Planner · chuột phải vào tiêu đề để thêm</div>
        </div>
      </header>

      {/* ── Two panels ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex gap-4 p-5 bg-gray-50">

        {/* ── Left: Chuyền ─────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Panel header — right-click to add */}
          <div
            className="relative flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50 select-none shrink-0 cursor-context-menu"
            onContextMenu={e => handleContextMenu(e, "lines")}
          >
            <Factory size={14} className="text-blue-500" />
            <span className="text-sm font-semibold text-gray-800">Chuyền</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
              {activeLines.length}
            </span>
            <span className="ml-auto text-[10px] text-gray-400 italic">Chuột phải để thêm</span>

            {popup === "lines" && (
              <AddPopup
                title="Thêm chuyền"
                placeholder="Tìm chuyền..."
                items={availableLineItems}
                onAdd={addLine}
                onClose={() => setPopup(null)}
              />
            )}
          </div>

          {/* Column sub-headers */}
          <div className="grid grid-cols-[96px_80px_1fr_28px] gap-2 px-4 py-1.5 bg-gray-50 border-b border-gray-100 shrink-0">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Chuyền</span>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Loại</span>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Sub-Planner phụ trách</span>
            <span />
          </div>

          {/* Lines list */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="py-16 flex flex-col items-center text-gray-400 gap-2">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">Đang tải...</span>
              </div>
            ) : activeLines.length === 0 ? (
              <div className="py-20 flex flex-col items-center text-gray-400 gap-2">
                <GitBranch size={32} className="opacity-20" />
                <div className="text-sm font-medium">Chưa có chuyền nào</div>
                <div className="text-xs">Chuột phải vào tiêu đề để thêm</div>
              </div>
            ) : (
              Object.entries(groupedLines).map(([prefix, lines]) => {
                const c = FACTORY_COLORS[prefix] || FACTORY_COLORS.B;
                return (
                  <div key={prefix}>
                    {/* Factory group header */}
                    <div className={`flex items-center gap-2 px-4 py-2 ${c.bg} border-b ${c.border}`}>
                      <Factory size={11} className={c.text} />
                      <span className={`text-[11px] font-bold ${c.text}`}>Nhà máy {prefix}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${c.badge}`}>{lines.length} chuyền</span>
                    </div>

                    {/* Line rows */}
                    {lines.map(line => {
                      const assigned  = assignments[line.line_id];
                      const planner   = ALL_SUB_PLANNERS.find(u => u.username === assigned);
                      const isSaved   = savedLines[line.line_id];

                      return (
                        <div
                          key={line.line_id}
                          className="grid grid-cols-[96px_80px_1fr_28px] gap-2 items-center px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 group transition-colors"
                        >
                          {/* Badge */}
                          <span className={`px-2 py-1 rounded text-[11px] font-bold border ${c.badge} inline-block`}>
                            {line.line_id}
                          </span>

                          {/* Type */}
                          <span className="text-[11px] text-gray-400 capitalize truncate">
                            {line.line_type || "production"}
                          </span>

                          {/* Planner select */}
                          <div className="relative">
                            <select
                              value={assigned || ""}
                              onChange={e => assignLine(line.line_id, e.target.value)}
                              className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 appearance-none transition-colors"
                            >
                              <option value="">— Chưa phân công —</option>
                              {activePlanners.map(u => {
                                const p = ALL_SUB_PLANNERS.find(x => x.username === u);
                                return p ? <option key={u} value={u}>{p.full_name} ({u})</option> : null;
                              })}
                            </select>
                          </div>

                          {/* Saved flash / remove */}
                          <div className="flex items-center justify-center">
                            {isSaved ? (
                              <Check size={13} className="text-green-500" />
                            ) : (
                              <button
                                onClick={() => removeLine(line.line_id)}
                                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all"
                              >
                                <X size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right: Sub-Planner ────────────────────────────────────────────── */}
        <div className="w-72 shrink-0 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Panel header — right-click to add */}
          <div
            className="relative flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50 select-none shrink-0 cursor-context-menu"
            onContextMenu={e => handleContextMenu(e, "planners")}
          >
            <Users size={14} className="text-purple-500" />
            <span className="text-sm font-semibold text-gray-800">Sub-Planner</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700">
              {activePlanners.length}
            </span>
            <span className="ml-auto text-[10px] text-gray-400 italic">Chuột phải để thêm</span>

            {popup === "planners" && (
              <AddPopup
                title="Thêm Sub-Planner"
                placeholder="Tìm tên Sub-Planner..."
                items={availablePlannerItems}
                onAdd={addPlanner}
                onClose={() => setPopup(null)}
              />
            )}
          </div>

          {/* Cards */}
          <div className="flex-1 overflow-auto p-3 space-y-2">
            {activePlanners.length === 0 ? (
              <div className="py-16 flex flex-col items-center text-gray-400 gap-2">
                <Users size={28} className="opacity-20" />
                <div className="text-xs font-medium">Chưa có Sub-Planner</div>
                <div className="text-[10px]">Chuột phải để thêm</div>
              </div>
            ) : (
              activePlanners.map((username, idx) => {
                const u        = ALL_SUB_PLANNERS.find(p => p.username === username);
                if (!u) return null;
                const myLines  = Object.entries(assignments)
                  .filter(([, u2]) => u2 === username)
                  .map(([id]) => id);
                const gradient = PLANNER_GRADIENTS[idx % PLANNER_GRADIENTS.length];

                return (
                  <div
                    key={username}
                    className="border border-gray-200 rounded-xl p-3 hover:border-gray-300 group transition-colors"
                  >
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                        {u.full_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-gray-900 truncate">{u.full_name}</div>
                        <div className="text-[10px] text-gray-400 truncate">{u.username}</div>
                      </div>
                      <button
                        onClick={() => removePlanner(username)}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all shrink-0"
                      >
                        <X size={13} />
                      </button>
                    </div>

                    {/* Assigned lines */}
                    <div className="flex flex-wrap gap-1">
                      {myLines.length > 0
                        ? myLines.map(id => {
                            const c = FACTORY_COLORS[getFactory(id)] || FACTORY_COLORS.B;
                            return (
                              <span key={id} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${c.badge}`}>
                                {id}
                              </span>
                            );
                          })
                        : <span className="text-[10px] text-gray-400 italic">Chưa có chuyền</span>
                      }
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

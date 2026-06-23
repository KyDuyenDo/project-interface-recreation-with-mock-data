import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GitBranch, Users, Save, Loader2, Check, AlertTriangle,
  Factory, ChevronDown, Search, User, Edit3
} from "lucide-react";
import { clsx } from "clsx";
import { usePermissions } from "../../hooks/usePermissions";
import { useNavigate } from "react-router-dom";
import { http } from "../../api/http";
import { MOCK_USERS } from "../../api/mockData";

const BTN = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SM = "inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const SUB_PLANNERS = Object.values(MOCK_USERS).filter(u => u.role === "sub_planner");

const FACTORY_COLORS = {
  "B": { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", header: "bg-blue-100" },
  "C": { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700", header: "bg-violet-100" },
  "A": { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", header: "bg-emerald-100" },
};

function getFactoryPrefix(lineId) {
  return lineId.split("_")[0];
}

export default function LineAssignmentPage() {
  const { isMain } = usePermissions();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [savedLines, setSavedLines] = useState({});
  const [savingLines, setSavingLines] = useState(new Set());
  const [pendingChanges, setPendingChanges] = useState({});

  const { data: assignmentsData, isLoading } = useQuery({
    queryKey: ["line-assignments"],
    queryFn: () => http.get("/lines/assignments").then(r => r.data),
  });

  const { data: linesData } = useQuery({
    queryKey: ["lines-pool"],
    queryFn: () => http.get("/lines/pool").then(r => r.data),
  });

  const assignments = useMemo(() => {
    const map = {};
    (assignmentsData?.items || []).forEach(a => { map[a.line_id] = a; });
    return map;
  }, [assignmentsData]);

  const lines = linesData || [];

  const saveMutation = useMutation({
    mutationFn: ({ line_id, planner_username }) =>
      http.put("/lines/assignments", { line_id, planner_username }).then(r => r.data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["line-assignments"] });
      setSavedLines(s => ({ ...s, [vars.line_id]: true }));
      setPendingChanges(s => { const n = { ...s }; delete n[vars.line_id]; return n; });
      setTimeout(() => setSavedLines(s => { const n = { ...s }; delete n[vars.line_id]; return n; }), 2500);
    },
  });

  const handleAssign = (lineId, plannerUsername) => {
    setPendingChanges(s => ({ ...s, [lineId]: plannerUsername }));
  };

  const handleSave = async (lineId) => {
    const username = pendingChanges[lineId];
    if (!username) return;
    setSavingLines(s => new Set([...s, lineId]));
    try { await saveMutation.mutateAsync({ line_id: lineId, planner_username: username }); }
    finally { setSavingLines(s => { const n = new Set(s); n.delete(lineId); return n; }); }
  };

  const handleSaveAll = async () => {
    for (const [lineId, username] of Object.entries(pendingChanges)) {
      setSavingLines(s => new Set([...s, lineId]));
      try { await saveMutation.mutateAsync({ line_id: lineId, planner_username: username }); }
      finally { setSavingLines(s => { const n = new Set(s); n.delete(lineId); return n; }); }
    }
  };

  // Group lines by factory prefix
  const grouped = useMemo(() => {
    const map = {};
    lines.forEach(l => {
      const prefix = getFactoryPrefix(l.line_id);
      if (!map[prefix]) map[prefix] = [];
      if (!search || l.line_id.toLowerCase().includes(search.toLowerCase())) {
        map[prefix].push(l);
      }
    });
    return map;
  }, [lines, search]);

  const pendingCount = Object.keys(pendingChanges).length;

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
      {/* Header */}
      <header className="flex items-center h-14 px-5 border-b border-gray-200 bg-white shrink-0 gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <GitBranch size={15} className="text-blue-500" />
            Phân chuyền Sub-Planner
          </div>
          <div className="text-xs text-gray-400 mt-0.5">Chỉ định chuyền cho từng Sub-Planner</div>
        </div>
        <div className="flex-1" />
        {pendingCount > 0 && (
          <button
            onClick={handleSaveAll}
            className={`${BTN} bg-blue-600 text-white border-blue-600 hover:bg-blue-700`}
          >
            <Save size={14} /> Lưu tất cả ({pendingCount})
          </button>
        )}
      </header>

      <div className="flex-1 overflow-auto bg-gray-50 p-5">
        {/* Sub-planner overview */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {SUB_PLANNERS.map(u => (
            <div key={u.username} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {u.full_name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-gray-900 truncate">{u.full_name}</div>
                  <div className="text-[10px] text-gray-400 truncate">{u.username}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {u.assigned_lines.length > 0
                  ? u.assigned_lines.map(l => (
                    <span key={l} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">{l}</span>
                  ))
                  : <span className="text-[10px] text-gray-400 italic">Chưa phân chuyền</span>
                }
              </div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm chuyền..."
              className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
            />
          </div>
          {pendingCount > 0 && (
            <span className="text-xs text-amber-600 font-medium flex items-center gap-1 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
              <AlertTriangle size={12} />
              {pendingCount} thay đổi chưa lưu
            </span>
          )}
        </div>

        {/* Line groups */}
        {isLoading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
            <Loader2 size={28} className="animate-spin mx-auto text-blue-500 mb-2" />
            <div className="text-sm text-gray-500">Đang tải danh sách chuyền...</div>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([prefix, groupLines]) => {
              const colors = FACTORY_COLORS[prefix] || FACTORY_COLORS["B"];
              return (
                <div key={prefix} className={`rounded-xl border overflow-hidden ${colors.border}`}>
                  <div className={`flex items-center gap-2 px-4 py-3 ${colors.header}`}>
                    <Factory size={14} className={colors.text} />
                    <span className={`text-sm font-bold ${colors.text}`}>Nhà máy {prefix}</span>
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                      {groupLines.length} chuyền
                    </span>
                  </div>
                  <div className="bg-white divide-y divide-gray-50">
                    {groupLines.map(line => {
                      const currentAssignment = assignments[line.line_id];
                      const pendingUsername = pendingChanges[line.line_id];
                      const effectiveUsername = pendingUsername ?? currentAssignment?.planner_username ?? "";
                      const isSaving = savingLines.has(line.line_id);
                      const isSaved = savedLines[line.line_id];
                      const hasPending = !!pendingUsername;

                      return (
                        <div key={line.line_id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition">
                          {/* Line ID */}
                          <div className="w-24 shrink-0">
                            <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${colors.bg} ${colors.text} ${colors.border} border`}>
                              {line.line_id}
                            </span>
                          </div>

                          {/* Line type */}
                          <div className="w-20 shrink-0">
                            <span className="text-xs text-gray-400 capitalize">{line.line_type || "production"}</span>
                          </div>

                          {/* Planner select */}
                          <div className="flex-1">
                            <div className="relative">
                              <select
                                value={effectiveUsername}
                                onChange={e => handleAssign(line.line_id, e.target.value)}
                                className={clsx(
                                  "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition appearance-none pr-8",
                                  hasPending
                                    ? "border-amber-300 bg-amber-50/50 ring-0 focus:ring-amber-200 focus:border-amber-400"
                                    : "border-gray-200 bg-white focus:ring-blue-100 focus:border-blue-300"
                                )}
                              >
                                <option value="">— Chưa phân công —</option>
                                {SUB_PLANNERS.map(u => (
                                  <option key={u.username} value={u.username}>
                                    {u.full_name} ({u.username})
                                  </option>
                                ))}
                              </select>
                              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                          </div>

                          {/* Save button */}
                          <div className="w-24 shrink-0 flex justify-end">
                            {isSaved ? (
                              <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium px-2 py-1">
                                <Check size={13} /> Đã lưu
                              </span>
                            ) : hasPending ? (
                              <button
                                disabled={isSaving}
                                onClick={() => handleSave(line.line_id)}
                                className={`${BTN_SM} bg-blue-600 text-white border-blue-600 hover:bg-blue-700`}
                              >
                                {isSaving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                                Lưu
                              </button>
                            ) : currentAssignment ? (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Check size={11} className="text-green-500" /> Đã phân công
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

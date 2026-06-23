import { NavLink } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { usePermissions } from "../../hooks/usePermissions";
import {
  LayoutDashboard, Table2, CalendarDays, Play, Bell,
  Factory, Package, BarChart2, Zap, Settings, Users,
  RefreshCw, Activity, LogOut, ClipboardList, GitBranch, Shield,
} from "lucide-react";
import { clsx } from "clsx";
import NotificationBell from "../notifications/NotificationBell";

const ROLE_LABELS = {
  main_planner: "Main Planner",
  sub_planner: "Sub Planner",
  admin: "Admin",
};
const ROLE_COLORS = {
  main_planner: "from-blue-500 to-blue-700",
  sub_planner: "from-emerald-500 to-teal-600",
  admin: "from-violet-500 to-purple-700",
};

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const perms = usePermissions();
  const isAdmin = user?.role === "admin" || user?.role === "main_planner";

  // Build navigation items based on permissions
  const navItems = [
    { section: "Planning" },
    { to: "/",          label: "Dashboard",           Icon: LayoutDashboard, show: true },
    { to: "/orders",    label: "BAO_CAO_SO_DUOI",     Icon: Table2,   badge: "480", show: perms.canSeeOrders },
    { to: "/khx-plan",  label: "KHX",                 Icon: CalendarDays,   show: perms.canSeeKHX },
    { to: "/runs",      label: "Lập lịch",            Icon: Play,           show: perms.canSeeLapLich },
    { to: "/my-tasks",  label: "Công việc của tôi",   Icon: ClipboardList,  show: perms.canSeeMyTasks, highlight: true },
    { to: "/events",    label: "Events",               Icon: Bell,           show: perms.canSeeEvents },
    { section: "Tracking" },
    { to: "/subcontractor", label: "Subcontractor",     Icon: Factory,    show: perms.canSeeSubcontractor },
    { to: "/material",      label: "Material ETA",      Icon: Package,    show: perms.canSeeMaterialETA },
    { to: "/throughput",    label: "Mục tiêu dạng giày",Icon: BarChart2,  show: perms.canSeeShoeTargets },
    { to: "/new-models",    label: "New Models",         Icon: Zap,        show: perms.canSeeNewModels },
    { section: "Config" },
    { to: "/line-assignments", label: "Phân chuyền",   Icon: GitBranch,  show: perms.canSeeLineAssignment },
    { to: "/factories",        label: "Factories",      Icon: Factory,    show: perms.canSeeFactories },
    { to: "/users",            label: "Users & Roles",  Icon: Users,      show: perms.canSeeUsers },
    { to: "/settings",         label: "Settings",       Icon: Settings,   show: perms.canSeeSettings },
    ...(isAdmin ? [
      { section: "Admin" },
      { to: "/sync",   label: "Sync Admin",           Icon: RefreshCw, show: true },
      { to: "/health", label: "Health & Diagnostics", Icon: Activity,  show: true },
    ] : []),
  ];

  const filtered = navItems.filter(item => item.section !== undefined || item.show);

  // Remove orphan section headers
  const cleaned = filtered.filter((item, idx) => {
    if (!item.section) return true;
    // Keep section only if next non-section item exists before another section / end
    for (let i = idx + 1; i < filtered.length; i++) {
      if (!filtered[i].section) return true;
      break;
    }
    return false;
  });

  const avatarGradient = ROLE_COLORS[user?.role] || "from-amber-400 to-red-500";

  return (
    <aside className="flex flex-col overflow-hidden" style={{ background: "#0f172a", color: "#cbd5e1" }}>
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 text-sm font-bold text-white">
          AP
        </div>
        <div>
          <div className="text-sm font-semibold text-white">AutoPlanning</div>
          <div className="text-xs text-slate-500">v2.5 · prod</div>
        </div>
        <div className="ml-auto">
          <NotificationBell />
        </div>
      </div>

      {/* Role banner for sub-planner */}
      {perms.isSub && (
        <div className="mx-2 mt-2 rounded-lg bg-emerald-900/40 border border-emerald-800/50 px-3 py-2">
          <div className="flex items-center gap-2">
            <Shield size={13} className="text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold text-emerald-300">Sub-Planner</span>
          </div>
          {perms.myLines.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {perms.myLines.map(l => (
                <span key={l} className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-800/60 text-emerald-200">
                  {l}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {cleaned.map((item, i) => {
          if (item.section) {
            return (
              <div key={i} className="px-3 pb-1.5 pt-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
                {item.section}
              </div>
            );
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition",
                  item.highlight && !isActive && "text-emerald-400 hover:bg-slate-800 hover:text-emerald-300",
                  !item.highlight && (isActive ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"),
                  isActive && "bg-slate-800 text-white",
                )
              }>
              {({ isActive }) => (
                <>
                  <item.Icon
                    size={16}
                    strokeWidth={2}
                    className={item.highlight && !isActive ? "text-emerald-400" : undefined}
                  />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs font-semibold text-slate-300">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User card */}
      <div className="border-t border-slate-800 p-3">
        <div className="flex items-center gap-2.5 rounded-lg bg-slate-800 px-3 py-2">
          <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br ${avatarGradient} text-xs font-bold text-white`}>
            {user?.full_name?.slice(0, 2)?.toUpperCase() || user?.username?.slice(0, 2).toUpperCase() || "??"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate text-sm font-semibold text-white">{user?.full_name || user?.username}</div>
            <div className="text-xs text-slate-400">{ROLE_LABELS[user?.role] || user?.role}</div>
          </div>
          <button
            onClick={logout}
            title="Logout"
            className="rounded-lg p-1 text-slate-400 hover:text-white transition">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}

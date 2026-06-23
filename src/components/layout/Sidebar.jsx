import { NavLink } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import {
  LayoutDashboard, Table2, CalendarDays, Play, Bell,
  Factory, Package, BarChart2, Zap, Settings, Users,
  RefreshCw, Activity, LogOut,
} from "lucide-react";
import { clsx } from "clsx";

const NAV_ITEMS = [
  { section: "Planning" },
  { to: "/", label: "Dashboard",         Icon: LayoutDashboard },
  { to: "/orders",  label: "BAO_CAO_SO_DUOI", Icon: Table2,   badge: "480" },
  { to: "/khx-plan", label: "KHX",              Icon: CalendarDays },
  { to: "/runs",    label: "Lập lịch",          Icon: Play },
  { to: "/events",  label: "Events",           Icon: Bell },
  { section: "Tracking" },
  { to: "/subcontractor", label: "Subcontractor",    Icon: Factory },
  { to: "/material",      label: "Material ETA",     Icon: Package },
  { to: "/throughput",    label: "Mục tiêu dạng giày", Icon: BarChart2 },
  { to: "/new-models",    label: "New Models",        Icon: Zap },
  { section: "Config" },
  { to: "/factories", label: "Factories",    Icon: Factory },
  { to: "/users",     label: "Users & Roles", Icon: Users },
  { to: "/settings",  label: "Settings",      Icon: Settings },
];

const ADMIN_ITEMS = [
  { section: "Admin" },
  { to: "/sync",   label: "Sync Admin",         Icon: RefreshCw },
  { to: "/health", label: "Health & Diagnostics", Icon: Activity },
];

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const isAdmin = user?.role === "admin";

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
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {[...NAV_ITEMS, ...(isAdmin ? ADMIN_ITEMS : [])].map((item, i) => {
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
                  isActive ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )
              }>
              <item.Icon size={16} strokeWidth={2} />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs font-semibold text-slate-300">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User card */}
      <div className="border-t border-slate-800 p-3">
        <div className="flex items-center gap-2.5 rounded-lg bg-slate-800 px-3 py-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-red-500 text-xs font-bold text-white">
            {user?.username?.slice(0, 2).toUpperCase() || "??"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate text-sm font-semibold text-white">{user?.username}</div>
            <div className="text-xs capitalize text-slate-400">{user?.role}</div>
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

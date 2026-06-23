import { useState, useRef, useEffect } from "react";
import { Bell, X, CheckCheck, AlertCircle, Calendar, ClipboardCheck } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { http } from "../../api/http";
import { clsx } from "clsx";

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  return `${Math.floor(hrs / 24)} ngày trước`;
}

const KIND_ICONS = {
  task_assigned: ClipboardCheck,
  run_completed: CheckCheck,
  default: AlertCircle,
};
const KIND_COLORS = {
  task_assigned: "text-emerald-500",
  run_completed: "text-blue-500",
  default: "text-amber-500",
};

export default function NotificationBell() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const { data: notiData } = useQuery({
    queryKey: ["notifications", user?.username],
    queryFn: () => http.get("/notifications", { params: { username: user?.username } }).then(r => r.data),
    enabled: !!user,
    refetchInterval: 15000,
  });

  const notifications = notiData?.items || [];
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markRead = useMutation({
    mutationFn: (id) => http.post(`/notifications/${id}`).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => http.post("/notifications", { username: user?.username }).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!user) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
        title="Thông báo"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden" style={{ minWidth: 320 }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-gray-500" />
              <span className="text-sm font-semibold text-gray-800">Thông báo</span>
              {unreadCount > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition"
                >
                  Đọc tất cả
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded transition">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">
                <Bell size={24} className="mx-auto mb-2 text-gray-200" />
                Không có thông báo nào
              </div>
            ) : (
              notifications.map(n => {
                const Icon = KIND_ICONS[n.kind] || KIND_ICONS.default;
                const iconColor = KIND_COLORS[n.kind] || KIND_COLORS.default;
                return (
                  <div
                    key={n.id}
                    onClick={() => !n.is_read && markRead.mutate(n.id)}
                    className={clsx(
                      "px-4 py-3 cursor-pointer hover:bg-gray-50 transition",
                      !n.is_read && "bg-blue-50/40"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={clsx("mt-0.5 shrink-0", iconColor)}>
                        <Icon size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={clsx("text-sm leading-snug", !n.is_read ? "font-semibold text-gray-900" : "font-medium text-gray-600")}>
                            {n.title}
                          </p>
                          {!n.is_read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

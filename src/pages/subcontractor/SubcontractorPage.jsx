import { useState, useMemo } from "react";
import { PageLayout, PageContent, Topbar, FilterBar } from "../../components/layout";
import { useGCTracking, usePatchGCTracking } from "../../hooks";
import { Spinner, Button, Input } from "../../components/ui";
import { useToast } from "../../components/ui/overlays";
import { useAuthStore } from "../../store/authStore";
import { fmtDate, fmtNum } from "../../utils";
import {
  ArrowUp, ArrowDown, ArrowUpDown, X, CheckCircle2, CalendarClock,
  PackageCheck, RefreshCw, AlertTriangle, Clock, Boxes, RotateCcw,
  ChevronDown,
} from "lucide-react";
import { clsx } from "clsx";

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  received: { label: "Đã nhận hàng", icon: CheckCircle2,   bg: "bg-green-50 text-green-700 border-green-200",   pill: "bg-green-600 text-white" },
  late:     { label: "Trễ",          icon: AlertTriangle,   bg: "bg-red-50 text-red-700 border-red-200",         pill: "bg-red-600 text-white" },
  warning:  { label: "Sắp trễ",      icon: AlertTriangle,   bg: "bg-amber-50 text-amber-700 border-amber-200",   pill: "bg-amber-500 text-white" },
  on_track: { label: "Đúng hạn",     icon: Clock,           bg: "bg-blue-50 text-blue-700 border-blue-200",      pill: "bg-blue-600 text-white" },
};

const SORT_OPTIONS = [
  { value: "return_asc",   label: "Ngày trả ↑" },
  { value: "return_desc",  label: "Ngày trả ↓" },
  { value: "deadline_asc", label: "CRD ↑" },
  { value: "deadline_desc",label: "CRD ↓" },
];

const RUNS_OPTIONS = [
  { value: "",   label: "Tất cả Run" },
  { value: "48", label: "Run #48 · run_20260622_active — T6/2026" },
  { value: "47", label: "Run #47 · run_20260622_verify — T6/2026" },
  { value: "46", label: "Run #46 · run_20260621_a3 — T6/2026" },
  { value: "41", label: "Run #41 · run_20260610_draft — T5/2026" },
];

// ── Status pill ───────────────────────────────────────────────────────────────
function StatusPill({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.on_track;
  const Icon = cfg.icon;
  return (
    <span className={clsx(
      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
      cfg.bg
    )}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

// ── Summary bar ───────────────────────────────────────────────────────────────
function SummaryBar({ items }) {
  const c = useMemo(() => ({
    total:    items.length,
    late:     items.filter((i) => i.status === "late").length,
    warning:  items.filter((i) => i.status === "warning").length,
    on_track: items.filter((i) => i.status === "on_track").length,
    received: items.filter((i) => i.status === "received").length,
  }), [items]);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-6 py-3">
      {[
        { label: "Tổng đơn GC",  value: c.total,    color: "text-slate-700",  bg: "bg-slate-100" },
        { label: "Trễ",           value: c.late,     color: "text-red-700",    bg: "bg-red-50" },
        { label: "Sắp trễ",      value: c.warning,  color: "text-amber-700",  bg: "bg-amber-50" },
        { label: "Đúng hạn",     value: c.on_track, color: "text-blue-700",   bg: "bg-blue-50" },
        { label: "Đã nhận",      value: c.received, color: "text-green-700",  bg: "bg-green-50" },
      ].map(({ label, value, color, bg }) => (
        <div key={label} className={clsx("flex items-center gap-2 rounded-xl px-3 py-1.5", bg)}>
          <span className={clsx("text-xl font-bold tabular-nums", color)}>{value}</span>
          <span className="text-xs text-slate-500">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Update / Extend Modal (sub-planner) ───────────────────────────────────────
function UpdateModal({ item, onClose, onSave }) {
  const { user } = useAuthStore();
  const [mode, setMode] = useState("update"); // "update" | "extend" | "receive"
  const [newDate, setNewDate] = useState(item.return_confirmed_date || "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const ACTION_LABELS = {
    receive: "Xác nhận nhận hàng",
    extend:  "Gia hạn đơn",
    update:  "Cập nhật ngày trả",
  };

  const handleSave = async () => {
    if (mode !== "receive" && !newDate) return;
    setSaving(true);
    const actor = user?.full_name || user?.username || "Sub Planner";
    const body = {
      updated_by:   actor,
      action_label: ACTION_LABELS[mode],
    };
    if (mode === "receive") {
      body.actual_return_date = new Date().toISOString().slice(0, 10);
    } else if (mode === "extend") {
      body.extend = true;
      body.return_confirmed_date = newDate;
    } else {
      body.return_confirmed_date = newDate;
    }
    if (note.trim()) body.note = note.trim();
    await onSave(item.id, body);
    setSaving(false);
    onClose();
  };

  const tabs = [
    { key: "update",  label: "Cập nhật ngày trả",  icon: CalendarClock },
    { key: "extend",  label: "Gia hạn đơn",         icon: RefreshCw },
    { key: "receive", label: "Xác nhận nhận hàng",  icon: PackageCheck },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <div className="font-semibold text-slate-800">Cập nhật đơn gia công</div>
            <div className="mt-0.5 font-mono text-xs text-slate-500">
              {item.order_id} · {item.shoe_type} · {fmtNum(item.qty)} đôi
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={clsx(
                "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition border-b-2",
                mode === key
                  ? "border-blue-600 text-blue-700 bg-blue-50/50"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}>
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Info grid */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <InfoBox label="Ngày trả hiện tại" value={fmtDate(item.return_confirmed_date)} highlight={item.status === "late"} />
            <InfoBox label="Hạn CRD" value={fmtDate(item.deadline)} />
            <InfoBox label="Đơn vị GC" value={item.gc_unit} />
          </div>

          {item.extension_count > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
              <RotateCcw size={13} />
              Đã gia hạn <strong>{item.extension_count} lần</strong> trước đó
            </div>
          )}

          {mode === "receive" ? (
            <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-4 text-center">
              <PackageCheck size={28} className="mx-auto text-green-600 mb-2" />
              <p className="text-sm font-semibold text-green-800">Xác nhận đã nhận hàng từ đơn vị GC?</p>
              <p className="text-xs text-green-600 mt-1">
                Ngày xác nhận: <strong>{new Date().toLocaleDateString("vi-VN")}</strong>
              </p>
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                {mode === "extend" ? "Ngày trả mới (sau gia hạn)" : "Ngày trả hàng mới"}
              </label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              {mode === "extend" && (
                <p className="mt-1 text-xs text-amber-600">
                  Gia hạn lần {(item.extension_count || 0) + 1} — đơn vị GC <strong>{item.gc_unit}</strong> xin thêm thời gian. Main Planner sẽ được thông báo.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Ghi chú (tuỳ chọn)</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Lý do cập nhật, tình trạng đơn..."
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-slate-100 px-6 py-4">
          <Button variant="ghost" size="md" className="flex-1" onClick={onClose}>Hủy</Button>
          <Button
            variant="primary"
            size="md"
            className={clsx("flex-1", mode === "receive" && "!bg-green-600 !border-green-600 hover:!bg-green-700")}
            disabled={saving || (mode !== "receive" && !newDate)}
            onClick={handleSave}>
            {saving ? "Đang lưu..." : mode === "receive" ? "Xác nhận nhận hàng" : mode === "extend" ? "Gia hạn" : "Lưu cập nhật"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value, highlight }) {
  return (
    <div className={clsx("rounded-lg px-3 py-2", highlight ? "bg-red-50 border border-red-200" : "bg-slate-50")}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">{label}</div>
      <div className={clsx("text-xs font-medium", highlight ? "text-red-700" : "text-slate-700")}>{value || "—"}</div>
    </div>
  );
}

// ── Notes history popover ─────────────────────────────────────────────────────
function NotesCell({ notes }) {
  if (!notes?.length) return <span className="text-xs text-slate-300">—</span>;
  const last = notes[notes.length - 1];
  return (
    <div title={notes.map((n) => `${n.by}: ${n.text}`).join("\n")}>
      <span className="text-xs text-slate-500 truncate block max-w-[140px]">{last.text}</span>
      <span className="text-[10px] text-slate-400">{notes.length > 1 ? `+${notes.length - 1} ghi chú` : ""}</span>
    </div>
  );
}

// ── Lifecycle badge ───────────────────────────────────────────────────────────
function LifecycleBadge({ status }) {
  const cfg = {
    active:   "text-green-700 bg-green-50 border-green-200",
    accepted: "text-blue-700 bg-blue-50 border-blue-200",
    draft:    "text-slate-500 bg-slate-50 border-slate-200",
  };
  const labels = { active: "Active", accepted: "Accepted", draft: "Draft" };
  return (
    <span className={clsx("inline-block rounded border px-1 py-0 text-[10px] font-semibold mt-0.5", cfg[status] || cfg.draft)}>
      {labels[status] || status}
    </span>
  );
}

// ── Table Row ─────────────────────────────────────────────────────────────────
function GCRow({ item, isSubPlanner, onEdit }) {
  const isReceived = item.status === "received";
  const rcDays = Math.round(
    (new Date(item.return_confirmed_date + "T00:00:00Z") - new Date("2026-06-23T00:00:00Z")) / 86400000
  );

  return (
    <tr className="border-b border-slate-100 hover:bg-blue-50/20 transition-colors">
      {/* Mã đơn */}
      <td className="px-4 py-2.5">
        <span className="font-mono text-xs font-semibold text-slate-800">{item.order_id}</span>
        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.article}</div>
      </td>

      {/* Dạng giày */}
      <td className="px-4 py-2.5 text-sm text-slate-700">{item.shoe_type}</td>

      {/* SL */}
      <td className="px-4 py-2.5 text-xs text-right tabular-nums text-slate-600">
        {fmtNum(item.qty)}
      </td>

      {/* Đơn vị GC */}
      <td className="px-4 py-2.5">
        <div className="text-xs font-medium text-slate-700">{item.gc_unit}</div>
        <div className="text-[10px] text-slate-400">{item.gc_dep_no}</div>
      </td>

      {/* Chuyền gò */}
      <td className="px-4 py-2.5">
        <span className={clsx(
          "inline-block rounded px-2 py-0.5 text-xs font-semibold",
          item.line_id?.startsWith("A") ? "bg-violet-100 text-violet-700" :
          item.line_id?.startsWith("B") ? "bg-blue-100 text-blue-700" :
          "bg-teal-100 text-teal-700"
        )}>
          {item.line_id}
        </span>
      </td>

      {/* Ngày gửi GC */}
      <td className="px-4 py-2.5">
        <span className="font-mono text-xs text-slate-600">{fmtDate(item.sent_date)}</span>
      </td>

      {/* Ngày xác nhận trả */}
      <td className="px-4 py-2.5">
        <div className={clsx("font-mono text-xs", item.status === "late" ? "text-red-700 font-semibold" : "text-slate-700")}>
          {fmtDate(item.return_confirmed_date)}
        </div>
        {item.extension_count > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600">
            <RotateCcw size={10} /> Gia hạn ×{item.extension_count}
          </span>
        )}
        <div className={clsx("text-[10px] font-medium mt-0.5",
          rcDays < 0 ? "text-red-500" : rcDays <= 5 ? "text-amber-600" : "text-slate-400"
        )}>
          {rcDays < 0 ? `Trễ ${Math.abs(rcDays)} ngày` : rcDays === 0 ? "Hôm nay" : `Còn ${rcDays} ngày`}
        </div>
      </td>

      {/* Bắt đầu gò */}
      <td className="px-4 py-2.5">
        <span className="font-mono text-xs text-slate-600">{fmtDate(item.go_start)}</span>
      </td>

      {/* Kết thúc gò */}
      <td className="px-4 py-2.5">
        <span className="font-mono text-xs text-slate-600">{fmtDate(item.go_end)}</span>
      </td>

      {/* CRD */}
      <td className="px-4 py-2.5">
        <span className="font-mono text-xs text-slate-600">{fmtDate(item.deadline)}</span>
        {item.actual_return_date && (
          <div className="text-[10px] text-green-600 mt-0.5">✓ Nhận: {fmtDate(item.actual_return_date)}</div>
        )}
      </td>

      {/* Trạng thái */}
      <td className="px-4 py-2.5">
        <StatusPill status={item.status} />
        {item.updated_by && (
          <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-slate-50 border border-slate-200 px-2 py-1">
            <span className="mt-px shrink-0 h-3.5 w-3.5 rounded-full bg-emerald-500 flex items-center justify-center text-[8px] text-white font-bold leading-none">
              {item.updated_by.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold text-slate-700 truncate">{item.updated_by}</div>
              <div className="text-[9px] text-slate-400 leading-tight">{item.action_label || "Đã cập nhật"}</div>
              {item.updated_at && (
                <div className="text-[9px] text-slate-400 leading-tight">
                  {new Date(item.updated_at).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
          </div>
        )}
      </td>

      {/* Run */}
      <td className="px-4 py-2.5">
        <div className="font-mono text-[10px] text-slate-500">#{item.run_id}</div>
        <div className="text-[10px] text-slate-400 truncate max-w-[130px]" title={item.run_label}>
          {item.run_label}
        </div>
        <LifecycleBadge status={item.lifecycle_status} />
      </td>

      {/* Giai đoạn */}
      <td className="px-4 py-2.5">
        <div className="text-xs font-medium text-slate-700">{item.period_label}</div>
        <div className="text-[10px] text-slate-400">Period {item.period_id}</div>
      </td>

      {/* Ghi chú */}
      <td className="px-4 py-2.5 max-w-[160px]">
        <NotesCell notes={item.notes} />
      </td>

      {/* Thao tác (sub-planner only) */}
      {isSubPlanner && (
        <td className="px-4 py-2.5">
          {isReceived ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
              <CheckCircle2 size={13} /> Đã nhận
            </span>
          ) : (
            <button
              onClick={() => onEdit(item)}
              className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition">
              <CalendarClock size={12} />
              Cập nhật
              <ChevronDown size={11} className="text-slate-400" />
            </button>
          )}
        </td>
      )}
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SubcontractorPage() {
  const { user } = useAuthStore();
  const isSubPlanner = user?.role === "sub_planner";
  const toast = useToast();

  const [statusFilter, setStatusFilter] = useState("");
  const [runFilter, setRunFilter]       = useState("");
  const [sort, setSort]                 = useState("return_asc");
  const [search, setSearch]             = useState("");
  const [editingItem, setEditingItem]   = useState(null);

  const queryParams = useMemo(() => {
    const p = {};
    if (statusFilter) p.status = statusFilter;
    if (runFilter)    p.run_id = runFilter;
    if (sort)         p.sort   = sort;
    if (isSubPlanner && user?.assigned_lines?.length)
      p.line_ids = user.assigned_lines.join(",");
    return p;
  }, [statusFilter, runFilter, sort, isSubPlanner, user?.assigned_lines]);

  const { data, isLoading, refetch } = useGCTracking(queryParams);
  const patchMutation = usePatchGCTracking();

  const allItems = data?.items || [];

  const items = useMemo(() => {
    if (!search.trim()) return allItems;
    const q = search.toLowerCase();
    return allItems.filter(
      (it) =>
        it.order_id.toLowerCase().includes(q) ||
        it.article.toLowerCase().includes(q) ||
        it.shoe_type?.toLowerCase().includes(q) ||
        it.gc_unit?.toLowerCase().includes(q) ||
        it.line_id?.toLowerCase().includes(q)
    );
  }, [allItems, search]);

  const handleUpdate = async (id, body) => {
    try {
      await patchMutation.mutateAsync({ id, body });
      const action = body.actual_return_date ? "Đã xác nhận nhận hàng" : body.extend ? "Đã gia hạn đơn" : "Đã cập nhật ngày trả";
      toast(action, "success");
      refetch();
    } catch {
      toast("Cập nhật thất bại", "error");
    }
  };

  const sortLabel = SORT_OPTIONS.find((s) => s.value === sort)?.label || "Sắp xếp";

  return (
    <PageLayout>
      <Topbar
        title="Theo dõi Gia công (GC)"
        subtitle={
          isSubPlanner
            ? `Chuyền gò phụ trách: ${user?.assigned_lines?.join(", ") || "—"} — cập nhật gia hạn khi đơn vị GC xin thêm thời gian`
            : "Tổng quan đơn gia công · theo dõi ngày trả hàng"
        }
      />

      <SummaryBar items={allItems} />

      <FilterBar>
        <Input
          placeholder="Tìm mã đơn, dạng giày, đơn vị GC..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56 text-sm"
        />

        {/* Status pills */}
        <div className="flex items-center gap-1">
          {[
            { value: "",         label: "Tất cả",      activeCls: "bg-slate-700 text-white",    inactiveCls: "bg-slate-100 text-slate-700" },
            { value: "late",     label: "Trễ",          activeCls: "bg-red-600 text-white",      inactiveCls: "bg-red-50 text-red-700 border border-red-200" },
            { value: "warning",  label: "Sắp trễ",     activeCls: "bg-amber-500 text-white",    inactiveCls: "bg-amber-50 text-amber-700 border border-amber-200" },
            { value: "on_track", label: "Đúng hạn",    activeCls: "bg-blue-600 text-white",     inactiveCls: "bg-blue-50 text-blue-700 border border-blue-200" },
            { value: "received", label: "Đã nhận",     activeCls: "bg-green-600 text-white",    inactiveCls: "bg-green-50 text-green-700 border border-green-200" },
          ].map(({ value, label, activeCls, inactiveCls }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={clsx(
                "rounded-full px-3 py-1 text-xs font-semibold transition",
                statusFilter === value ? activeCls : inactiveCls
              )}>
              {label}
            </button>
          ))}
        </div>

        {/* Run dropdown */}
        <div className="relative">
          <select
            value={runFilter}
            onChange={(e) => setRunFilter(e.target.value)}
            className="appearance-none rounded-lg border border-slate-300 bg-white py-1.5 pl-3 pr-7 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 min-w-[180px]">
            {RUNS_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">▾</span>
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="appearance-none rounded-lg border border-slate-300 bg-white py-1.5 pl-3 pr-7 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">▾</span>
        </div>

        <div className="flex-1" />
        <span className="text-xs text-slate-400">{items.length} đơn GC</span>
      </FilterBar>

      <PageContent className="p-6">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner size={32} />
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {[
                      "Mã đơn", "Dạng giày", "SL", "Đơn vị GC",
                      "Chuyền gò", "Ngày gửi GC", "Ngày XN trả",
                      "Bắt đầu gò", "Kết thúc gò", "CRD",
                      "Trạng thái", "Run", "Giai đoạn", "Ghi chú",
                      ...(isSubPlanner ? ["Gia hạn / Xác nhận"] : []),
                    ].map((h) => (
                      <th key={h} className="border-b border-slate-200 px-4 py-3 text-left font-semibold whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={isSubPlanner ? 15 : 14} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <Boxes size={32} strokeWidth={1.5} />
                          <p className="font-medium text-slate-500">Không có đơn gia công nào</p>
                          <p className="text-xs">Thử thay đổi bộ lọc hoặc chọn Run khác</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    items.map((it) => (
                      <GCRow
                        key={it.id}
                        item={it}
                        isSubPlanner={isSubPlanner}
                        onEdit={setEditingItem}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </PageContent>

      {editingItem && (
        <UpdateModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={handleUpdate}
        />
      )}
    </PageLayout>
  );
}

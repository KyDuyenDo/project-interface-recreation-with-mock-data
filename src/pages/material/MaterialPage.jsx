import { useState, useMemo } from "react";
import { PageLayout, PageContent, Topbar, FilterBar } from "../../components/layout";
import { useMaterialTracking, usePatchMaterialTracking } from "../../hooks";
import { Spinner, Badge, Button, Input, Select } from "../../components/ui";
import { useToast } from "../../components/ui/overlays";
import { useAuthStore } from "../../store/authStore";
import { fmtDate } from "../../utils";
import {
  ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, Pencil, X,
  PackageCheck, Clock, AlertTriangle, Boxes,
} from "lucide-react";
import { clsx } from "clsx";

// ── Constants ────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  waiting:  { label: "Chờ vật liệu",  variant: "info",    icon: Clock,         bg: "bg-blue-50 text-blue-700 border-blue-200" },
  upcoming: { label: "Sắp đến hạn",   variant: "warning", icon: AlertTriangle,  bg: "bg-amber-50 text-amber-700 border-amber-200" },
  late:     { label: "Trễ",           variant: "danger",  icon: AlertTriangle,  bg: "bg-red-50 text-red-700 border-red-200" },
  ready:    { label: "Đã có hàng",    variant: "success", icon: CheckCircle2,   bg: "bg-green-50 text-green-700 border-green-200" },
};

const RUNS_OPTIONS = [
  { value: "",   label: "Tất cả các Run" },
  { value: "48", label: "Run #48", sub: "run_20260622_active — T6/2026" },
  { value: "47", label: "Run #47", sub: "run_20260622_verify — T6/2026" },
  { value: "46", label: "Run #46", sub: "run_20260621_a3 — T6/2026" },
  { value: "41", label: "Run #41", sub: "run_20260610_draft — T5/2026" },
];

function StatusPill({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.waiting;
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

// ── Update Material Date Modal (sub-planner) ─────────────────────────────────
function UpdateEtaModal({ item, onClose, onSave }) {
  const [newDate, setNewDate] = useState(item.material_eta || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!newDate) return;
    setSaving(true);
    await onSave(item.id, { material_eta: newDate });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="font-semibold text-slate-800">Cập nhật ngày NVL về</div>
            <div className="mt-0.5 text-xs text-slate-500 font-mono">{item.order_id} · {item.shoe_type}</div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Ngày NVL dự kiến về</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <div className="font-medium text-slate-400 uppercase tracking-wide text-[10px] mb-0.5">Hiện tại</div>
              <div className="font-mono">{fmtDate(item.material_eta)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <div className="font-medium text-slate-400 uppercase tracking-wide text-[10px] mb-0.5">Deadline</div>
              <div className="font-mono">{fmtDate(item.deadline)}</div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <Button variant="ghost" size="md" className="flex-1" onClick={onClose}>Hủy</Button>
          <Button variant="primary" size="md" className="flex-1" disabled={!newDate || saving} onClick={handleSave}>
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Summary stats bar ────────────────────────────────────────────────────────
function SummaryBar({ items }) {
  const counts = useMemo(() => ({
    total: items.length,
    late: items.filter((i) => i.status === "late").length,
    upcoming: items.filter((i) => i.status === "upcoming").length,
    waiting: items.filter((i) => i.status === "waiting").length,
    ready: items.filter((i) => i.status === "ready").length,
  }), [items]);

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-6 py-3">
      {[
        { label: "Tổng đơn", value: counts.total, color: "text-slate-700", bg: "bg-slate-100" },
        { label: "Trễ NVL",  value: counts.late,     color: "text-red-700",  bg: "bg-red-50" },
        { label: "Sắp hạn",  value: counts.upcoming,  color: "text-amber-700", bg: "bg-amber-50" },
        { label: "Chờ NVL",  value: counts.waiting,   color: "text-blue-700", bg: "bg-blue-50" },
        { label: "Đã có",    value: counts.ready,     color: "text-green-700", bg: "bg-green-50" },
      ].map(({ label, value, color, bg }) => (
        <div key={label} className={clsx("flex items-center gap-2 rounded-xl px-3 py-1.5", bg)}>
          <span className={clsx("text-xl font-bold tabular-nums", color)}>{value}</span>
          <span className="text-xs text-slate-500">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MaterialPage() {
  const { user } = useAuthStore();
  const isSubPlanner = user?.role === "sub_planner";
  const toast = useToast();

  const [statusFilter, setStatusFilter] = useState("");
  const [runFilter, setRunFilter] = useState("");
  const [sort, setSort] = useState("deadline_asc");
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState(null);

  const queryParams = useMemo(() => {
    const p = {};
    if (statusFilter) p.status = statusFilter;
    if (runFilter) p.run_id = runFilter;
    if (sort) p.sort = sort;
    if (isSubPlanner && user?.assigned_lines?.length)
      p.line_ids = user.assigned_lines.join(",");
    return p;
  }, [statusFilter, runFilter, sort, isSubPlanner, user?.assigned_lines]);

  const { data, isLoading, refetch } = useMaterialTracking(queryParams);
  const patchMutation = usePatchMaterialTracking();

  const allItems = data?.items || [];

  const items = useMemo(() => {
    if (!search.trim()) return allItems;
    const q = search.toLowerCase();
    return allItems.filter(
      (it) =>
        it.order_id.toLowerCase().includes(q) ||
        it.article.toLowerCase().includes(q) ||
        it.shoe_type?.toLowerCase().includes(q) ||
        it.line_id?.toLowerCase().includes(q)
    );
  }, [allItems, search]);

  const handleConfirm = async (item) => {
    try {
      await patchMutation.mutateAsync({
        id: item.id,
        body: {
          material_confirmed: true,
          confirmed_by: user?.full_name || user?.username,
        },
      });
      toast(`Đã xác nhận NVL về cho đơn ${item.order_id}`, "success");
    } catch {
      toast("Xác nhận thất bại", "error");
    }
  };

  const handleUpdateEta = async (id, body) => {
    try {
      await patchMutation.mutateAsync({ id, body });
      toast("Đã cập nhật ngày NVL về", "success");
      refetch();
    } catch {
      toast("Cập nhật thất bại", "error");
    }
  };

  const toggleSort = () =>
    setSort((s) => (s === "deadline_asc" ? "deadline_desc" : "deadline_asc"));

  const SortIcon = sort === "deadline_asc" ? ArrowUp : sort === "deadline_desc" ? ArrowDown : ArrowUpDown;

  return (
    <PageLayout>
      <Topbar
        title="Theo dõi Nguyên vật liệu"
        subtitle={
          isSubPlanner
            ? `Chuyền của bạn: ${user?.assigned_lines?.join(", ") || "—"}`
            : "Tổng quan NVL về · tất cả đơn hàng"
        }
      />

      {/* Summary bar */}
      <SummaryBar items={allItems} />

      {/* Filter bar */}
      <FilterBar>
        {/* Search */}
        <Input
          placeholder="Tìm đơn hàng, article, chuyền..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-52 text-sm"
        />

        {/* Status filter pills */}
        <div className="flex items-center gap-1">
          {[
            { value: "",         label: "Tất cả",       bg: "bg-slate-100 text-slate-700", active: "bg-slate-700 text-white" },
            { value: "late",     label: "Trễ",           bg: "bg-red-50 text-red-700 border border-red-200",    active: "bg-red-600 text-white border-red-600" },
            { value: "upcoming", label: "Sắp đến hạn",  bg: "bg-amber-50 text-amber-700 border border-amber-200", active: "bg-amber-500 text-white border-amber-500" },
            { value: "waiting",  label: "Chờ vật liệu", bg: "bg-blue-50 text-blue-700 border border-blue-200",  active: "bg-blue-600 text-white border-blue-600" },
            { value: "ready",    label: "Đã có hàng",   bg: "bg-green-50 text-green-700 border border-green-200", active: "bg-green-600 text-white border-green-600" },
          ].map(({ value, label, bg, active }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={clsx(
                "rounded-full px-3 py-1 text-xs font-semibold transition",
                statusFilter === value ? active : bg
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
            className="appearance-none rounded-lg border border-slate-300 bg-white py-1.5 pl-3 pr-7 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 min-w-[160px]">
            {RUNS_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}{r.sub ? ` · ${r.sub}` : ""}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">▾</span>
        </div>

        {/* Sort by deadline */}
        <button
          onClick={toggleSort}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 transition">
          <SortIcon size={14} />
          {sort === "deadline_asc" ? "Deadline ↑" : sort === "deadline_desc" ? "Deadline ↓" : "Sắp xếp"}
        </button>

        <div className="flex-1" />
        <span className="text-xs text-slate-400">{items.length} đơn</span>
      </FilterBar>

      {/* Table */}
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
                    <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold whitespace-nowrap">Mã đơn</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold whitespace-nowrap">Dạng giày</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold whitespace-nowrap">Deadline (CRD)</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold whitespace-nowrap">NVL dự kiến về</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold whitespace-nowrap">Chuyền phụ trách</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold whitespace-nowrap">Trạng thái</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold whitespace-nowrap">Run</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold whitespace-nowrap">Giai đoạn</th>
                    {isSubPlanner && (
                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold whitespace-nowrap">Thao tác</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={isSubPlanner ? 9 : 8} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <Boxes size={32} strokeWidth={1.5} />
                          <p className="font-medium text-slate-500">Không có đơn nào</p>
                          <p className="text-xs">Thử thay đổi bộ lọc để xem thêm</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    items.map((it) => (
                      <Row
                        key={it.id}
                        item={it}
                        isSubPlanner={isSubPlanner}
                        onConfirm={handleConfirm}
                        onEdit={() => setEditingItem(it)}
                        isPending={patchMutation.isPending}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </PageContent>

      {/* Update ETA Modal */}
      {editingItem && (
        <UpdateEtaModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={handleUpdateEta}
        />
      )}
    </PageLayout>
  );
}

// ── Table Row ────────────────────────────────────────────────────────────────
function Row({ item, isSubPlanner, onConfirm, onEdit, isPending }) {
  const isReady = item.status === "ready" || item.material_confirmed;

  return (
    <tr className="border-b border-slate-100 hover:bg-blue-50/20 transition-colors">
      <td className="px-4 py-2.5">
        <span className="font-mono text-xs font-semibold text-slate-800">{item.order_id}</span>
        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.article}</div>
      </td>

      <td className="px-4 py-2.5">
        <span className="text-sm text-slate-700">{item.shoe_type}</span>
      </td>

      <td className="px-4 py-2.5">
        <DeadlineCell deadline={item.deadline} />
      </td>

      <td className="px-4 py-2.5">
        <EtaCell eta={item.material_eta} deadline={item.deadline} />
      </td>

      <td className="px-4 py-2.5">
        <LineCell lineId={item.line_id} />
      </td>

      <td className="px-4 py-2.5">
        <StatusPill status={item.status} />
        {item.material_confirmed && item.confirmed_by && item.status === "ready" && (
          <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-slate-50 border border-slate-200 px-2 py-1">
            <span className="mt-px shrink-0 h-3.5 w-3.5 rounded-full bg-emerald-500 flex items-center justify-center text-[8px] text-white font-bold leading-none">
              {item.confirmed_by.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold text-slate-700 truncate">{item.confirmed_by}</div>
              <div className="text-[9px] text-slate-400 leading-tight">Xác nhận NVL về</div>
              {item.confirmed_at && (
                <div className="text-[9px] text-slate-400 leading-tight">
                  {new Date(item.confirmed_at).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
          </div>
        )}
      </td>

      <td className="px-4 py-2.5">
        <div className="font-mono text-[10px] text-slate-500">#{item.run_id}</div>
        <div className="text-[10px] text-slate-400 truncate max-w-[140px]" title={item.run_label}>
          {item.run_label}
        </div>
        <LifecycleBadge status={item.lifecycle_status} />
      </td>

      <td className="px-4 py-2.5">
        <div className="text-xs font-medium text-slate-700">{item.period_label}</div>
        <div className="text-[10px] text-slate-400">Period {item.period_id}</div>
      </td>

      {isSubPlanner && (
        <td className="px-4 py-2.5">
          {isReady ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
              <CheckCircle2 size={13} /> Đã xác nhận
            </span>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                disabled={isPending}
                onClick={() => onConfirm(item)}
                title="Xác nhận NVL đã về"
                className="flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition">
                <PackageCheck size={12} />
                Có hàng
              </button>
              <button
                onClick={onEdit}
                title="Cập nhật ngày NVL về"
                className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition">
                <Pencil size={11} />
                Cập nhật
              </button>
            </div>
          )}
        </td>
      )}
    </tr>
  );
}

// ── Small cell helpers ────────────────────────────────────────────────────────
function DeadlineCell({ deadline }) {
  if (!deadline) return <span className="text-slate-400">—</span>;
  const days = Math.round((new Date(deadline + "T00:00:00Z") - new Date("2026-06-23T00:00:00Z")) / 86400000);
  return (
    <div>
      <span className="font-mono text-xs">{fmtDate(deadline)}</span>
      <div className={clsx("text-[10px] font-medium mt-0.5",
        days < 0 ? "text-red-500" : days <= 7 ? "text-amber-600" : "text-slate-400"
      )}>
        {days < 0 ? `Quá hạn ${Math.abs(days)} ngày` : days === 0 ? "Hôm nay" : `Còn ${days} ngày`}
      </div>
    </div>
  );
}

function EtaCell({ eta, deadline }) {
  if (!eta) return <span className="text-slate-400">—</span>;
  const isLate = deadline && eta > deadline;
  return (
    <div>
      <span className={clsx("font-mono text-xs", isLate ? "text-red-600 font-semibold" : "text-slate-700")}>
        {fmtDate(eta)}
      </span>
      {isLate && <div className="text-[10px] text-red-500 mt-0.5">Sau CRD</div>}
    </div>
  );
}

function LineCell({ lineId }) {
  if (!lineId) return <span className="text-slate-400">—</span>;
  const [prefix, num] = lineId.split("_L");
  return (
    <div className="flex items-center gap-1.5">
      <span className={clsx(
        "inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white",
        prefix === "B" ? "bg-blue-500" : prefix === "C" ? "bg-purple-500" : "bg-teal-500"
      )}>
        {prefix}
      </span>
      <span className="text-xs font-medium text-slate-700">{lineId}</span>
    </div>
  );
}

function LifecycleBadge({ status }) {
  const cfg = {
    active:      { label: "Active",    cls: "text-green-700 bg-green-50 border-green-200" },
    accepted:    { label: "Accepted",  cls: "text-blue-700 bg-blue-50 border-blue-200" },
    draft:       { label: "Draft",     cls: "text-slate-500 bg-slate-50 border-slate-200" },
    superseded:  { label: "Cũ",        cls: "text-slate-400 bg-slate-50 border-slate-200" },
  };
  const c = cfg[status] || cfg.draft;
  return (
    <span className={clsx("mt-0.5 inline-block rounded border px-1 py-0 text-[10px] font-semibold", c.cls)}>
      {c.label}
    </span>
  );
}

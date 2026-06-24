/**
 * SubPlannerDispatchPanel — v2
 *
 * Mô hình mới: Nhóm chuyền → nhiều Sub-Planner/nhóm
 *
 * Left  : LineGroupCard — nhóm chuyền + avatar stack (overlap + "+N")
 * Right : Chi tiết đơn hàng của nhóm, mỗi đơn ghi rõ ai đã cập nhật
 *
 * Mode "approval" (step 2, 6): xác nhận / từ chối
 * Mode "eta"      (step 3):    nhập ngày NVL về
 * Mode "gc"       (step 4):    nhập ngày GC
 */

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, CheckCircle2, Clock, AlertTriangle, RefreshCw,
  Loader2, Send, RotateCcw, Info, ChevronRight,
  Package, CalendarClock, Filter, Search, X, CalendarDays,
  Layers,
} from "lucide-react";
import http from "../../api/http";

// ── Step metadata ──────────────────────────────────────────────────────────────
const STEP_META = {
  2: { label: "Phân công xác nhận chuyền",  hint: "Sub-Planner xem kế hoạch → Chấp nhận hoặc Từ chối", color: "blue",   mode: "approval" },
  3: { label: "Phân công nhập NVL về",       hint: "Sub-Planner nhập ngày NVL → Xác nhận hoàn tất",      color: "teal",   mode: "eta"      },
  4: { label: "Phân công nhập ngày GC",      hint: "Sub-Planner nhập ngày GC → Xác nhận hoàn tất",       color: "orange", mode: "gc"       },
  6: { label: "Phân công review lịch",       hint: "Sub-Planner review lịch chuyền → Chấp nhận/Từ chối", color: "purple", mode: "approval" },
};

// ── Planner color palette (assigned by index in group) ─────────────────────────
const PLANNER_PALETTE = [
  { bg: "bg-blue-100",   text: "text-blue-700",   ring: "ring-blue-300",   badge: "bg-blue-50 text-blue-700 border-blue-200"   },
  { bg: "bg-teal-100",   text: "text-teal-700",   ring: "ring-teal-300",   badge: "bg-teal-50 text-teal-700 border-teal-200"   },
  { bg: "bg-orange-100", text: "text-orange-700", ring: "ring-orange-300", badge: "bg-orange-50 text-orange-700 border-orange-200" },
  { bg: "bg-purple-100", text: "text-purple-700", ring: "ring-purple-300", badge: "bg-purple-50 text-purple-700 border-purple-200" },
  { bg: "bg-rose-100",   text: "text-rose-700",   ring: "ring-rose-300",   badge: "bg-rose-50 text-rose-700 border-rose-200"   },
  { bg: "bg-green-100",  text: "text-green-700",  ring: "ring-green-300",  badge: "bg-green-50 text-green-700 border-green-200"  },
];
const plannerPalette = idx => PLANNER_PALETTE[idx % PLANNER_PALETTE.length];

// ── Status config ──────────────────────────────────────────────────────────────
const APPROVAL_STATUS = {
  confirmed: { label: "Chấp nhận",    bg: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500",  Icon: CheckCircle2 },
  rejected:  { label: "Từ chối",      bg: "bg-red-100 text-red-700 border-red-200",       dot: "bg-red-500",    Icon: AlertTriangle },
  pending:   { label: "Chờ xác nhận", bg: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-400",  Icon: Clock },
};
const DATE_STATUS = {
  done:    { label: "Đã nhập",   bg: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500",  Icon: CheckCircle2 },
  pending: { label: "Chưa nhập", bg: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-400",  Icon: Clock },
};

function StatusChip({ status, mode = "approval" }) {
  const cfg = mode === "approval"
    ? (APPROVAL_STATUS[status] || { label: status, bg: "bg-gray-100 text-gray-500 border-gray-200", dot: "bg-gray-400", Icon: Clock })
    : (DATE_STATUS[status]    || { label: status, bg: "bg-gray-100 text-gray-500 border-gray-200", dot: "bg-gray-400", Icon: Clock });
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${cfg.bg}`}>
      <cfg.Icon size={10} /> {cfg.label}
    </span>
  );
}

// ── Avatar (large) ─────────────────────────────────────────────────────────────
function Avatar({ name, palette: pal }) {
  const initials = name.split(" ").map(p => p[0]).slice(-2).join("").toUpperCase();
  const p = pal || PLANNER_PALETTE[0];
  return (
    <span className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 ${p.bg} ${p.text}`}>
      {initials}
    </span>
  );
}

// ── MiniAvatar — small, used in stacks and attribution ────────────────────────
function MiniAvatar({ name, palette: pal, size = "md", border = true }) {
  const initials = name.split(" ").map(p => p[0]).slice(-2).join("").toUpperCase();
  const p = pal || PLANNER_PALETTE[0];
  const sz = size === "sm" ? "w-5 h-5 text-[9px]" : "w-7 h-7 text-[11px]";
  return (
    <span title={name} className={`${sz} rounded-full flex items-center justify-center font-bold shrink-0 ${p.bg} ${p.text} ${border ? "border-2 border-white" : ""}`}>
      {initials}
    </span>
  );
}

// ── AvatarStack — overlapping row with "+N" overflow ──────────────────────────
function AvatarStack({ planners, max = 4 }) {
  const shown = planners.slice(0, max);
  const extra = planners.length - max;
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <div key={p.username} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: max - i }} className="relative">
          <MiniAvatar name={p.name} palette={plannerPalette(p.colorIdx)} border />
        </div>
      ))}
      {extra > 0 && (
        <div
          style={{ marginLeft: -8, zIndex: 0 }}
          className="relative w-7 h-7 rounded-full bg-gray-200 text-gray-600 text-[10px] font-bold flex items-center justify-center border-2 border-white"
        >
          +{extra}
        </div>
      )}
    </div>
  );
}

// ── Section divider ────────────────────────────────────────────────────────────
function SectionDivider({ label, count, sub }) {
  return (
    <div className={`flex items-center gap-2 px-1 ${sub ? "mt-3" : "mt-0"}`}>
      <span className={`text-[10px] font-bold uppercase tracking-wider ${sub ? "text-violet-500" : "text-blue-500"}`}>{label}</span>
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${sub ? "bg-violet-100 text-violet-600" : "bg-blue-100 text-blue-600"}`}>{count}</span>
      <div className={`flex-1 h-px ${sub ? "bg-violet-100" : "bg-blue-100"}`} />
    </div>
  );
}

// ── Stat ───────────────────────────────────────────────────────────────────────
function Stat({ label, value, color }) {
  const cls = { gray: "text-gray-700", green: "text-green-600", red: "text-red-600", amber: "text-amber-600" }[color] || "text-gray-700";
  return (
    <div className="flex flex-col items-center">
      <span className={`text-sm font-bold leading-none ${cls}`}>{value}</span>
      <span className="text-[9px] text-gray-400 mt-0.5 leading-none whitespace-nowrap">{label}</span>
    </div>
  );
}

// ── UpdatedBy attribution badge ────────────────────────────────────────────────
function UpdatedByBadge({ updatedBy }) {
  if (!updatedBy) return null;
  const p = plannerPalette(updatedBy.colorIdx);
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${p.badge}`}>
      <MiniAvatar name={updatedBy.name} palette={p} size="sm" border={false} />
      {updatedBy.name.split(" ").slice(-1)[0]}
    </span>
  );
}

// ── Mock data ──────────────────────────────────────────────────────────────────
const MOCK_GROUPS = [
  {
    groupId: "G1", groupName: "Nhóm 1",
    lines: ["L01", "L02", "L03"],
    planners: [
      { username: "nvl_01", name: "Nguyễn Văn Long"  },
      { username: "nvl_02", name: "Trần Thị Mai"      },
      { username: "nvl_03", name: "Lê Văn Đức"        },
    ],
  },
  {
    groupId: "G2", groupName: "Nhóm 2",
    lines: ["L04", "L05"],
    planners: [
      { username: "gc_01", name: "Phạm Thị Hoa"  },
      { username: "gc_02", name: "Vũ Minh Tuấn"  },
    ],
  },
  {
    groupId: "G3", groupName: "Nhóm 3",
    lines: ["L06", "L07", "L08"],
    planners: [
      { username: "sp_01", name: "Đặng Thị Lan"       },
      { username: "sp_02", name: "Hoàng Văn Nam"       },
      { username: "sp_03", name: "Bùi Thị Thúy"       },
      { username: "sp_04", name: "Nguyễn Minh Khoa"   },
    ],
  },
];

// Enrich planners with colorIdx
const ENRICHED_GROUPS = MOCK_GROUPS.map(g => ({
  ...g,
  planners: g.planners.map((p, i) => ({ ...p, colorIdx: i })),
}));

const STATUSES_APPROVAL = ["confirmed", "rejected", "pending", "confirmed", "confirmed", "pending", "rejected", "confirmed"];
const DONE_PATTERN       = [true, false, true, true, false, true, true, false, true, false];

function mockGroupApprovalOrders(group, dispatched) {
  if (!dispatched) return [];
  const { planners, lines } = group;
  const confirmReasons = ["Đã kiểm tra, kế hoạch hợp lý.", "Chuyền đủ năng lực thực hiện.", "Nguyên liệu đã về đủ."];
  const rejectReasons  = ["Năng lực chuyền không đủ trong tuần này.", "NVL chưa về kịp deadline.", "Chuyền đang có lịch sản xuất khác."];

  let orders = [];
  planners.forEach((planner, pi) => {
    const count = 3 + (planner.username.length % 3); // 3–5 đơn / planner
    for (let i = 0; i < count; i++) {
      const isSupport  = pi > 0 && i === count - 1;
      const line       = isSupport ? lines[0] : lines[(pi + i) % lines.length];
      const st         = STATUSES_APPROVAL[(pi * 5 + i) % STATUSES_APPROVAL.length];
      const rs         = st === "confirmed" ? confirmReasons : st === "rejected" ? rejectReasons : [];
      orders.push({
        id:           `ORD-${group.groupId}-${planner.username.slice(-2).toUpperCase()}${String(i + 1).padStart(2, "0")}`,
        line,
        san_luong:    200 + (pi * 10 + i) * 120,
        deadline:     `2026-07-${String(((pi * 5 + i) % 28) + 1).padStart(2, "0")}`,
        status:       st,
        reason:       rs[(pi + i) % rs.length] || "",
        is_support:   isSupport,
        main_line_id: isSupport ? lines[0] : null,
        updatedBy:    st !== "pending" ? planner : null,
      });
    }
  });
  return orders;
}

function mockGroupDateOrders(group, step) {
  const { planners, lines } = group;
  const dateKey = step === 3 ? "nvl_date" : "gc_date";

  let orders = [];
  planners.forEach((planner, pi) => {
    // Bước 3 & 4: chỉ nhập ngày cho đơn chính (không có đơn phụ)
    const count = 3 + (planner.username.length % 3);
    for (let i = 0; i < count; i++) {
      const line   = lines[(pi + i) % lines.length];
      const isDone = DONE_PATTERN[(pi * 5 + i) % DONE_PATTERN.length];
      const day    = String(10 + ((pi * 5 + i) % 18)).padStart(2, "0");
      orders.push({
        id:        `ORD-${group.groupId}-${planner.username.slice(-2).toUpperCase()}${String(i + 1).padStart(2, "0")}`,
        line,
        san_luong: 200 + (pi * 10 + i) * 120,
        deadline:  `2026-07-${String(((pi * 5 + i) % 28) + 1).padStart(2, "0")}`,
        status:    isDone ? "done" : "pending",
        [dateKey]: isDone ? `2026-06-${day}` : null,
        is_support:   false,
        main_line_id: null,
        updatedBy:    isDone ? planner : null,
      });
    }
  });
  return orders;
}

// ── Left panel: Line Group Card ────────────────────────────────────────────────
function LineGroupCard({ group, color, dispatched, selected, onClick, mode }) {
  const orders   = group.orders || [];
  const mainOrds = orders.filter(o => !o.is_support);
  const subOrds  = orders.filter(o => o.is_support);

  // Aggregate stats
  const confirmed = orders.filter(o => o.status === "confirmed").length;
  const rejected  = orders.filter(o => o.status === "rejected").length;
  const pending   = orders.length - confirmed - rejected;
  const done      = orders.filter(o => o.status === "done").length;
  const notDone   = orders.length - done;

  const isDateMode = mode === "eta" || mode === "gc";

  // Group-level overall status
  const groupDone = isDateMode
    ? (orders.length > 0 && done === orders.length ? "done" : "pending")
    : (confirmed === orders.length && orders.length > 0 ? "confirmed" : rejected > 0 ? "rejected" : "pending");

  const ringCls = {
    blue: "ring-blue-400", teal: "ring-teal-400",
    orange: "ring-orange-400", purple: "ring-purple-400",
  }[color] || "ring-blue-400";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3.5 rounded-xl border transition-all duration-150 ${
        selected
          ? `bg-white shadow-md ring-2 ${ringCls} border-transparent`
          : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm"
      }`}
    >
      {/* Group name row */}
      <div className="flex items-center justify-between gap-1 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Layers size={13} className="text-gray-400 shrink-0" />
          <span className="text-sm font-bold text-gray-800 truncate">{group.groupName}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {dispatched && <StatusChip status={groupDone} mode={isDateMode ? "date" : "approval"} />}
          {selected && <ChevronRight size={13} className="text-gray-400" />}
        </div>
      </div>

      {/* Line badges */}
      <div className="flex flex-wrap gap-1 mb-2.5">
        {(group.lines || []).map((l, li) => (
          <span key={l} className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${
            li === 0 ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-gray-50 text-gray-600 border-gray-200"
          }`}>{l}</span>
        ))}
      </div>

      {/* Planner avatar stack */}
      <div className="flex items-center gap-2 mb-1">
        <AvatarStack planners={group.planners} max={4} />
        <span className="text-[10px] text-gray-500">{group.planners.length} thành viên</span>
      </div>

      {/* Đơn chính / phụ counts */}
      {dispatched && orders.length > 0 && (
        <div className="flex items-center gap-2 mb-2 mt-1">
          <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
            Chính: {mainOrds.length}
          </span>
          <span className="text-[10px] text-violet-600 font-semibold bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded">
            Phụ: {subOrds.length}
          </span>
        </div>
      )}

      {/* Stats */}
      {dispatched && orders.length > 0 && (
        <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
          {isDateMode ? (
            <>
              <Stat label="Tổng"      value={orders.length} color="gray" />
              <Stat label="Đã nhập"   value={done}          color="green" />
              <Stat label="Chưa nhập" value={notDone}       color="amber" />
            </>
          ) : (
            <>
              <Stat label="Tổng"      value={orders.length} color="gray" />
              <Stat label="Chấp nhận" value={confirmed}     color="green" />
              <Stat label="Từ chối"   value={rejected}      color="red" />
              <Stat label="Chờ"       value={pending}       color="amber" />
            </>
          )}
        </div>
      )}

      {!dispatched && (
        <span className="text-[10px] text-amber-600 font-medium">Chờ phân công</span>
      )}
    </button>
  );
}

// ── Right panel: approval mode ─────────────────────────────────────────────────
function ApprovalDetailPanel({ group, color, dispatched }) {
  const [search,       setSearch]      = useState("");
  const [filterLine,   setFilterLine]  = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const orders = group?.orders || [];
  const lines  = [...new Set(orders.map(o => o.line))].sort();

  const filtered = useMemo(() => orders.filter(o =>
    (filterLine   === "all" || o.line   === filterLine) &&
    (filterStatus === "all" || o.status === filterStatus) &&
    (!search || o.id.toLowerCase().includes(search.toLowerCase()))
  ), [orders, filterLine, filterStatus, search]);

  if (!group) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
        <Users size={40} className="text-gray-200" />
        <p className="text-sm">Chọn một nhóm chuyền để xem chi tiết</p>
      </div>
    );
  }

  if (!dispatched) {
    const colorBg = { blue: "bg-blue-50", purple: "bg-purple-50" }[color] || "bg-gray-50";
    return (
      <div className={`flex flex-col items-center justify-center h-full gap-4 ${colorBg}`}>
        <Layers size={32} className="text-gray-300" />
        <p className="text-sm font-semibold text-gray-700">{group.groupName}</p>
        <AvatarStack planners={group.planners} max={6} />
        <p className="text-xs text-gray-400">Chưa phân công — chưa có đơn hàng</p>
      </div>
    );
  }

  const confirmed = orders.filter(o => o.status === "confirmed").length;
  const rejected  = orders.filter(o => o.status === "rejected").length;

  const gradBorder = {
    blue:   "from-blue-50 border-blue-100",
    purple: "from-purple-50 border-purple-100",
  }[color] || "from-gray-50 border-gray-100";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`px-5 py-4 bg-gradient-to-b ${gradBorder} to-white border-b shrink-0`}>
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-1.5 pt-0.5">
            <Layers size={18} className="text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="text-base font-bold text-gray-800">{group.groupName}</span>
              <div className="flex flex-wrap gap-1">
                {group.lines.map(l => (
                  <span key={l} className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-white text-gray-600 border border-gray-200">{l}</span>
                ))}
              </div>
            </div>
            {/* Planner avatar row */}
            <div className="flex flex-wrap items-center gap-2">
              {group.planners.map((p, i) => {
                const pal = plannerPalette(i);
                return (
                  <span key={p.username} className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${pal.badge}`}>
                    <MiniAvatar name={p.name} palette={pal} size="sm" border={false} />
                    {p.name.split(" ").slice(-2).join(" ")}
                  </span>
                );
              })}
            </div>
          </div>
          {/* Aggregate stats */}
          <div className="flex items-center gap-5 shrink-0 text-center">
            <div><div className="text-xl font-bold text-gray-700">{orders.length}</div><div className="text-[10px] text-gray-400">Tổng đơn</div></div>
            <div><div className="text-xl font-bold text-green-600">{confirmed}</div><div className="text-[10px] text-gray-400">Chấp nhận</div></div>
            <div><div className="text-xl font-bold text-red-600">{rejected}</div><div className="text-[10px] text-gray-400">Từ chối</div></div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-5 py-2.5 border-b bg-gray-50 flex items-center gap-2 flex-wrap shrink-0">
        <Filter size={12} className="text-gray-400 shrink-0" />
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Mã đơn..."
            className="pl-7 pr-6 py-1.5 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300 w-28" />
          {search && <button onClick={() => setSearch("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={10} /></button>}
        </div>
        <select value={filterLine} onChange={e => setFilterLine(e.target.value)}
          className="px-2 py-1.5 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300">
          <option value="all">Tất cả chuyền</option>
          {lines.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-2 py-1.5 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300">
          <option value="all">Tất cả trạng thái</option>
          <option value="confirmed">Chấp nhận</option>
          <option value="rejected">Từ chối</option>
          <option value="pending">Chờ xác nhận</option>
        </select>
        <span className="ml-auto text-[11px] text-gray-400">{filtered.length} đơn hàng</span>
      </div>

      {/* Order list */}
      <div className="flex-1 overflow-y-auto px-5 py-3">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 gap-2 text-gray-400">
            <Package size={32} className="text-gray-200" />
            <p className="text-sm">Không có đơn hàng phù hợp</p>
          </div>
        )}
        {filtered.length > 0 && (() => {
          const mainOrds = filtered.filter(o => !o.is_support);
          const subOrds  = filtered.filter(o => o.is_support);
          return (
            <div className="space-y-1.5">
              {mainOrds.length > 0 && (
                <>
                  <SectionDivider label="Đơn chính" count={mainOrds.length} sub={false} />
                  {mainOrds.map(o => <ApprovalOrderRow key={o.id} order={o} />)}
                </>
              )}
              {subOrds.length > 0 && (
                <>
                  <SectionDivider label="Đơn phụ (hỗ trợ chuyền khác)" count={subOrds.length} sub={true} />
                  {subOrds.map(o => <ApprovalOrderRow key={o.id} order={o} isSupport />)}
                </>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function ApprovalOrderRow({ order, isSupport = false }) {
  const [open, setOpen] = useState(false);
  const cfg       = APPROVAL_STATUS[order.status] || APPROVAL_STATUS.pending;
  const hasReason = !!order.reason;

  const borderCls = order.status === "rejected"
    ? "border-red-200 bg-red-50/30"
    : order.status === "confirmed"
      ? isSupport ? "border-violet-200 bg-violet-50/20" : "border-green-200 bg-green-50/20"
      : isSupport ? "border-violet-100 bg-violet-50/10" : "border-gray-200 bg-white";

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${borderCls}`}>
      <button
        onClick={() => hasReason && setOpen(v => !v)}
        className={`w-full flex items-center gap-2 px-4 py-2.5 text-left ${hasReason ? "cursor-pointer" : "cursor-default"}`}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
        <span className="text-sm font-mono font-semibold text-gray-800 min-w-0 flex-1 truncate">{order.id}</span>
        {/* Line badge */}
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border shrink-0 ${
          isSupport ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-gray-100 text-gray-600 border-gray-200"
        }`}>{order.line}</span>
        {isSupport && order.main_line_id && (
          <span className="text-[10px] text-violet-400 shrink-0">→ {order.main_line_id}</span>
        )}
        <div className="hidden sm:flex items-center gap-1 text-xs text-gray-500 shrink-0">
          <Package size={11} className="text-gray-400" />
          <span>{order.san_luong.toLocaleString()}</span>
        </div>
        <div className="hidden sm:flex items-center gap-1 text-xs text-gray-500 shrink-0">
          <CalendarClock size={11} className="text-gray-400" />
          <span>{order.deadline}</span>
        </div>
        <StatusChip status={order.status} mode="approval" />
        {/* Who updated */}
        <UpdatedByBadge updatedBy={order.updatedBy} />
        {hasReason && <ChevronRight size={13} className={`text-gray-400 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />}
      </button>

      {open && hasReason && (
        <div className={`px-4 pb-3 border-t ${order.status === "rejected" ? "border-red-100 bg-red-50/40" : "border-green-100 bg-green-50/30"}`}>
          <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 mt-2 ${order.status === "rejected" ? "text-red-700 bg-red-50 border border-red-100" : "text-green-700 bg-green-50 border border-green-100"}`}>
            {order.status === "rejected" ? <AlertTriangle size={11} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={11} className="shrink-0 mt-0.5" />}
            <div>
              <span className="font-semibold">{order.status === "rejected" ? "Lý do từ chối: " : "Ghi chú: "}</span>
              {order.reason}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Right panel: date-entry mode ───────────────────────────────────────────────
function DateEntryDetailPanel({ group, color, dispatched, step }) {
  const [search,       setSearch]      = useState("");
  const [filterLine,   setFilterLine]  = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const isGC      = step === 4;
  const dateKey   = isGC ? "gc_date" : "nvl_date";
  const dateLabel = isGC ? "Ngày GC" : "Ngày NVL về";

  const orders = group?.orders || [];
  const lines  = [...new Set(orders.map(o => o.line))].sort();

  const filtered = useMemo(() => orders.filter(o =>
    (filterLine   === "all" || o.line   === filterLine) &&
    (filterStatus === "all" || o.status === filterStatus) &&
    (!search || o.id.toLowerCase().includes(search.toLowerCase()))
  ), [orders, filterLine, filterStatus, search]);

  if (!group) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
        <Users size={40} className="text-gray-200" />
        <p className="text-sm">Chọn một nhóm chuyền để xem chi tiết</p>
      </div>
    );
  }

  if (!dispatched) {
    const colorBg = { teal: "bg-teal-50", orange: "bg-orange-50" }[color] || "bg-gray-50";
    return (
      <div className={`flex flex-col items-center justify-center h-full gap-4 ${colorBg}`}>
        <Layers size={32} className="text-gray-300" />
        <p className="text-sm font-semibold text-gray-700">{group.groupName}</p>
        <AvatarStack planners={group.planners} max={6} />
        <p className="text-xs text-gray-400">Chưa phân công</p>
      </div>
    );
  }

  const done    = orders.filter(o => o.status === "done").length;
  const notDone = orders.length - done;
  const allDone = orders.length > 0 && done === orders.length;

  const gradBorder = { teal: "from-teal-50 border-teal-100", orange: "from-orange-50 border-orange-100" }[color] || "from-gray-50 border-gray-100";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`px-5 py-4 bg-gradient-to-b ${gradBorder} to-white border-b shrink-0`}>
        <div className="flex items-start gap-3">
          <div className="pt-0.5"><Layers size={18} className="text-gray-400" /></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="text-base font-bold text-gray-800">{group.groupName}</span>
              <StatusChip status={allDone ? "done" : "pending"} mode="date" />
              <div className="flex flex-wrap gap-1">
                {group.lines.map(l => (
                  <span key={l} className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-white text-gray-600 border border-gray-200">{l}</span>
                ))}
              </div>
            </div>
            {/* Planner chips */}
            <div className="flex flex-wrap items-center gap-2">
              {group.planners.map((p, i) => {
                const pal = plannerPalette(i);
                return (
                  <span key={p.username} className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${pal.badge}`}>
                    <MiniAvatar name={p.name} palette={pal} size="sm" border={false} />
                    {p.name.split(" ").slice(-2).join(" ")}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-5 shrink-0 text-center">
            <div><div className="text-xl font-bold text-gray-700">{orders.length}</div><div className="text-[10px] text-gray-400">Tổng đơn</div></div>
            <div><div className="text-xl font-bold text-green-600">{done}</div><div className="text-[10px] text-gray-400">Đã nhập</div></div>
            <div><div className="text-xl font-bold text-amber-500">{notDone}</div><div className="text-[10px] text-gray-400">Chưa nhập</div></div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-5 py-2.5 border-b bg-gray-50 flex items-center gap-2 flex-wrap shrink-0">
        <Filter size={12} className="text-gray-400 shrink-0" />
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Mã đơn..."
            className="pl-7 pr-6 py-1.5 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300 w-28" />
          {search && <button onClick={() => setSearch("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={10} /></button>}
        </div>
        <select value={filterLine} onChange={e => setFilterLine(e.target.value)}
          className="px-2 py-1.5 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300">
          <option value="all">Tất cả chuyền</option>
          {lines.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-2 py-1.5 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300">
          <option value="all">Tất cả trạng thái</option>
          <option value="done">Đã nhập</option>
          <option value="pending">Chưa nhập</option>
        </select>
        <span className="ml-auto text-[11px] text-gray-400">{filtered.length} đơn hàng</span>
      </div>

      {/* Column header */}
      <div className="px-4 py-2 border-b bg-gray-50/80 shrink-0">
        <div className="flex items-center gap-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
          <span className="w-2 shrink-0" />
          <span className="flex-1">Mã đơn</span>
          <span className="w-14 shrink-0 text-center">Chuyền</span>
          <span className="w-16 shrink-0 text-right">SL</span>
          <span className="w-24 shrink-0 text-center">{dateLabel}</span>
          <span className="w-20 shrink-0 text-center">Trạng thái</span>
          <span className="w-24 shrink-0 text-center">Người nhập</span>
        </div>
      </div>

      {/* Order rows */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 gap-2 text-gray-400">
            <Package size={32} className="text-gray-200" />
            <p className="text-sm">Không có đơn hàng phù hợp</p>
          </div>
        )}
        {filtered.length > 0 && (() => {
          const mainOrds = filtered.filter(o => !o.is_support);
          const subOrds  = filtered.filter(o => o.is_support);
          return (
            <>
              {mainOrds.length > 0 && (
                <>
                  <div className="px-4 pt-3 pb-1"><SectionDivider label="Đơn chính" count={mainOrds.length} sub={false} /></div>
                  <div className="divide-y divide-gray-100">
                    {mainOrds.map(o => <DateEntryOrderRow key={o.id} order={o} dateKey={dateKey} />)}
                  </div>
                </>
              )}
              {subOrds.length > 0 && (
                <>
                  <div className="px-4 pt-4 pb-1"><SectionDivider label="Đơn phụ (hỗ trợ chuyền khác)" count={subOrds.length} sub={true} /></div>
                  <div className="divide-y divide-violet-50">
                    {subOrds.map(o => <DateEntryOrderRow key={o.id} order={o} dateKey={dateKey} isSupport />)}
                  </div>
                </>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}

function DateEntryOrderRow({ order, dateKey, isSupport = false }) {
  const isDone = order.status === "done";
  const date   = order[dateKey];

  const rowBg = isDone
    ? isSupport ? "bg-violet-50/30 hover:bg-violet-50/50" : "bg-green-50/30 hover:bg-green-50/50"
    : isSupport ? "bg-violet-50/10 hover:bg-violet-50/30" : "bg-white hover:bg-amber-50/30";

  return (
    <div className={`flex items-center gap-2 px-4 py-3 transition-colors ${rowBg}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${isDone ? "bg-green-500" : "bg-amber-400"}`} />
      <span className="text-sm font-mono font-semibold text-gray-800 flex-1 truncate min-w-0">{order.id}</span>
      <span className={`w-14 shrink-0 text-center`}>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${
          isSupport ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-gray-100 text-gray-600 border-gray-200"
        }`}>{order.line}</span>
      </span>
      {isSupport && order.main_line_id && (
        <span className="text-[10px] text-violet-400 shrink-0">→ {order.main_line_id}</span>
      )}
      <span className="w-16 shrink-0 text-right text-xs text-gray-500 font-medium">{order.san_luong.toLocaleString()}</span>
      <div className="w-24 shrink-0 text-center">
        {date ? (
          <span className="inline-flex items-center gap-1 text-xs text-green-700 font-semibold">
            <CalendarDays size={11} />{date.slice(5)}
          </span>
        ) : (
          <span className="text-xs text-gray-300 italic">—</span>
        )}
      </div>
      <div className="w-20 shrink-0 flex justify-center">
        <StatusChip status={isDone ? "done" : "pending"} mode="date" />
      </div>
      {/* Người nhập */}
      <div className="w-24 shrink-0 flex justify-center">
        <UpdatedByBadge updatedBy={order.updatedBy} />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function SubPlannerDispatchPanel({ runId, dispatchStep, readOnly = false }) {
  const qc   = useQueryClient();
  const meta = STEP_META[dispatchStep] || STEP_META[2];
  const mode = meta.mode;
  const isDateMode = mode === "eta" || mode === "gc";

  const [dispatched,     setDispatched]     = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  // Fetch dispatch status
  const { data: statusData, isLoading: statusLoading, refetch } = useQuery({
    queryKey: ["dispatch-status", runId, dispatchStep],
    queryFn:  () => http.get(`/runs/${runId}/dispatch-status`, { params: { step: dispatchStep } }).then(r => r.data),
    enabled:  !!runId && dispatched,
    refetchInterval: dispatched ? 8000 : false,
  });

  useEffect(() => {
    if (statusData?.dispatched) setDispatched(true);
  }, [statusData?.dispatched]);

  const dispatchMut = useMutation({
    mutationFn: () => http.post(`/runs/${runId}/dispatch`, { step: dispatchStep }).then(r => r.data),
    onSuccess: () => {
      setDispatched(true);
      qc.invalidateQueries({ queryKey: ["dispatch-status", runId, dispatchStep] });
    },
  });

  // Build line groups with orders
  const lineGroups = useMemo(() => ENRICHED_GROUPS.map(g => ({
    ...g,
    orders: dispatched
      ? (isDateMode ? mockGroupDateOrders(g, dispatchStep) : mockGroupApprovalOrders(g, true))
      : [],
  })), [dispatched, dispatchStep, isDateMode]);

  // Auto-select first group
  useEffect(() => {
    if (lineGroups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(lineGroups[0].groupId);
    }
  }, [lineGroups.length]); // eslint-disable-line

  if (!runId) return null;

  // Progress stats (across all groups)
  const allOrders = lineGroups.flatMap(g => g.orders);
  const total     = lineGroups.length;

  let progressLabel, progressBar, allDone;
  if (isDateMode) {
    const donePct = allOrders.length > 0 ? allOrders.filter(o => o.status === "done").length / allOrders.length * 100 : 0;
    const doneGroups = lineGroups.filter(g => {
      const ords = g.orders;
      return ords.length > 0 && ords.every(o => o.status === "done");
    }).length;
    allDone = dispatched && total > 0 && doneGroups === total;
    progressLabel = allDone
      ? <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-100 border border-green-200 px-2.5 py-1 rounded-full"><CheckCircle2 size={11} /> Tất cả đã nhập</span>
      : <span className="text-xs text-gray-500">{doneGroups}/{total} nhóm hoàn tất</span>;
    progressBar = { pct: donePct, color: allDone ? "bg-green-500" : "bg-amber-400" };
  } else {
    const confirmed = allOrders.filter(o => o.status === "confirmed").length;
    const rejected  = allOrders.filter(o => o.status === "rejected").length;
    const confPct   = allOrders.length > 0 ? confirmed / allOrders.length * 100 : 0;
    allDone = dispatched && allOrders.length > 0 && confirmed === allOrders.length;
    progressLabel = allDone
      ? <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-100 border border-green-200 px-2.5 py-1 rounded-full"><CheckCircle2 size={11} /> Tất cả xác nhận</span>
      : <>
          <span className="text-xs text-gray-500">{confirmed}/{allOrders.length} đơn xác nhận</span>
          {rejected > 0 && <span className="flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 border border-red-200 px-2.5 py-1 rounded-full"><AlertTriangle size={11} /> {rejected} từ chối</span>}
        </>;
    progressBar = { pct: confPct, color: allDone ? "bg-green-500" : rejected > 0 ? "bg-amber-400" : "bg-blue-500" };
  }

  const selectedGroup = selectedGroupId ? lineGroups.find(g => g.groupId === selectedGroupId) || null : null;

  const btnColor = {
    2: "bg-blue-600 hover:bg-blue-700",
    3: "bg-teal-600 hover:bg-teal-700",
    4: "bg-orange-500 hover:bg-orange-600",
    6: "bg-purple-600 hover:bg-purple-700",
  }[dispatchStep] || "bg-blue-600 hover:bg-blue-700";

  const isLoading = dispatched && statusLoading;

  return (
    <div className="flex flex-col h-full">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-3 border-b bg-gray-50 shrink-0 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Info size={12} className="text-gray-400 shrink-0" />
          <span>{meta.hint}</span>
        </div>
        <div className="flex-1" />
        {dispatched && total > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            {progressLabel}
            <div className="w-24 h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${progressBar.color}`} style={{ width: `${progressBar.pct}%` }} />
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 shrink-0">
          {dispatched && (
            <button onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-white transition-colors">
              <RefreshCw size={12} /> Làm mới
            </button>
          )}
          {!readOnly && (
            dispatched ? (
              <button onClick={() => dispatchMut.mutate()} disabled={dispatchMut.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors disabled:opacity-50">
                {dispatchMut.isPending ? <><Loader2 size={12} className="animate-spin" /> Đang phân công lại…</> : <><RotateCcw size={12} /> Phân công lại</>}
              </button>
            ) : (
              <button onClick={() => dispatchMut.mutate()} disabled={dispatchMut.isPending}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-50 ${btnColor}`}>
                {dispatchMut.isPending ? <><Loader2 size={12} className="animate-spin" /> Đang phân công…</> : <><Send size={12} /> Phân công Sub-Planner</>}
              </button>
            )
          )}
        </div>
      </div>

      {/* ── Two-panel body ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left panel */}
        <div className="w-72 shrink-0 border-r bg-gray-50 flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b bg-white shrink-0">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Nhóm chuyền ({lineGroups.length})
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-sm text-gray-400">
                <Loader2 size={16} className="animate-spin" /> Đang tải…
              </div>
            ) : (
              lineGroups.map(g => (
                <LineGroupCard
                  key={g.groupId}
                  group={g}
                  color={meta.color}
                  dispatched={dispatched}
                  selected={selectedGroupId === g.groupId}
                  onClick={() => setSelectedGroupId(g.groupId)}
                  mode={mode}
                />
              ))
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 overflow-hidden flex flex-col bg-white">
          {isDateMode ? (
            <DateEntryDetailPanel
              group={selectedGroup}
              color={meta.color}
              dispatched={dispatched}
              step={dispatchStep}
            />
          ) : (
            <ApprovalDetailPanel
              group={selectedGroup}
              color={meta.color}
              dispatched={dispatched}
            />
          )}
        </div>

      </div>
    </div>
  );
}

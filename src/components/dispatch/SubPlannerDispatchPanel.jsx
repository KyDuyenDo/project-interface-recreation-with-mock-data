/**
 * SubPlannerDispatchPanel
 * Two-panel layout — always visible.
 *
 * Mode "approval" (step 2, 6):
 *   Left : Sub-planner cards with confirm/reject stats
 *   Right: Order list with confirm/reject status per order
 *
 * Mode "eta" (step 3 — NVL về):
 *   Left : Sub-planner cards with date-entry progress
 *   Right: Order list showing NVL date entered / not yet
 *
 * Mode "gc" (step 4 — Ngày GC):
 *   Left : Sub-planner cards with date-entry progress
 *   Right: Order list showing GC date entered / not yet
 */

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, CheckCircle2, Clock, AlertTriangle, RefreshCw,
  Loader2, Send, RotateCcw, Info, ChevronRight,
  Package, CalendarClock, Filter, Search, X, CalendarDays,
} from "lucide-react";
import http from "../../api/http";

// ── Step metadata ──────────────────────────────────────────────────────────────
const STEP_META = {
  2: { label: "Phân công xác nhận chuyền",  hint: "Sub-Planner xem kế hoạch → Chấp nhận hoặc Từ chối", color: "blue",   mode: "approval" },
  3: { label: "Phân công nhập NVL về",       hint: "Sub-Planner nhập ngày NVL → Xác nhận hoàn tất",      color: "teal",   mode: "eta"      },
  4: { label: "Phân công nhập ngày GC",      hint: "Sub-Planner nhập ngày GC → Xác nhận hoàn tất",       color: "orange", mode: "gc"       },
  6: { label: "Phân công review lịch",       hint: "Sub-Planner review lịch chuyền → Chấp nhận/Từ chối", color: "purple", mode: "approval" },
};

// ── Status config (approval mode) ─────────────────────────────────────────────
const APPROVAL_STATUS = {
  confirmed: { label: "Chấp nhận",    bg: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500",  Icon: CheckCircle2 },
  rejected:  { label: "Từ chối",      bg: "bg-red-100 text-red-700 border-red-200",       dot: "bg-red-500",    Icon: AlertTriangle },
  pending:   { label: "Chờ xác nhận", bg: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-400",  Icon: Clock },
  submitted: { label: "Đã gửi",       bg: "bg-blue-100 text-blue-700 border-blue-200",    dot: "bg-blue-500",   Icon: Send },
};

// ── Status config (date-entry mode) ───────────────────────────────────────────
const DATE_STATUS = {
  done:    { label: "Đã nhập",   bg: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500",  Icon: CheckCircle2 },
  pending: { label: "Chưa nhập", bg: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-400",  Icon: Clock },
};

function StatusChip({ status, mode = "approval" }) {
  const cfg = mode === "approval"
    ? (APPROVAL_STATUS[status] || { label: status, bg: "bg-gray-100 text-gray-500 border-gray-200", dot: "bg-gray-400", Icon: Clock })
    : (DATE_STATUS[status]    || { label: status, bg: "bg-gray-100 text-gray-500 border-gray-200", dot: "bg-gray-400", Icon: Clock });
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${cfg.bg}`}>
      <cfg.Icon size={10} /> {cfg.label}
    </span>
  );
}

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ name, color = "blue" }) {
  const initials = name.split(" ").map(p => p[0]).slice(-2).join("").toUpperCase();
  const palette = {
    blue:   "bg-blue-100 text-blue-700",
    teal:   "bg-teal-100 text-teal-700",
    orange: "bg-orange-100 text-orange-700",
    purple: "bg-purple-100 text-purple-700",
  };
  return (
    <span className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 ${palette[color] || palette.blue}`}>
      {initials}
    </span>
  );
}

// ── Mini stat ──────────────────────────────────────────────────────────────────
function Stat({ label, value, color }) {
  const cls = { gray: "text-gray-700", green: "text-green-600", red: "text-red-600", amber: "text-amber-600" }[color] || "text-gray-700";
  return (
    <div className="flex flex-col items-center">
      <span className={`text-sm font-bold leading-none ${cls}`}>{value}</span>
      <span className="text-[9px] text-gray-400 mt-0.5 leading-none whitespace-nowrap">{label}</span>
    </div>
  );
}

// ── Mock order generator — approval mode ───────────────────────────────────────
function mockApprovalOrders(username, lines, dispatched) {
  if (!dispatched) return [];
  const statuses = ["confirmed", "rejected", "pending", "confirmed", "pending", "rejected", "confirmed", "pending"];
  const confirmReasons = ["Đã kiểm tra, kế hoạch hợp lý.", "Chuyền đủ năng lực thực hiện.", "Nguyên liệu đã về đủ."];
  const rejectReasons  = ["Năng lực chuyền không đủ trong tuần này.", "NVL chưa về kịp deadline.", "Chuyền đang có lịch sản xuất khác."];
  const count = 6 + (username.length % 5);
  return Array.from({ length: count }, (_, i) => {
    const line = lines[i % lines.length];
    const st   = statuses[i % statuses.length];
    const rs   = st === "confirmed" ? confirmReasons : st === "rejected" ? rejectReasons : [];
    return {
      id:        `ORD-${username.slice(0, 2).toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
      line,
      san_luong: 200 + i * 150,
      deadline:  `2026-07-${String((i % 28) + 1).padStart(2, "0")}`,
      status:    st,
      reason:    rs[i % rs.length] || "",
    };
  });
}

// ── Mock order generator — date-entry mode (step 3 NVL / step 4 GC) ───────────
function mockDateOrders(username, lines, step) {
  const count = 6 + (username.length % 5);
  // Deterministic "done" pattern: even-indexed orders have dates entered
  const donePattern = [true, false, true, true, false, true, true, false, true, false, true];
  return Array.from({ length: count }, (_, i) => {
    const line    = lines[i % lines.length];
    const isDone  = donePattern[i % donePattern.length];
    const dateKey = step === 3 ? "nvl_date" : "gc_date";
    const day     = String(10 + (i % 18)).padStart(2, "0");
    return {
      id:        `ORD-${username.slice(0, 2).toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
      line,
      san_luong: 200 + i * 150,
      deadline:  `2026-07-${String((i % 28) + 1).padStart(2, "0")}`,
      status:    isDone ? "done" : "pending",
      [dateKey]: isDone ? `2026-06-${day}` : null,
    };
  });
}

// ── Left panel: planner card ───────────────────────────────────────────────────
function PlannerCard({ planner, color, dispatched, selected, onClick, mode }) {
  const orders = planner.orders || [];
  const total  = orders.length;

  // Approval mode stats
  const confirmed = orders.filter(o => o.status === "confirmed").length;
  const rejected  = orders.filter(o => o.status === "rejected").length;
  const pending   = total - confirmed - rejected;

  // Date-entry mode stats
  const done      = orders.filter(o => o.status === "done").length;
  const notDone   = total - done;

  // Card-level status chip
  const cardStatus = mode === "approval"
    ? planner.status
    : (total > 0 && done === total ? "done" : "pending");

  const ringCls = {
    blue:   "ring-blue-400",
    teal:   "ring-teal-400",
    orange: "ring-orange-400",
    purple: "ring-purple-400",
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
      <div className="flex items-start gap-3">
        <Avatar name={planner.name} color={color} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-sm font-semibold text-gray-800 truncate">{planner.name}</span>
            {selected && <ChevronRight size={13} className="text-gray-400 shrink-0" />}
          </div>

          {dispatched
            ? <div className="mt-1"><StatusChip status={cardStatus} mode={mode} /></div>
            : <span className="text-[10px] text-amber-600 font-medium mt-0.5 block">Chờ phân công</span>
          }

          {/* Lines */}
          <div className="flex flex-wrap gap-1 mt-2">
            {(planner.lines || []).map(l => (
              <span key={l} className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-gray-100 text-gray-600 border border-gray-200">{l}</span>
            ))}
          </div>

          {/* Stats — only after dispatch */}
          {dispatched && (
            <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-gray-100">
              {mode === "approval" ? (
                <>
                  <Stat label="Tổng đơn"  value={total}     color="gray"  />
                  <Stat label="Chấp nhận" value={confirmed} color="green" />
                  <Stat label="Từ chối"   value={rejected}  color="red"   />
                  <Stat label="Chờ"       value={pending}   color="amber" />
                </>
              ) : (
                <>
                  <Stat label="Tổng đơn"  value={total}  color="gray"  />
                  <Stat label="Đã nhập"   value={done}   color="green" />
                  <Stat label="Chưa nhập" value={notDone} color="amber" />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Right panel: approval mode ─────────────────────────────────────────────────
function ApprovalDetailPanel({ planner, color, dispatched }) {
  const [search,        setSearch]       = useState("");
  const [filterLine,    setFilterLine]   = useState("all");
  const [filterStatus,  setFilterStatus] = useState("all");

  const orders = planner?.orders || [];
  const lines  = [...new Set(orders.map(o => o.line))].sort();

  const filtered = useMemo(() => orders.filter(o => {
    return (filterLine   === "all" || o.line   === filterLine)
        && (filterStatus === "all" || o.status === filterStatus)
        && (!search || o.id.toLowerCase().includes(search.toLowerCase()));
  }), [orders, filterLine, filterStatus, search]);

  if (!planner) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
        <Users size={40} className="text-gray-200" />
        <p className="text-sm">Chọn một Sub-Planner để xem chi tiết</p>
      </div>
    );
  }

  if (!dispatched) {
    const colorBg = { blue: "bg-blue-50", teal: "bg-teal-50", orange: "bg-orange-50", purple: "bg-purple-50" }[color] || "bg-blue-50";
    return (
      <div className={`flex flex-col items-center justify-center h-full gap-4 ${colorBg}`}>
        <Avatar name={planner.name} color={color} />
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-700">{planner.name}</p>
          <p className="text-xs text-gray-400 mt-1">Chưa phân công — chưa có đơn hàng để hiển thị</p>
        </div>
        <div className="flex flex-wrap gap-1 justify-center">
          {(planner.lines || []).map(l => (
            <span key={l} className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-white text-gray-600 border border-gray-200">{l}</span>
          ))}
        </div>
      </div>
    );
  }

  const confirmed = orders.filter(o => o.status === "confirmed").length;
  const rejected  = orders.filter(o => o.status === "rejected").length;
  const gradBorder = { blue: "from-blue-50 border-blue-100", teal: "from-teal-50 border-teal-100", orange: "from-orange-50 border-orange-100", purple: "from-purple-50 border-purple-100" }[color] || "from-blue-50 border-blue-100";

  return (
    <div className="flex flex-col h-full">
      <div className={`px-5 py-4 bg-gradient-to-b ${gradBorder} to-white border-b shrink-0`}>
        <div className="flex items-center gap-3">
          <Avatar name={planner.name} color={color} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold text-gray-800">{planner.name}</span>
              <StatusChip status={planner.status} mode="approval" />
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {(planner.lines || []).map(l => (
                <span key={l} className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-white text-gray-600 border border-gray-200">{l}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-5 shrink-0 text-center">
            <div><div className="text-xl font-bold text-gray-700">{orders.length}</div><div className="text-[10px] text-gray-400">Tổng đơn</div></div>
            <div><div className="text-xl font-bold text-green-600">{confirmed}</div><div className="text-[10px] text-gray-400">Chấp nhận</div></div>
            <div><div className="text-xl font-bold text-red-600">{rejected}</div><div className="text-[10px] text-gray-400">Từ chối</div></div>
          </div>
        </div>
      </div>

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

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 gap-2 text-gray-400">
            <Package size={32} className="text-gray-200" />
            <p className="text-sm">Không có đơn hàng phù hợp</p>
          </div>
        )}
        {filtered.map(order => <ApprovalOrderRow key={order.id} order={order} />)}
      </div>
    </div>
  );
}

function ApprovalOrderRow({ order }) {
  const [open, setOpen] = useState(false);
  const cfg = APPROVAL_STATUS[order.status] || APPROVAL_STATUS.pending;
  const hasReason = !!order.reason;

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      order.status === "rejected"  ? "border-red-200   bg-red-50/30"   :
      order.status === "confirmed" ? "border-green-200 bg-green-50/20" :
                                     "border-gray-200  bg-white"
    }`}>
      <button onClick={() => hasReason && setOpen(v => !v)} className={`w-full flex items-center gap-2 px-4 py-2.5 text-left ${hasReason ? "cursor-pointer" : "cursor-default"}`}>
        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
        <span className="text-sm font-mono font-semibold text-gray-800 min-w-0 flex-1 truncate">{order.id}</span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-gray-100 text-gray-600 border border-gray-200 shrink-0">{order.line}</span>
        <div className="hidden sm:flex items-center gap-1 text-xs text-gray-500 shrink-0">
          <Package size={11} className="text-gray-400" />
          <span>{order.san_luong.toLocaleString()}</span>
        </div>
        <div className="hidden sm:flex items-center gap-1 text-xs text-gray-500 shrink-0">
          <CalendarClock size={11} className="text-gray-400" />
          <span>{order.deadline}</span>
        </div>
        <StatusChip status={order.status} mode="approval" />
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

// ── Right panel: date-entry mode (step 3 NVL / step 4 GC) ─────────────────────
function DateEntryDetailPanel({ planner, color, dispatched, step }) {
  const [search,       setSearch]     = useState("");
  const [filterLine,   setFilterLine] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const isGC    = step === 4;
  const dateKey = isGC ? "gc_date" : "nvl_date";
  const dateLabel = isGC ? "Ngày GC" : "Ngày NVL về";

  const orders = planner?.orders || [];
  const lines  = [...new Set(orders.map(o => o.line))].sort();

  const filtered = useMemo(() => orders.filter(o => {
    return (filterLine   === "all" || o.line   === filterLine)
        && (filterStatus === "all" || o.status === filterStatus)
        && (!search || o.id.toLowerCase().includes(search.toLowerCase()));
  }), [orders, filterLine, filterStatus, search]);

  if (!planner) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
        <Users size={40} className="text-gray-200" />
        <p className="text-sm">Chọn một Sub-Planner để xem chi tiết</p>
      </div>
    );
  }

  if (!dispatched) {
    const colorBg = { teal: "bg-teal-50", orange: "bg-orange-50" }[color] || "bg-gray-50";
    return (
      <div className={`flex flex-col items-center justify-center h-full gap-4 ${colorBg}`}>
        <Avatar name={planner.name} color={color} />
        <p className="text-sm font-semibold text-gray-700">{planner.name}</p>
        <p className="text-xs text-gray-400">Chưa phân công</p>
      </div>
    );
  }

  const done   = orders.filter(o => o.status === "done").length;
  const notDone = orders.length - done;
  const allDone = orders.length > 0 && done === orders.length;

  const gradBorder = {
    teal:   "from-teal-50 border-teal-100",
    orange: "from-orange-50 border-orange-100",
  }[color] || "from-gray-50 border-gray-100";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`px-5 py-4 bg-gradient-to-b ${gradBorder} to-white border-b shrink-0`}>
        <div className="flex items-center gap-3">
          <Avatar name={planner.name} color={color} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold text-gray-800">{planner.name}</span>
              <StatusChip status={allDone ? "done" : "pending"} mode="date" />
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {(planner.lines || []).map(l => (
                <span key={l} className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-white text-gray-600 border border-gray-200">{l}</span>
              ))}
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
        </div>
      </div>

      {/* Order rows */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 gap-2 text-gray-400">
            <Package size={32} className="text-gray-200" />
            <p className="text-sm">Không có đơn hàng phù hợp</p>
          </div>
        )}
        {filtered.map(order => (
          <DateEntryOrderRow key={order.id} order={order} dateKey={dateKey} />
        ))}
      </div>
    </div>
  );
}

function DateEntryOrderRow({ order, dateKey }) {
  const isDone = order.status === "done";
  const date   = order[dateKey];

  return (
    <div className={`flex items-center gap-2 px-4 py-3 transition-colors ${
      isDone ? "bg-green-50/30 hover:bg-green-50/50" : "bg-white hover:bg-amber-50/30"
    }`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${isDone ? "bg-green-500" : "bg-amber-400"}`} />
      <span className="text-sm font-mono font-semibold text-gray-800 flex-1 truncate min-w-0">{order.id}</span>
      <span className="w-14 shrink-0 text-center">
        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-gray-100 text-gray-600 border border-gray-200">{order.line}</span>
      </span>
      <span className="w-16 shrink-0 text-right text-xs text-gray-500 font-medium">
        {order.san_luong.toLocaleString()}
      </span>
      <div className="w-24 shrink-0 text-center">
        {date ? (
          <span className="inline-flex items-center gap-1 text-xs text-green-700 font-semibold">
            <CalendarDays size={11} />
            {date.slice(5)} {/* Show MM-DD */}
          </span>
        ) : (
          <span className="text-xs text-gray-300 italic">—</span>
        )}
      </div>
      <div className="w-20 shrink-0 flex justify-center">
        <StatusChip status={isDone ? "done" : "pending"} mode="date" />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function SubPlannerDispatchPanel({ runId, dispatchStep, readOnly = false }) {
  const qc   = useQueryClient();
  const meta = STEP_META[dispatchStep] || STEP_META[2];
  const mode = meta.mode; // "approval" | "eta" | "gc"
  const isDateMode = mode === "eta" || mode === "gc";

  const [dispatched,      setDispatched]      = useState(false);
  const [selectedPlanner, setSelectedPlanner] = useState(null);

  // Fetch line assignments (pre-dispatch preview)
  const { data: assignData, isLoading: assignLoading } = useQuery({
    queryKey: ["line-assignments-preview"],
    queryFn:  () => http.get("/lines/assignments").then(r => r.data),
    staleTime: 60000,
  });

  // Fetch dispatch status (post-dispatch)
  const { data: statusData, isLoading: statusLoading, refetch } = useQuery({
    queryKey: ["dispatch-status", runId, dispatchStep],
    queryFn:  () => http.get(`/runs/${runId}/dispatch-status`, { params: { step: dispatchStep } }).then(r => r.data),
    enabled:  !!runId && dispatched,
    refetchInterval: dispatched ? 8000 : false,
  });

  useEffect(() => {
    if (statusData?.dispatched) setDispatched(true);
  }, [statusData?.dispatched]);

  // Dispatch mutation
  const dispatchMut = useMutation({
    mutationFn: () => http.post(`/runs/${runId}/dispatch`, { step: dispatchStep }).then(r => r.data),
    onSuccess: () => {
      setDispatched(true);
      qc.invalidateQueries({ queryKey: ["dispatch-status", runId, dispatchStep] });
    },
  });

  // Build planner list
  let planners = [];
  if (dispatched && statusData?.planners) {
    planners = statusData.planners.map(p => ({
      ...p,
      orders: isDateMode
        ? mockDateOrders(p.username, p.lines || [], dispatchStep)
        : mockApprovalOrders(p.username, p.lines || [], true),
    }));
  } else {
    const items = Array.isArray(assignData) ? assignData : (assignData?.items || []);
    const byPlanner = {};
    for (const a of items) {
      if (!a.planner_username) continue;
      if (!byPlanner[a.planner_username])
        byPlanner[a.planner_username] = { username: a.planner_username, name: a.planner_name, lines: [], status: "pending", orders: [] };
      byPlanner[a.planner_username].lines.push(a.line_id);
    }
    planners = Object.values(byPlanner);
  }

  // Auto-select first planner
  useEffect(() => {
    if (planners.length > 0 && !selectedPlanner) {
      setSelectedPlanner(planners[0].username);
    }
  }, [planners.length]); // eslint-disable-line

  if (!runId) return null;

  // Progress stats
  const total = planners.length;
  let progressLabel, progressBar, allDone;

  if (isDateMode) {
    // Date-entry mode: count planners where all orders are done
    const donePlanners = planners.filter(p => {
      const ords = p.orders || [];
      return ords.length > 0 && ords.every(o => o.status === "done");
    }).length;
    allDone = total > 0 && donePlanners === total;
    progressLabel = allDone
      ? <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-100 border border-green-200 px-2.5 py-1 rounded-full"><CheckCircle2 size={11} /> Tất cả đã nhập</span>
      : <span className="text-xs text-gray-500">{donePlanners}/{total} hoàn tất</span>;
    progressBar = { pct: total ? (donePlanners / total) * 100 : 0, color: allDone ? "bg-green-500" : "bg-amber-400" };
  } else {
    const confirmedCount = planners.filter(p => p.status === "confirmed").length;
    const rejectedCount  = planners.filter(p => p.status === "rejected").length;
    allDone = total > 0 && confirmedCount === total;
    progressLabel = allDone
      ? <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-100 border border-green-200 px-2.5 py-1 rounded-full"><CheckCircle2 size={11} /> Tất cả xác nhận</span>
      : <>
          <span className="text-xs text-gray-500">{confirmedCount}/{total} xác nhận</span>
          {rejectedCount > 0 && <span className="flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 border border-red-200 px-2.5 py-1 rounded-full"><AlertTriangle size={11} /> {rejectedCount} từ chối</span>}
        </>;
    progressBar = { pct: total ? (confirmedCount / total) * 100 : 0, color: allDone ? "bg-green-500" : rejectedCount > 0 ? "bg-amber-400" : "bg-blue-500" };
  }

  const selectedPlannerData = selectedPlanner ? planners.find(p => p.username === selectedPlanner) || null : null;

  const btnColor = {
    2: "bg-blue-600 hover:bg-blue-700",
    3: "bg-teal-600 hover:bg-teal-700",
    4: "bg-orange-500 hover:bg-orange-600",
    6: "bg-purple-600 hover:bg-purple-700",
  }[dispatchStep] || "bg-blue-600 hover:bg-blue-700";

  const isLoading = assignLoading || (dispatched && statusLoading);

  return (
    <div className="flex flex-col h-full">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-3 border-b bg-gray-50 shrink-0 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Info size={12} className="text-gray-400 shrink-0" />
          <span>{meta.hint}</span>
        </div>

        <div className="flex-1" />

        {/* Progress */}
        {dispatched && total > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            {progressLabel}
            <div className="w-24 h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${progressBar.color}`} style={{ width: `${progressBar.pct}%` }} />
            </div>
          </div>
        )}

        {/* Action buttons */}
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
              Sub-Planner ({planners.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-sm text-gray-400">
                <Loader2 size={16} className="animate-spin" /> Đang tải…
              </div>
            ) : planners.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-gray-400">
                <Users size={28} className="text-gray-200" />
                <p className="text-xs text-center">Chưa có Sub-Planner nào được phân chuyền</p>
              </div>
            ) : (
              planners.map(p => (
                <PlannerCard
                  key={p.username}
                  planner={p}
                  color={meta.color}
                  dispatched={dispatched}
                  selected={selectedPlanner === p.username}
                  onClick={() => setSelectedPlanner(p.username)}
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
              planner={selectedPlannerData}
              color={meta.color}
              dispatched={dispatched}
              step={dispatchStep}
            />
          ) : (
            <ApprovalDetailPanel
              planner={selectedPlannerData}
              color={meta.color}
              dispatched={dispatched}
            />
          )}
        </div>
      </div>
    </div>
  );
}

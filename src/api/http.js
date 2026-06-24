// ─────────────────────────────────────────────────────────────────────────────
// Mock HTTP client.
// Drop-in replacement for the axios instance: exposes get/post/patch/put/delete
// returning Promise<{ data }>. Routes every request to in-memory mock data so the
// entire UI works without a live backend.
// ─────────────────────────────────────────────────────────────────────────────
import * as M from "./mockData";

const LATENCY = 180; // simulated network delay (ms)

// ── In-memory dispatch state per run+step ─────────────────────────────────────
// key: `${runId}:${step}` → { dispatched, dispatched_at, planners: [{username, name, lines, status, updated_at, reject_reason}] }
const DISPATCH_STATE = {};

function ok(data) {
  return new Promise((resolve) => setTimeout(() => resolve({ data }), LATENCY));
}

function seg(url) {
  return url.split("?")[0].split("/").filter(Boolean);
}

function route(method, url, body, config) {
  const params = config?.params || {};
  const p = seg(url);
  const m = method.toUpperCase();

  // ── Auth ──────────────────────────────────────────────────────────────────
  if (url === "/auth/login") {
    const u = M.MOCK_USERS[body?.username] || M.MOCK_USER;
    return ok({ user: u, access_token: "mock-token-" + Date.now() });
  }
  if (url === "/auth/me") return ok(M.MOCK_USER);

  // ── Dashboard ───────────────────────────────────────────────────────────────
  if (url === "/dashboard/summary") return ok(M.DASHBOARD);

  // ── Orders (ERP master) ─────────────────────────────────────────────────────
  if (url === "/orders" && m === "POST") return ok(M.makeOrdersList(body));
  if (url === "/orders/factory-codes") return ok(M.FACTORY_LIST.map((f) => f.code));
  if (url === "/orders/bulk-lookup") return ok(M.makeBulkLookup(body?.order_ids));
  if (p[0] === "orders" && p.length === 2) {
    const row = M.BAO_CAO_ALL.find((r) => r.RY === p[1]) || M.BAO_CAO_ALL[0];
    return ok(row);
  }
  if (p[0] === "orders" && p[2] === "events") return ok({ items: M.EVENTS.slice(0, 5) });
  if (p[0] === "orders" && p[2] === "pdsch") return ok({ items: [] });

  // ── BAO_CAO_SO_DUOI ──────────────────────────────────────────────────────────
  if (p[0] === "bao-cao-so-duoi") {
    if (m === "PATCH") return ok({ ok: true });
    const page = +params.page || 1;
    const pageSize = +params.page_size || 100;
    let rows = M.BAO_CAO_ALL;
    if (params.search) {
      const q = String(params.search).toLowerCase();
      rows = rows.filter((r) => r.ZLBH.toLowerCase().includes(q) || r.RY.toLowerCase().includes(q) || r.Article.toLowerCase().includes(q));
    }
    const total = rows.length;
    const items = rows.slice((page - 1) * pageSize, page * pageSize);
    return ok({ items, total, page, page_size: pageSize, ga_pending: page === 1 ? M.BAO_CAO_GA_PENDING : [], ga_pending_count: M.BAO_CAO_GA_PENDING.length });
  }

  // ── Periods ────────────────────────────────────────────────────────────────
  if (p[0] === "periods") {
    if (m === "POST") return ok({ id: 99, ...body });
    return ok({ items: M.PERIODS });
  }

  // ── Notifications ──────────────────────────────────────────────────────────
  if (p[0] === "notifications") {
    if (p[1] === "unread-count") {
      const username = params.username || "";
      const count = M.MOCK_NOTIFICATIONS.filter(n => n.to_username === username && !n.is_read).length;
      return ok({ count });
    }
    if (p.length === 2 && p[1] && m === "POST") {
      // mark read
      const id = parseInt(p[1]);
      const n = M.MOCK_NOTIFICATIONS.find(n => n.id === id);
      if (n) n.is_read = true;
      return ok({ ok: true });
    }
    if (m === "POST" && p.length === 1) {
      // mark all read
      const username = body?.username || "";
      M.MOCK_NOTIFICATIONS.filter(n => n.to_username === username).forEach(n => n.is_read = true);
      return ok({ ok: true });
    }
    // GET list
    const username = params.username || "";
    const notes = M.MOCK_NOTIFICATIONS.filter(n => !username || n.to_username === username)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return ok({ items: notes, total: notes.length });
  }

  // ── Task assignments ────────────────────────────────────────────────────────
  if (p[0] === "tasks") {
    // GET /tasks/my?username=xxx
    if (p[1] === "my") {
      const username = params.username || "";
      const tasks = M.MOCK_TASK_ASSIGNMENTS.filter(t => !username || t.planner_username === username);
      return ok({ items: tasks, total: tasks.length });
    }
    // POST /tasks/:id/confirm
    if (p.length === 3 && p[2] === "confirm") {
      const id = parseInt(p[1]);
      const task = M.MOCK_TASK_ASSIGNMENTS.find(t => t.id === id);
      if (task) {
        task.status = "confirmed";
        task.qty_override = body?.qty_override ?? task.qty_override;
        task.note = body?.note ?? task.note;
        task.confirmed_at = new Date().toISOString();
      }
      return ok({ ok: true, task });
    }
    // POST /tasks/:id/reject
    if (p.length === 3 && p[2] === "reject") {
      const id = parseInt(p[1]);
      const task = M.MOCK_TASK_ASSIGNMENTS.find(t => t.id === id);
      if (task) {
        task.status = "rejected";
        task.reject_reason = body?.reason ?? null;
        task.note = body?.note ?? task.note;
        // Notify main planner
        const REASON_LABELS = { wrong_model: "Sai dạng giày", no_capacity: "Không đủ năng lực" };
        const reasonLabel = REASON_LABELS[body?.reason] || body?.reason || "không xác định";
        M.MOCK_NOTIFICATIONS.push({
          id: M.MOCK_NOTIFICATIONS.length + 1,
          to_username: "tran.minh",
          kind: "task_rejected",
          title: `Từ chối đơn ${task.order_id || "(lịch)"} — ${reasonLabel}`,
          body: `${task.planner_name} từ chối chuyền ${task.line_id}: "${reasonLabel}". ${body?.note ? "Ghi chú: " + body.note : ""}`,
          run_id: task.run_id,
          step: task.step,
          is_read: false,
          created_at: new Date().toISOString(),
        });
      }
      return ok({ ok: true });
    }
    return ok({ items: M.MOCK_TASK_ASSIGNMENTS });
  }

  // ── Assignments (dispatch from main planner) ──────────────────────────────
  if (p[0] === "assignments") {
    if (p[1] === "dispatch" && m === "POST") {
      // Create new task assignments
      const runId = body?.run_id;
      const step = body?.step;
      const lineId = body?.line_id;
      const orders = body?.orders || [];
      const assignment = M.MOCK_LINE_ASSIGNMENTS[lineId];
      if (assignment) {
        orders.forEach(order => {
          M.MOCK_TASK_ASSIGNMENTS.push({
            id: M.MOCK_TASK_ASSIGNMENTS.length + 1,
            run_id: runId,
            step,
            step_label: step === 2 ? "Ưu tiên & Chuyền" : step === 6 ? "Review lịch" : `Step ${step}`,
            planner_username: assignment.planner_username,
            planner_name: assignment.planner_name,
            line_id: lineId,
            order_id: order.order_id,
            article: order.article,
            model: order.model,
            customer: order.customer,
            qty: order.qty,
            crd: order.crd,
            status: "pending",
            qty_override: null,
            confirmed_at: null,
            note: null,
            created_at: new Date().toISOString(),
          });
          // Add notification
          M.MOCK_NOTIFICATIONS.push({
            id: M.MOCK_NOTIFICATIONS.length + 1,
            to_username: assignment.planner_username,
            kind: "task_assigned",
            title: "Công việc mới được phân công",
            body: `Bạn được phân công xác nhận đơn ${order.order_id} trên chuyền ${lineId}`,
            run_id: runId,
            step,
            is_read: false,
            created_at: new Date().toISOString(),
          });
        });
      }
      return ok({ ok: true, dispatched: orders.length });
    }
    // GET /assignments/:runId
    const runId = parseInt(p[1]);
    const tasks = M.MOCK_TASK_ASSIGNMENTS.filter(t => t.run_id === runId);
    return ok({ items: tasks, total: tasks.length });
  }

  // ── Line assignments config ────────────────────────────────────────────────
  if (p[0] === "lines") {
    if (p[1] === "assignments") {
      if (m === "POST" || m === "PUT") {
        const { line_id, planner_username } = body || {};
        if (line_id && planner_username) {
          const u = M.MOCK_USERS[planner_username];
          M.MOCK_LINE_ASSIGNMENTS[line_id] = {
            line_id,
            dep_name: line_id,
            planner_username,
            planner_name: u?.full_name || planner_username,
          };
          // update user assigned_lines
          if (u && !u.assigned_lines.includes(line_id)) {
            u.assigned_lines.push(line_id);
          }
        }
        return ok({ ok: true });
      }
      return ok({ items: Object.values(M.MOCK_LINE_ASSIGNMENTS) });
    }
    if (p[1] === "factories") return ok(M.FACTORY_LIST);
    if (p[1] === "eip") return ok(M.EIP_LINES);
    if (p[1] === "floors") return ok(M.FLOORS);
    if (p[1] === "pool") return ok(M.LINE_POOL);
    // GET /lines/schedule?lines=B_L01,B_L02
    if (p[1] === "schedule") {
      const lineIds = (params.lines || "").split(",").filter(Boolean);
      return ok(M.makeLineCapacityData(lineIds));
    }
    return ok([]);
  }

  // ── Step approvals (per run per step) ─────────────────────────────────────
  if (p[0] === "runs" && p[2] === "step-approvals") {
    const runId = parseInt(p[1]);
    if (m === "POST") {
      const { step, planner_username, line_id, status, reject_reason, note, final_submit, line_decisions } = body || {};
      const REASON_LABELS = { wrong_model: "Sai dạng giày", no_capacity: "Không đủ năng lực" };

      // ── New: final_submit with per-order decisions per line ──────────────────
      if (final_submit && Array.isArray(line_decisions)) {
        const subUser = M.MOCK_USERS[planner_username];
        const rejectedLines = [];
        line_decisions.forEach(({ line_id: ld, orders }) => {
          (orders || []).forEach(ord => {
            const task = M.MOCK_TASK_ASSIGNMENTS.find(t =>
              t.run_id === runId &&
              t.line_id === ld &&
              t.order_id === ord.order_id
            );
            if (task) {
              task.status        = ord.status === "accepted" ? "confirmed" : ord.status === "rejected" ? "rejected" : ord.status;
              task.confirmed_at  = ord.status === "accepted" ? new Date().toISOString() : undefined;
              task.reject_reason = ord.reject_reason || null;
              task.note          = ord.note || null;
            }
            if (ord.status === "rejected") {
              const label = REASON_LABELS[ord.reject_reason] || ord.reject_reason || "không xác định";
              rejectedLines.push({ line_id: ld, order_id: ord.order_id, label, note: ord.note });
            }
          });
        });
        // Send one notification per rejected line summarising rejected orders
        const rejectedByLine = {};
        rejectedLines.forEach(r => {
          if (!rejectedByLine[r.line_id]) rejectedByLine[r.line_id] = [];
          rejectedByLine[r.line_id].push(r);
        });
        Object.entries(rejectedByLine).forEach(([ld, items]) => {
          M.MOCK_NOTIFICATIONS.push({
            id: M.MOCK_NOTIFICATIONS.length + 1,
            to_username: "tran.minh",
            kind: "task_rejected",
            title: `Từ chối ${items.length} đơn — chuyền ${ld} (Run #${runId})`,
            body: `${subUser?.full_name || planner_username} đã từ chối ${items.length} đơn hàng ở chuyền ${ld}: ${items.map(i => i.order_id).join(", ")}.`,
            run_id: runId,
            step,
            is_read: false,
            created_at: new Date().toISOString(),
          });
        });
        return ok({ ok: true });
      }

      // ── Legacy: bulk line approval (kept for backward compat) ────────────────
      M.MOCK_TASK_ASSIGNMENTS
        .filter(t =>
          t.run_id === runId &&
          t.step === step &&
          t.planner_username === planner_username &&
          (!line_id || t.line_id === line_id)
        )
        .forEach(t => {
          t.status = status;
          if (status === "confirmed") t.confirmed_at = new Date().toISOString();
          if (status === "rejected") {
            t.reject_reason = reject_reason || null;
            t.note = note || null;
          }
        });
      if (status === "rejected") {
        const subUser = M.MOCK_USERS[planner_username];
        const reasonLabel = REASON_LABELS[reject_reason] || reject_reason || "không xác định";
        M.MOCK_NOTIFICATIONS.push({
          id: M.MOCK_NOTIFICATIONS.length + 1,
          to_username: "tran.minh",
          kind: "task_rejected",
          title: `Từ chối chuyền ${line_id || "?"} — ${reasonLabel}`,
          body: `${subUser?.full_name || planner_username} từ chối kế hoạch chuyền ${line_id} (Run #${runId}): "${reasonLabel}".${note ? " Ghi chú: " + note : ""}`,
          run_id: runId,
          step,
          is_read: false,
          created_at: new Date().toISOString(),
        });
      }
      return ok({ ok: true });
    }
    // GET — return approval status per step
    const step = params.step ? parseInt(params.step) : null;
    const username = params.username || "";
    const filterTasks = M.MOCK_TASK_ASSIGNMENTS.filter(t =>
      t.run_id === runId &&
      (!step || t.step === step) &&
      (!username || t.planner_username === username)
    );

    const tasks = M.MOCK_TASK_ASSIGNMENTS.filter(t => t.run_id === runId);
    const byStep = {};
    tasks.forEach(t => {
      if (!byStep[t.step]) byStep[t.step] = { total: 0, confirmed: 0, pending: 0, rejected: 0 };
      byStep[t.step].total++;
      byStep[t.step][t.status] = (byStep[t.step][t.status] || 0) + 1;
    });

    let status = "pending";
    if (filterTasks.length > 0) {
      const hasRejected = filterTasks.some(t => t.status === "rejected");
      const allConfirmed = filterTasks.every(t => t.status === "confirmed");
      status = hasRejected ? "rejected" : allConfirmed ? "confirmed" : "pending";
    }

    return ok({ by_step: byStep, tasks, status });
  }

  if (p[0] === "runs" && p[2] === "sub-schedule" && p[3]) {
    const lineId = p[3];
    const data = M.makeLineCapacityData([lineId])?.by_line?.[lineId] || null;
    return ok(data);
  }

  // ── Runs ──────────────────────────────────────────────────────────────────
  if (p[0] === "runs") {
    if (p[1] === "active") return ok(M.RUNS.find((r) => r.lifecycle_status === "active") || null);
    if (p[1] === "wizard-in-progress") return ok(M.RUNS.find((r) => r.id === 44) || null);
    if (p[1] === "wizard-close-stale" && m === "POST") return ok({ closed: 0 });
    if (p[1] === "draft" && m === "POST") return ok({ id: 100, label: body?.label || "draft", status: "draft", lifecycle_status: "draft" });
    if (p[1] === "publish-logs" && p[3] === "details") return ok({ items: [] });

    if (p.length === 1) {
      if (m === "POST") {
        const existingIdx = M.RUNS.findIndex((r) => r.id === 101);
        const newRun = M.makeRun(101, {
          label: body?.label || `Kế hoạch ${new Date().toLocaleDateString("vi-VN")}`,
          status: "done",
          lifecycle_status: "draft",
          on_time_pct: 90,
          scheduled_count: 221,
          n_orders: 25,
          created_at: new Date().toISOString(),
          started_at: new Date().toISOString(),
        });
        if (existingIdx >= 0) {
          M.RUNS[existingIdx] = newRun;
        } else {
          M.RUNS.unshift(newRun);
        }
        return ok(newRun);
      }
      return ok({ items: M.RUNS, total: M.RUNS.length });
    }

    const runId = parseInt(p[1], 10);
    const tail = p[2];

    // handle step-approvals before the switch
    if (tail === "step-approvals") {
      // already handled above — but catch here for safety
      return ok({ by_step: {}, tasks: [] });
    }

    // ── Dispatch: POST /runs/:id/dispatch ──────────────────────────────────
    if (tail === "dispatch" && m === "POST") {
      const step = body?.step;
      const key  = `${runId}:${step}`;
      // Build per-planner entries from line assignments
      const plannerMap = {};
      Object.values(M.MOCK_LINE_ASSIGNMENTS).forEach(la => {
        if (!la.planner_username) return;
        if (!plannerMap[la.planner_username]) {
          plannerMap[la.planner_username] = {
            username:      la.planner_username,
            name:          la.planner_name,
            lines:         [],
            status:        "pending",
            updated_at:    null,
            reject_reason: null,
          };
        }
        plannerMap[la.planner_username].lines.push(la.line_id);
      });
      const planners = Object.values(plannerMap);
      DISPATCH_STATE[key] = { dispatched: true, dispatched_at: new Date().toISOString(), planners };
      // Notify all sub-planners
      planners.forEach(p => {
        const stepLabels = { 2: "Xác nhận chuyền", 3: "Nhập NVL về", 4: "Nhập ngày GC", 6: "Review lịch" };
        M.MOCK_NOTIFICATIONS.push({
          id: M.MOCK_NOTIFICATIONS.length + 1,
          to_username: p.username,
          kind: "task_assigned",
          title: `Bạn có công việc mới — ${stepLabels[step] || "Phân công"}`,
          body: `Main Planner đã phân công bạn: ${stepLabels[step] || ""}. Vào "Công việc của tôi" để xác nhận.`,
          run_id: runId,
          step,
          is_read: false,
          created_at: new Date().toISOString(),
        });
      });
      return ok({ ok: true, planners });
    }

    // ── Dispatch status: GET /runs/:id/dispatch-status?step=N ──────────────
    if (tail === "dispatch-status") {
      const step = parseInt(params.step, 10);
      const key  = `${runId}:${step}`;
      // 1. Check in-memory dispatch state (from "Phân công" button clicks)
      if (DISPATCH_STATE[key]) {
        // Merge with MOCK_TASK_ASSIGNMENTS (to pick up sub-planner status changes)
        const existingTasks = M.MOCK_TASK_ASSIGNMENTS.filter(t => t.run_id === runId && t.step === step);
        const state = DISPATCH_STATE[key];
        if (existingTasks.length > 0) {
          const merged = state.planners.map(p => {
            const pTasks = existingTasks.filter(t => t.planner_username === p.username);
            if (!pTasks.length) return p;
            const hasRejected  = pTasks.some(t => t.status === "rejected");
            const allConfirmed = pTasks.every(t => t.status === "confirmed");
            const latestTask   = pTasks.reduce((a, b) => (a.confirmed_at || "") > (b.confirmed_at || "") ? a : b);
            return {
              ...p,
              status:        hasRejected ? "rejected" : allConfirmed ? "confirmed" : "pending",
              updated_at:    latestTask.confirmed_at || p.updated_at,
              reject_reason: hasRejected ? (pTasks.find(t => t.status === "rejected")?.reject_reason || null) : null,
            };
          });
          return ok({ ...state, planners: merged });
        }
        return ok(state);
      }
      // 2. Check MOCK_TASK_ASSIGNMENTS for pre-seeded tasks (e.g. run 48 steps 2, 6)
      const existingTasks = M.MOCK_TASK_ASSIGNMENTS.filter(t => t.run_id === runId && t.step === step);
      if (existingTasks.length > 0) {
        const plannerMap = {};
        existingTasks.forEach(t => {
          if (!plannerMap[t.planner_username]) {
            plannerMap[t.planner_username] = {
              username: t.planner_username, name: t.planner_name,
              lines: [], status: "pending", updated_at: null, reject_reason: null,
            };
          }
          const p = plannerMap[t.planner_username];
          if (!p.lines.includes(t.line_id)) p.lines.push(t.line_id);
          if (t.status === "rejected") {
            p.status = "rejected";
            p.reject_reason = t.reject_reason || null;
          } else if (p.status !== "rejected") {
            if (t.status === "confirmed") {
              const plannerTasks = existingTasks.filter(x => x.planner_username === t.planner_username);
              p.status = plannerTasks.every(x => x.status === "confirmed") ? "confirmed" : "pending";
              p.updated_at = t.confirmed_at || null;
            }
          }
        });
        return ok({ dispatched: true, planners: Object.values(plannerMap) });
      }
      // 3. Fallback for new runs: auto-seed all planners as confirmed
      const allPlannerMap = {};
      Object.values(M.MOCK_LINE_ASSIGNMENTS).forEach(la => {
        if (!la.planner_username) return;
        if (!allPlannerMap[la.planner_username]) {
          allPlannerMap[la.planner_username] = {
            username:      la.planner_username,
            name:          la.planner_name,
            lines:         [],
            status:        "confirmed",
            updated_at:    new Date(Date.now() - 86400000).toISOString(),
            reject_reason: null,
          };
        }
        allPlannerMap[la.planner_username].lines.push(la.line_id);
      });
      return ok({ dispatched: true, planners: Object.values(allPlannerMap) });
    }

    if (p.length === 2) {
      if (m === "DELETE") {
        const idx = M.RUNS.findIndex((r) => r.id === runId);
        if (idx >= 0) M.RUNS.splice(idx, 1);
        return ok({ ok: true });
      }
      return ok(M.RUNS.find((r) => r.id === runId) || M.makeRun(runId));
    }

    switch (tail) {
      case "status": return ok(M.makeRunStatus(runId));
      case "warnings": return ok(M.makeWarnings(runId));
      case "accept": {
        const r = M.RUNS.find((x) => x.id === runId);
        if (r) {
          r.lifecycle_status = "accepted";
          r.is_accepted = true;
          r.accepted_at = new Date().toISOString();
          r.accepted_by = "tran.minh";
          r.period_id = body?.period_id || r.period_id;
        }
        return ok({ ok: true, id: runId });
      }
      case "verify": {
        const r = M.RUNS.find((x) => x.id === runId);
        if (r) {
          r.lifecycle_status = "verifying";
          setTimeout(() => { r.lifecycle_status = "active"; }, 3000);
        }
        return ok({ id: 9002, status: "verifying" });
      }
      case "launch": return ok({ ok: true });
      case "publish-logs": return ok(M.makePublishLogs(runId));
      case "khx-plan":
        if (p[3] === "sheets") return ok(M.makeKhxPlanSheets(runId));
        return ok(M.makeKhxPlan(runId, params.zone, params.year, params.month));
      case "khx":
        if (p[3] === "sheets") return ok({ sheets: [] });
        return ok({ celldata: [] });
      case "output":
        if (p[3] === "orders") return ok(M.makeOutputOrders(runId));
        if (p[3] === "daily") return ok(M.makeOutputDaily(runId));
        if (p[3] === "lineload") return ok(M.makeOutputLineload(runId));
        return ok({ items: [] });
      case "schedule":
        if (p[3] === "daily") return ok(M.makeScheduleDaily(runId, params.target_date));
        return ok({ items: [] });
      case "genes": return ok(M.makeRunGenes(runId));
      case "impact": return ok({ items: [] });
      case "diff": return ok({ added: [], removed: [], changed: [] });
      case "snapshot": return ok({ items: [] });
      case "line-with-running": return ok(M.makeLineWithRunning(runId, params.line, params.sc_date));
      case "pdsch-running": return ok({ orders: M.MOCK_PDSCH_RUNNING });
      case "gene-edits": return ok({ items: [] });
      case "chunks":
        if (p[3] === "user-edits") return ok(M.MOCK_CHUNK_EDITS);
        if (p[3] === "single-edit" && m === "POST") return ok({ ok: true });
        return ok({ items: [], edits: [] });
      case "wizard": {
        const sub = p[3];
        if (sub === "orders") return ok(M.makeWizardOrders(runId));
        if (sub === "priorities") return ok({ priority_config: M.MOCK_PRIORITY_CONFIG });
        if (sub === "capacities") return ok({ cap_choices: {}, working_hours_per_day: 9 });
        if (sub === "new-model-targets") return ok({ targets: {} });
        if (sub === "material-etas") return ok({ overrides: M.MOCK_WIZARD_MATERIAL_ETA_OVERRIDES });
        if (sub === "gc-dates") return ok({ gc_dates: M.MOCK_WIZARD_GC_DATES });
        return ok({});
      }
      case "wizard-step": return ok({ ok: true });
      default:
        return ok({ items: [] });
    }
  }

  // ── Subcontractors ───────────────────────────────────────────────────────────
  if (p[0] === "subcontractors") return ok({ items: [] });

  // ── GC Tracking ──────────────────────────────────────────────────────────────
  if (p[0] === "gc" && p[1] === "tracking") {
    if (m === "PATCH" && p[2]) {
      const id = parseInt(p[2]);
      const item = M.GC_TRACKING.find((t) => t.id === id);
      if (item) {
        if (body?.return_confirmed_date) item.return_confirmed_date = body.return_confirmed_date;
        if (body?.actual_return_date) {
          item.actual_return_date = body.actual_return_date;
          item.status = "received";
        }
        if (body?.extend) {
          item.extension_count = (item.extension_count || 0) + 1;
          if (body.return_confirmed_date) item.return_confirmed_date = body.return_confirmed_date;
          const rcMs = new Date(item.return_confirmed_date + "T00:00:00Z");
          const todayMs = new Date("2026-06-23T00:00:00Z");
          const daysToRc = (rcMs - todayMs) / 86400000;
          item.status = daysToRc < 0 ? "late" : daysToRc <= 5 ? "warning" : "on_track";
        }
        if (body?.note) {
          item.notes = [...(item.notes || []), { text: body.note, by: body.updated_by, at: new Date().toISOString() }];
        }
        item.updated_at = new Date().toISOString();
        item.updated_by = body?.updated_by || null;
        if (body?.action_label) item.action_label = body.action_label;
      }
      return ok({ ok: true, item });
    }
    let items = [...M.GC_TRACKING];
    if (params.status) items = items.filter((t) => t.status === params.status);
    if (params.run_id) items = items.filter((t) => t.run_id === parseInt(params.run_id));
    if (params.line_ids) {
      const lineSet = new Set(params.line_ids.split(","));
      items = items.filter((t) => lineSet.has(t.line_id));
    }
    if (params.sort === "return_asc") items.sort((a, b) => a.return_confirmed_date.localeCompare(b.return_confirmed_date));
    else if (params.sort === "return_desc") items.sort((a, b) => b.return_confirmed_date.localeCompare(a.return_confirmed_date));
    else if (params.sort === "deadline_asc") items.sort((a, b) => a.deadline.localeCompare(b.deadline));
    else if (params.sort === "deadline_desc") items.sort((a, b) => b.deadline.localeCompare(a.deadline));
    return ok({ items, total: items.length });
  }

  // ── Material Tracking ────────────────────────────────────────────────────────
  if (p[0] === "material" && p[1] === "tracking") {
    if (m === "PATCH" && p[2]) {
      const id = parseInt(p[2]);
      const item = M.MATERIAL_TRACKING.find((t) => t.id === id);
      if (item) {
        if (body?.material_confirmed !== undefined) item.material_confirmed = body.material_confirmed;
        if (body?.material_eta) item.material_eta = body.material_eta;
        if (body?.confirmed_by) item.confirmed_by = body.confirmed_by;
        if (body?.material_confirmed) {
          item.confirmed_at = new Date().toISOString();
          item.status = "ready";
        }
      }
      return ok({ ok: true, item });
    }
    let items = [...M.MATERIAL_TRACKING];
    if (params.status) items = items.filter((t) => t.status === params.status);
    if (params.run_id) items = items.filter((t) => t.run_id === parseInt(params.run_id));
    if (params.line_ids) {
      const lineSet = new Set(params.line_ids.split(","));
      items = items.filter((t) => lineSet.has(t.line_id));
    }
    if (params.sort === "deadline_asc") items.sort((a, b) => a.deadline.localeCompare(b.deadline));
    else if (params.sort === "deadline_desc") items.sort((a, b) => b.deadline.localeCompare(a.deadline));
    return ok({ items, total: items.length });
  }

  // ── Materials ──────────────────────────────────────────────────────────────
  if (p[0] === "materials") {
    if (p[2] === "import") return ok({ updated: 12, inserted: 4 });
    if (m === "PUT") return ok({ ok: true });
    if (params.order_ids) return ok({ items: M.MOCK_WIZARD_MATERIAL_ETAS, total: M.MOCK_WIZARD_MATERIAL_ETAS.length });
    return ok({ items: M.MATERIAL_ETAS, total: M.MATERIAL_ETAS.length });
  }

  // ── Shoe targets (Mục tiêu dạng giày) ────────────────────────────────────────
  if (p[0] === "shoe-targets") {
    if (p[1] === "preview") return ok({ rows: [["Tên giày", "Đ/H", "Ghi chú"], ["AeroLite Mid", "160", "Chính"]] });
    if (p[1] === "import") return ok({ inserted: 5, updated: 3, skipped: 1 });
    if (m === "POST") { const it = { id: M.SHOE_TARGETS.length + 1, ...body }; M.SHOE_TARGETS.push(it); return ok(it); }
    if (m === "PUT") return ok({ ok: true });
    if (m === "DELETE") return ok({ ok: true });
    const q = (params.q || "").toLowerCase();
    const items = q ? M.SHOE_TARGETS.filter((s) => s.model_name.toLowerCase().includes(q)) : M.SHOE_TARGETS;
    return ok(items);
  }

  // ── Capacity / new models ─────────────────────────────────────────────────────
  if (p[0] === "capacity") {
    if (p[1] === "new-models") {
      if (p[2] === "scan") return ok(M.NEW_MODELS);
      if (p[2] === "pins") {
        if (m === "POST") return ok({ id: Date.now(), ...body });
        if (m === "DELETE") return ok({ ok: true });
        return ok([]);
      }
    }
    if (p[1] === "events") return ok({ items: M.EVENTS });
    if (p[1] === "gc-departments") return ok(M.GC_DEPARTMENTS);
    if (p[1] === "line-stats") return ok({ items: [] });
    if (p[1] === "line-production") return ok({ items: [] });
    if (p[1] === "line-affinity") return ok({ items: [] });
    if (p[1] === "model-line-frequency") return ok(M.MOCK_MODEL_LINE_FREQUENCY);
    if (p[1] === "classify-orders") return ok(M.makeClassifyOrders(body));
    return ok({ items: [] });
  }

  // ── Throughputs ─────────────────────────────────────────────────────────────
  if (p[0] === "throughputs") {
    if (p[1] === "overrides") {
      if (m === "POST") return ok({ id: Date.now(), ...body });
      if (m === "DELETE") return ok({ ok: true });
      return ok(M.THROUGHPUT_OVERRIDES);
    }
    if (p[1] === "matrix") return ok({ items: [] });
    if (p[1] === "line") {
      if (p[2] === "picker") return ok({ items: [] });
      return ok({ items: [] });
    }
    return ok({ items: [] });
  }

  // ── Events ──────────────────────────────────────────────────────────────────
  if (p[0] === "events") return ok({ items: M.EVENTS });

  // ── Fallback ──────────────────────────────────────────────────────────────────
  console.warn("[mock] Unhandled route:", method, url, params);
  return ok({ items: [] });
}

const makeMethod = (verb) => (url, a, b) => {
  if (verb === "get" || verb === "delete") return route(verb, url, undefined, a);
  return route(verb, url, a, b);
};

export const http = {
  get: makeMethod("get"),
  post: makeMethod("post"),
  put: makeMethod("put"),
  patch: makeMethod("patch"),
  delete: makeMethod("delete"),
  interceptors: { request: { use() {} }, response: { use() {} } },
};

export default http;

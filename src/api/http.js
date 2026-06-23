// ─────────────────────────────────────────────────────────────────────────────
// Mock HTTP client.
// Drop-in replacement for the axios instance: exposes get/post/patch/put/delete
// returning Promise<{ data }>. Routes every request to in-memory mock data so the
// entire UI works without a live backend. The real axios-based client is kept in
// http.real.js for reference.
// ─────────────────────────────────────────────────────────────────────────────
import * as M from "./mockData";

const LATENCY = 180; // simulated network delay (ms)

function ok(data) {
  return new Promise((resolve) => setTimeout(() => resolve({ data }), LATENCY));
}

// Match "/runs/48/khx-plan" → captures. Returns array of path segments.
function seg(url) {
  return url.split("?")[0].split("/").filter(Boolean);
}

function route(method, url, body, config) {
  const params = config?.params || {};
  const p = seg(url);
  const m = method.toUpperCase();

  // ── Auth ──────────────────────────────────────────────────────────────────
  if (url === "/auth/login") return ok({ user: M.MOCK_USER, access_token: "mock-token-" + Date.now() });
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

  // ── Runs ──────────────────────────────────────────────────────────────────
  if (p[0] === "runs") {
    // /runs/active
    if (p[1] === "active") return ok(M.RUNS.find((r) => r.lifecycle_status === "active") || null);
    if (p[1] === "wizard-in-progress") return ok(null);
    if (p[1] === "wizard-close-stale" && m === "POST") return ok({ closed: 0 });
    if (p[1] === "draft" && m === "POST") return ok({ id: 100, label: body?.label || "draft", status: "draft", lifecycle_status: "draft" });
    if (p[1] === "publish-logs" && p[3] === "details") return ok({ items: [] });

    // /runs  (list)
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

    if (p.length === 2) {
      if (m === "DELETE") {
        const idx = M.RUNS.findIndex((r) => r.id === runId);
        if (idx >= 0) M.RUNS.splice(idx, 1);
        return ok({ ok: true });
      }
      // detail
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
          setTimeout(() => {
            r.lifecycle_status = "active";
          }, 3000);
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

  // ── Materials ──────────────────────────────────────────────────────────────
  if (p[0] === "materials") {
    if (p[2] === "import") return ok({ updated: 12, inserted: 4 });
    if (m === "PUT") return ok({ ok: true });
    // If order_ids param is present, return wizard-specific ETAs
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

  // ── Lines / factories ─────────────────────────────────────────────────────────
  if (p[0] === "lines") {
    if (p[1] === "factories") return ok(M.FACTORY_LIST);
    if (p[1] === "eip") return ok(M.EIP_LINES);
    if (p[1] === "floors") return ok(M.FLOORS);
    if (p[1] === "pool") return ok(M.LINE_POOL);
    return ok([]);
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
  // axios signatures: get(url, config) / post(url, body, config) / delete(url, config)
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

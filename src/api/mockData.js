// ─────────────────────────────────────────────────────────────────────────────
// Mock data store for AutoPlanning Suite — deterministic, generated once.
// Provides realistic shapes for every endpoint the UI consumes so the whole
// interface renders without a live backend.
// ─────────────────────────────────────────────────────────────────────────────

const FACTORIES = ["B-F2", "C-F2", "A-F1", "D-F2", "E-F1"];
const ZONES = ["B-F2", "C-F2", "A-F1"];
const LINES = [
  "B_L01", "B_L02", "B_L03", "B_L04", "B_L05",
  "C_L01", "C_L02", "C_L03", "C_L04",
  "A_L01", "A_L02", "A_L03",
];
const CUSTOMERS = ["Decathlon", "ASICS", "New Balance", "Puma", "Skechers", "Under Armour", "Brooks", "Salomon"];
const COUNTRIES = ["FR", "US", "DE", "JP", "UK", "VN", "CN", "KR"];
const MODELS = ["AeroLite Mid", "FlexRun Pro", "TrailBlazer X", "CloudStep", "VeloMax", "TerraGrip", "PaceSetter", "SwiftEdge", "GlideForm", "AlphaBound"];

// ── Deterministic PRNG so data is stable between reloads ────────────────────
let _seed = 1337;
function rnd() {
  _seed = (_seed * 1103515245 + 12345) & 0x7fffffff;
  return _seed / 0x7fffffff;
}
function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
function ri(min, max) { return Math.floor(rnd() * (max - min + 1)) + min; }

function isoDate(d) { return d.toISOString().slice(0, 10); }
function addDays(base, n) { const d = new Date(base); d.setDate(d.getDate() + n); return d; }

const TODAY = new Date(2026, 5, 23); // 2026-06-23

// ── Auth ────────────────────────────────────────────────────────────────────
export const MOCK_USER = { id: 1, username: "tran.minh", full_name: "Trần Minh", role: "admin", email: "tran.minh@ga-planning.vn" };

// ── Schedule periods ──────────────────────────────────────────────────────────
export const PERIODS = [
  { id: 3, label: "P2026-07", period_label: "Tháng 7/2026", period_start: "2026-07-01", period_end: "2026-07-31" },
  { id: 2, label: "P2026-06", period_label: "Tháng 6/2026", period_start: "2026-06-01", period_end: "2026-06-30" },
  { id: 1, label: "P2026-05", period_label: "Tháng 5/2026", period_start: "2026-05-01", period_end: "2026-05-31" },
];

// ── Runs ──────────────────────────────────────────────────────────────────────
function makeRun(id, overrides = {}) {
  const created = addDays(TODAY, -ri(1, 40));
  return {
    id,
    label: `run_2026${String(ri(5, 7)).padStart(2, "0")}${String(ri(1, 28)).padStart(2, "0")}_${String(ri(1, 99)).padStart(2, "0")}`,
    status: "done",
    lifecycle_status: "draft",
    is_accepted: false,
    accepted_at: null,
    accepted_by: null,
    superseded_at: null,
    superseded_by: null,
    started_at: created.toISOString(),
    created_at: created.toISOString(),
    generation: ri(120, 480),
    fitness: ri(820000, 1480000),
    n_orders: ri(180, 460),
    scheduled_count: ri(180, 460),
    on_time_pct: ri(78, 99),
    on_time_count: ri(150, 440),
    runtime_seconds: +(rnd() * 60 + 8).toFixed(1),
    period_id: 2,
    period_label: "Tháng 6/2026",
    error_message: null,
    triggered_by: "tran.minh",
    step_progress: 6,
    step_name: "Lưu kết quả",
    config_json: { horizon_days: 90, report_window_days: 90 },
    ...overrides,
  };
}

export const RUNS = [
  makeRun(48, {
    label: "run_20260622_active", lifecycle_status: "active", status: "done",
    is_accepted: true, accepted_at: addDays(TODAY, -1).toISOString(), accepted_by: "tran.minh",
    period_id: 2, period_label: "Tháng 6/2026", on_time_pct: 96, scheduled_count: 412, n_orders: 412,
  }),
  makeRun(47, {
    label: "run_20260622_verify", lifecycle_status: "accepted", status: "done",
    is_accepted: true, accepted_at: addDays(TODAY, -1).toISOString(), accepted_by: "le.an",
    period_id: 2, period_label: "Tháng 6/2026", on_time_pct: 94,
  }),
  makeRun(46, { label: "run_20260621_a3", lifecycle_status: "draft", status: "done", on_time_pct: 91 }),
  makeRun(45, { label: "run_20260621_a2", lifecycle_status: "draft", status: "done", on_time_pct: 88 }),
  makeRun(44, {
    label: "run_20260620_run", status: "running", lifecycle_status: "draft",
    generation: 210, fitness: null, on_time_pct: null, scheduled_count: null,
    step_progress: 3, step_name: "TailFollowAllocator",
  }),
  makeRun(43, {
    label: "run_20260620_fail", status: "failed", lifecycle_status: "draft",
    on_time_pct: null, scheduled_count: null, fitness: null,
    error_message: "Thiếu pin line cho 2 model mới (DAOMH9002, DAOMH9003) — không thể phân bổ chuyền.",
  }),
  makeRun(42, {
    label: "run_20260615_sup", lifecycle_status: "superseded", status: "done",
    is_accepted: true, accepted_at: addDays(TODAY, -8).toISOString(), accepted_by: "tran.minh",
    superseded_at: addDays(TODAY, -1).toISOString(), superseded_by: 48,
    period_id: 1, period_label: "Tháng 5/2026", on_time_pct: 90,
  }),
  makeRun(41, { label: "run_20260610_draft", lifecycle_status: "draft", status: "done", period_id: 1, period_label: "Tháng 5/2026", on_time_pct: 85 }),
];

// ── Dashboard summary ───────────────────────────────────────────────────────
export const DASHBOARD = {
  total_orders: 480,
  on_time_pct: 96.2,
  late_orders: 14,
  total_qty: 4_820_000,
  factories_active: FACTORIES,
};

// ── ERP / PDSCH orders (BAO_CAO_SO_DUOI) ─────────────────────────────────────
function makeBaoCaoRow(i) {
  const factory = pick(FACTORIES);
  const fprefix = factory.split("-")[0];
  const qty = ri(2, 18) * 1000;
  const stitching = Math.round(qty * (rnd() * 0.9));
  const assemble = Math.round(stitching * (rnd() * 0.95));
  const crd = addDays(TODAY, ri(-10, 60));
  const sdd = addDays(crd, -ri(2, 8));
  const lpd = addDays(crd, ri(-3, 5));
  const psdt = addDays(crd, -ri(15, 35));
  const pedt = addDays(psdt, ri(6, 14));
  const article = `AR2026${fprefix}-${String(i).padStart(3, "0")}`;
  const src = i % 9 === 0 ? "ga_pending" : i % 5 === 0 ? "in_production" : "erp_only";
  return {
    ZLBH: `${fprefix}${String(100000 + i)}`,
    RY: `RY${String(20260 + i)}`,
    KHPO: `PO-${ri(10000, 99999)}`,
    SPECID: pick(["A", "B", "C"]),
    CUSTNAME: pick(CUSTOMERS),
    COUNTRY: pick(COUNTRIES),
    XieMing: pick(MODELS),
    Article: article,
    LEADTIME: ri(45, 90),
    DDMH: `DD${ri(1000, 9999)}`,
    XTMH: `XT${ri(1000, 9999)}`,
    DAOMH: `DAOMH${ri(8000, 9999)}`,
    QTY: qty,
    DDRQ: isoDate(addDays(psdt, -ri(2, 10))),
    PlanDate: isoDate(psdt),
    CRD: isoDate(crd),
    SDD: isoDate(sdd),
    LPD: isoDate(lpd),
    UPMETA: isoDate(addDays(psdt, -ri(0, 6))),
    LEAN: `${fprefix}_L${String(ri(1, 5)).padStart(2, "0")}_${pick(["L", "G"])}`,
    PSDT: isoDate(psdt),
    PEDT: isoDate(pedt),
    Stitching: stitching,
    ga_go_start: isoDate(addDays(pedt, 1)),
    ga_go_end: isoDate(addDays(pedt, ri(3, 9))),
    Assemble: assemble,
    OnTimeQty: Math.round(assemble * 0.6),
    source: src,
    ga_state: src === "ga_pending" ? "Chờ ERP" : src === "in_production" ? "Đang SX" : "ERP",
    ga_line_may: `${fprefix}_L${String(ri(1, 5)).padStart(2, "0")}_L`,
    ga_line_go: `${fprefix}_L${String(ri(1, 5)).padStart(2, "0")}_G`,
    warehouse_bal: "",
    ngay_nhap_ktp_ok: "",
    xuat_hang_du_kien: "",
    ex_factory: "",
    inspection_date: "",
    lo_inspection_result: "",
    remark: "",
    podd: "",
    production_no: "",
    gc_mm: "",
    remark_gc_chi_tiet: "",
  };
}

export const BAO_CAO_ALL = Array.from({ length: 480 }, (_, i) => makeBaoCaoRow(i + 1));
export const BAO_CAO_GA_PENDING = BAO_CAO_ALL.filter((r) => r.source === "ga_pending").slice(0, 12);

// ── ERP orders (master, used by /orders) ─────────────────────────────────────
export function makeOrdersList(body = {}) {
  const page = body.page || 1;
  const pageSize = body.page_size || 50;
  let rows = BAO_CAO_ALL;
  if (body.statuses?.includes("N")) rows = rows.filter((r) => r.source === "ga_pending");
  if (body.search) {
    const q = String(body.search).toLowerCase();
    rows = rows.filter((r) => r.Article.toLowerCase().includes(q) || r.RY.toLowerCase().includes(q) || r.CUSTNAME.toLowerCase().includes(q));
  }
  const total = rows.length;
  const items = rows.slice((page - 1) * pageSize, page * pageSize).map((r, i) => ({
    id: r.ZLBH,
    order_id: r.RY,
    orderno: r.RY,
    article: r.Article,
    model_name: r.XieMing,
    customer: r.CUSTNAME,
    country: r.COUNTRY,
    factory_code: r.ZLBH.slice(0, 1) + "-F2",
    qty: r.QTY,
    crd: r.CRD,
    lpd: r.LPD,
    sdd: r.SDD,
    status: r.source === "ga_pending" ? "N" : "P",
  }));
  return { items, total, page, page_size: pageSize };
}

// ── Material ETA ──────────────────────────────────────────────────────────────
export const MATERIAL_ETAS = Array.from({ length: 22 }, (_, i) => {
  const r = BAO_CAO_ALL[i * 5];
  const eta = addDays(TODAY, ri(-5, 25));
  return {
    order_id: r.RY,
    article: r.Article,
    factory_code: r.ZLBH.slice(0, 1) + "-F2",
    material_eta: isoDate(eta),
    buffer_days: ri(2, 12),
    status: rnd() > 0.4 ? "ok" : "pending",
  };
});

// ── Shoe model targets (Mục tiêu dạng giày) ──────────────────────────────────
export let SHOE_TARGETS = MODELS.map((m, i) => ({
  id: i + 1,
  model_name: m,
  pairs_per_hour: ri(110, 220),
  note: i % 3 === 0 ? "Dây chuyền chính" : i % 3 === 1 ? "Cần training" : null,
}));

// ── New models scan ──────────────────────────────────────────────────────────
export const NEW_MODELS = [
  { id: 1, article: "AR2026X-01", cutting_die: "DAOMH9001", name: "AeroLite Mid", buyer: "Decathlon", qty: 6500, factory: "B-F2", suggested_lines: ["B_L02", "B_L03"], reason: "Die mới, chưa có lịch sử" },
  { id: 2, article: "AR2026X-02", cutting_die: "DAOMH9002", name: "FlexRun Pro", buyer: "ASICS", qty: 8200, factory: "C-F2", suggested_lines: ["C_L01", "C_L02"], reason: "Article + die đều mới" },
  { id: 3, article: "AR2026X-03", cutting_die: "DAOMH9003", name: "TrailBlazer X", buyer: "New Balance", qty: 5400, factory: "B-F2", suggested_lines: ["B_L04"], reason: "Cutting die mới" },
  { id: 4, article: "AR2026X-04", cutting_die: "DAOMH9004", name: "CloudStep", buyer: "Puma", qty: 4100, factory: "A-F1", suggested_lines: ["A_L01", "A_L02"], reason: "Model mới hoàn toàn" },
];

// ── Factories / lines / floors ───────────────────────────────────────────────
export const FACTORY_LIST = FACTORIES.map((f, i) => ({ id: i + 1, code: f, name: `Nhà máy ${f}`, line_count: ri(3, 6) }));
export const FLOORS = [
  { floor_id: 1, name: "Tầng 1 - B" }, { floor_id: 2, name: "Tầng 2 - B" },
  { floor_id: 3, name: "Tầng 1 - C" }, { floor_id: 4, name: "Tầng 1 - A" },
];
export const EIP_LINES = LINES.map((l, i) => ({
  line_id: l, dep_no: `D${100 + i}`, dep_name: `Chuyền ${l}`,
  line_type: rnd() > 0.3 ? "production" : "lean", floor_id: ri(1, 4), factory_code: l.split("_")[0] + "-F2",
}));
export const LINE_POOL = EIP_LINES;
export const GC_DEPARTMENTS = Array.from({ length: 6 }, (_, i) => ({
  dep_no: `GC${200 + i}`, dep_name: `Gia công ${i + 1}`, line_type: "gc", floor_id: ri(1, 4),
}));

// ── Events ──────────────────────────────────────────────────────────────────
export const EVENTS = Array.from({ length: 18 }, (_, i) => {
  const r = BAO_CAO_ALL[i * 3];
  return {
    id: i + 1,
    order_id: r.RY,
    article: r.Article,
    kind: pick(["CRD_CHANGE", "QTY_CHANGE", "NEW_ORDER", "CANCEL", "LINE_CHANGE"]),
    old_value: String(ri(1000, 9000)),
    new_value: String(ri(1000, 9000)),
    changed_at: addDays(TODAY, -ri(0, 14)).toISOString(),
    note: "Đồng bộ tự động từ ERP",
  };
});

// ── Throughput overrides ─────────────────────────────────────────────────────
export const THROUGHPUT_OVERRIDES = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  article: `AR2026${pick(["B", "C", "A"])}-${String(ri(1, 200)).padStart(3, "0")}`,
  line_id: pick(LINES),
  pairs_per_hour: ri(120, 240),
  source: rnd() > 0.5 ? "manual" : "history",
}));

// ── Run output orders ─────────────────────────────────────────────────────────
export function makeOutputOrders(runId) {
  const orders = Array.from({ length: 120 }, (_, i) => {
    const r = BAO_CAO_ALL[i];
    const goStart = addDays(TODAY, ri(0, 40));
    const goEnd = addDays(goStart, ri(2, 8));
    const crd = addDays(goEnd, ri(-3, 6));
    const isLate = goEnd > crd;
    return {
      order_id: r.RY,
      article: r.Article,
      model_name: r.XieMing,
      customer: r.CUSTNAME,
      factory: r.ZLBH.slice(0, 1) + "-F2",
      line: pick(LINES),
      qty: r.QTY,
      crd: isoDate(crd),
      sew_start: isoDate(addDays(goStart, -ri(3, 7))),
      sew_end: isoDate(addDays(goStart, -1)),
      go_start: isoDate(goStart),
      go_end: isoDate(goEnd),
      lpd: r.LPD,
      is_late: isLate,
      status: isLate ? "late" : "on_time",
    };
  });
  return { orders, items: orders, total: orders.length };
}

// ── Run warnings ──────────────────────────────────────────────────────────────
export function makeWarnings(runId) {
  if (runId === 43) {
    return {
      warnings: [
        { kind: "MISSING_PIN", severity: "high", message: "Model mới DAOMH9002 chưa được pin vào chuyền nào.", order_id: "RY20266" },
        { kind: "MISSING_PIN", severity: "high", message: "Model mới DAOMH9003 chưa được pin vào chuyền nào.", order_id: "RY20271" },
      ],
    };
  }
  return {
    warnings: [
      { kind: "LATE_RISK", severity: "medium", message: "Đơn có nguy cơ trễ CRD 2 ngày do tải chuyền cao.", order_id: "RY20281" },
      { kind: "ERP_DRIFT", severity: "low", message: "Số lượng ERP lệch 200 đôi so với snapshot.", order_id: "RY20294" },
      { kind: "MATERIAL_ETA", severity: "medium", message: "NVL về sau ngày bắt đầu may dự kiến.", order_id: "RY20312" },
    ],
  };
}

// ── Publish / verification logs ──────────────────────────────────────────────
export function makePublishLogs(runId) {
  const run = RUNS.find((r) => r.id === runId);
  if (!run || (run.lifecycle_status !== "active" && run.lifecycle_status !== "verifying")) return [];
  return [
    {
      id: 9001, status: run.lifecycle_status === "active" ? "success" : "verifying",
      checked_at: addDays(TODAY, -1).toISOString(),
      matched_count: 408, total_records: 412,
      verification_note: run.lifecycle_status === "active"
        ? "Tất cả đơn đã khớp với PDSCH trên ERP."
        : "Đang đối soát danh sách đơn với ERP...",
    },
  ];
}

// ── Run status (live) ─────────────────────────────────────────────────────────
export function makeRunStatus(runId) {
  const run = RUNS.find((r) => r.id === runId);
  if (run?.status === "running") return { current_step: 3, step_name: "TailFollowAllocator", progress_pct: 52 };
  return { current_step: 6, step_name: "Lưu kết quả", progress_pct: 100 };
}

// ── Wizard per-run state ──────────────────────────────────────────────────────
export function makeWizardOrders(runId) {
  const regular = BAO_CAO_ALL.slice(0, 40).map((r) => ({
    order_id: r.RY, article: r.Article, model_name: r.XieMing, customer: r.CUSTNAME,
    qty: r.QTY, crd: r.CRD, factory_code: r.ZLBH.slice(0, 1) + "-F2",
  }));
  const gc = BAO_CAO_ALL.slice(40, 52).map((r) => ({
    order_id: r.RY, article: r.Article, model_name: r.XieMing, customer: r.CUSTNAME,
    qty: r.QTY, crd: r.CRD, factory_code: r.ZLBH.slice(0, 1) + "-F2",
  }));
  return { regular, gc };
}

// ── KHX Plan sheets ──────────────────────────────────────────────────────────
export function makeKhxPlanSheets(runId) {
  const sheets = ZONES.map((zone) => ({ zone, year: 2026, month: 6, n_orders: ri(20, 60) }));
  return { sheets };
}

export function makeKhxPlan(runId, zone, year, month) {
  const y = +year || 2026;
  const m = +month || 6;
  const daysInMonth = new Date(y, m, 0).getDate();
  const allDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const sundayDays = allDays.filter((d) => new Date(y, m - 1, d).getDay() === 0);
  const sundaySet = new Set(sundayDays);
  const zonePrefix = zone.split("-")[0];
  const zoneLines = LINES.filter((l) => l.startsWith(zonePrefix)).slice(0, 4);

  const lines = zoneLines.map((lineId) => {
    const plan_by_day = {};
    const actual_by_day = {};
    const day_slots = {};
    // Build a couple of orders flowing across days
    let orderCounter = 0;
    allDays.forEach((d) => {
      if (sundaySet.has(d)) return;
      const planQty = ri(800, 1600);
      plan_by_day[d] = planQty;
      actual_by_day[d] = d <= TODAY.getDate() && m === 6 ? Math.round(planQty * (0.7 + rnd() * 0.4)) : 0;
      day_slots[d] = {};
      [0, 1].forEach((si) => {
        // group days into ~5-day order blocks
        const orderId = `${lineId}-O${Math.floor((d - 1) / 5) + 1}-${si}`;
        const r = BAO_CAO_ALL[(orderCounter + si * 7) % BAO_CAO_ALL.length];
        const goThieu = ri(-300, 400);
        const actQty = actual_by_day[d];
        day_slots[d][si] = {
          order_id: orderId,
          ly: `LY${ri(100, 999)}`,
          ry: r.RY,
          model: `${r.XieMing}/${r.SPECID}`,
          crd: `${r.CRD}/${r.COUNTRY}/${r.SDD}`,
          pd: `${r.PSDT}/${r.Article}/${r.xuat_hang_du_kien || "-"}`,
          material: `${r.UPMETA}/${(r.QTY / 1000).toFixed(1)}k`,
          customer: r.CUSTNAME,
          size: `${ri(35, 38)}-${ri(42, 45)}`,
          ngay_chot: si === 0 ? r.PEDT : r.ga_go_end,
          ngay_chot_type: si === 0 ? "MAY" : "GO",
          go_thieu_val: goThieu,
          actual_qty: actQty,
          is_late: rnd() > 0.85,
        };
      });
      orderCounter++;
    });
    return { line_id: lineId, plan_by_day, actual_by_day, day_slots };
  });

  return { zone, year: y, month: m, all_days: allDays, sunday_days: sundayDays, n_orders: ri(20, 60), lines };
}

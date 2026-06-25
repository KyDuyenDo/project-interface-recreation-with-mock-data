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

// ── Auth ─────────────────────────────────────────────────────────────────────
export const MOCK_USERS = {
  "tran.minh":  { id: 1, username: "tran.minh",  full_name: "Trần Minh",    role: "main_planner", email: "tran.minh@ga.vn",   assigned_lines: [] },
  "nguyen.van": { id: 2, username: "nguyen.van", full_name: "Nguyễn Văn A", role: "sub_planner",  email: "nguyen.van@ga.vn",  assigned_lines: ["B_L01","B_L02"] },
  "le.thi":     { id: 3, username: "le.thi",     full_name: "Lê Thị B",     role: "sub_planner",  email: "le.thi@ga.vn",      assigned_lines: ["B_L03","B_L04"] },
  "pham.duc":   { id: 4, username: "pham.duc",   full_name: "Phạm Đức C",   role: "sub_planner",  email: "pham.duc@ga.vn",    assigned_lines: ["C_L01","C_L02"] },
  "hoang.mai":  { id: 5, username: "hoang.mai",  full_name: "Hoàng Mai D",  role: "sub_planner",  email: "hoang.mai@ga.vn",   assigned_lines: ["A_L01","A_L02"] },
};
export const MOCK_USER = MOCK_USERS["tran.minh"];

// ── Line → sub-planner assignment map ────────────────────────────────────────
export const MOCK_LINE_ASSIGNMENTS = {
  "B_L01": { line_id: "B_L01", dep_name: "B_L01", planner_username: "nguyen.van", planner_name: "Nguyễn Văn A" },
  "B_L02": { line_id: "B_L02", dep_name: "B_L02", planner_username: "nguyen.van", planner_name: "Nguyễn Văn A" },
  "B_L03": { line_id: "B_L03", dep_name: "B_L03", planner_username: "le.thi",     planner_name: "Lê Thị B" },
  "B_L04": { line_id: "B_L04", dep_name: "B_L04", planner_username: "le.thi",     planner_name: "Lê Thị B" },
  "C_L01": { line_id: "C_L01", dep_name: "C_L01", planner_username: "pham.duc",   planner_name: "Phạm Đức C" },
  "C_L02": { line_id: "C_L02", dep_name: "C_L02", planner_username: "pham.duc",   planner_name: "Phạm Đức C" },
  "A_L01": { line_id: "A_L01", dep_name: "A_L01", planner_username: "hoang.mai",  planner_name: "Hoàng Mai D" },
  "A_L02": { line_id: "A_L02", dep_name: "A_L02", planner_username: "hoang.mai",  planner_name: "Hoàng Mai D" },
};

// ── Schedule periods ──────────────────────────────────────────────────────────
export const PERIODS = [
  { id: 3, label: "P2026-07", period_label: "Tháng 7/2026", period_start: "2026-07-01", period_end: "2026-07-31" },
  { id: 2, label: "P2026-06", period_label: "Tháng 6/2026", period_start: "2026-06-01", period_end: "2026-06-30" },
  { id: 1, label: "P2026-05", period_label: "Tháng 5/2026", period_start: "2026-05-01", period_end: "2026-05-31" },
];

// ── Runs ──────────────────────────────────────────────────────────────────────
export function makeRun(id, overrides = {}) {
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
    wizard_step: 5,
  }),
  makeRun(46, { label: "run_20260621_a3", lifecycle_status: "draft", status: "done", on_time_pct: 91, wizard_step: 5 }),
  makeRun(45, { label: "run_20260621_a2", lifecycle_status: "draft", status: "done", on_time_pct: 88, wizard_step: 5 }),
  makeRun(44, {
    label: "run_20260620_run", status: "done", lifecycle_status: "draft",
    generation: 380, fitness: 912000, on_time_pct: 94, scheduled_count: 25, n_orders: 25,
    step_progress: 6, step_name: "Lưu kết quả",
    wizard_step: 5, // step 6: Chỉnh sửa lịch
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

  if (body.order_ids?.length) {
    const idSet = new Set(body.order_ids.map(id => String(id).toUpperCase()));
    rows = rows.filter((r) => idSet.has(r.RY));
  }
  if (body.statuses?.includes("N")) rows = rows.filter((r) => r.source === "ga_pending");
  if (body.search) {
    const q = String(body.search).toLowerCase();
    rows = rows.filter((r) => r.Article.toLowerCase().includes(q) || r.RY.toLowerCase().includes(q) || r.CUSTNAME.toLowerCase().includes(q));
  }
  const total = rows.length;
  const items = rows.slice((page - 1) * pageSize, page * pageSize).map((r) => ({
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
    order: {
      ARTICLE:   r.Article,
      DAOMH_:    r.DAOMH,
      DAOMH:     r.DAOMH,
      XieMing_:  r.XieMing,
      XieMing:   r.XieMing,
      XTMH_:     r.XTMH,
      DDMH_:     r.DDMH,
      COLNO:     r.SPECID,
      PAIRQTY:   r.QTY,
      DUEDT:     r.CRD,
      SPECID:    r.SPECID,
      CUSTNAME:  r.CUSTNAME,
      COUNTRY:   r.COUNTRY,
      LEADTIME:  r.LEADTIME,
    },
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

// ── Material Tracking (enriched view combining orders + ETAs + runs + lines) ──
const _TRACKING_RUNS = [
  { run_id: 48, run_label: "run_20260622_active", period_id: 2, period_label: "Tháng 6/2026", lifecycle_status: "active" },
  { run_id: 47, run_label: "run_20260622_verify", period_id: 2, period_label: "Tháng 6/2026", lifecycle_status: "accepted" },
  { run_id: 46, run_label: "run_20260621_a3",     period_id: 2, period_label: "Tháng 6/2026", lifecycle_status: "draft" },
  { run_id: 41, run_label: "run_20260610_draft",  period_id: 1, period_label: "Tháng 5/2026", lifecycle_status: "draft" },
];
const _LINES_BY_PREFIX = {
  B: ["B_L01", "B_L02", "B_L03", "B_L04"],
  C: ["C_L01", "C_L02", "C_L03"],
  A: ["A_L01", "A_L02"],
  D: ["B_L01", "B_L02"],
  E: ["A_L01", "A_L02"],
};
// ETA offsets relative to CRD (days): negative = before CRD = good, positive = after = late
const _ETA_OFFSETS = [-15, 5, -7, 3, -3, 8, -10, -2, 15, -5];

export const MATERIAL_TRACKING = _TRACKING_RUNS.flatMap((rc, ri_) =>
  Array.from({ length: 10 }, (_, i) => {
    const r = BAO_CAO_ALL[(ri_ * 47 + i * 13) % BAO_CAO_ALL.length];
    const fprefix = r.ZLBH.slice(0, 1);
    const lineArr = _LINES_BY_PREFIX[fprefix] || _LINES_BY_PREFIX.B;
    const line_id = lineArr[i % lineArr.length];

    const crdDate = new Date(r.CRD + "T00:00:00Z");
    const etaOffset = _ETA_OFFSETS[(ri_ * 3 + i) % _ETA_OFFSETS.length];
    const etaDate = new Date(crdDate);
    etaDate.setUTCDate(etaDate.getUTCDate() + etaOffset);
    const material_eta = isoDate(etaDate);

    const daysToDeadline = (crdDate - TODAY) / 86400000;

    let status;
    if (etaDate > crdDate) {
      status = "late";
    } else if (etaDate <= TODAY) {
      status = "ready";
    } else if (daysToDeadline <= 7) {
      status = "upcoming";
    } else {
      status = "waiting";
    }

    const lineAssignment = MOCK_LINE_ASSIGNMENTS[line_id];
    return {
      id: ri_ * 10 + i + 1,
      order_id: r.RY,
      article: r.Article,
      shoe_type: r.XieMing,
      deadline: r.CRD,
      material_eta,
      line_id,
      status,
      run_id: rc.run_id,
      run_label: rc.run_label,
      period_id: rc.period_id,
      period_label: rc.period_label,
      lifecycle_status: rc.lifecycle_status,
      material_confirmed: status === "ready",
      confirmed_at: status === "ready" ? isoDate(addDays(TODAY, -1)) : null,
      confirmed_by: status === "ready" ? (lineAssignment?.planner_username || null) : null,
    };
  })
);

// ── GC (Gia công) Tracking ───────────────────────────────────────────────────
const _GC_TRACKING_RUNS = [
  { run_id: 48, run_label: "run_20260622_active", period_id: 2, period_label: "Tháng 6/2026", lifecycle_status: "active" },
  { run_id: 47, run_label: "run_20260622_verify", period_id: 2, period_label: "Tháng 6/2026", lifecycle_status: "accepted" },
  { run_id: 46, run_label: "run_20260621_a3",     period_id: 2, period_label: "Tháng 6/2026", lifecycle_status: "draft" },
  { run_id: 41, run_label: "run_20260610_draft",  period_id: 1, period_label: "Tháng 5/2026", lifecycle_status: "draft" },
];
const _GC_UNITS = [
  { dep_no: "GC200", name: "Gia công Thuận Phát" },
  { dep_no: "GC201", name: "Gia công Minh Khoa" },
  { dep_no: "GC202", name: "Gia công Đức Hùng" },
  { dep_no: "GC203", name: "Gia công Thiên Long" },
  { dep_no: "GC204", name: "Gia công Bảo Châu" },
  { dep_no: "GC205", name: "Gia công Kim Anh" },
];
// Return-confirmed offsets from TODAY (days): <0 = past (late), >0 = future
// Pattern per i%5: 0→received(-10), 1→late(-2), 2→warning(+3), 3→on_track(+12), 4→on_track(+22)
const _RC_OFFSETS = [-10, -2, 3, 12, 22];

export const GC_TRACKING = _GC_TRACKING_RUNS.flatMap((rc, ri_) =>
  Array.from({ length: 10 }, (_, i) => {
    const r = BAO_CAO_ALL[(ri_ * 53 + i * 17) % BAO_CAO_ALL.length];
    const fprefix = r.ZLBH.slice(0, 1);
    const lineArr = _LINES_BY_PREFIX[fprefix] || _LINES_BY_PREFIX.B;
    const line_id = lineArr[i % lineArr.length];

    const statusIdx = i % 5;
    const rcDate = addDays(TODAY, _RC_OFFSETS[statusIdx]);
    const deadline = isoDate(addDays(rcDate, 8 + (i % 3) * 3));
    const sent_date = isoDate(addDays(TODAY, -(15 + (i % 7) * 2)));
    const return_confirmed_date = isoDate(rcDate);
    const gcUnit = _GC_UNITS[(ri_ * 2 + i) % _GC_UNITS.length];
    const extension_count = (statusIdx === 3 && i > 5) ? 1 : 0;
    const extended_deadline = extension_count > 0 ? isoDate(addDays(rcDate, 5)) : null;
    // Ngày gò: bắt đầu sau khi GC trả hàng, kết thúc sau vài ngày tùy SL
    const go_start = isoDate(addDays(rcDate, 1 + (i % 3)));
    const go_end   = isoDate(addDays(rcDate, 4 + (i % 4) * 2));

    let status, actual_return_date = null;
    if (statusIdx === 0)      { status = "received"; actual_return_date = isoDate(addDays(TODAY, -3)); }
    else if (statusIdx === 1) { status = "late"; }
    else if (statusIdx === 2) { status = "warning"; }
    else                      { status = "on_track"; }

    return {
      id: ri_ * 10 + i + 1,
      order_id: r.RY,
      article: r.Article,
      shoe_type: r.XieMing,
      qty: r.QTY,
      gc_dep_no: gcUnit.dep_no,
      gc_unit: gcUnit.name,
      line_id,
      deadline,
      sent_date,
      return_confirmed_date,
      extended_deadline,
      actual_return_date,
      extension_count,
      go_start,
      go_end,
      status,
      run_id: rc.run_id,
      run_label: rc.run_label,
      period_id: rc.period_id,
      period_label: rc.period_label,
      lifecycle_status: rc.lifecycle_status,
      notes: [],
      updated_at: null,
      updated_by: null,
    };
  })
);

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
  line_id: l, dep_no: `D${100 + i}`, dep_name: l,
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
const DELAY_REASONS = [
  {
    code: "material_late",
    label: "Vật liệu về trễ",
    color: "orange",
    note: (r, crd, goEnd) => {
      const etaDays = Math.round((goEnd - crd) / 86400000) + ri(1, 3);
      return `ETA vật liệu (${r.Article ?? "NVL"}) dự kiến về sau CRD ${etaDays} ngày — đang chờ nhà cung cấp xác nhận lại lịch giao.`;
    },
  },
  {
    code: "subcon_late",
    label: "Gia công giao trễ",
    color: "amber",
    note: (r) => `Đơn gia công ${r.CUSTNAME ?? "KH"} chưa giao đúng hạn — nhà gia công phản hồi chậm hơn dự kiến ${ri(2, 7)} ngày do thiếu nhân công.`,
  },
  {
    code: "customer_hold",
    label: "Khách hàng holding",
    color: "purple",
    note: (r) => `${r.CUSTNAME ?? "KH"} yêu cầu tạm giữ đơn — đang chờ xác nhận từ phía mua hàng về thay đổi số lượng hoặc chất liệu.`,
  },
  {
    code: "customer_spending",
    label: "Khách hàng spending",
    color: "blue",
    note: (r) => `${r.CUSTNAME ?? "KH"} chưa xác nhận chi tiêu ngân sách quý — đơn bị hold cho đến khi phê duyệt PO.`,
  },
  {
    code: "capacity",
    label: "Thiếu năng lực chuyền",
    color: "red",
    note: (r, crd, goEnd) => {
      const days = Math.round((goEnd - crd) / 86400000);
      return `Chuyền may không đủ năng lực trong ${days} ngày CRD — cần xem xét phân bổ lại hoặc tăng ca.`;
    },
  },
  {
    code: "model_change",
    label: "Thay đổi model / size",
    color: "slate",
    note: (r) => `${r.CUSTNAME ?? "KH"} điều chỉnh tỷ lệ size sau khi đặt hàng — cần tái lên kế hoạch cắt và may.`,
  },
];

export function makeOutputOrders(runId) {
  const DIE_CODES = ["DAOMH1001","DAOMH1002","DAOMH1003","DAOMH2001","DAOMH2002","DAOMH3001","DAOMH3002","DAOMH4001"];
  const STATES = ["IN_PROGRESS","IN_PROGRESS","FUTURE_PLANNED","FUTURE_PLANNED","FUTURE_PLANNED",null,null,null];
  const orders = Array.from({ length: 120 }, (_, i) => {
    const r = BAO_CAO_ALL[i];
    const fprefix = r.ZLBH.slice(0, 1);
    const possibleLines = LINES.filter(l => l.startsWith(fprefix + "_"));
    const lineMay = possibleLines[i % possibleLines.length] || LINES[i % LINES.length];
    const lineGo  = possibleLines[(i + 1) % possibleLines.length] || lineMay;
    const goStart = addDays(TODAY, ri(0, 40));
    const goEnd   = addDays(goStart, ri(2, 8));
    const crd     = addDays(goEnd, ri(-3, 6));
    const isLate  = goEnd > crd;
    const state   = STATES[i % STATES.length];
    const qty     = r.QTY;
    const daysLate = isLate ? Math.round((goEnd - crd) / 86400000) : 0;
    const delayDef = isLate ? DELAY_REASONS[i % DELAY_REASONS.length] : null;
    return {
      order_id:     r.RY,
      scbh:         r.RY,
      article:      r.Article,
      model_name:   r.XieMing,
      customer:     r.CUSTNAME,
      factory:      fprefix + "-F2",
      line:         lineMay,
      line_may:     lineMay,
      line_go:      lineGo,
      dep_name_may: lineMay,
      dep_name_go:  lineGo,
      qty,
      qty_total:    qty,
      crd:          isoDate(crd),
      sew_start:    isoDate(addDays(goStart, -ri(3, 7))),
      sew_end:      isoDate(addDays(goStart, -1)),
      go_start:     isoDate(goStart),
      go_end:       isoDate(goEnd),
      lpd:          r.LPD,
      is_late:      isLate,
      days_late:    daysLate,
      delay_reason: delayDef?.code   ?? null,
      delay_label:  delayDef?.label  ?? null,
      delay_color:  delayDef?.color  ?? null,
      delay_note:   delayDef ? delayDef.note(r, crd, goEnd) : null,
      status:       isLate ? "late" : "on_time",
      state,
      cutting_die:  DIE_CODES[i % DIE_CODES.length],
      sizes:        {},
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
  if (run?.status === "running") {
    return { status: "running", current_step: 3, step_name: "TailFollowAllocator", progress_pct: 52 };
  }
  if (run?.status === "failed") {
    return { status: "failed", current_step: 0, step_name: "Thất bại", progress_pct: 0 };
  }
  return { status: "done", current_step: 6, step_name: "Lưu kết quả", progress_pct: 100 };
}

// ── Wizard per-run state (comprehensive mock) ────────────────────────────────

const WIZARD_REGULAR_SOURCES = BAO_CAO_ALL.slice(0, 25);
const WIZARD_GC_SOURCES      = BAO_CAO_ALL.slice(40, 48);

function _wizardOrderItem(r) {
  return {
    order_id: r.RY,
    order: {
      ARTICLE:   r.Article,
      DAOMH_:    r.DAOMH,
      DAOMH:     r.DAOMH,
      XieMing_:  r.XieMing,
      XieMing:   r.XieMing,
      XTMH_:     r.XTMH,
      DDMH_:     r.DDMH,
      COLNO:     r.SPECID,
      PAIRQTY:   r.QTY,
      DUEDT:     r.CRD,
      SPECID:    r.SPECID,
      CUSTNAME:  r.CUSTNAME,
      COUNTRY:   r.COUNTRY,
      LEADTIME:  r.LEADTIME,
    },
  };
}

export function makeWizardOrders(runId) {
  const regular = WIZARD_REGULAR_SOURCES.map(_wizardOrderItem);
  const gc      = WIZARD_GC_SOURCES.map(_wizardOrderItem);
  return { regular, gc };
}

const ALL_WIZARD_IDS = [
  ...WIZARD_REGULAR_SOURCES.map(r => r.RY),
  ...WIZARD_GC_SOURCES.map(r => r.RY),
];

// ── Step 1 — Classify orders ─────────────────────────────────────────────────
export function makeClassifyOrders(body) {
  const cls = {};
  const gcSet = new Set(WIZARD_GC_SOURCES.map(r => r.RY));
  for (const o of (body?.orders || [])) {
    const id = String(o.order_id || "").toUpperCase();
    cls[id] = { type: gcSet.has(id) ? "gc" : "regular" };
  }
  return { classifications: cls };
}

// ── Step 1 — Bulk lookup ─────────────────────────────────────────────────────
export function makeBulkLookup(orderIds) {
  const knownSet = new Set(ALL_WIZARD_IDS);
  const found = (orderIds || []).filter(id => knownSet.has(id));
  return { found, not_found: (orderIds || []).filter(id => !knownSet.has(id)) };
}

// ── Step 2 — Model-line frequency ────────────────────────────────────────────
export const MOCK_MODEL_LINE_FREQUENCY = (() => {
  const result = [];
  WIZARD_REGULAR_SOURCES.slice(0, 20).forEach((r, i) => {
    const fprefix = r.ZLBH.slice(0, 1);
    const mayLines = LINES.filter(l => l.startsWith(fprefix + "_")).slice(0, 3);
    const goLines  = LINES.filter(l => l.startsWith(fprefix + "_")).slice(1, 3);
    result.push({
      article:     r.Article,
      cutting_die: r.DAOMH,
      lines: mayLines.map((lid, li) => ({
        line_id:   lid,
        dep_name:  lid,
        line_type: "may",
        total_qty: ri(25000, 80000),
        count:     ri(4, 15),
        mode_qty:  ri(900, 1600),
        avg_qty:   ri(800, 1400),
        floor_id:  ri(1, 4),
      })),
      gc_lines: i % 5 === 0 ? [{
        line_id:   `GC${200 + (i % 6)}`,
        dep_name:  `Gia công ${(i % 6) + 1}`,
        line_type: "gc",
        total_qty: ri(8000, 20000),
        count:     ri(2, 6),
        mode_qty:  ri(600, 1000),
        avg_qty:   ri(500, 900),
      }] : [],
    });
  });
  WIZARD_GC_SOURCES.slice(0, 5).forEach((r, i) => {
    result.push({
      article:     r.Article,
      cutting_die: r.DAOMH,
      lines: [],
      gc_lines: [{
        line_id:   `GC${200 + i}`,
        dep_name:  `Gia công ${i + 1}`,
        line_type: "gc",
        total_qty: ri(10000, 30000),
        count:     ri(3, 8),
        mode_qty:  ri(700, 1100),
        avg_qty:   ri(600, 1000),
      }],
    });
  });
  return result;
})();

// ── Step 2 — Pre-populated priority config ───────────────────────────────────
export const MOCK_PRIORITY_CONFIG = (() => {
  const cfg = {};
  for (const m of MOCK_MODEL_LINE_FREQUENCY) {
    const key = `${m.article}||${m.cutting_die || ""}`;
    const mayLines = (m.lines || []).filter(l => l.line_type === "may" || !l.line_type).map(l => l.line_id);
    const goLines  = (m.lines || []).filter(l => l.line_type === "go").map(l => l.line_id);
    const gcLines  = (m.gc_lines || []).map(l => l.line_id);
    const mayPrimary = mayLines.slice(0, 2);
    const mayBackup  = mayLines.slice(2);
    const goPrimary  = goLines.length > 0 ? goLines.slice(0, 1) : mayLines.slice(-1);
    const goBackup   = goLines.length > 1 ? goLines.slice(1) : [];
    const gcPrimary  = gcLines.slice(0, 1);
    const gcBackup   = gcLines.slice(1);
    cfg[key] = {
      may_primary: mayPrimary,
      may_backup:  mayBackup,
      go_primary:  goPrimary,
      go_backup:   goBackup,
      gc_primary:  gcPrimary,
      gc_backup:   gcBackup,
    };
  }
  return cfg;
})();

// ── Step 3 — Wizard material ETAs ────────────────────────────────────────────
export const MOCK_WIZARD_MATERIAL_ETAS = (() => {
  const rows = [];
  ALL_WIZARD_IDS.forEach((id, i) => {
    const r = BAO_CAO_ALL.find(x => x.RY === id) || BAO_CAO_ALL[i];
    const hasPending = i % 4 === 0;
    rows.push({
      order_id: id,
      article:  r.Article,
      eta_date: hasPending ? isoDate(addDays(TODAY, ri(5, 25))) : null,
      status:   hasPending ? "pending" : "ok",
    });
  });
  return rows;
})();

// Pre-populated material ETA overrides for Step 3
export const MOCK_WIZARD_MATERIAL_ETA_OVERRIDES = (() => {
  const overrides = {};
  WIZARD_REGULAR_SOURCES.forEach((r, i) => {
    if (i % 4 === 0) {
      overrides[r.RY] = isoDate(addDays(TODAY, 3 + (i % 5)));
    }
  });
  return overrides;
})();

// Pre-populated GC dates for Step 4
export const MOCK_WIZARD_GC_DATES = (() => {
  const dates = {};
  WIZARD_GC_SOURCES.forEach((r, i) => {
    dates[r.RY] = {
      start_date: isoDate(addDays(TODAY, 2 + i)),
      end_date: isoDate(addDays(TODAY, 7 + i)),
    };
  });
  return dates;
})();

// ── Step 6 — Output daily (calendar & DailyReport) ──────────────────────────
export function makeOutputDaily(runId) {
  const rows = [];
  const sizes = [36, 37, 38, 39, 40, 41, 42, 43, 44];
  [...WIZARD_REGULAR_SOURCES, ...WIZARD_GC_SOURCES].forEach((r, oi) => {
    const fprefix = r.ZLBH.slice(0, 1);
    const possibleLines = LINES.filter(l => l.startsWith(fprefix + "_"));
    const line = possibleLines[oi % possibleLines.length] || possibleLines[0];
    const startOffset = ri(5, 30);
    const nDays = ri(3, 8);
    const totalQty = r.QTY;
    const perDay = Math.floor(totalQty / nDays);
    let remaining = totalQty;
    for (let d = 0; d < nDays; d++) {
      const date = addDays(TODAY, startOffset + d);
      if (date.getDay() === 0) continue;
      const qty = d === nDays - 1 ? remaining : perDay;
      remaining -= qty;
      if (qty <= 0) continue;
      const sizeMap = {};
      let sizeRemaining = qty;
      sizes.forEach((sz, si) => {
        const szQty = si === sizes.length - 1
          ? sizeRemaining
          : Math.floor(qty / sizes.length * (0.5 + rnd()));
        if (szQty > 0) {
          sizeMap[String(sz)] = Math.min(szQty, sizeRemaining);
          sizeRemaining -= sizeMap[String(sz)];
        }
      });
      const isGc = WIZARD_GC_SOURCES.some(x => x.RY === r.RY);
      rows.push({
        scbh:  r.RY,
        date:  isoDate(date),
        line:  isGc ? `GC${200 + (oi % 6)}` : line,
        qty,
        sizes: sizeMap,
        stage: isGc ? "gc" : (d < nDays / 2 ? "sew" : "go"),
      });
    }
  });
  return { rows };
}

// ── Step 6 — Output lineload ──────────────────────────────────────────────────
export function makeOutputLineload(runId) {
  const daily = makeOutputDaily(runId).rows;
  const groups = {};
  for (const r of daily) {
    const key = `${r.date}||${r.line}`;
    if (!groups[key]) {
      groups[key] = {
        date: r.date,
        line: r.line,
        dep_name: r.line,
        total_qty: 0,
        day_capacity: ri(1000, 2000),
        stage: r.stage,
      };
    }
    groups[key].total_qty += r.qty;
  }
  return { items: Object.values(groups), rows: Object.values(groups), total: Object.values(groups).length };
}

// ── Step 6 — Run Genes (lineup tab details) ──────────────────────────────────
export function makeRunGenes(runId) {
  const DIE_CODES = ["DAOMH1001","DAOMH1002","DAOMH1003","DAOMH2001","DAOMH2002","DAOMH3001","DAOMH3002","DAOMH4001"];
  const TOOLS     = ["DAO_A","DAO_B","DAO_C","DAO_D","DAO_E"];
  const LASTS     = ["LAST-001","LAST-002","LAST-003","LAST-004","LAST-005","LAST-006"];
  const items = Array.from({ length: 120 }, (_, i) => {
    const r = BAO_CAO_ALL[i];
    const isGc = WIZARD_GC_SOURCES.some(x => x.RY === r.RY);
    const fprefix = r.ZLBH.slice(0, 1);
    const mayPool = isGc
      ? GC_DEPARTMENTS.map(d => d.dep_no)
      : LINES.filter(l => l.startsWith(fprefix + "_"));
    const goPool  = LINES.filter(l => l.startsWith(fprefix + "_"));
    const lineMay = mayPool[i % mayPool.length] || LINES[i % LINES.length];
    const lineGo  = isGc ? lineMay : (goPool[(i + 1) % goPool.length] || lineMay);
    const depNameMay = isGc ? `Gia công ${(i % 6) + 1}` : lineMay;
    const depNameGo  = lineGo;
    const goStart  = addDays(TODAY, ri(3, 45));
    const goEnd    = addDays(goStart, ri(2, 8));
    const sewStart = addDays(goStart, -ri(3, 8));
    const sewEnd   = addDays(goStart, -1);
    return {
      order_id:     r.RY,
      article:      r.Article,
      style:        r.XieMing,
      model:        r.XieMing,
      customer:     r.CUSTNAME,
      cutting_die:  DIE_CODES[i % DIE_CODES.length],
      tool:         TOOLS[i % TOOLS.length],
      last:         LASTS[i % LASTS.length],
      line:         lineMay,
      line_may:     lineMay,
      line_go:      lineGo,
      dep_name_may: depNameMay,
      dep_name_go:  depNameGo,
      qty:          r.QTY,
      qty_total:    r.QTY,
      crd:          r.CRD,
      go_start:     isoDate(goStart),
      go_end:       isoDate(goEnd),
      sew_start:    isoDate(sewStart),
      sew_end:      isoDate(sewEnd),
      is_gc:        isGc,
      is_late:      goEnd > new Date(r.CRD),
    };
  });
  return { items, genes: items };
}

// ── KHX Plan ──────────────────────────────────────────────────────────────────
export function makeKhxPlan(runId, zone, year, month) {
  const targetZone = zone || ZONES[0];
  const zoneLines = LINES.filter(l => l.startsWith(targetZone.split("-")[0] + "_"));
  const targetYear = year ? parseInt(year) : 2026;
  const targetMonth = month ? parseInt(month) : 7;
  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
  const cells = [];
  zoneLines.forEach((line, li) => {
    Array.from({ length: 25 }, (_, oi) => {
      const r = BAO_CAO_ALL[(li * 25 + oi) % BAO_CAO_ALL.length];
      const startDay = ri(1, Math.max(1, daysInMonth - 10));
      const endDay   = Math.min(startDay + ri(3, 10), daysInMonth);
      cells.push({
        line,
        order_id:  r.RY,
        article:   r.Article,
        model:     r.XieMing,
        customer:  r.CUSTNAME,
        qty:       r.QTY,
        start_day: startDay,
        end_day:   endDay,
        stage:     li % 2 === 0 ? "go" : "sew",
        is_late:   rnd() > 0.85,
        crd:       r.CRD,
      });
    });
  });
  return {
    zone: targetZone,
    year: targetYear,
    month: targetMonth,
    lines: zoneLines,
    days_in_month: daysInMonth,
    cells,
  };
}

export function makeKhxPlanSheets(runId) {
  return { zones: ZONES, years: [2026], months: [6, 7, 8] };
}

// ── Line with running ─────────────────────────────────────────────────────────
export function makeLineWithRunning(runId, line, scDate) {
  const targetLine = line || LINES[0];
  const date       = scDate || isoDate(TODAY);
  const lineIdx    = LINES.indexOf(targetLine);
  const offset     = lineIdx < 0 ? 0 : lineIdx;

  const running_orders = Array.from({ length: ri(2, 4) }, (_, i) => {
    const r = BAO_CAO_ALL[(offset * 3 + i) % BAO_CAO_ALL.length];
    const orderQty     = r.QTY;
    const actualQty    = ri(Math.floor(orderQty * 0.05), Math.floor(orderQty * 0.4));
    const remainingQty = orderQty - actualQty;
    return {
      scbh:          r.RY,
      order_id:      r.RY,
      article:       r.Article,
      model:         r.XieMing,
      order_qty:     orderQty,
      actual_qty:    actualQty,
      remaining_qty: remainingQty,
    };
  });

  const committed_orders = Array.from({ length: ri(2, 5) }, (_, i) => {
    const r         = BAO_CAO_ALL[(offset * 5 + i + 20) % BAO_CAO_ALL.length];
    const orderQty  = r.QTY;
    const actualSew = ri(0, Math.floor(orderQty * 0.6));
    const remainSew = orderQty - actualSew;
    return {
      scbh:             r.RY,
      order_id:         r.RY,
      article:          r.Article,
      model:            r.XieMing,
      customer:         r.CUSTNAME,
      order_qty:        orderQty,
      actual_sew_qty:   actualSew,
      remaining_sew_qty: remainSew,
      lpd:              r.LPD,
      crd:              isoDate(addDays(TODAY, ri(5, 40))),
    };
  });

  return { line: targetLine, sc_date: date, running_orders, committed_orders };
}

// ── PDSCH Running ────────────────────────────────────────────────────────────
export const MOCK_PDSCH_RUNNING = Array.from({ length: 20 }, (_, i) => {
  const r = BAO_CAO_ALL[i * 4];
  const fprefix = r.ZLBH.slice(0, 1);
  const possibleLines = LINES.filter(l => l.startsWith(fprefix + "_"));
  const lineMay = possibleLines[i % possibleLines.length] || LINES[i % LINES.length];
  const lineGo  = possibleLines[(i + 1) % possibleLines.length] || lineMay;
  const DIE_CODES = ["DAOMH1001","DAOMH1002","DAOMH1003","DAOMH2001","DAOMH2002","DAOMH3001","DAOMH3002","DAOMH4001"];
  const psdt = isoDate(addDays(TODAY, -ri(1, 15)));
  const pedt = isoDate(addDays(TODAY, ri(2, 10)));
  const source = i % 3 === 0 ? "lean" : "production";
  const qty = ri(500, 3000);
  const actualSew = source === "production" ? ri(100, Math.floor(qty * 0.7)) : 0;
  const actualGo  = source === "production" ? ri(50,  Math.floor(qty * 0.5)) : 0;
  return {
    order_id:       r.RY,
    scbh:           r.RY,
    article:        r.Article,
    model:          r.XieMing,
    customer:       r.CUSTNAME,
    cutting_die:    DIE_CODES[i % DIE_CODES.length],
    lpd:            r.LPD,
    psdt,
    pedt,
    line_may:       lineMay,
    line_go:        lineGo,
    stage:          i % 2 === 0 ? "sew" : "go",
    qty,
    remaining_qty:  ri(200, 4000),
    actual_qty_sew: actualSew,
    actual_qty_go:  actualGo,
    source,
  };
});

// ── Chunk edits ───────────────────────────────────────────────────────────────
export const MOCK_CHUNK_EDITS = (() => {
  const changers = ["tran.minh", "nguyen.lan", "le.hung"];
  const lines = LINES.slice(0, 6);
  const edits = [];
  BAO_CAO_ALL.slice(0, 18).forEach((r, i) => {
    const actions = ["move","move","move","add","delete","qty_change"];
    const action = actions[i % actions.length];
    const fromLine = lines[i % lines.length];
    const toLine   = lines[(i + 2) % lines.length];
    const oldDate  = isoDate(addDays(TODAY, -ri(1, 10)));
    const newDate  = isoDate(addDays(TODAY, ri(1, 14)));
    edits.push({
      action,
      order_id:   r.RY,
      chunk_id:   `${r.RY}|${oldDate}|${fromLine}`,
      old_line:   action === "add"    ? null : fromLine,
      new_line:   action === "delete" ? null : toLine,
      old_date:   action === "add"    ? null : oldDate,
      new_date:   action === "delete" ? null : newDate,
      changed_by: changers[i % changers.length],
      changed_at: addDays(TODAY, -ri(0, 3)).toISOString().replace("T", " ").slice(0, 19),
    });
  });
  return edits;
})();

// ── Schedule daily ────────────────────────────────────────────────────────────
export function makeScheduleDaily(runId, targetDate) {
  const date = targetDate || isoDate(TODAY);
  const DIE_CODES = ["DAOMH1001","DAOMH1002","DAOMH1003","DAOMH2001","DAOMH2002","DAOMH3001","DAOMH3002","DAOMH4001"];
  const STATES = ["IN_PROGRESS", "FUTURE_PLANNED", null, null, null];

  const lines = LINES.slice(0, 8);
  const lineObjs = lines.map((line, li) => {
    const sewOrders = Array.from({ length: ri(2, 5) }, (_, i) => {
      const r = BAO_CAO_ALL[(li * 7 + i) % BAO_CAO_ALL.length];
      const isFrozen = i === 0;
      const state    = STATES[i % STATES.length];
      return {
        order_id:    r.RY,
        article:     r.Article,
        model:       r.XieMing,
        customer:    r.CUSTNAME,
        cutting_die: DIE_CODES[i % DIE_CODES.length],
        line,
        stage:       "sew",
        qty:         ri(200, 1500),
        date,
        crd:         isoDate(addDays(TODAY, ri(5, 40))),
        is_frozen:   isFrozen,
        state,
        sizes: isFrozen ? {} : {
          "37": ri(30, 60), "38": ri(60, 120), "39": ri(80, 150),
          "40": ri(100, 180), "41": ri(80, 150), "42": ri(40, 80),
        },
      };
    });
    const goOrders = Array.from({ length: ri(1, 3) }, (_, i) => {
      const r = BAO_CAO_ALL[(li * 5 + i + 40) % BAO_CAO_ALL.length];
      const isFrozen = i === 0 && li % 3 === 0;
      const state    = STATES[(i + 1) % STATES.length];
      return {
        order_id:    r.RY,
        article:     r.Article,
        model:       r.XieMing,
        customer:    r.CUSTNAME,
        cutting_die: DIE_CODES[(i + 2) % DIE_CODES.length],
        line,
        stage:       "go",
        qty:         ri(300, 1800),
        date,
        crd:         isoDate(addDays(TODAY, ri(3, 30))),
        is_frozen:   isFrozen,
        state,
        sizes:       {},
      };
    });
    return { line, sew_orders: sewOrders, go_orders: goOrders };
  });

  return { lines: lineObjs, date };
}

// ── Line capacity / schedule data ────────────────────────────────────────────
// Generates daily production data for a list of lines spanning 30 days before
// today through all future scheduled dates (up to +90 days).
// Each day entry: { date, is_today, is_past, orders: [{ order_id, article, model, customer, qty, crd }] }
export function makeLineCapacityData(lineIds = [], capacityPerDay = 1200) {
  const lines = (Array.isArray(lineIds) ? lineIds : [lineIds]).filter(Boolean);
  const byLine = {};

  lines.forEach((lineId, li) => {
    const fprefix = lineId.split("_")[0]; // "B", "C", "A"
    // Pool of orders for this line (from BAO_CAO_ALL)
    const pool = BAO_CAO_ALL.filter(r => r.LEAN && r.LEAN.startsWith(fprefix + "_"))
      .concat(BAO_CAO_ALL.slice(li * 40, li * 40 + 40));

    // We'll map dates (-30 … +90) to order slots
    // Build a set of "order spans": each order occupies consecutive days based on qty / capacity
    const spans = []; // { order_id, model, article, customer, qty, crd, startDay, endDay }
    let dayOffset = -28; // start from 28 days ago
    const ordersToPlace = pool.slice(0, 12);

    ordersToPlace.forEach((r, oi) => {
      const daysNeeded = Math.max(1, Math.ceil((r.QTY * 0.6) / capacityPerDay));
      const start = dayOffset;
      const end   = dayOffset + daysNeeded - 1;
      spans.push({
        order_id: r.RY,
        article:  r.Article,
        model:    r.XieMing,
        customer: r.CUSTNAME,
        qty_total: r.QTY,
        crd:      r.CRD,
        startDay: start,
        endDay:   end,
      });
      dayOffset = end + ri(0, 2); // 0-2 day gap between orders
    });

    // Figure out the range of days to emit
    const maxFutureDay = Math.max(90, spans.length ? spans[spans.length - 1].endDay + 5 : 90);
    const minDay = -30;
    const todayMs = TODAY.getTime();

    const days = [];
    for (let d = minDay; d <= maxFutureDay; d++) {
      const dt = addDays(TODAY, d);
      const dateStr = isoDate(dt);
      const isPast  = d < 0;
      const isToday = d === 0;

      // Find orders active on this day
      const ordersOnDay = spans
        .filter(sp => d >= sp.startDay && d <= sp.endDay)
        .map(sp => {
          // Daily qty for this order on this day
          const daysTotal = sp.endDay - sp.startDay + 1;
          const dailyQty = Math.round(Math.min(sp.qty_total * 0.6 / daysTotal, capacityPerDay * 0.8));
          return {
            order_id: sp.order_id,
            article:  sp.article,
            model:    sp.model,
            customer: sp.customer,
            qty:      dailyQty,
            crd:      sp.crd,
          };
        });

      days.push({ date: dateStr, is_today: isToday, is_past: isPast, orders: ordersOnDay });
    }

    byLine[lineId] = { capacity_per_day: capacityPerDay, days };
  });

  return { by_line: byLine };
}

// ── Task assignments for sub-planner ─────────────────────────────────────────
// In-memory store for tasks assigned by main-planner to sub-planners
export let MOCK_TASK_ASSIGNMENTS = (() => {
  const tasks = [];

  // Run meta (used for display on cards)
  const RUN_META = {
    48: { run_id: 48, run_label: "run_20260622_active", period_label: "Tháng 6/2026",
          started_at: addDays(TODAY, -2).toISOString(), step_label: "Ưu tiên & Chuyền" },
    47: { run_id: 47, run_label: "run_20260622_verify", period_label: "Tháng 6/2026",
          started_at: addDays(TODAY, -5).toISOString(), step_label: "Review lịch" },
    46: { run_id: 46, run_label: "run_20260621_a3", period_label: "Tháng 6/2026",
          started_at: addDays(TODAY, -3).toISOString(), step_label: "Review lịch" },
    45: { run_id: 45, run_label: "run_20260621_a2", period_label: "Tháng 6/2026",
          started_at: addDays(TODAY, -4).toISOString(), step_label: "Review lịch" },
    44: { run_id: 44, run_label: "run_20260620_run", period_label: "Tháng 6/2026",
          started_at: addDays(TODAY, -1).toISOString(), step_label: "Ưu tiên & Chuyền" },
  };
  Object.assign(tasks, { _runMeta: RUN_META }); // attach for http.js to read

  // Step 2 tasks for Run 44 (the active wizard run, pending)
  Object.values(MOCK_LINE_ASSIGNMENTS).forEach((la, i) => {
    const runId = 44;
    // 2 primary orders per line
    const primaryOrders = WIZARD_REGULAR_SOURCES.slice(i * 2 + 10, i * 2 + 12);
    primaryOrders.forEach((r, oi) => {
      const prodStart = addDays(TODAY, ri(2, 8));
      const prodEnd   = addDays(prodStart, ri(4, 10));
      tasks.push({
        id: tasks.length + 1,
        run_id: runId,
        run_label: RUN_META[runId].run_label,
        period_label: RUN_META[runId].period_label,
        run_started_at: RUN_META[runId].started_at,
        step: 2,
        step_label: "Ưu tiên & Chuyền",
        planner_username: la.planner_username,
        planner_name: la.planner_name,
        line_id: la.line_id,
        order_id: r.RY,
        article: r.Article,
        model: r.XieMing,
        customer: r.CUSTNAME,
        qty: r.QTY,
        crd: r.CRD,
        prod_start: isoDate(prodStart),
        prod_end:   isoDate(prodEnd),
        is_support: false,
        main_line_id: null,
        status: "pending",
        reject_reason: null,
        qty_override: null,
        confirmed_at: null,
        note: null,
        created_at: addDays(TODAY, -1).toISOString(),
      });
    });
  });

  // Step 2 tasks — primary + support orders per line
  Object.values(MOCK_LINE_ASSIGNMENTS).forEach((la, i) => {
    const runId = 48;
    // 3 primary orders + 1 support order per line
    const primaryOrders = WIZARD_REGULAR_SOURCES.slice(i * 3, i * 3 + 3);
    const supportOrder  = WIZARD_REGULAR_SOURCES[(i * 3 + 12) % WIZARD_REGULAR_SOURCES.length];

    primaryOrders.forEach((r, oi) => {
      const prodStart = addDays(TODAY, ri(-5, 10));
      const prodEnd   = addDays(prodStart, ri(5, 14));
      tasks.push({
        id: tasks.length + 1,
        run_id: runId,
        run_label: RUN_META[runId].run_label,
        period_label: RUN_META[runId].period_label,
        run_started_at: RUN_META[runId].started_at,
        step: 2,
        step_label: "Ưu tiên & Chuyền",
        planner_username: la.planner_username,
        planner_name: la.planner_name,
        line_id: la.line_id,
        order_id: r.RY,
        article: r.Article,
        model: r.XieMing,
        customer: r.CUSTNAME,
        qty: r.QTY,
        crd: r.CRD,
        prod_start: isoDate(prodStart),
        prod_end:   isoDate(prodEnd),
        is_support: false,
        main_line_id: null,
        status: "confirmed",
        reject_reason: null,
        qty_override: null,
        confirmed_at: addDays(TODAY, -1).toISOString(),
        note: null,
        created_at: addDays(TODAY, -2).toISOString(),
      });
    });

    // 1 support order (this line assists another line's primary order)
    const prodStart = addDays(TODAY, ri(2, 15));
    const prodEnd   = addDays(prodStart, ri(3, 8));
    const supportLineIndex = (i + 1) % Object.values(MOCK_LINE_ASSIGNMENTS).length;
    const mainLine = Object.values(MOCK_LINE_ASSIGNMENTS)[supportLineIndex].line_id;
    tasks.push({
      id: tasks.length + 1,
      run_id: runId,
      run_label: RUN_META[runId].run_label,
      period_label: RUN_META[runId].period_label,
      run_started_at: RUN_META[runId].started_at,
      step: 2,
      step_label: "Ưu tiên & Chuyền",
      planner_username: la.planner_username,
      planner_name: la.planner_name,
      line_id: la.line_id,
      order_id: supportOrder.RY,
      article: supportOrder.Article,
      model: supportOrder.XieMing,
      customer: supportOrder.CUSTNAME,
      qty: Math.round(supportOrder.QTY * 0.3),
      crd: supportOrder.CRD,
      prod_start: isoDate(prodStart),
      prod_end:   isoDate(prodEnd),
      is_support: true,
      main_line_id: mainLine,
      status: "confirmed",
      reject_reason: null,
      qty_override: null,
      confirmed_at: addDays(TODAY, -1).toISOString(),
      note: null,
      created_at: addDays(TODAY, -2).toISOString(),
    });
  });

  // Step 6 tasks — schedule review (one task per line, not per order)
  [44, 45, 46, 47].forEach(runId => {
    Object.values(MOCK_LINE_ASSIGNMENTS).forEach((la, i) => {
      const prodStart = addDays(TODAY, ri(-10, 0));
      const prodEnd   = addDays(TODAY, ri(15, 45));
      tasks.push({
        id: tasks.length + 1,
        run_id: runId,
        run_label: RUN_META[runId].run_label,
        period_label: RUN_META[runId].period_label,
        run_started_at: RUN_META[runId].started_at,
        step: 6,
        step_label: "Review lịch",
        planner_username: la.planner_username,
        planner_name: la.planner_name,
        line_id: la.line_id,
        order_id: null,
        article: null,
        model: null,
        customer: null,
        qty: null,
        crd: null,
        prod_start: isoDate(prodStart),
        prod_end:   isoDate(prodEnd),
        is_support: false,
        main_line_id: null,
        status: "confirmed",
        reject_reason: null,
        qty_override: null,
        confirmed_at: addDays(TODAY, -1).toISOString(),
        note: null,
        created_at: addDays(TODAY, -3).toISOString(),
      });
    });
  });

  return tasks;
})();

// ── Notifications ─────────────────────────────────────────────────────────────
export let MOCK_NOTIFICATIONS = (() => {
  const notes = [];
  Object.values(MOCK_USERS).forEach((u) => {
    if (u.role !== "sub_planner") return;
    notes.push({
      id: notes.length + 1,
      to_username: u.username,
      kind: "task_assigned",
      title: "Công việc mới được phân công",
      body: `Main Planner đã phân công bạn xác nhận lịch chuyền ${u.assigned_lines[0]} cho Run #44`,
      run_id: 44,
      step: 2,
      is_read: false,
      created_at: new Date().toISOString(),
    });
    notes.push({
      id: notes.length + 1,
      to_username: u.username,
      kind: "task_assigned",
      title: "Công việc mới được phân công",
      body: `Main Planner đã phân công bạn xác nhận lịch chuyền ${u.assigned_lines[0]} cho Run #48`,
      run_id: 48,
      step: 2,
      is_read: false,
      created_at: addDays(TODAY, -1).toISOString(),
    });
    notes.push({
      id: notes.length + 1,
      to_username: u.username,
      kind: "task_assigned",
      title: "Cần review lịch sản xuất",
      body: `Lịch chuyền ${u.assigned_lines[0]} đã được tạo. Vui lòng kiểm tra và xác nhận.`,
      run_id: 47,
      step: 6,
      is_read: Math.random() > 0.5,
      created_at: addDays(TODAY, -2).toISOString(),
    });
  });
  return notes;
})();

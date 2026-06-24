import http from "./http";

// ─── Auth ───────────────────────────────────────────────────────────────────
export const authApi = {
  login: (username, password) =>
    http.post("/auth/login", { username, password }).then((r) => r.data),
  me: () => http.get("/auth/me").then((r) => r.data),
};

// ─── Dashboard ──────────────────────────────────────────────────────────────
export const dashboardApi = {
  summary: () => http.get("/dashboard/summary").then((r) => r.data),
};

// ─── Orders (ERP master) ────────────────────────────────────────────────────
export const ordersApi = {
  list: (body) => http.post("/orders", body).then((r) => r.data),
  factoryCodes: () => http.get("/orders/factory-codes").then((r) => r.data),
  bulkLookup: (orderIds) =>
    http.post("/orders/bulk-lookup", { order_ids: orderIds }).then((r) => r.data),
  detail: (id) => http.get(`/orders/${id}`).then((r) => r.data),
  events: (id) => http.get(`/orders/${id}/events`).then((r) => r.data),
  pdsch: (id) => http.get(`/orders/${id}/pdsch`).then((r) => r.data),
};

// ─── BAO_CAO_SO_DUOI ────────────────────────────────────────────────────────
export const baoCaoApi = {
  list: (params) => http.get("/bao-cao-so-duoi", { params }).then((r) => r.data),
  patch: (zlbh, body) =>
    http.patch(`/bao-cao-so-duoi/${encodeURIComponent(zlbh)}`, body).then((r) => r.data),
};

// ─── Schedule Runs ──────────────────────────────────────────────────────────
export const runsApi = {
  list: (params) => http.get("/runs", { params }).then((r) => r.data),
  detail: (id) => http.get(`/runs/${id}`).then((r) => r.data),
  active: () => http.get("/runs/active").then((r) => r.data),
  create: (body) => http.post("/runs", body).then((r) => r.data),
  accept: (id, body = {}) => http.post(`/runs/${id}/accept`, body).then((r) => r.data),
  delete: (id, force = false) => http.delete(`/runs/${id}${force ? "?force=true" : ""}`).then((r) => r.data),
  verify: (id) => http.post(`/runs/${id}/verify`).then((r) => r.data),
  publishLogs: (id) => http.get(`/runs/${id}/publish-logs`).then((r) => r.data),
  publishLogDetails: (logId) => http.get(`/runs/publish-logs/${logId}/details`).then((r) => r.data),

  // Live status (step-based progress)
  status: (id) => http.get(`/runs/${id}/status`).then((r) => r.data),

  // Warnings
  warnings: (id) => http.get(`/runs/${id}/warnings`).then((r) => r.data),

  // Gene manual edit (on KHX)
  genes: {
    list: (id, params) => http.get(`/runs/${id}/genes`, { params }).then((r) => r.data),
    edit: (id, orderId, body) =>
      http.patch(`/runs/${id}/genes/${orderId}`, body).then((r) => r.data),
  },
  impact: (id, body) => http.post(`/runs/${id}/impact`, body).then((r) => r.data),

  // KHX sheets (old Fortune-Sheet renderer)
  khxSheets: (id) => http.get(`/runs/${id}/khx/sheets`).then((r) => r.data),
  khx: (id, factory, year, month) =>
    http.get(`/runs/${id}/khx`, { params: { factory, year, month } }).then((r) => r.data),

  // KHX Plan (new CSS-Grid sequential slot renderer)
  khxPlanSheets: (id) => http.get(`/runs/${id}/khx-plan/sheets`).then((r) => r.data),
  khxPlan: (id, zone, year, month) =>
    http.get(`/runs/${id}/khx-plan`, { params: { zone, year, month } }).then((r) => r.data),

  // Full daily schedule (orders + sew_days + go_days + sizes)
  schedule: (id, params) => http.get(`/runs/${id}/schedule`, { params }).then((r) => r.data),
  scheduleDay: (id, targetDate) =>
    http.get(`/runs/${id}/schedule/daily`, { params: { target_date: targetDate } }).then((r) => r.data),

  // Pre-computed output views
  outputOrders: (id, params) =>
    http.get(`/runs/${id}/output/orders`, { params }).then((r) => r.data),
  outputDaily: (id, params) =>
    http.get(`/runs/${id}/output/daily`, { params }).then((r) => r.data),
  outputLineload: (id, params) =>
    http.get(`/runs/${id}/output/lineload`, { params }).then((r) => r.data),

  // Line view: running ERP orders + scheduled genes
  lineWithRunning: (id, line, scDate) =>
    http.get(`/runs/${id}/line-with-running`, {
      params: { line, ...(scDate ? { sc_date: scDate } : {}) },
    }).then((r) => r.data),

  // PDSCH orders with upcoming LPD + production/lean line assignment
  pdschRunning: (id, params) =>
    http.get(`/runs/${id}/pdsch-running`, { params }).then((r) => r.data),

  // Run diff — compare two runs
  diff: (id, compareId) =>
    http.get(`/runs/${id}/diff/${compareId}`).then((r) => r.data),

  // ERP drift
  snapshotDiff: (id, orderId) =>
    http.get(`/runs/${id}/snapshot/diff`, { params: orderId ? { order_id: orderId } : {} })
      .then((r) => r.data),
};

// ─── Subcontractor ──────────────────────────────────────────────────────────
export const subcontractorApi = {
  list: (params) => http.get("/subcontractors", { params }).then((r) => r.data),
  create: (body) => http.post("/subcontractors", body).then((r) => r.data),
  update: (id, body) => http.patch(`/subcontractors/${id}`, body).then((r) => r.data),
  remove: (id) => http.delete(`/subcontractors/${id}`).then((r) => r.data),
};

// ─── Material ETA ────────────────────────────────────────────────────────────
export const materialApi = {
  list: (params) => http.get("/materials/etas", { params }).then((r) => r.data),
  importXlsx: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return http.post("/materials/etas/import", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data);
  },
  update: (id, body) => http.put("/materials/etas", { order_id: id, ...body }).then((r) => r.data),
  tracking: (params) => http.get("/material/tracking", { params }).then((r) => r.data),
  patchTracking: (id, body) => http.patch(`/material/tracking/${id}`, body).then((r) => r.data),
};

// ─── New Models / Pins ───────────────────────────────────────────────────────
export const newModelsApi = {
  scan: () => http.get("/capacity/new-models/scan").then((r) => r.data),
  pins: {
    list: () => http.get("/capacity/new-models/pins").then((r) => r.data),
    create: (body) => http.post("/capacity/new-models/pins", body).then((r) => r.data),
    remove: (id) => http.delete(`/capacity/new-models/pins/${id}`).then((r) => r.data),
  },
};

// ─── Factories ───────────────────────────────────────────────────────────────
export const factoriesApi = {
  list: () => http.get("/lines/factories").then((r) => r.data),
  lines: (params) => http.get("/lines/eip", { params }).then((r) => r.data),
  floors: () => http.get("/lines/floors").then((r) => r.data),
};

// ─── Wizard — line throughput + material ETA (wizard-specific) ───────────────
export const wizardApi = {
  // Line throughput (capacity history)
  lineThroughput: (params) => http.get("/throughputs/line", { params }).then((r) => r.data),
  lineThroughputPicker: (params) =>
    http.get("/throughputs/line/picker", { params }).then((r) => r.data),
  upsertLineThroughput: (body) => http.post("/throughputs/line", body).then((r) => r.data),
  bulkLineThroughput: (body) => http.post("/throughputs/line/bulk", body).then((r) => r.data),

  // Throughput overrides (article × line)
  throughputMatrix: (params) =>
    http.get("/throughputs/matrix", { params }).then((r) => r.data),
  throughputOverrides: () => http.get("/throughputs/overrides").then((r) => r.data),
  createThroughputOverride: (body) =>
    http.post("/throughputs/overrides", body).then((r) => r.data),
  deleteThroughputOverride: (id) =>
    http.delete(`/throughputs/overrides/${id}`).then((r) => r.data),

  // Material ETA (wizard-routed path)
  materialEtas: (orderIds) =>
    http.get("/materials/etas", {
      params: orderIds?.length ? { order_ids: orderIds } : {},
    }).then((r) => r.data),
  upsertMaterialEta: (body) => http.put("/materials/etas", body).then((r) => r.data),
  importMaterialEta: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return http.post("/materials/etas/import", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data);
  },

  // New model scan
  newModelScan: (params) => http.get("/capacity/new-models/scan", { params }).then((r) => r.data),

  // Line capacity stats from ERP production report (N53-style query)
  lineCapacityStats: (params) =>
    http.get("/capacity/line-stats", { params }).then((r) => r.data),

  // Frequency-based line-model stats for Step 2 priority matrix (POST — articles in body)
  modelLineFrequency: ({ articles, ...queryParams } = {}) =>
    http.post(
      "/capacity/model-line-frequency",
      { articles: articles || [] },
      { params: queryParams },
    ).then((r) => r.data),

  // Line production (current orders on a specific line)
  lineProduction: (params) =>
    http.get("/capacity/line-production", { params }).then((r) => r.data),

  // Full line pool: EIP lines joined with BDepartment (dep_no, dep_name, line_type, floor_id)
  linePool: () =>
    http.get("/lines/pool").then((r) => r.data),

  // All GC/CM subcontractor departments from BDepartment
  gcDepartments: () =>
    http.get("/capacity/gc-departments").then((r) => r.data),

  // Line model affinity stats (restored for Tab 1 overview)
  lineModelStats: (params) =>
    http.get("/capacity/line-affinity", { params }).then((r) => r.data),

  // Classify orders as regular/gc using PDSCH + SCBB history
  classifyOrders: (body) =>
    http.post("/capacity/classify-orders", body).then((r) => r.data),

};

// ─── Schedule Periods ────────────────────────────────────────────────────────
export const periodsApi = {
  list: (params) => http.get("/periods", { params }).then((r) => r.data),
  create: (body) => http.post("/periods", body).then((r) => r.data),
};

// ─── Shoe model targets ──────────────────────────────────────────────────────
export const shoeTargetsApi = {
  list:       (params) => http.get("/shoe-targets", { params }).then((r) => r.data),
  create:     (body) => http.post("/shoe-targets", body).then((r) => r.data),
  update:     (id, body) => http.put(`/shoe-targets/${id}`, body).then((r) => r.data),
  remove:     (id) => http.delete(`/shoe-targets/${id}`).then((r) => r.data),
  preview:    (formData) =>
    http.post("/shoe-targets/preview", formData, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data),
  importData: (formData, params) =>
    http.post("/shoe-targets/import", formData, { params, headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data),
};

// ─── Events ─────────────────────────────────────────────────────────────────
export const eventsApi = {
  list: (params) => http.get("/capacity/events", { params }).then((r) => r.data),
  erpRecent: (params) => http.get("/capacity/events/erp", { params }).then((r) => r.data),
};

// ─── Wizard state (per-run persistence) ──────────────────────────────────────
export const wizardStateApi = {
  // Draft lifecycle
  createDraft: (label = "") => http.post("/runs/draft", { label }).then((r) => r.data),
  launch: (runId) => http.post(`/runs/${runId}/launch`).then((r) => r.data),

  // Step 1 — orders
  getOrders:    (runId) => http.get(`/runs/${runId}/wizard/orders`).then((r) => r.data),
  putOrders:    (runId, body) => http.put(`/runs/${runId}/wizard/orders`, body).then((r) => r.data),
  deleteOrder:  (runId, orderId) => http.delete(`/runs/${runId}/wizard/orders/${encodeURIComponent(orderId)}`).then((r) => r.data),

  // Step 2 — priorities
  getPriorities:   (runId) => http.get(`/runs/${runId}/wizard/priorities`).then((r) => r.data),
  putPriorities:   (runId, body) => http.put(`/runs/${runId}/wizard/priorities`, body).then((r) => r.data),
  patchPriorities: (runId, patches) => http.patch(`/runs/${runId}/wizard/priorities`, patches).then((r) => r.data),

  // Step 2 — capacities + working hours
  getCapacities:  (runId) => http.get(`/runs/${runId}/wizard/capacities`).then((r) => r.data),
  putCapacities:  (runId, body) => http.put(`/runs/${runId}/wizard/capacities`, body).then((r) => r.data),
  patchSettings:  (runId, body) => http.patch(`/runs/${runId}/wizard/settings`, body).then((r) => r.data),

  // Step 2 — new model targets
  getNewModelTargets:  (runId) => http.get(`/runs/${runId}/wizard/new-model-targets`).then((r) => r.data),
  putNewModelTargets:  (runId, body) => http.put(`/runs/${runId}/wizard/new-model-targets`, body).then((r) => r.data),
  importNewModelTargets: (runId, file) => {
    const fd = new FormData();
    fd.append("file", file);
    return http.post(`/runs/${runId}/wizard/new-model-targets/import`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data);
  },

  // Step 3 — material ETAs (per-run)
  getMaterialEtas:  (runId) => http.get(`/runs/${runId}/wizard/material-etas`).then((r) => r.data),
  putMaterialEtas:  (runId, body) => http.put(`/runs/${runId}/wizard/material-etas`, body).then((r) => r.data),
  patchMaterialEta: (runId, orderId, body) =>
    http.patch(`/runs/${runId}/wizard/material-etas/${encodeURIComponent(orderId)}`, body).then((r) => r.data),
  deleteMaterialEta: (runId, orderId) =>
    http.delete(`/runs/${runId}/wizard/material-etas/${encodeURIComponent(orderId)}`).then((r) => r.data),

  // Step 4 — GC dates (per-run)
  getGcDates:    (runId) => http.get(`/runs/${runId}/wizard/gc-dates`).then((r) => r.data),
  putGcDates:    (runId, body) => http.put(`/runs/${runId}/wizard/gc-dates`, body).then((r) => r.data),
  patchGcDate:   (runId, orderId, body) =>
    http.patch(`/runs/${runId}/wizard/gc-dates/${encodeURIComponent(orderId)}`, body).then((r) => r.data),
  deleteGcDate:  (runId, orderId) =>
    http.delete(`/runs/${runId}/wizard/gc-dates/${encodeURIComponent(orderId)}`).then((r) => r.data),

  // Wizard-in-progress (resume)
  getWizardInProgress: () =>
    http.get("/runs/wizard-in-progress").then((r) => r.data),
  saveWizardStep: (runId, step) =>
    http.patch(`/runs/${runId}/wizard-step`, { step }).then((r) => r.data),
  closeStaleWizardSessions: () =>
    http.post("/runs/wizard-close-stale").then((r) => r.data),

  // Step 6 — chunk edits bulk-save (legacy / full-replace)
  bulkSaveChunks: (runId, edits) =>
    http.post(`/runs/${runId}/chunks/bulk-save`, { edits }).then((r) => r.data),

  // Step 6 — single real-time edit (append to history)
  singleChunkEdit: (runId, edit) =>
    http.post(`/runs/${runId}/chunks/single-edit`, edit).then((r) => r.data),

  // Step 6 — chunk edit history
  getChunkEdits: (runId) =>
    http.get(`/runs/${runId}/chunks/user-edits`).then((r) => r.data),

  // Gene edit history
  getGeneEdits: (runId) =>
    http.get(`/runs/${runId}/gene-edits`).then((r) => r.data),
  toggleEditConstraint: (runId, editId, isConstraint) =>
    http.patch(`/runs/${runId}/gene-edits/${editId}/constraint`, { is_constraint: isConstraint }).then((r) => r.data),
};

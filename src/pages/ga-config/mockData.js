/**
 * Mock data for all steps in GA Config wizard
 * This allows testing the wizard without needing data from previous steps
 */

export const MOCK_REGULAR_ORDERS = [
  {
    order_id: "ORD001",
    order: {
      ARTICLE: "XL100",
      DAOMH_: "DIE-001",
      DAOMH: "DIE-001",
      XieMing_: "Classic White Low",
      XieMing: "Classic White Low",
      PAIRQTY: 500,
      DUEDT: "2026-07-15",
      XTMH_: "TOOL-001",
      DDMH_: "LAST-001",
      COLNO: "WHITE",
    },
  },
  {
    order_id: "ORD002",
    order: {
      ARTICLE: "XL101",
      DAOMH_: "DIE-002",
      DAOMH: "DIE-002",
      XieMing_: "Premium Black High",
      XieMing: "Premium Black High",
      PAIRQTY: 750,
      DUEDT: "2026-07-20",
      XTMH_: "TOOL-002",
      DDMH_: "LAST-002",
      COLNO: "BLACK",
    },
  },
  {
    order_id: "ORD003",
    order: {
      ARTICLE: "XL102",
      DAOMH_: "DIE-003",
      DAOMH: "DIE-003",
      XieMing_: "Urban Gray Mid",
      XieMing: "Urban Gray Mid",
      PAIRQTY: 600,
      DUEDT: "2026-07-25",
      XTMH_: "TOOL-003",
      DDMH_: "LAST-003",
      COLNO: "GRAY",
    },
  },
  {
    order_id: "ORD004",
    order: {
      ARTICLE: "XL103",
      DAOMH_: "DIE-004",
      DAOMH: "DIE-004",
      XieMing_: "Sport Red Low",
      XieMing: "Sport Red Low",
      PAIRQTY: 400,
      DUEDT: "2026-08-01",
      XTMH_: "TOOL-004",
      DDMH_: "LAST-004",
      COLNO: "RED",
    },
  },
  {
    order_id: "ORD005",
    order: {
      ARTICLE: "XL104",
      DAOMH_: "DIE-005",
      DAOMH: "DIE-005",
      XieMing_: "Navy Comfort Slip",
      XieMing: "Navy Comfort Slip",
      PAIRQTY: 550,
      DUEDT: "2026-08-05",
      XTMH_: "TOOL-005",
      DDMH_: "LAST-005",
      COLNO: "NAVY",
    },
  },
];

export const MOCK_GC_ORDERS = [
  {
    order_id: "GC001",
    order: {
      ARTICLE: "GC100",
      DAOMH_: "DIE-GC01",
      DAOMH: "DIE-GC01",
      XieMing_: "Partner Assembly A",
      XieMing: "Partner Assembly A",
      PAIRQTY: 1000,
      DUEDT: "2026-07-30",
      XTMH_: "TOOL-GC01",
      DDMH_: "LAST-GC01",
      COLNO: "MULTI",
    },
  },
  {
    order_id: "GC002",
    order: {
      ARTICLE: "GC101",
      DAOMH_: "DIE-GC02",
      DAOMH: "DIE-GC02",
      XieMing_: "Partner Assembly B",
      XieMing: "Partner Assembly B",
      PAIRQTY: 800,
      DUEDT: "2026-08-10",
      XTMH_: "TOOL-GC02",
      DDMH_: "LAST-GC02",
      COLNO: "MULTI",
    },
  },
  {
    order_id: "GC003",
    order: {
      ARTICLE: "GC102",
      DAOMH_: "DIE-GC03",
      DAOMH: "DIE-GC03",
      XieMing_: "Partner Assembly C",
      XieMing: "Partner Assembly C",
      PAIRQTY: 600,
      DUEDT: "2026-08-15",
      XTMH_: "TOOL-GC03",
      DDMH_: "LAST-GC03",
      COLNO: "MULTI",
    },
  },
];

export const MOCK_PRIORITY_CONFIG = {
  "XL100||DIE-001": {
    may_primary: ["LHGA1M01", "LHGA1M02"],
    may_secondary: ["LHGA2M01"],
    go_primary: ["LHGA1G01"],
  },
  "XL101||DIE-002": {
    may_primary: ["LHGA1M03", "LHGA1M04"],
    go_primary: ["LHGA1G02"],
  },
  "GC100||DIE-GC01": {
    gc_primary: ["EXTERNAL-PART-01"],
  },
};

export const MOCK_MATERIAL_ETA_OVERRIDES = {
  ORD001: "2026-07-10",
  ORD002: "2026-07-18",
  GC001: "2026-07-25",
};

export const MOCK_GC_DATE_OVERRIDES = {
  GC001: {
    start_date: "2026-07-25",
    end_date: "2026-07-29",
  },
  GC002: {
    start_date: "2026-08-05",
    end_date: "2026-08-09",
  },
};

export const MOCK_CAP_CHOICES = {
  regular: {
    "XL100||DIE-001": "HIGH",
    "XL101||DIE-002": "MEDIUM",
  },
  gc: {
    "GC100||DIE-GC01": "HIGH",
  },
  noHistRegular: {},
  noHistGc: {},
};

export const MOCK_WORKING_HOURS_PER_DAY = 8;

export const MOCK_IMPORTED_TARGET_QTY = {
  "XL100||DIE-001": {
    "LHGA1M01": 250,
    "LHGA1M02": 200,
    "LHGA1G01": 50,
  },
};

/**
 * Initialize mock data into state
 * Call this in GAConfigPage.jsx to populate all states with mock data
 */
export function initializeMockData() {
  return {
    regularOrders: MOCK_REGULAR_ORDERS,
    gcOrders: MOCK_GC_ORDERS,
    priorityConfig: MOCK_PRIORITY_CONFIG,
    materialEtaOverrides: MOCK_MATERIAL_ETA_OVERRIDES,
    gcDateOverrides: MOCK_GC_DATE_OVERRIDES,
    capChoices: MOCK_CAP_CHOICES,
    workingHoursPerDay: MOCK_WORKING_HOURS_PER_DAY,
    importedTargetQty: MOCK_IMPORTED_TARGET_QTY,
  };
}

// Vietnam timezone helpers (UTC+7)
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
// Returns a Date whose UTC fields == Vietnam local time
export const vnNow = () => new Date(Date.now() + VN_OFFSET_MS);
// Current date in Vietnam → "YYYY-MM-DD"
export const vnToday = () => vnNow().toISOString().slice(0, 10);
// Current year-month in Vietnam → "YYYY-MM"
export const vnMonth = () => vnNow().toISOString().slice(0, 7);

// Format date string to locale
export const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d + "T00:00:00Z").toLocaleDateString("vi-VN", { timeZone: "UTC" });
};

// Number with comma separator
export const fmtNum = (n) => {
  if (n == null) return "—";
  return Number(n).toLocaleString();
};

// Status → badge variant
export const statusVariant = (s) => {
  const map = {
    accepted: "success", done: "info", running: "warning",
    pending: "neutral", failed: "danger",
    on_time: "success", ontime: "success", late: "danger",
    ok: "success", warn: "warning", danger: "danger",
    P: "info", N: "purple", C: "success", H: "warning", R: "neutral",
  };
  return map[s] || "neutral";
};

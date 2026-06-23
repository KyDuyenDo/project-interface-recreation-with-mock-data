import { clsx } from "clsx";

// ─── Dialog ──────────────────────────────────────────────────────────────────
export function Dialog({ open, onClose, title, children, footer, width = 540 }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-slate-900/40 p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="animate-scale-in flex max-h-[90vh] flex-col rounded-2xl bg-white shadow-xl"
        style={{ width }}>
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
          <div className="flex-1 text-base font-semibold">{title}</div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
        </div>
        <div className="overflow-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

// ─── Drawer ──────────────────────────────────────────────────────────────────
export function Drawer({ open, onClose, title, subtitle, children, headerExtras, width = 600 }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 animate-fade-in bg-slate-900/40" onClick={onClose} />
      <div
        className="fixed inset-y-0 right-0 z-50 flex animate-slide-in-right flex-col bg-white shadow-xl"
        style={{ width }}>
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
          <div className="flex-1">
            <div className="text-base font-semibold">{title}</div>
            {subtitle && <div className="mt-0.5 text-sm text-slate-500">{subtitle}</div>}
          </div>
          {headerExtras}
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">✕</button>
        </div>
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </>
  );
}

export function DrawerSection({ title, children }) {
  return (
    <div className="border-b border-slate-100 px-6 py-5">
      {title && <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">{title}</h4>}
      {children}
    </div>
  );
}

// ─── KV Grid ─────────────────────────────────────────────────────────────────
export function KVGrid({ items }) {
  return (
    <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-sm">
      {items.map(([k, v]) => (
        <>
          <dt key={k + "k"} className="font-medium text-slate-500">{k}</dt>
          <dd key={k + "v"} className="text-slate-800">{v ?? "—"}</dd>
        </>
      ))}
    </dl>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={clsx("flex gap-0.5 border-b border-slate-200 px-6", className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={clsx(
            "px-3 py-2.5 text-sm font-medium transition",
            value === t.value
              ? "border-b-2 border-primary-600 text-primary-700"
              : "text-slate-500 hover:text-slate-800"
          )}>
          {t.label}
          {t.count != null && <span className="ml-1.5 text-xs text-slate-400">({t.count})</span>}
        </button>
      ))}
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export function Pagination({ page, pageSize, total, onChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between px-2 py-3 text-sm text-slate-500">
      <span>
        Showing <strong className="text-slate-800">{(page - 1) * pageSize + 1}</strong>–
        <strong className="text-slate-800">{Math.min(page * pageSize, total)}</strong> of{" "}
        <strong className="text-slate-800">{total.toLocaleString()}</strong>
      </span>
      <div className="flex gap-1">
        <button disabled={page <= 1} onClick={() => onChange(page - 1)}
          className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-40">‹</button>
        <span className="px-3 py-1">{page} / {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => onChange(page + 1)}
          className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-40">›</button>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
import { createContext, useCallback, useContext, useState } from "react";
const ToastCtx = createContext(null);
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((msg, kind = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  const bg = { success: "bg-green-800", error: "bg-red-800", warning: "bg-amber-700", info: "bg-slate-800" };
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="fixed right-4 top-4 z-[200] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id}
            className={clsx("animate-slide-in-right flex min-w-[280px] max-w-sm items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg", bg[t.kind] ?? bg.info)}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

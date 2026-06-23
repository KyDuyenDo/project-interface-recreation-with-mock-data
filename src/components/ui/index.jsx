import { clsx } from "clsx";

const variants = {
  primary: "bg-primary-600 text-white border-primary-600 hover:bg-primary-700",
  ghost:   "bg-transparent border-transparent hover:bg-slate-100",
  danger:  "bg-danger-600 text-white border-danger-600 hover:bg-red-700",
  default: "bg-white text-slate-800 border-slate-300 hover:bg-slate-50",
};
const sizes = {
  sm: "px-2 py-1 text-xs gap-1",
  md: "px-3 py-1.5 text-sm gap-1.5",
  lg: "px-4 py-2 text-sm gap-2",
  icon: "p-1.5",
};

export function Button({
  children, variant = "default", size = "md",
  className, disabled, onClick, type = "button", title,
}) {
  return (
    <button
      type={type} title={title}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "inline-flex items-center rounded-md border font-medium transition focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-1 whitespace-nowrap",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant] ?? variants.default,
        sizes[size] ?? sizes.md,
        className
      )}>
      {children}
    </button>
  );
}

export function Badge({ children, variant = "neutral", className }) {
  const cls = {
    success: "bg-green-50 text-green-700 border-green-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    danger:  "bg-red-50 text-red-700 border-red-200",
    info:    "bg-blue-50 text-blue-700 border-blue-200",
    neutral: "bg-slate-100 text-slate-600 border-slate-200",
    purple:  "bg-violet-50 text-violet-700 border-violet-200",
  };
  return (
    <span className={clsx(
      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
      cls[variant] ?? cls.neutral, className
    )}>
      {children}
    </span>
  );
}

export function Dot({ variant = "neutral" }) {
  const cls = {
    success: "bg-green-500", warning: "bg-amber-500",
    danger: "bg-red-500", info: "bg-blue-500", neutral: "bg-slate-400", purple: "bg-violet-500",
  };
  return <span className={clsx("inline-block h-1.5 w-1.5 rounded-full", cls[variant] ?? cls.neutral)} />;
}

export function Spinner({ size = 24 }) {
  return (
    <div
      className="animate-spin rounded-full border-2 border-blue-100 border-t-primary-600"
      style={{ width: size, height: size }}
    />
  );
}

export function Input({ className, ...props }) {
  return (
    <input
      className={clsx(
        "block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm",
        "placeholder:text-slate-400 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-50",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }) {
  return (
    <select
      className={clsx(
        "block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm",
        "focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-50",
        className
      )}
      {...props}>
      {children}
    </select>
  );
}

export function Card({ children, className }) {
  return (
    <div className={clsx("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }) {
  return (
    <div className={clsx("flex items-center gap-3 border-b border-slate-100 px-5 py-4", className)}>
      {children}
    </div>
  );
}

export function CardBody({ children, className }) {
  return <div className={clsx("p-5", className)}>{children}</div>;
}

export function EmptyState({ icon: Icon, title, message }) {
  return (
    <div className="grid place-items-center py-16 text-center text-slate-400">
      {Icon && <Icon size={32} strokeWidth={1.5} className="mb-3" />}
      <p className="font-semibold text-slate-600">{title || "Nothing to show"}</p>
      {message && <p className="mt-1 text-sm">{message}</p>}
    </div>
  );
}

export function KpiCard({ label, value, delta, deltaUp, deltaText }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</div>
      <div className="mt-1.5 text-3xl font-bold tracking-tight">{value}</div>
      {deltaText && (
        <div className={clsx("mt-1.5 flex items-center gap-1 text-xs font-medium",
          deltaUp ? "text-green-600" : "text-red-600")}>
          {deltaText}
        </div>
      )}
    </div>
  );
}

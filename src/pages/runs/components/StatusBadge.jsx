export function deriveRunState(run) {
  if (run.lifecycle_status) return run.lifecycle_status;
  if (run.is_accepted && !run.superseded_at) return "active";
  if (run.is_accepted &&  run.superseded_at) return "superseded";
  if (run.status === "done")                 return "draft";
  return run.status;
}

const STATE_MAP = {
  draft:      { cls: "bg-gray-100 text-gray-500",  label: "Nháp" },
  accepted:   { cls: "bg-blue-100 text-blue-700",  label: "Đang duyệt" },
  verifying:  { cls: "bg-yellow-100 text-yellow-800 animate-pulse", label: "Đang đối soát" },
  active:     { cls: "bg-green-100 text-green-700 font-semibold border border-green-200", label: "Hiện hành (Active)" },
  archived:   { cls: "bg-gray-200 text-gray-600",  label: "Lưu trữ" },
  superseded: { cls: "bg-gray-100 text-gray-400",  label: "Đã thay thế" },
  done:       { cls: "bg-blue-100 text-blue-700",  label: "Xong" },
  running:    { cls: "bg-amber-100 text-amber-700",  label: "Đang chạy" },
  pending:    { cls: "bg-gray-100 text-gray-600",  label: "Chờ" },
  failed:     { cls: "bg-red-100 text-red-700",    label: "Lỗi" },
};

export default function StatusBadge({ status, run }) {
  const key = run ? deriveRunState(run) : status;
  const m = STATE_MAP[key] ?? { cls: "bg-gray-100 text-gray-600", label: key };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${m.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {m.label}
    </span>
  );
}

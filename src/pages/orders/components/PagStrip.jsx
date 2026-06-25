export default function PagStrip({ page, total, pageSize, onChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center gap-2 border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)}
        className="rounded border border-slate-200 px-2 py-0.5 disabled:opacity-40 hover:bg-slate-50">‹</button>
      <span>Page {page} / {totalPages} &nbsp;·&nbsp; {total.toLocaleString()} rows</span>
      <button disabled={page >= totalPages} onClick={() => onChange(page + 1)}
        className="rounded border border-slate-200 px-2 py-0.5 disabled:opacity-40 hover:bg-slate-50">›</button>
    </div>
  );
}

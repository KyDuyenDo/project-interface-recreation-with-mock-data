import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shoeTargetsApi } from "../../api";
import { PageLayout, PageContent, Topbar } from "../../components/layout";
import { Spinner } from "../../components/ui";
import { useToast } from "../../components/ui/overlays";
import { Search, Plus, Upload, Pencil, Trash2, Check, X } from "lucide-react";

// ─── Auto-detect columns from a given header row ──────────────────────────────
function autoDetect(row) {
  const lc   = row.map(c => c.toLowerCase());
  const pick = (checks) => {
    const i = lc.findIndex(c => checks.some(k => c.includes(k)));
    return i >= 0 ? row[i] : "";
  };
  return {
    colModel: pick(["tên", "giày", "model name", "model_name"]),
    colPairs: pick(["sl", "đ/h", "d/h", "pairs", "sản lượng"]),
    colNote:  pick(["ghi", "note", "chú"]),
  };
}

export default function ShoeModelTargetPage() {
  const [search,       setSearch]      = useState("");
  const [addRow,       setAddRow]      = useState(null);
  const [editId,       setEditId]      = useState(null);
  const [editRow,      setEditRow]     = useState({});

  // Import flow
  const [importStep,   setImportStep]  = useState(null); // null | "pick" | "cols" | "done"
  const [importFile,   setImportFile]  = useState(null);
  const [allRows,      setAllRows]     = useState([]);   // raw rows from preview
  const [headerRowIdx, setHeaderRowIdx]= useState(0);
  const [colModel,     setColModel]    = useState("");
  const [colPairs,     setColPairs]    = useState("");
  const [colNote,      setColNote]     = useState("");
  const [upsert,       setUpsert]      = useState(true);
  const [importResult, setImportResult]= useState(null);
  const importFileRef  = useRef(null);

  const toast = useToast();
  const qc    = useQueryClient();

  // ── Derived ────────────────────────────────────────────────────────────────
  const currentColumns = allRows[headerRowIdx] || [];

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["shoe-targets", search],
    queryFn:  () => shoeTargetsApi.list({ q: search || undefined }),
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: shoeTargetsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shoe-targets"] }); setAddRow(null); toast("Đã thêm", "success"); },
    onError:   (e) => toast(e.response?.data?.detail || "Lỗi", "error"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...body }) => shoeTargetsApi.update(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shoe-targets"] }); setEditId(null); toast("Đã cập nhật", "success"); },
    onError:   (e) => toast(e.response?.data?.detail || "Lỗi", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: shoeTargetsApi.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shoe-targets"] }); toast("Đã xoá", "success"); },
    onError:   (e) => toast(e.response?.data?.detail || "Lỗi", "error"),
  });

  // ── Add / Edit ─────────────────────────────────────────────────────────────
  const confirmAdd = () => {
    if (!addRow.model_name.trim() || !addRow.pairs_per_hour) { toast("Thiếu tên giày hoặc SL", "error"); return; }
    createMut.mutate({ model_name: addRow.model_name.trim(), pairs_per_hour: +addRow.pairs_per_hour, note: addRow.note || null });
  };

  const confirmEdit = () => {
    if (!editRow.model_name || !editRow.pairs_per_hour) return;
    updateMut.mutate({ id: editId, model_name: editRow.model_name, pairs_per_hour: +editRow.pairs_per_hour, note: editRow.note || null });
  };

  // ── Import ─────────────────────────────────────────────────────────────────
  const handleImportFile = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setImportFile(f);
    const fd = new FormData();
    fd.append("file", f);
    try {
      const res = await shoeTargetsApi.preview(fd);
      const rows = res.rows || [];
      setAllRows(rows);
      setHeaderRowIdx(0);
      const detected = autoDetect(rows[0] || []);
      setColModel(detected.colModel);
      setColPairs(detected.colPairs);
      setColNote(detected.colNote);
      setImportStep("cols");
    } catch (err) {
      toast(err.response?.data?.detail || "Lỗi đọc file", "error");
    }
  };

  const handleHeaderRowChange = (idx) => {
    setHeaderRowIdx(idx);
    const detected = autoDetect(allRows[idx] || []);
    setColModel(detected.colModel);
    setColPairs(detected.colPairs);
    setColNote(detected.colNote);
  };

  const confirmImport = async () => {
    if (!colModel) { toast("Chọn cột tên giày", "error"); return; }
    const fd = new FormData();
    fd.append("file", importFile);
    try {
      const res = await shoeTargetsApi.importData(fd, {
        col_model:  colModel,
        ...(colPairs ? { col_pairs: colPairs } : {}),
        ...(colNote  ? { col_note:  colNote  } : {}),
        header_row: headerRowIdx,
        upsert,
      });
      setImportResult(res);
      setImportStep("done");
      qc.invalidateQueries({ queryKey: ["shoe-targets"] });
    } catch (err) {
      toast(err.response?.data?.detail || "Lỗi import", "error");
    }
  };

  const closeImport = () => {
    setImportStep(null); setImportFile(null); setImportResult(null); setAllRows([]);
    if (importFileRef.current) importFileRef.current.value = "";
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <PageLayout>
      <Topbar title="Mục tiêu dạng giày" subtitle="Model name · Đôi/giờ · Ghi chú">
        <button
          onClick={() => { setImportStep("pick"); setTimeout(() => importFileRef.current?.click(), 50); }}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          <Upload size={14} /> Import Excel
        </button>
        <button
          onClick={() => { if (!addRow) setAddRow({ model_name: "", pairs_per_hour: "", note: "" }); }}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
        >
          <Plus size={14} /> Thêm mới
        </button>
      </Topbar>

      <input ref={importFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />

      {/* ── Column-selection modal ── */}
      {importStep === "cols" && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 flex flex-col max-h-[90vh]">
            <div className="text-base font-semibold mb-1 shrink-0">Chọn cột dữ liệu</div>
            <div className="text-sm text-slate-500 mb-4 shrink-0">{importFile?.name}</div>

            {/* Header row picker */}
            <div className="shrink-0 mb-4">
              <div className="text-sm font-medium text-slate-700 mb-2">
                Hàng tiêu đề — nhấp vào hàng chứa tên cột:
              </div>
              <div className="overflow-auto rounded-lg border border-slate-200 max-h-44">
                <table className="w-full text-xs border-collapse">
                  <tbody>
                    {allRows.map((row, i) => (
                      <tr
                        key={i}
                        onClick={() => handleHeaderRowChange(i)}
                        className={`cursor-pointer transition-colors ${
                          headerRowIdx === i
                            ? "bg-blue-100 hover:bg-blue-100"
                            : i % 2 === 0 ? "bg-white hover:bg-slate-50" : "bg-slate-50 hover:bg-slate-100"
                        }`}
                      >
                        <td className="border-b border-slate-100 w-8 px-2 py-1.5 text-center">
                          <input
                            type="radio"
                            name="header_row"
                            readOnly
                            checked={headerRowIdx === i}
                            className="accent-blue-600"
                          />
                        </td>
                        <td className={`border-b border-slate-100 w-10 px-2 py-1.5 font-medium ${headerRowIdx === i ? "text-blue-700" : "text-slate-400"}`}>
                          {i + 1}
                        </td>
                        {row.map((cell, j) => (
                          <td key={j} className={`border-b border-slate-100 px-2 py-1.5 max-w-[140px] truncate ${headerRowIdx === i ? "font-semibold text-blue-800" : "text-slate-600"}`}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Column selectors */}
            <div className="shrink-0 grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "Cột tên giày *", val: colModel, set: setColModel },
                { label: "Cột SL (Đ/H)",  val: colPairs, set: setColPairs },
                { label: "Cột ghi chú",    val: colNote,  set: setColNote  },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
                  <select value={val} onChange={e => set(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">-- Không chọn --</option>
                    {currentColumns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700 mb-5 shrink-0 cursor-pointer select-none">
              <input type="checkbox" checked={upsert} onChange={e => setUpsert(e.target.checked)} className="rounded" />
              Cập nhật bản ghi đã có (upsert)
            </label>

            <div className="flex justify-end gap-2 shrink-0">
              <button onClick={closeImport} className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50">Huỷ</button>
              <button onClick={confirmImport} disabled={!colModel}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
                Nhập dữ liệu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Result modal ── */}
      {importStep === "done" && importResult && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="text-base font-semibold mb-4">Import hoàn tất</div>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: "Thêm mới", val: importResult.inserted, cls: "text-green-600" },
                { label: "Cập nhật", val: importResult.updated,  cls: "text-blue-600"  },
                { label: "Bỏ qua",   val: importResult.skipped,  cls: "text-slate-500" },
              ].map(({ label, val, cls }) => (
                <div key={label} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <div className={`text-2xl font-bold ${cls}`}>{val}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
            <button onClick={closeImport} className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* ── Search bar ── */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-full border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Tìm tên giày…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <span className="text-xs text-slate-500">{items.length} mục</span>
      </div>

      {/* ── Table ── */}
      <PageContent className="bg-slate-50">
        <div className="p-4">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center"><Spinner size={32} /></div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left font-semibold text-slate-600 w-[42%]">Tên giày</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600 w-[12%]">Đ/H</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Ghi chú</th>
                    <th className="px-4 py-3 w-[90px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {/* Inline add row */}
                  {addRow && (
                    <tr className="bg-blue-50 border-b border-slate-200">
                      <td className="px-3 py-2">
                        <input autoFocus value={addRow.model_name}
                          onChange={e => setAddRow({ ...addRow, model_name: e.target.value })}
                          onKeyDown={e => e.key === "Enter" && confirmAdd()}
                          className="w-full rounded border border-blue-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Tên giày…" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min={1} value={addRow.pairs_per_hour}
                          onChange={e => setAddRow({ ...addRow, pairs_per_hour: e.target.value })}
                          onKeyDown={e => e.key === "Enter" && confirmAdd()}
                          className="w-full rounded border border-blue-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="160" />
                      </td>
                      <td className="px-3 py-2">
                        <input value={addRow.note}
                          onChange={e => setAddRow({ ...addRow, note: e.target.value })}
                          onKeyDown={e => e.key === "Enter" && confirmAdd()}
                          className="w-full rounded border border-blue-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Ghi chú…" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={confirmAdd} disabled={createMut.isPending}
                            className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                            <Check size={13} />
                          </button>
                          <button onClick={() => setAddRow(null)}
                            className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-50">
                            <X size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {items.length === 0 && !addRow ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-slate-400">
                        Chưa có dữ liệu — thêm mới hoặc import Excel
                      </td>
                    </tr>
                  ) : items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      {editId === item.id ? (
                        <>
                          <td className="px-3 py-2">
                            <input autoFocus value={editRow.model_name}
                              onChange={e => setEditRow({ ...editRow, model_name: e.target.value })}
                              onKeyDown={e => e.key === "Enter" && confirmEdit()}
                              className="w-full rounded border border-blue-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min={1} value={editRow.pairs_per_hour}
                              onChange={e => setEditRow({ ...editRow, pairs_per_hour: e.target.value })}
                              onKeyDown={e => e.key === "Enter" && confirmEdit()}
                              className="w-full rounded border border-blue-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          </td>
                          <td className="px-3 py-2">
                            <input value={editRow.note}
                              onChange={e => setEditRow({ ...editRow, note: e.target.value })}
                              onKeyDown={e => e.key === "Enter" && confirmEdit()}
                              className="w-full rounded border border-blue-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={confirmEdit} disabled={updateMut.isPending}
                                className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                                <Check size={13} />
                              </button>
                              <button onClick={() => setEditId(null)}
                                className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-50">
                                <X size={13} />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2.5 font-medium text-slate-800">{item.model_name}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-700">{item.pairs_per_hour}</td>
                          <td className="px-4 py-2.5 text-slate-500">{item.note || "—"}</td>
                          <td className="px-4 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => { setEditId(item.id); setEditRow({ model_name: item.model_name, pairs_per_hour: item.pairs_per_hour, note: item.note || "" }); }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => { if (window.confirm(`Xoá "${item.model_name}"?`)) deleteMut.mutate(item.id); }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PageContent>
    </PageLayout>
  );
}

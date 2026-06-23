import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Check, AlertTriangle, Info, Loader2, Calendar } from "lucide-react";
import { useRunDetail, useAcceptRun, useSchedulePeriods, useCreatePeriod, useRunGenes } from "../../../hooks/useRuns";
import { wizardStateApi } from "../../../api";
import { vnNow } from "../../../utils";

const BTN    = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_LG = "inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border text-base font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const INPUT  = "px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors w-full";
const BADGE  = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium";
const NEW_SENTINEL = "__new__";

export default function Step7Confirm({ runId, draftRunId, label, onPrev }) {
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();
  const [mode,             setMode]             = useState("draft"); // 'draft' | 'accept'
  const [note,             setNote]             = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [newLabel, setNewLabel] = useState(() => {
    const d = vnNow();
    return `Lịch chính thức T${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
  });
  const [newStart, setNewStart] = useState("");
  const [newEnd,   setNewEnd]   = useState("");

  const acceptMutation = useAcceptRun();
  const { mutate: createPeriod, isPending: isCreating } = useCreatePeriod();
  const { data: runData } = useRunDetail(runId);
  const { data: periodsData } = useSchedulePeriods();
  const { data: genes } = useRunGenes(runId);

  const periods  = periodsData?.items || periodsData || [];
  const isDone   = runData?.status === "done";
  const isNew    = selectedPeriodId === NEW_SENTINEL;
  const isPendingAccept = acceptMutation.isPending || isCreating;

  useEffect(() => {
    if (isNew && genes && genes.length > 0) {
      let minDate = null, maxDate = null;
      const raw = Array.isArray(genes) ? genes : (genes?.items ?? genes?.genes ?? []);
      raw.forEach(g => {
        [g.sew_start, g.sew_end, g.go_start, g.go_end].filter(Boolean).forEach(d => {
          const s = d.slice(0, 10);
          if (!minDate || s < minDate) minDate = s;
          if (!maxDate || s > maxDate) maxDate = s;
        });
      });
      if (minDate) setNewStart(minDate);
      if (maxDate) setNewEnd(maxDate);
    }
  }, [isNew, genes]);

  const periodValid = (selectedPeriodId && !isNew) || (isNew && newLabel && newStart && newEnd);
  const canDraft    = isDone && !isPendingAccept;
  const canConfirm  = isDone && !isPendingAccept && periodValid;

  async function handleDraft() {
    // Close ALL active wizard sessions (current + any stale ones from previous sessions)
    await wizardStateApi.closeStaleWizardSessions().catch(() => {});
    queryClient.setQueryData(["wizard-in-progress"], null);
    queryClient.invalidateQueries({ queryKey: ["wizard-in-progress"] });
    navigate("/runs");
  }

  function handleAccept() {
    const doAccept = (period_id) =>
      acceptMutation.mutate({ id: runId, note, period_id }, {
        onSuccess: async () => {
          await wizardStateApi.closeStaleWizardSessions().catch(() => {});
          queryClient.setQueryData(["wizard-in-progress"], null);
          queryClient.invalidateQueries({ queryKey: ["wizard-in-progress"] });
          navigate("/runs");
        },
      });

    if (isNew) {
      createPeriod(
        { label: newLabel, period_start: newStart, period_end: newEnd },
        { onSuccess: (p) => doAccept(p.id) },
      );
    } else {
      doAccept(+selectedPeriodId);
    }
  }

  if (!runId) return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm max-w-2xl mx-auto">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="text-sm font-semibold text-gray-900">Bước 7 · Xác nhận</div>
      </div>
      <div className="p-5">
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm bg-amber-50 text-amber-800 border border-amber-100">
          <Info size={14} className="shrink-0 mt-0.5" /> Chưa có lịch — hãy chạy lịch ở bước trước
        </div>
      </div>
      <div className="flex items-center gap-3 px-5 py-3 border-t border-gray-100 bg-gray-50">
        <button className={`${BTN} bg-white text-gray-700 border-gray-200 hover:bg-gray-50`} onClick={onPrev}>
          <ChevronLeft size={14} /> Bước trước
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm max-w-2xl mx-auto">
      {/* Head */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="text-sm font-semibold text-gray-900">Bước 7 · Xác nhận</div>
        <div className="text-xs text-gray-500 mt-0.5">Chọn cách lưu kết quả lịch này</div>
      </div>

      {/* Mode tabs */}
      <div className="flex border-b border-gray-100 bg-gray-50/50">
        {[
          { key: "draft",  label: "Lưu lịch nháp",   desc: "Lưu để xem xét, chưa áp dụng" },
          { key: "accept", label: "Duyệt & Xác nhận", desc: "Đẩy trực tiếp vào kế hoạch" },
        ].map(m => (
          <button key={m.key}
            className={`flex-1 px-4 py-3 text-left border-b-2 transition-colors ${
              mode === m.key
                ? "border-blue-600 bg-white"
                : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
            onClick={() => setMode(m.key)}>
            <div className={`text-xs font-semibold ${mode === m.key ? "text-blue-700" : ""}`}>{m.label}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{m.desc}</div>
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="p-6">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: "Run ID",      value: `#${runId}` },
            { label: "Đơn đã lập", value: runData?.scheduled_count ?? "—" },
            { label: "On-time",    value: runData?.on_time_pct != null ? `${runData.on_time_pct}%` : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-blue-50 rounded-xl p-4 text-center border border-blue-100">
              <div className="text-xs text-blue-500 uppercase tracking-wide">{label}</div>
              <div className="text-2xl font-bold text-blue-900 mt-1">{value}</div>
            </div>
          ))}
        </div>

        {/* kv details */}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm mb-5">
          <dt className="text-gray-500">Label</dt>
          <dd className="font-medium text-gray-900"><code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{runData?.label ?? label}</code></dd>

          <dt className="text-gray-500">Trạng thái</dt>
          <dd>
            <span className={`${BADGE} ${runData?.status === "done" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {runData?.status ?? "—"}
            </span>
          </dd>

          <dt className="text-gray-500">Thời gian</dt>
          <dd className="font-medium text-gray-900">{runData?.runtime_seconds != null ? `${runData.runtime_seconds.toFixed(1)}s` : "—"}</dd>

          <dt className="text-gray-500">Fitness</dt>
          <dd className="font-medium text-gray-900">{runData?.fitness?.toLocaleString() ?? "—"}</dd>
        </dl>

        {/* Draft mode */}
        {mode === "draft" && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm bg-blue-50 text-blue-800 border border-blue-100">
              <Info size={14} className="shrink-0 mt-0.5" />
              Lịch sẽ được lưu vào tab <strong>Lịch nháp</strong>. Người quản lý có thể xem xét và duyệt sau.
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Ghi chú (tùy chọn)</label>
              <input className={INPUT} value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú cho người duyệt…" />
            </div>
            <button
              className={`${BTN_LG} w-full justify-center bg-blue-600 text-white border-blue-600 hover:bg-blue-700`}
              disabled={!canDraft}
              onClick={handleDraft}>
              {canDraft
                ? <><Check size={15} /> Lưu lịch nháp</>
                : <><Loader2 size={15} className="animate-spin" /> Đang chờ lịch hoàn thành…</>}
            </button>
            {!isDone && <div className="text-xs text-center text-gray-400">Chờ GA chạy xong để lưu</div>}
          </div>
        )}

        {/* Accept mode */}
        {mode === "accept" && (
          <div className="space-y-4">
            {/* Period selector */}
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1.5">
                <Calendar size={12} /> Giai đoạn lập lịch <span className="text-red-500">*</span>
              </label>
              <select className={INPUT} value={selectedPeriodId} onChange={e => setSelectedPeriodId(e.target.value)}>
                <option value="">— Chọn giai đoạn —</option>
                {periods.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.label}{p.period_start && p.period_end ? ` · ${p.period_start.slice(0, 10)} – ${p.period_end.slice(0, 10)}` : ""}
                  </option>
                ))}
                <option value={NEW_SENTINEL}>+ Tạo giai đoạn mới…</option>
              </select>
            </div>

            {isNew && (
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 space-y-2">
                <div className="text-xs font-medium text-violet-700">Giai đoạn mới</div>
                <input className={INPUT} value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="VD: Lịch chính thức T05/2026" />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-600 block mb-1">Ngày bắt đầu</label>
                    <input type="date" className={INPUT} value={newStart} onChange={e => setNewStart(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 block mb-1">Ngày kết thúc</label>
                    <input type="date" className={INPUT} value={newEnd} onChange={e => setNewEnd(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Ghi chú (tùy chọn)</label>
              <input className={INPUT} value={note} onChange={e => setNote(e.target.value)} placeholder="Lý do duyệt hoặc ghi chú kế hoạch…" />
            </div>

            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm bg-amber-50 text-amber-800 border border-amber-100">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              Sau khi duyệt, lịch chuyển sang trạng thái <strong>đã duyệt</strong>. Quản trị viên xác nhận để kích hoạt.
            </div>

            {acceptMutation.isError && (
              <div className="text-sm text-red-600">{acceptMutation.error?.response?.data?.detail ?? "Lỗi khi duyệt"}</div>
            )}

            <button
              className={`${BTN_LG} w-full justify-center bg-green-600 text-white border-green-600 hover:bg-green-700`}
              disabled={!canConfirm}
              onClick={handleAccept}>
              {isPendingAccept
                ? <><Loader2 size={15} className="animate-spin" /> Đang xác nhận…</>
                : <><Check size={15} /> {isNew ? "Tạo giai đoạn & Duyệt ngay" : "Duyệt & đẩy vào kế hoạch"}</>}
            </button>
            {!isDone && <div className="text-xs text-center text-gray-400">Chờ lịch hoàn thành để duyệt</div>}
            {isDone && !periodValid && <div className="text-xs text-center text-amber-600">Vui lòng chọn hoặc tạo giai đoạn</div>}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 px-5 py-3 border-t border-gray-100 bg-gray-50">
        <button className={`${BTN} bg-white text-gray-700 border-gray-200 hover:bg-gray-50`} onClick={onPrev}>
          <ChevronLeft size={14} /> Bước trước
        </button>
      </div>
    </div>
  );
}

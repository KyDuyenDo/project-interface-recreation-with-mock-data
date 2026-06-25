import { Save } from "lucide-react";

export default function PendingSaveBar({ queue, onSave, onDiscard, isSaving }) {
  const count = Object.keys(queue).length;
  if (!count) return null;
  return (
    <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-800">
      <span className="font-medium">{count} row{count > 1 ? "s" : ""} edited — unsaved</span>
      <button
        onClick={onSave}
        disabled={isSaving}
        className="flex items-center gap-1 rounded-full bg-amber-600 px-3 py-1 text-white hover:bg-amber-700 disabled:opacity-50"
      >
        <Save size={11} /> {isSaving ? "Saving…" : "Save all"}
      </button>
      <button onClick={onDiscard} className="text-amber-600 hover:underline">Discard</button>
    </div>
  );
}

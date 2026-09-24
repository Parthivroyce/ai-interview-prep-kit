import React, { useState } from "react";
import { api } from "../api";
import { X, Layers, AlertCircle, CheckCircle, Upload } from "lucide-react";
import { batchInputSchema } from "../../packages/shared/schemas";

interface BatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBatchProcessed: () => void;
}

export const BatchModal: React.FC<BatchModalProps> = ({ isOpen, onClose, onBatchProcessed }) => {
  const [jsonText, setJsonText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setJsonText((event.target?.result as string) || "");
      setError(null);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const parsed = JSON.parse(jsonText);
      const val = batchInputSchema.safeParse(parsed);
      if (!val.success) {
        throw new Error(`Batch format error: ${val.error.issues.map(i => i.message).join(", ")}`);
      }

      const cases = val.data;
      let count = 0;
      for (const item of cases) {
        await api.kits.create({
          jd: item.jd,
          company_url: item.company_url,
          days: item.days,
        });
        count++;
      }

      setSuccessCount(count);
      setTimeout(() => {
        onBatchProcessed();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || "Failed to process batch cases.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600/20 text-violet-400 flex items-center justify-center border border-violet-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Upload Batch Cases</h2>
              <p className="text-xs text-slate-400">Queue multiple JD and company cases</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-sm flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {successCount !== null && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-sm flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-400" />
            <span>Successfully queued {successCount} kit generation job(s)!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Select JSON File or Paste JSON Array
            </label>
            <div className="mb-3">
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
              />
            </div>
            <textarea
              required
              rows={8}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder={`[\n  {\n    "id": "case-01",\n    "jd": "...",\n    "company_url": "https://example.com",\n    "days": 5\n  }\n]`}
              className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs font-mono placeholder-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !jsonText.trim()}
              className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-violet-900 text-white text-sm font-medium transition-all shadow-md shadow-violet-600/30 flex items-center space-x-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>{loading ? "Queueing..." : "Submit Batch"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

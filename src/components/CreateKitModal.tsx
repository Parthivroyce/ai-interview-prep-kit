import React, { useState } from "react";
import { api } from "../api";
import { X, Sparkles, AlertCircle, Globe, Calendar, FileText } from "lucide-react";

interface CreateKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKitCreated: (kitId: string) => void;
}

export const CreateKitModal: React.FC<CreateKitModalProps> = ({ isOpen, onClose, onKitCreated }) => {
  const [jd, setJd] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [days, setDays] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let formattedUrl = companyUrl.trim();
      if (!/^https?:\/\//i.test(formattedUrl)) {
        formattedUrl = `https://${formattedUrl}`;
      }

      const res = await api.kits.create({
        jd: jd.trim(),
        company_url: formattedUrl,
        days: Number(days),
      });

      onKitCreated(res.kitId);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to initiate kit creation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Create AI Interview Prep Kit</h2>
              <p className="text-xs text-slate-400">Multi-stage crawler, coverage verification &amp; scheduling</p>
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

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label className="flex items-center justify-between text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              <span className="flex items-center space-x-1.5">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>Job Description Text</span>
              </span>
              <span className="text-[11px] text-slate-500 font-normal">Strictly grounded extraction</span>
            </label>
            <textarea
              required
              rows={6}
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste the full job description or brief requirements here..."
              className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors font-mono text-xs leading-relaxed"
            />
            <p className="text-xs text-slate-500 mt-1">
              Deterministic note: If a short or thin JD is entered, only explicit requirements are extracted.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                <Globe className="w-4 h-4 text-indigo-400" />
                <span>Company Website URL</span>
              </label>
              <input
                type="text"
                required
                value={companyUrl}
                onChange={(e) => setCompanyUrl(e.target.value)}
                placeholder="https://acme.example.com"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span>Days Before Interview</span>
              </label>
              <input
                type="number"
                min={1}
                max={90}
                required
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>
          </div>

          <div className="pt-3 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !jd || !companyUrl}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white text-sm font-medium transition-all shadow-md shadow-indigo-600/30 flex items-center space-x-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{loading ? "Launching Pipeline..." : "Generate Kit"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

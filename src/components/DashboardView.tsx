import React, { useEffect, useState } from "react";
import { api } from "../api";
import { StoredKit } from "../../packages/shared/types";
import { Sparkles, Plus, Layers, Trash2, ArrowRight, Clock, Calendar, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface DashboardViewProps {
  onSelectKit: (kitId: string) => void;
  onOpenCreateModal: () => void;
  onOpenBatchModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onSelectKit,
  onOpenCreateModal,
  onOpenBatchModal,
}) => {
  const [kits, setKits] = useState<StoredKit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadKits = async () => {
    try {
      setLoading(true);
      const res = await api.kits.list();
      setKits(res.kits);
    } catch (err: any) {
      setError(err.message || "Failed to load kits.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKits();
  }, []);

  const handleDelete = async (e: React.MouseEvent, kitId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this prep kit?")) return;
    try {
      await api.kits.delete(kitId);
      setKits(prev => prev.filter(k => k._id !== kitId));
    } catch (err: any) {
      alert(err.message || "Failed to delete kit");
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <span className="text-sm">Loading your interview prep kits...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 border-b border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
            Interview Prep Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Deterministic coverage, company research, and adaptive study schedules
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenBatchModal}
            className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors flex items-center space-x-2 cursor-pointer shadow-sm"
          >
            <Layers className="w-4 h-4 text-slate-400" />
            <span>Upload Batch</span>
          </button>
          <button
            onClick={onOpenCreateModal}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all flex items-center space-x-2 shadow-md shadow-indigo-600/30 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Kit</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-6 p-4 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Kits Grid */}
      {kits.length === 0 ? (
        <div className="mt-12 text-center py-16 px-4 bg-slate-900/50 border border-dashed border-slate-800 rounded-3xl max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-indigo-950/60 border border-indigo-800/50 text-indigo-400 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-100">No Prep Kits Created Yet</h2>
          <p className="text-sm text-slate-400 mt-1.5 max-w-md mx-auto">
            Paste a target Job Description and Company URL to generate a comprehensive, grounded interview kit.
          </p>
          <button
            onClick={onOpenCreateModal}
            className="mt-6 inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Kit</span>
          </button>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {kits.map((kit) => {
            const isRunning = kit.generation?.status === "running";
            const isFailed = kit.generation?.status === "failed";
            const isCompleted = kit.generation?.status === "completed";

            return (
              <div
                key={kit._id}
                onClick={() => onSelectKit(kit._id)}
                className="group bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/5 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60 truncate max-w-[180px]">
                      {kit.source.company || "Company"}
                    </span>
                    {isRunning ? (
                      <span className="inline-flex items-center space-x-1 text-xs font-medium text-amber-400 bg-amber-950/40 border border-amber-800/50 px-2 py-0.5 rounded-md">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Generating {kit.generation.progress}%</span>
                      </span>
                    ) : isFailed ? (
                      <span className="inline-flex items-center space-x-1 text-xs font-medium text-rose-400 bg-rose-950/40 border border-rose-800/50 px-2 py-0.5 rounded-md">
                        <AlertCircle className="w-3 h-3" />
                        <span>Failed</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-xs font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2 py-0.5 rounded-md">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Ready</span>
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-100 group-hover:text-indigo-300 transition-colors line-clamp-1">
                    {kit.role.title || "Software Engineer"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {kit.company_brief?.summary || "Company information and research."}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-3 font-medium">
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{kit.schedule.days_available} days plan</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{kit.questions?.length || 0} questions</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500">
                      {new Date(kit.createdAt).toLocaleDateString()}
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => handleDelete(e, kit._id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Delete kit"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="p-1.5 text-slate-400 group-hover:text-indigo-400 transition-colors">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

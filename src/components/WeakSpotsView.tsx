import React, { useEffect, useState } from "react";
import { WeakSpotItem } from "../../packages/shared/types";
import { api } from "../api";
import { AlertCircle, CheckCircle2, TrendingDown, Target, Loader2, ArrowRight } from "lucide-react";

interface WeakSpotsViewProps {
  kitId: string;
  onStartPractice: () => void;
}

export const WeakSpotsView: React.FC<WeakSpotsViewProps> = ({ kitId, onStartPractice }) => {
  const [weakSpots, setWeakSpots] = useState<WeakSpotItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeakSpots = async () => {
      try {
        setLoading(true);
        const res = await api.practice.getWeakSpots(kitId);
        setWeakSpots(res.weakSpots);
      } catch (err) {
        console.error("Failed to load weak spots", err);
      } finally {
        setLoading(false);
      }
    };
    fetchWeakSpots();
  }, [kitId]);

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mb-2" />
        <span className="text-sm">Analyzing practice telemetry...</span>
      </div>
    );
  }

  const reviewedSpots = weakSpots.filter(w => w.reviewCount > 0);
  const unreviewedSpots = weakSpots.filter(w => w.reviewCount === 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-indigo-950/30 border border-indigo-800/40">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
            <Target className="w-5 h-5 text-indigo-400" />
            <span>Targeted Weakness Analysis</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Calculated from your self-assessments in Flashcard Practice. Requirements with lowest average confidence receive higher scheduling and flashcard drill priority.
          </p>
        </div>
        <button
          onClick={onStartPractice}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-2 shadow-md shadow-indigo-600/30 cursor-pointer self-start sm:self-center"
        >
          <span>Practice Flashcards</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Grid of Weak Spot items */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {weakSpots.map((item) => {
          const isWeak = item.reviewCount > 0 && item.averageConfidence < 2.5;
          const isModerate = item.reviewCount > 0 && item.averageConfidence >= 2.5 && item.averageConfidence < 3.8;
          const isProficient = item.reviewCount > 0 && item.averageConfidence >= 3.8;
          const isUnreviewed = item.reviewCount === 0;

          return (
            <div
              key={item.requirementId}
              className={`p-5 rounded-2xl border transition-all ${
                isWeak
                  ? "bg-rose-950/20 border-rose-800/50"
                  : isModerate
                  ? "bg-amber-950/20 border-amber-800/50"
                  : isProficient
                  ? "bg-emerald-950/20 border-emerald-800/50"
                  : "bg-slate-900 border-slate-800"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {item.requirementId}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400 capitalize">
                    {item.kind}
                  </span>
                </div>

                <div>
                  {isUnreviewed ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      Unreviewed
                    </span>
                  ) : (
                    <div className="flex items-center space-x-1 font-mono font-bold text-sm">
                      <span
                        className={
                          isWeak
                            ? "text-rose-400"
                            : isModerate
                            ? "text-amber-400"
                            : "text-emerald-400"
                        }
                      >
                        {item.averageConfidence}
                      </span>
                      <span className="text-xs text-slate-500 font-normal">/ 5.0</span>
                    </div>
                  )}
                </div>
              </div>

              <h4 className="text-sm font-bold text-slate-200 mt-2 line-clamp-2">
                {item.requirementText}
              </h4>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>{item.associatedQuestionsCount} interview questions mapped</span>
                <span>{item.reviewCount} session review(s)</span>
              </div>

              <div
                className={`mt-3 text-xs font-medium px-3 py-1.5 rounded-lg ${
                  isWeak
                    ? "bg-rose-950/60 text-rose-300 border border-rose-800/40"
                    : isModerate
                    ? "bg-amber-950/60 text-amber-300 border border-amber-800/40"
                    : isProficient
                    ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/40"
                    : "bg-slate-800/60 text-slate-400 border border-slate-700/40"
                }`}
              >
                {item.recommendedAction}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

import React, { useEffect, useState } from "react";
import { api } from "../api";
import { StoredKit } from "../../packages/shared/types";
import { CheckCircle2, Circle, Loader2, AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

interface GenerationProgressViewProps {
  kitId: string;
  onComplete: (kit: StoredKit) => void;
  onBack: () => void;
}

const STAGES = [
  { key: "requirements", label: "Extracting requirements from job description", threshold: 10 },
  { key: "crawler", label: "Crawling company website & ranking pages", threshold: 20 },
  { key: "hiring", label: "Analyzing hiring and culture information", threshold: 30 },
  { key: "interview", label: "Researching public interview discussions", threshold: 40 },
  { key: "brief", label: "Synthesizing company brief", threshold: 48 },
  { key: "role", label: "Structuring role breakdown", threshold: 55 },
  { key: "technical", label: "Generating technical questions", threshold: 65 },
  { key: "behavioural", label: "Generating behavioural questions", threshold: 72 },
  { key: "system_design", label: "Generating system design questions", threshold: 80 },
  { key: "company_fit", label: "Generating company fit questions", threshold: 86 },
  { key: "flashcards", label: "Generating study flashcards", threshold: 90 },
  { key: "coverage", label: "Running deterministic coverage verification", threshold: 94 },
  { key: "schedule", label: "Allocating deterministic study schedule", threshold: 97 },
  { key: "validation", label: "Validating Appendix A kit structure", threshold: 100 },
];

export const GenerationProgressView: React.FC<GenerationProgressViewProps> = ({
  kitId,
  onComplete,
  onBack,
}) => {
  const [kit, setKit] = useState<StoredKit | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let intervalId: any;

    const poll = async () => {
      try {
        const res = await api.kits.get(kitId);
        setKit(res.kit);

        if (res.kit.generation.status === "completed") {
          clearInterval(intervalId);
          onComplete(res.kit);
        } else if (res.kit.generation.status === "failed") {
          clearInterval(intervalId);
          const errMsg = res.kit.generation.errors.join("; ") || "Generation pipeline failed.";
          setError(errMsg);
        }
      } catch (err: any) {
        setError(err.message || "Failed to poll generation status.");
      }
    };

    poll();
    intervalId = setInterval(poll, 1800);

    return () => clearInterval(intervalId);
  }, [kitId, onComplete]);

  const progress = kit?.generation.progress || 5;
  const currentStep = kit?.generation.step || "Initializing pipeline...";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <button
        onClick={onBack}
        className="inline-flex items-center space-x-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Dashboard</span>
      </button>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-xs uppercase font-semibold text-indigo-400 tracking-wider">
              Multi-Stage Pipeline Running
            </span>
            <h1 className="text-xl font-bold text-slate-100 mt-1">Generating Your Prep Kit</h1>
          </div>
          <span className="text-2xl font-black text-indigo-400 font-mono">
            {progress}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800 mb-6">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Current step banner */}
        <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-800/40 flex items-center space-x-3 mb-6">
          <Loader2 className="w-5 h-5 text-indigo-400 animate-spin flex-shrink-0" />
          <span className="text-sm font-medium text-indigo-200">{currentStep}</span>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-sm flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
            <div>
              <div className="font-semibold text-rose-100">Generation Error</div>
              <div className="mt-1 text-xs text-rose-300">{error}</div>
            </div>
          </div>
        )}

        {/* Pipeline Checklist */}
        <div className="space-y-2.5 pt-2">
          {STAGES.map((st) => {
            const isDone = progress >= st.threshold;
            const isCurrent = progress < st.threshold && progress >= st.threshold - 10;

            return (
              <div
                key={st.key}
                className={`flex items-center space-x-3 text-sm p-2 rounded-lg transition-colors ${
                  isCurrent ? "bg-slate-800/80 text-slate-100 font-medium" : "text-slate-400"
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin flex-shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-slate-600 flex-shrink-0" />
                )}
                <span className={isDone ? "text-slate-300" : isCurrent ? "text-indigo-300" : "text-slate-500"}>
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

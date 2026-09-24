import React, { useState } from "react";
import { Flashcard, PracticeReview } from "../../packages/shared/types";
import { api } from "../api";
import { Eye, RotateCcw, Check, ArrowRight, Award, Zap, HelpCircle } from "lucide-react";

interface PracticeModeProps {
  kitId: string;
  flashcards: Flashcard[];
  existingReviews: PracticeReview[];
  onReviewRecorded: (review: PracticeReview) => void;
  onExit: () => void;
}

export const PracticeMode: React.FC<PracticeModeProps> = ({
  kitId,
  flashcards,
  existingReviews,
  onReviewRecorded,
  onExit,
}) => {
  // Sort cards by priority: priority = 6 - latestConfidence (cards with lowest confidence or unreviewed first)
  const latestConfByCard = new Map<string, number>();
  for (const r of existingReviews) {
    latestConfByCard.set(r.cardId, r.confidence);
  }

  const prioritizedCards = [...flashcards].sort((a, b) => {
    const confA = latestConfByCard.get(a.id) ?? 0;
    const confB = latestConfByCard.get(b.id) ?? 0;
    // Unreviewed (0) first, then lower confidence first
    if (confA === 0 && confB !== 0) return -1;
    if (confB === 0 && confA !== 0) return 1;
    return confA - confB;
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  if (prioritizedCards.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl">
        <HelpCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
        <p className="text-slate-300">No flashcards available to practice.</p>
        <button
          onClick={onExit}
          className="mt-4 px-4 py-2 bg-slate-800 text-slate-200 rounded-xl text-sm"
        >
          Return to Kit
        </button>
      </div>
    );
  }

  const isFinished = currentIndex >= prioritizedCards.length;
  const currentCard = prioritizedCards[currentIndex];

  const handleRateConfidence = async (score: number) => {
    if (!currentCard || submitting) return;
    setSubmitting(true);
    try {
      const res = await api.practice.recordReview(kitId, {
        cardId: currentCard.id,
        confidence: score,
      });
      onReviewRecorded(res.review);
      setSessionCount(prev => prev + 1);
      setRevealed(false);
      setCurrentIndex(prev => prev + 1);
    } catch (err: any) {
      alert(err.message || "Failed to save practice confidence");
    } finally {
      setSubmitting(false);
    }
  };

  if (isFinished) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center max-w-xl mx-auto shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white mx-auto mb-5 shadow-xl shadow-emerald-600/20">
          <Award className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-100">Practice Session Complete!</h2>
        <p className="text-sm text-slate-400 mt-2">
          You reviewed {sessionCount} cards. Your weak spots report and study priority have been updated based on your self-assessments.
        </p>

        <div className="mt-8 flex justify-center space-x-3">
          <button
            onClick={() => {
              setCurrentIndex(0);
              setRevealed(false);
            }}
            className="px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors flex items-center space-x-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Practice Again</span>
          </button>
          <button
            onClick={onExit}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all shadow-md shadow-indigo-600/30 cursor-pointer"
          >
            Return to Kit
          </button>
        </div>
      </div>
    );
  }

  const pastConfidence = latestConfByCard.get(currentCard.id);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Session Progress Header */}
      <div className="flex items-center justify-between text-xs text-slate-400 mb-3 px-1">
        <span className="font-semibold uppercase tracking-wider text-indigo-400">
          Flashcard Drill ({currentIndex + 1} / {prioritizedCards.length})
        </span>
        <span>
          {pastConfidence !== undefined
            ? `Previous score: ${pastConfidence}/5`
            : "Never reviewed"}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800 mb-6">
        <div
          className="h-full bg-indigo-500 transition-all duration-300"
          style={{ width: `${((currentIndex) / prioritizedCards.length) * 100}%` }}
        />
      </div>

      {/* Flashcard Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl min-h-[320px] flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
              {currentCard.id}
            </span>
            <div className="flex items-center space-x-1.5">
              {currentCard.requirement_ids.map(rid => (
                <span key={rid} className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                  {rid}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Prompt / Question
          </div>
          <p className="text-lg sm:text-xl font-bold text-slate-100 mt-2 leading-relaxed">
            {currentCard.front}
          </p>

          {revealed && (
            <div className="mt-6 pt-6 border-t border-slate-800 animate-fadeIn">
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Answer Key / Outline
              </div>
              <p className="text-sm sm:text-base text-slate-200 mt-2 leading-relaxed whitespace-pre-line font-normal">
                {currentCard.back}
              </p>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="mt-8 pt-4">
          {!revealed ? (
            <button
              onClick={() => setRevealed(true)}
              className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-medium text-sm transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>Reveal Answer</span>
            </button>
          ) : (
            <div>
              <div className="text-xs font-semibold text-center text-slate-400 uppercase tracking-wider mb-3">
                Rate your confidence (1 = very weak, 5 = mastered)
              </div>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { val: 1, label: "1: Lost", color: "hover:bg-rose-600 border-rose-800/60" },
                  { val: 2, label: "2: Weak", color: "hover:bg-amber-600 border-amber-800/60" },
                  { val: 3, label: "3: Fair", color: "hover:bg-yellow-600 border-yellow-800/60" },
                  { val: 4, label: "4: Good", color: "hover:bg-blue-600 border-blue-800/60" },
                  { val: 5, label: "5: Solid", color: "hover:bg-emerald-600 border-emerald-800/60" },
                ].map(({ val, label, color }) => (
                  <button
                    key={val}
                    disabled={submitting}
                    onClick={() => handleRateConfidence(val)}
                    className={`py-3 px-1 rounded-xl bg-slate-800 ${color} text-slate-200 hover:text-white border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center`}
                  >
                    <span>{val}</span>
                    <span className="text-[10px] font-normal opacity-80 mt-0.5">{label.split(":")[1]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

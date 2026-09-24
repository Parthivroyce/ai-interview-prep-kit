import React, { useState, useEffect } from "react";
import { StoredKit, Question, Flashcard, QuestionCategory, DifficultyLevel, PracticeReview } from "../../packages/shared/types";
import { sanitizeToExactAppendixA } from "../../packages/shared/appendixA";
import { api } from "../api";
import { PracticeMode } from "./PracticeMode";
import { WeakSpotsView } from "./WeakSpotsView";
import {
  ArrowLeft,
  Building2,
  Briefcase,
  HelpCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Download,
  Trash2,
  Pin,
  PinOff,
  Edit2,
  Plus,
  RefreshCw,
  Clock,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Target,
  Award,
  Layers,
  Save,
} from "lucide-react";

interface KitDetailViewProps {
  initialKit: StoredKit;
  onBack: () => void;
}

type TabType = "overview" | "company" | "role" | "questions" | "flashcards" | "schedule" | "practice" | "weakspots";

export const KitDetailView: React.FC<KitDetailViewProps> = ({ initialKit, onBack }) => {
  const [kit, setKit] = useState<StoredKit>(initialKit);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [questionFilter, setQuestionFilter] = useState<string>("all");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | null>(null);
  const [reviews, setReviews] = useState<PracticeReview[]>([]);
  const [regenerating, setRegenerating] = useState<string | null>(null);

  // New question form state
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [newQuestionPrompt, setNewQuestionPrompt] = useState("");
  const [newQuestionOutline, setNewQuestionOutline] = useState("");
  const [newQuestionCategory, setNewQuestionCategory] = useState<QuestionCategory>("technical");
  const [newQuestionDiff, setNewQuestionDiff] = useState<DifficultyLevel>(2);

  // New flashcard form state
  const [showAddFlashcard, setShowAddFlashcard] = useState(false);
  const [newCardFront, setNewCardFront] = useState("");
  const [newCardBack, setNewCardBack] = useState("");

  // Schedule days edit
  const [scheduleDaysInput, setScheduleDaysInput] = useState(kit.schedule.days_available);

  // Load existing reviews on mount
  useEffect(() => {
    api.practice.getReviews(kit._id).then(res => setReviews(res.reviews)).catch(console.error);
  }, [kit._id]);

  const triggerSaveIndicator = () => {
    setSaveStatus("saving");
    setTimeout(() => setSaveStatus("saved"), 600);
    setTimeout(() => setSaveStatus(null), 2500);
  };

  // ---------------------------------------------
  // REGENERATION HANDLERS
  // ---------------------------------------------
  const handleRegenerateCompany = async () => {
    try {
      setRegenerating("company");
      const res = await api.kits.regenerateCompany(kit._id);
      setKit(res.kit);
      triggerSaveIndicator();
    } catch (err: any) {
      alert(err.message || "Failed to regenerate company brief");
    } finally {
      setRegenerating(null);
    }
  };

  const handleRegenerateCategory = async (category: QuestionCategory) => {
    try {
      setRegenerating(category);
      const res = await api.kits.regenerateQuestions(kit._id, category);
      setKit(res.kit);
      triggerSaveIndicator();
    } catch (err: any) {
      alert(err.message || `Failed to regenerate ${category} questions`);
    } finally {
      setRegenerating(null);
    }
  };

  const handleRegenerateSchedule = async () => {
    try {
      setRegenerating("schedule");
      const res = await api.kits.regenerateSchedule(kit._id, scheduleDaysInput);
      setKit(res.kit);
      triggerSaveIndicator();
    } catch (err: any) {
      alert(err.message || "Failed to regenerate schedule");
    } finally {
      setRegenerating(null);
    }
  };

  // ---------------------------------------------
  // QUESTION ACTIONS
  // ---------------------------------------------
  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionPrompt.trim()) return;

    try {
      const res = await api.questions.create(kit._id, {
        prompt: newQuestionPrompt,
        answer_outline: newQuestionOutline,
        category: newQuestionCategory,
        difficulty: newQuestionDiff,
      });
      setKit(res.kit);
      setNewQuestionPrompt("");
      setNewQuestionOutline("");
      setShowAddQuestion(false);
      triggerSaveIndicator();
    } catch (err: any) {
      alert(err.message || "Failed to add question");
    }
  };

  const handleTogglePinQuestion = async (q: Question) => {
    const newPinned = !(q._meta?.pinned ?? false);
    try {
      const res = await api.questions.update(kit._id, q.id, { pinned: newPinned });
      setKit(res.kit);
      triggerSaveIndicator();
    } catch (err: any) {
      alert(err.message || "Failed to update pin state");
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;
    try {
      const res = await api.questions.delete(kit._id, questionId);
      setKit(res.kit);
      triggerSaveIndicator();
    } catch (err: any) {
      alert(err.message || "Failed to delete question");
    }
  };

  const handleMoveQuestionOrder = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= kit.questions.length) return;

    const newQuestions = [...kit.questions];
    const [moved] = newQuestions.splice(index, 1);
    newQuestions.splice(targetIndex, 0, moved);

    // Optimistic UI update
    setKit(prev => ({ ...prev, questions: newQuestions }));

    try {
      const res = await api.questions.reorder(kit._id, newQuestions.map(q => q.id));
      setKit(res.kit);
      triggerSaveIndicator();
    } catch (err: any) {
      alert(err.message || "Failed to reorder questions");
    }
  };

  const handleChangeCategory = async (questionId: string, newCat: QuestionCategory) => {
    try {
      const res = await api.questions.update(kit._id, questionId, { category: newCat });
      setKit(res.kit);
      triggerSaveIndicator();
    } catch (err: any) {
      alert(err.message || "Failed to change question category");
    }
  };

  // ---------------------------------------------
  // FLASHCARD ACTIONS
  // ---------------------------------------------
  const handleAddFlashcard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardFront.trim() || !newCardBack.trim()) return;

    try {
      const res = await api.flashcards.create(kit._id, {
        front: newCardFront,
        back: newCardBack,
      });
      setKit(res.kit);
      setNewCardFront("");
      setNewCardBack("");
      setShowAddFlashcard(false);
      triggerSaveIndicator();
    } catch (err: any) {
      alert(err.message || "Failed to add flashcard");
    }
  };

  const handleDeleteFlashcard = async (cardId: string) => {
    if (!confirm("Delete this flashcard?")) return;
    try {
      const res = await api.flashcards.delete(kit._id, cardId);
      setKit(res.kit);
      triggerSaveIndicator();
    } catch (err: any) {
      alert(err.message || "Failed to delete flashcard");
    }
  };

  // Export exact Appendix A
  const handleExportJson = () => {
    const sanitized = sanitizeToExactAppendixA(kit);
    const blob = new Blob([JSON.stringify(sanitized, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interview-prep-kit-${kit.source.company.toLowerCase().replace(/[^a-z0-9]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredQuestions = kit.questions.filter(q => {
    if (questionFilter === "all") return true;
    return q.category === questionFilter;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Navigation Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700">
                {kit.source.company || "Company"}
              </span>
              {saveStatus && (
                <span className="text-xs font-medium text-emerald-400 flex items-center space-x-1 animate-pulse">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{saveStatus === "saving" ? "Saving..." : "Saved"}</span>
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 mt-1">
              {kit.role.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleExportJson}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center space-x-1.5 border border-slate-700 cursor-pointer shadow-sm"
          >
            <Download className="w-4 h-4 text-indigo-400" />
            <span>Export Appendix A</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 overflow-x-auto pb-2 border-b border-slate-800 scrollbar-none">
        {[
          { id: "overview", label: "Overview", icon: BookOpen },
          { id: "company", label: "Company Brief", icon: Building2 },
          { id: "role", label: "Role Breakdown", icon: Briefcase },
          { id: "questions", label: `Questions (${kit.questions.length})`, icon: HelpCircle },
          { id: "flashcards", label: `Flashcards (${kit.flashcards.length})`, icon: Sparkles },
          { id: "schedule", label: `Schedule (${kit.schedule.days_available}d)`, icon: Calendar },
          { id: "practice", label: "Practice Mode", icon: Award },
          { id: "weakspots", label: "Weak Spots", icon: Target },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-xs text-slate-400 font-medium">Requirements</div>
              <div className="text-2xl font-bold text-slate-100 mt-1">{kit.role.requirements.length}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {kit.role.requirements.filter(r => r.priority === "must").length} core must-have
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-xs text-slate-400 font-medium">Questions</div>
              <div className="text-2xl font-bold text-slate-100 mt-1">{kit.questions.length}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Across 4 categories</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-xs text-slate-400 font-medium">Study Days</div>
              <div className="text-2xl font-bold text-slate-100 mt-1">{kit.schedule.days_available}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Deterministic schedule</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-xs text-slate-400 font-medium">Coverage Passes</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">{kit.coverage.passes}</div>
              <div className="text-[11px] text-emerald-500/80 mt-0.5">100% must requirements covered</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2 mb-3">
                <Building2 className="w-4 h-4 text-indigo-400" />
                <span>Company Intelligence</span>
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed line-clamp-4">
                {kit.company_brief.summary}
              </p>
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>{kit.source.pages_used.length} pages researched</span>
                <button
                  onClick={() => setActiveTab("company")}
                  className="text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                >
                  View Details &rarr;
                </button>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2 mb-3">
                <Target className="w-4 h-4 text-indigo-400" />
                <span>Interactive Practice &amp; Weak Spots</span>
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Practice study flashcards one-by-one, record your confidence, and identify high-priority weak spots grouped by role requirement.
              </p>
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">{reviews.length} total reviews logged</span>
                <button
                  onClick={() => setActiveTab("practice")}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Start Practice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: COMPANY BRIEF */}
      {activeTab === "company" && (
        <div className="space-y-6 max-w-4xl">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-100">Company Intelligence Brief</h2>
            <button
              onClick={handleRegenerateCompany}
              disabled={regenerating === "company"}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center space-x-1.5 border border-slate-700 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${regenerating === "company" ? "animate-spin text-indigo-400" : ""}`} />
              <span>{regenerating === "company" ? "Researching..." : "Regenerate Brief"}</span>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-2">
                Company Summary
              </label>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                {kit.company_brief.summary}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-2">
                What They Do &amp; Business Domain
              </label>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                {kit.company_brief.what_they_do}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Research Sources &amp; Crawled Pages
              </label>
              <ul className="space-y-1.5 text-xs text-slate-300 font-mono">
                {kit.company_brief.sources.map((src, i) => (
                  <li key={i} className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800/50">
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                    <span className="truncate">{src}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: ROLE BREAKDOWN */}
      {activeTab === "role" && (
        <div className="space-y-6 max-w-4xl">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">Role Title</span>
                <h2 className="text-xl font-bold text-slate-100 mt-0.5">{kit.role.title}</h2>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block text-right">Seniority</span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 mt-0.5 inline-block">
                  {kit.role.seniority || "Not specified"}
                </span>
              </div>
            </div>

            {kit.role.responsibilities.length > 0 && (
              <div className="mt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Core Responsibilities
                </h3>
                <ul className="space-y-2 text-sm text-slate-300">
                  {kit.role.responsibilities.map((resp, i) => (
                    <li key={i} className="flex items-start space-x-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
                      <span>{resp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Extracted Requirements (Grounded Strictly in JD)
              </h3>
              <div className="space-y-2.5">
                {kit.role.requirements.map(req => (
                  <div
                    key={req.id}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start space-x-3">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 mt-0.5">
                        {req.id}
                      </span>
                      <span className="text-sm text-slate-200">{req.text}</span>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400 capitalize">
                        {req.kind}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          req.priority === "must"
                            ? "bg-indigo-950 text-indigo-300 border border-indigo-800/60"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {req.priority.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: QUESTIONS */}
      {activeTab === "questions" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Category Filter */}
            <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800 overflow-x-auto">
              {["all", "technical", "behavioural", "system-design", "company-fit"].map(cat => (
                <button
                  key={cat}
                  onClick={() => setQuestionFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-colors cursor-pointer ${
                    questionFilter === cat
                      ? "bg-slate-800 text-indigo-400 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {cat.replace("-", " ")}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2">
              {questionFilter !== "all" && (
                <button
                  onClick={() => handleRegenerateCategory(questionFilter as QuestionCategory)}
                  disabled={regenerating === questionFilter}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center space-x-1.5 border border-slate-700 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${regenerating === questionFilter ? "animate-spin text-indigo-400" : ""}`} />
                  <span>Regenerate Category</span>
                </button>
              )}
              <button
                onClick={() => setShowAddQuestion(true)}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors flex items-center space-x-1 cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Question</span>
              </button>
            </div>
          </div>

          {/* Add Question Modal / Form */}
          {showAddQuestion && (
            <div className="p-5 rounded-2xl bg-slate-900 border border-indigo-500/30 space-y-4">
              <h3 className="text-sm font-bold text-slate-100">Add Custom Question (Marked Manual)</h3>
              <form onSubmit={handleAddQuestion} className="space-y-3">
                <input
                  type="text"
                  required
                  value={newQuestionPrompt}
                  onChange={(e) => setNewQuestionPrompt(e.target.value)}
                  placeholder="Question prompt..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                />
                <textarea
                  rows={3}
                  value={newQuestionOutline}
                  onChange={(e) => setNewQuestionOutline(e.target.value)}
                  placeholder="Key answer outline points..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                />
                <div className="flex items-center space-x-4">
                  <div>
                    <label className="text-xs text-slate-400 mr-2">Category:</label>
                    <select
                      value={newQuestionCategory}
                      onChange={(e) => setNewQuestionCategory(e.target.value as QuestionCategory)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200"
                    >
                      <option value="technical">Technical</option>
                      <option value="behavioural">Behavioural</option>
                      <option value="system-design">System Design</option>
                      <option value="company-fit">Company Fit</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mr-2">Difficulty:</label>
                    <select
                      value={newQuestionDiff}
                      onChange={(e) => setNewQuestionDiff(Number(e.target.value) as DifficultyLevel)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200"
                    >
                      <option value={1}>1 (Easy - 10m)</option>
                      <option value={2}>2 (Medium - 20m)</option>
                      <option value={3}>3 (Hard - 30m)</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddQuestion(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                  >
                    Save Question
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Question List */}
          <div className="space-y-4">
            {filteredQuestions.map((q, idx) => {
              const isPinned = q._meta?.pinned === true;
              const isEdited = q._meta?.edited === true;
              const isManual = q._meta?.origin === "manual";

              return (
                <div
                  key={q.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 transition-all shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {q.id}
                      </span>
                      <select
                        value={q.category}
                        onChange={(e) => handleChangeCategory(q.id, e.target.value as QuestionCategory)}
                        className="bg-slate-800 border border-slate-700 text-indigo-300 text-xs font-semibold rounded-md px-2 py-0.5 focus:outline-none"
                      >
                        <option value="technical">Technical</option>
                        <option value="behavioural">Behavioural</option>
                        <option value="system-design">System Design</option>
                        <option value="company-fit">Company Fit</option>
                      </select>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                        Diff {q.difficulty} ({q.difficulty * 10}m)
                      </span>
                      {isManual && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                          MANUAL
                        </span>
                      )}
                      {isEdited && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                          EDITED
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1">
                      {/* Reorder up/down */}
                      <button
                        onClick={() => handleMoveQuestionOrder(idx, "up")}
                        disabled={idx === 0}
                        className="p-1 rounded text-slate-500 hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                        title="Move question up"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleMoveQuestionOrder(idx, "down")}
                        disabled={idx === kit.questions.length - 1}
                        className="p-1 rounded text-slate-500 hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                        title="Move question down"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>

                      {/* Pin button */}
                      <button
                        onClick={() => handleTogglePinQuestion(q)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isPinned ? "text-amber-400 bg-amber-950/40" : "text-slate-500 hover:text-slate-300"
                        }`}
                        title={isPinned ? "Unpin question" : "Pin question (survives regeneration)"}
                      >
                        {isPinned ? <Pin className="w-4 h-4 fill-current" /> : <Pin className="w-4 h-4" />}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Delete question"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-base font-semibold text-slate-100 leading-snug">
                    {q.prompt}
                  </h3>

                  {q.answer_outline && (
                    <div className="mt-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-300 whitespace-pre-line leading-relaxed">
                      <span className="font-semibold text-slate-400 block mb-1">Answer Outline:</span>
                      {q.answer_outline}
                    </div>
                  )}

                  <div className="mt-3 flex items-center space-x-1.5 text-xs text-slate-500">
                    <span>Mapped requirements:</span>
                    {q.requirement_ids.map(rid => (
                      <span key={rid} className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300">
                        {rid}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB CONTENT: FLASHCARDS */}
      {activeTab === "flashcards" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-100">Study Flashcards</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowAddFlashcard(true)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
              >
                + Add Flashcard
              </button>
              <button
                onClick={() => setActiveTab("practice")}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer shadow-sm"
              >
                Launch Drill
              </button>
            </div>
          </div>

          {showAddFlashcard && (
            <div className="p-5 rounded-2xl bg-slate-900 border border-indigo-500/30 space-y-3">
              <h3 className="text-sm font-bold text-slate-100">Add Custom Flashcard</h3>
              <input
                type="text"
                required
                value={newCardFront}
                onChange={(e) => setNewCardFront(e.target.value)}
                placeholder="Front: Concept or question prompt..."
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none"
              />
              <textarea
                rows={2}
                required
                value={newCardBack}
                onChange={(e) => setNewCardBack(e.target.value)}
                placeholder="Back: Answer or key breakdown..."
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none"
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddFlashcard(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddFlashcard}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                >
                  Save Card
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {kit.flashcards.map(card => (
              <div
                key={card.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-slate-400">{card.id}</span>
                    <button
                      onClick={() => handleDeleteFlashcard(card.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-xs uppercase font-semibold text-indigo-400 mb-1">Front</div>
                  <p className="text-sm font-semibold text-slate-100 leading-snug">{card.front}</p>

                  <div className="text-xs uppercase font-semibold text-emerald-400 mt-4 mb-1">Back</div>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line bg-slate-950 p-3 rounded-xl border border-slate-800/60">
                    {card.back}
                  </p>
                </div>

                <div className="mt-4 pt-2 border-t border-slate-800/80 flex items-center space-x-1.5">
                  {card.requirement_ids.map(rid => (
                    <span key={rid} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      {rid}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: SCHEDULE */}
      {activeTab === "schedule" && (
        <div className="space-y-6 max-w-4xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Deterministic Study Schedule</h2>
              <p className="text-xs text-slate-400">
                Guaranteed coverage of must-have requirements with hardest topics scheduled earliest.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="number"
                min={1}
                max={90}
                value={scheduleDaysInput}
                onChange={(e) => setScheduleDaysInput(parseInt(e.target.value, 10) || 1)}
                className="w-20 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs text-center"
              />
              <button
                onClick={handleRegenerateSchedule}
                disabled={regenerating === "schedule"}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer flex items-center space-x-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${regenerating === "schedule" ? "animate-spin" : ""}`} />
                <span>Update Schedule</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {kit.schedule.days.map(day => {
              // Retrieve questions assigned to this day
              const dayQuestions = kit.questions.filter(q => day.question_ids.includes(q.id));

              return (
                <div
                  key={day.day}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 font-bold font-mono text-sm flex items-center justify-center border border-indigo-500/30">
                        {day.day}
                      </span>
                      <h3 className="text-sm font-bold text-slate-100">{day.focus}</h3>
                    </div>
                    <div className="flex items-center space-x-1 text-xs text-indigo-400 font-mono font-semibold bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-800/40">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{day.minutes} mins</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    {dayQuestions.map(q => (
                      <div
                        key={q.id}
                        className="px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center space-x-2.5 truncate">
                          <span className="font-mono font-bold text-slate-400">{q.id}</span>
                          <span className="text-slate-200 truncate">{q.prompt}</span>
                        </div>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <span className="capitalize text-slate-400">{q.category}</span>
                          <span className="font-mono text-slate-500">{q.difficulty * 10}m</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB CONTENT: PRACTICE MODE */}
      {activeTab === "practice" && (
        <div className="py-2">
          <PracticeMode
            kitId={kit._id}
            flashcards={kit.flashcards}
            existingReviews={reviews}
            onReviewRecorded={(newReview) => setReviews(prev => [...prev, newReview])}
            onExit={() => setActiveTab("overview")}
          />
        </div>
      )}

      {/* TAB CONTENT: WEAK SPOTS */}
      {activeTab === "weakspots" && (
        <WeakSpotsView
          kitId={kit._id}
          onStartPractice={() => setActiveTab("practice")}
        />
      )}
    </div>
  );
};

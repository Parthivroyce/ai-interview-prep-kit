import { z } from "zod";

export type RequirementKind = "technical" | "behavioural" | "domain";
export type RequirementPriority = "must" | "nice";
export type QuestionCategory = "technical" | "behavioural" | "system-design" | "company-fit";
export type DifficultyLevel = 1 | 2 | 3;
export type ItemOrigin = "generated" | "manual";

export interface ItemMeta {
  origin: ItemOrigin;
  edited: boolean;
  pinned: boolean;
}

export interface KitSource {
  company: string;
  company_url: string;
  role: string;
  location: string;
  jd_chars: number;
  researched_at: string;
  pages_used: string[];
}

export interface CompanyBrief {
  summary: string;
  what_they_do: string;
  sources: string[];
  _meta?: ItemMeta;
}

export interface Requirement {
  id: string; // e.g. "r1", "r2"
  text: string;
  kind: RequirementKind;
  priority: RequirementPriority;
  _meta?: ItemMeta;
}

export interface RoleBreakdown {
  title: string;
  seniority: string;
  responsibilities: string[];
  requirements: Requirement[];
  _meta?: ItemMeta;
}

export interface Question {
  id: string; // e.g. "q1", "q2"
  requirement_ids: string[];
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: DifficultyLevel;
  _meta?: ItemMeta;
}

export interface Flashcard {
  id: string; // e.g. "f1", "f2"
  front: string;
  back: string;
  requirement_ids: string[];
  _meta?: ItemMeta;
}

export interface ScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

export interface Schedule {
  days_available: number;
  days: ScheduleDay[];
}

export interface CoverageReport {
  uncovered_requirement_ids: string[];
  passes: number;
}

export interface AppendixAKit {
  source: KitSource;
  company_brief: CompanyBrief;
  role: RoleBreakdown;
  questions: Question[];
  flashcards: Flashcard[];
  schedule: Schedule;
  coverage: CoverageReport;
}

export interface GenerationProgress {
  status: "idle" | "running" | "completed" | "failed";
  step: string;
  progress: number;
  errors: string[];
}

export interface StoredKit extends AppendixAKit {
  _id: string;
  userId: string;
  fingerprint: string;
  generation: GenerationProgress;
  createdAt: string;
  updatedAt: string;
}

export interface PracticeReview {
  id: string;
  userId: string;
  kitId: string;
  cardId: string;
  confidence: number; // 1 to 5
  reviewedAt: string;
}

export interface WeakSpotItem {
  requirementId: string;
  requirementText: string;
  kind: RequirementKind;
  averageConfidence: number;
  reviewCount: number;
  associatedQuestionsCount: number;
  recommendedAction: string;
}

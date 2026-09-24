import {
  AppendixAKit,
  StoredKit,
  WeakSpotItem,
  PracticeReview,
  QuestionCategory,
  DifficultyLevel,
} from "../packages/shared/types";

export interface User {
  id: string;
  email: string;
  name?: string;
}

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: "include",
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data as T;
}

export const api = {
  auth: {
    me: () => fetchApi<{ user: User }>("/auth/me"),
    login: (body: { email: string; password: string }) =>
      fetchApi<{ user: User; token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    register: (body: { email: string; password: string; name?: string }) =>
      fetchApi<{ user: User; token: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    logout: () => fetchApi<{ success: boolean }>("/auth/logout", { method: "POST" }),
  },
  kits: {
    list: () => fetchApi<{ kits: StoredKit[] }>("/kits"),
    get: (id: string) => fetchApi<{ kit: StoredKit }>(`/kits/${id}`),
    status: (id: string) => fetchApi<{ generation: StoredKit["generation"] }>(`/kits/${id}/status`),
    create: (body: { jd: string; company_url: string; days: number }) =>
      fetchApi<{ kitId: string; status: string; duplicate?: boolean; message?: string }>("/kits", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (id: string, body: any) =>
      fetchApi<{ kit: StoredKit }>(`/kits/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    delete: (id: string) =>
      fetchApi<{ success: boolean }>(`/kits/${id}`, { method: "DELETE" }),
    regenerateCompany: (id: string) =>
      fetchApi<{ kit: StoredKit }>(`/kits/${id}/regenerate/company`, { method: "POST" }),
    regenerateQuestions: (id: string, category: QuestionCategory) =>
      fetchApi<{ kit: StoredKit }>(`/kits/${id}/regenerate/questions/${category}`, { method: "POST" }),
    regenerateSchedule: (id: string, days?: number) =>
      fetchApi<{ kit: StoredKit }>(`/kits/${id}/regenerate/schedule`, {
        method: "POST",
        body: JSON.stringify({ days }),
      }),
  },
  questions: {
    create: (kitId: string, body: { prompt: string; answer_outline?: string; category: QuestionCategory; difficulty: DifficultyLevel; requirement_ids?: string[] }) =>
      fetchApi<{ kit: StoredKit; question: any }>(`/kits/${kitId}/questions`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (kitId: string, questionId: string, body: any) =>
      fetchApi<{ kit: StoredKit; question: any }>(`/kits/${kitId}/questions/${questionId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    delete: (kitId: string, questionId: string) =>
      fetchApi<{ kit: StoredKit }>(`/kits/${kitId}/questions/${questionId}`, { method: "DELETE" }),
    reorder: (kitId: string, question_ids: string[]) =>
      fetchApi<{ kit: StoredKit }>(`/kits/${kitId}/questions/reorder`, {
        method: "PUT",
        body: JSON.stringify({ question_ids }),
      }),
  },
  flashcards: {
    create: (kitId: string, body: { front: string; back: string; requirement_ids?: string[] }) =>
      fetchApi<{ kit: StoredKit; flashcard: any }>(`/kits/${kitId}/flashcards`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (kitId: string, flashcardId: string, body: any) =>
      fetchApi<{ kit: StoredKit; flashcard: any }>(`/kits/${kitId}/flashcards/${flashcardId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    delete: (kitId: string, flashcardId: string) =>
      fetchApi<{ kit: StoredKit }>(`/kits/${kitId}/flashcards/${flashcardId}`, { method: "DELETE" }),
  },
  practice: {
    recordReview: (kitId: string, body: { cardId: string; confidence: number }) =>
      fetchApi<{ review: PracticeReview }>(`/kits/${kitId}/practice`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    getReviews: (kitId: string) =>
      fetchApi<{ reviews: PracticeReview[] }>(`/kits/${kitId}/practice`),
    getWeakSpots: (kitId: string) =>
      fetchApi<{ weakSpots: WeakSpotItem[] }>(`/kits/${kitId}/weak-spots`),
  },
};

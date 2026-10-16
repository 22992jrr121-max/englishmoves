// The student's own General English course (A1–C1): static content, loaded per level on demand.
import index from "@/content/course/index.json";
import type { CourseLevel } from "./learning";

export type CourseIndexEntry = { id: string; level: CourseLevel; sequence: number; title: string; objective: string; exercises: number };
export const COURSE_INDEX = index as CourseIndexEntry[];

export type CourseFormat = "multiple_choice" | "short_answer" | "oral_recording" | "written_response";
export type CourseExercise = {
  id: string;
  section: string;
  format: CourseFormat;
  prompt: string;
  options: string[];
  answer: string | null;
  explanation: string;
  topic_id?: string;
};
export type VocabItem = { en: string; es: string; example: string };
export type GrammarTopic = { id: string; title: string; explanation: string; form?: string; examples?: string[] };
export type CourseSection = {
  order: number;
  key: string;
  title: string;
  explanation: string;
  items?: VocabItem[];
  form?: string;
  examples?: string[];
  additional_topics?: GrammarTopic[];
  script?: string;
  tts?: { language: string; rate: number; repetitions: number };
  prompts?: string[];
  success_criteria?: string[];
  text?: string;
  prompt?: string;
  word_range?: string;
};
export type CourseUnit = {
  id: string;
  level: CourseLevel;
  sequence: number;
  title: string;
  objective: string;
  exam_target: string;
  sections: CourseSection[];
  exercises: CourseExercise[];
};
/** Progress stored in units.content for a course unit. */
export type CourseState = { course: string; done: string[]; scores: Record<string, number> };

const loaders = import.meta.glob<{ default: CourseUnit[] }>("../content/course/[ABC][12].json");

export async function loadCourseUnit(code: string): Promise<CourseUnit | null> {
  const load = loaders[`../content/course/${code.slice(0, 2)}.json`];
  if (!load) return null;
  const mod = await load();
  return mod.default.find((u) => u.id === code) ?? null;
}

// ---------- Exam tasks (client-safe shape, answers stripped by the server) ----------
export type ExamItem = {
  n: number;
  question?: string;
  options?: string[];
  base?: string;
  source?: string;
  keyword?: string;
  target?: string;
  response_type?: string;
  gradable: boolean;
};
export type ExamTask = {
  id: string;
  level: string;
  paper: string;
  part: number;
  title: string;
  format: string;
  strategy_es: string;
  instructions: string;
  text?: string;
  text_with_gaps?: string;
  script?: string;
  segments?: string[];
  tts?: { rate?: number };
  images?: string[];
  options?: Record<string, string> | string[];
  candidate_paragraphs?: Record<string, string>;
  candidate_sentences?: Record<string, string>;
  text_labels?: string[];
  word_bank?: string[];
  concept_cards?: string[];
  rubric?: string[];
  word_range?: string;
  requires_human_review?: boolean;
  items: ExamItem[];
};
export type ExamReview = Record<string, Record<string, { correct: boolean; answer: string; explanation?: string | undefined }>>;

export const PAPER_LABEL: Record<string, string> = {
  listening: "Listening",
  reading_writing: "Reading & Writing",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking",
  reading_use_of_english: "Reading & Use of English",
};

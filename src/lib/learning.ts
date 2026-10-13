// Shared, browser-safe learning logic: levels, diagnostic, catalogs, answer checking.
export const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type Level = (typeof LEVELS)[number];
export type Block = "daily" | "general" | "work";

export const BLOCKS: Record<Block, { name: string; short: string; tagline: string }> = {
  daily: { name: "Inglés Cotidiano", short: "Cotidiano", tagline: "Expresiones reales para el día a día" },
  general: { name: "Inglés General", short: "General", tagline: "Unidades estilo Cambridge A1–C2" },
  work: { name: "Inglés para tu Trabajo", short: "Trabajo", tagline: "Vocabulario a medida de tu puesto" },
};

export type DiagnosticQuestion = { level: Level; q: string; options: string[]; answer: number };

/** 10 questions, two per band, increasing difficulty A1 → C2. */
export const DIAGNOSTIC: DiagnosticQuestion[] = [
  { level: "A1", q: "She ___ a teacher.", options: ["is", "are", "am", "be"], answer: 0 },
  { level: "A1", q: "I ___ coffee every morning.", options: ["drinks", "drink", "drinking", "am drink"], answer: 1 },
  { level: "A2", q: "Yesterday we ___ to the cinema.", options: ["go", "gone", "went", "going"], answer: 2 },
  { level: "A2", q: "This bag is ___ than that one.", options: ["more cheap", "cheapest", "cheaper", "cheap"], answer: 2 },
  { level: "B1", q: "I ___ here since 2019.", options: ["live", "have lived", "am living", "lived"], answer: 1 },
  { level: "B1", q: "If it rains, we ___ at home.", options: ["stay", "would stay", "will stay", "stayed"], answer: 2 },
  { level: "B2", q: "The report ___ by the time the meeting starts.", options: ["will have been finished", "will finish", "has finished", "is finishing"], answer: 0 },
  { level: "B2", q: "I wish I ___ more time to travel.", options: ["have", "had", "will have", "am having"], answer: 1 },
  { level: "C1", q: "Not only ___ late, but he also forgot the documents.", options: ["he arrived", "did he arrive", "he did arrive", "arrived he"], answer: 1 },
  { level: "C2", q: "Her argument, ___ compelling, failed to sway the board.", options: ["albeit", "despite", "whereas", "notwithstanding of"], answer: 0 },
];

/** Maps diagnostic correct answers (0–10) to a suggested CEFR level. */
export function levelFromScore(correct: number): Level {
  if (correct <= 2) return "A1";
  if (correct <= 4) return "A2";
  if (correct <= 6) return "B1";
  if (correct <= 8) return "B2";
  if (correct === 9) return "C1";
  return "C2";
}

export const DAILY_TOPICS = [
  { title: "En el restaurante", emoji: "🍝", description: "Pedir, preguntar por platos y pagar" },
  { title: "De compras", emoji: "🛍️", description: "Tallas, precios, devoluciones" },
  { title: "Transporte y viajes", emoji: "🚆", description: "Billetes, horarios, aeropuerto" },
  { title: "En el médico", emoji: "🩺", description: "Síntomas, citas, farmacia" },
  { title: "Vivienda y alquiler", emoji: "🏠", description: "Buscar piso, averías, vecinos" },
  { title: "Llamadas y citas", emoji: "📞", description: "Reservar, cambiar o cancelar" },
  { title: "Hacer amigos", emoji: "👋", description: "Presentarse, planes, small talk" },
  { title: "Gestiones y banco", emoji: "🏦", description: "Cuentas, trámites, oficinas" },
];

export const GENERAL_UNITS: Record<Level, string[]> = {
  A1: ["Hello! Personal information", "Family and friends", "Daily routines", "Food and drink", "My home", "Free time"],
  A2: ["Past experiences", "Travel and holidays", "Shopping and money", "Health and body", "Jobs and work", "Plans for the future"],
  B1: ["Life stories", "The world of work", "Technology today", "Environment", "Entertainment and media", "Relationships"],
  B2: ["Changing lifestyles", "Science and discovery", "Crime and justice", "Global issues", "Communication skills", "Arts and culture"],
  C1: ["Identity and society", "Persuasion and influence", "Innovation and ethics", "Language and thought", "Risk and reward", "The economy"],
  C2: ["Nuance and connotation", "Power and politics", "Philosophy of mind", "Literary styles", "Rhetoric in debate", "Futures and forecasting"],
};

export type Card = { term: string; meaning_es: string; example_en: string; example_es: string };
export type ExerciseType =
  | "multiple_choice"
  | "fill_blank"
  | "order_words"
  | "translate"
  | "open_question"
  | "listening"
  | "read_aloud"
  | "listening_choice";
export type Exercise = {
  type: ExerciseType;
  section: string;
  instruction_es: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation_es: string;
};
export type UnitContent = {
  title: string;
  objective_es: string;
  intro_es: string;
  cards: Card[];
  grammar: { title: string; explanation_es: string; examples: string[] };
  dialogue: { speaker: string; es: string; en: string }[];
  reading: { title: string; text: string };
  exercises: Exercise[];
};

export function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Exercises that can be checked exactly without AI. */
export function isLocallyChecked(t: ExerciseType) {
  return t === "multiple_choice" || t === "fill_blank" || t === "order_words" || t === "listening" || t === "listening_choice";
}

export function checkLocal(answer: string, expected: string) {
  return normalize(answer) === normalize(expected);
}

/** Word overlap (0–100) between what was said and the expected text. */
export function pronunciationScore(said: string, expected: string) {
  const exp = normalize(expected).split(" ").filter(Boolean);
  const got = new Set(normalize(said).split(" ").filter(Boolean));
  if (!exp.length) return 0;
  const hit = exp.filter((w) => got.has(w)).length;
  return Math.round((hit / exp.length) * 100);
}

/** Mastery 0–100 after an attempt: +20 when right, −25 when wrong. */
export function nextMastery(current: number, correct: boolean) {
  return Math.max(0, Math.min(100, current + (correct ? 20 : -25)));
}

export const CONSOLIDATED = 70;

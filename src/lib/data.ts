import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { nextMastery } from "./learning";
import type { CourseState, CourseUnit } from "./course";

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("No has iniciado sesión");
  return data.user.id;
}

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async () => {
    const id = await uid();
    const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },
});

export const unitsQuery = queryOptions({
  queryKey: ["units"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("units")
      .select("id, block, level, topic, title, status, progress, score, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const itemsQuery = queryOptions({
  queryKey: ["items"],
  queryFn: async () => {
    const { data, error } = await supabase.from("learned_items").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const attemptsQuery = queryOptions({
  queryKey: ["attempts"],
  queryFn: async () => {
    const { data, error } = await supabase.from("attempts").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) throw error;
    return data;
  },
});

export const useProfile = () => useQuery(profileQuery);
export const useUnits = () => useQuery(unitsQuery);
export const useItems = () => useQuery(itemsQuery);
export const useAttempts = () => useQuery(attemptsQuery);

export function useRecordAttempt() {
  const qc = useQueryClient();
  return async (a: {
    unit_id?: string | null | undefined;
    item_id?: string | null | undefined;
    block?: string | null | undefined;
    exercise_type: string;
    prompt: string;
    answer: string;
    expected: string;
    correct: boolean;
    score: number;
    feedback?: string | null | undefined;
    currentMastery?: number | undefined;
    itemAttempts?: number | undefined;
    itemCorrect?: number | undefined;
  }) => {
    const user_id = await uid();
    await supabase.from("attempts").insert({
      user_id,
      unit_id: a.unit_id ?? null,
      item_id: a.item_id ?? null,
      block: a.block ?? null,
      exercise_type: a.exercise_type,
      prompt: a.prompt,
      answer: a.answer,
      expected: a.expected,
      correct: a.correct,
      score: a.score,
      feedback: a.feedback ?? null,
    });
    if (a.item_id) {
      await supabase
        .from("learned_items")
        .update({
          mastery: nextMastery(a.currentMastery ?? 0, a.correct),
          attempts: (a.itemAttempts ?? 0) + 1,
          correct: (a.itemCorrect ?? 0) + (a.correct ? 1 : 0),
          last_seen: new Date().toISOString(),
        })
        .eq("id", a.item_id);
      qc.invalidateQueries({ queryKey: ["items"] });
    }
    qc.invalidateQueries({ queryKey: ["attempts"] });
  };
}

/** Consecutive days with at least one attempt, ending today or yesterday. */
export function streakFrom(dates: string[]) {
  const days = new Set(dates.map((d) => new Date(d).toDateString()));
  let streak = 0;
  const cur = new Date();
  if (!days.has(cur.toDateString())) cur.setDate(cur.getDate() - 1);
  while (days.has(cur.toDateString())) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

export const notesQuery = queryOptions({
  queryKey: ["notes"],
  queryFn: async () => {
    const { data, error } = await supabase.from("notes").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});
export const useNotes = () => useQuery(notesQuery);

export const examsQuery = queryOptions({
  queryKey: ["exams"],
  queryFn: async () => {
    const { data, error } = await supabase.from("level_exams").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});
export const useExams = () => useQuery(examsQuery);

export function useAddNote() {
  const qc = useQueryClient();
  return async (n: { text: string; source: string; source_label?: string | null; unit_id?: string | null }) => {
    const user_id = await uid();
    const { error } = await supabase.from("notes").insert({
      user_id,
      text: n.text.slice(0, 2000),
      source: n.source,
      source_label: n.source_label ?? null,
      unit_id: n.unit_id ?? null,
    });
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["notes"] });
  };
}

/** Gets (or creates on first open) the progress row of a course unit, and its review cards. */
export async function ensureCourseUnit(u: CourseUnit) {
  const user_id = await uid();
  const { data: rows } = await supabase.from("units").select("*").eq("block", "general").eq("topic", u.id).limit(1);
  if (rows?.[0]) return rows[0];
  const state: CourseState = { course: u.id, done: [], scores: {} };
  const { data, error } = await supabase
    .from("units")
    .insert({ user_id, block: "general", level: u.level, topic: u.id, title: u.title, content: state, status: "in_progress", progress: 0 })
    .select("*")
    .single();
  if (error) throw error;
  const vocab = u.sections.filter((s) => s.key === "vocabulary" || s.key === "phrasal_verbs").flatMap((s) => s.items ?? []);
  if (vocab.length)
    await supabase.from("learned_items").insert(vocab.map((v) => ({ user_id, unit_id: data.id, block: "general", term: v.en, meaning: v.es, example: v.example })));
  return data;
}

/** Turns a note into a review card (learned_items row) so it enters smart review. */
export async function noteToCard(note: { id: string; text: string; unit_id: string | null }, meaning: string) {
  const user_id = await uid();
  const [term, ...rest] = note.text.split(/\s[-—=:]\s/);
  const { data, error } = await supabase
    .from("learned_items")
    .insert({ user_id, unit_id: note.unit_id, block: "notes", term: (term ?? note.text).trim().slice(0, 200), meaning: meaning || rest.join(" ").trim() || "—", example: note.text.slice(0, 500) })
    .select("id")
    .single();
  if (error) throw error;
  await supabase.from("notes").update({ item_id: data.id }).eq("id", note.id);
}

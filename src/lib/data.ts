import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { nextMastery } from "./learning";

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
    unit_id?: string | null;
    item_id?: string | null;
    block?: string | null;
    exercise_type: string;
    prompt: string;
    answer: string;
    expected: string;
    correct: boolean;
    score: number;
    feedback?: string | null;
    currentMastery?: number;
    itemAttempts?: number;
    itemCorrect?: number;
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

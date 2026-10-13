import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CONSOLIDATED, type Exercise } from "@/lib/learning";
import { useAttempts, useItems, useRecordAttempt } from "@/lib/data";
import { ExerciseCard, type Feedback } from "./lesson";
import { Empty, Loading } from "./Page";

type Item = { id: string; term: string; meaning: string; example: string | null; mastery: number; attempts: number; correct: number; block: string; unit_id: string | null };
type Q = { ex: Exercise; item?: Item; unit_id?: string | null; block?: string | null };

function shuffle<T>(a: T[]) {
  return [...a].sort(() => Math.random() - 0.5);
}

/** Builds an adaptive set: weakest items first, plus recently failed open exercises. */
export function buildReview(items: Item[], failed: { prompt: string; expected: string | null; exercise_type: string; unit_id: string | null; block: string | null }[], count: number): Q[] {
  const weak = [...items].sort((a, b) => a.mastery - b.mastery).filter((i) => i.mastery < CONSOLIDATED);
  const pool = weak.length >= 3 ? weak : [...items].sort((a, b) => a.mastery - b.mastery);
  const out: Q[] = [];
  const kinds = ["meaning", "listen", "write"] as const;
  pool.slice(0, count).forEach((it, k) => {
    const others = shuffle(items.filter((o) => o.id !== it.id)).slice(0, 3);
    const kind = others.length < 2 ? "write" : kinds[k % 3];
    if (kind === "write")
      out.push({ item: it, ex: { type: "fill_blank", section: "Repaso · vocabulario", instruction_es: `Escribe en inglés: “${it.meaning}”`, prompt: it.example ? it.example.replace(new RegExp(it.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "___") : "___", options: [], answer: it.term, explanation_es: it.example ?? "" } });
    else if (kind === "meaning")
      out.push({ item: it, ex: { type: "multiple_choice", section: "Repaso · significado", instruction_es: `¿Qué significa “${it.term}”?`, prompt: it.term, options: shuffle([it.meaning, ...others.map((o) => o.meaning)]), answer: it.meaning, explanation_es: it.example ?? "" } });
    else
      out.push({ item: it, ex: { type: "multiple_choice", section: "Repaso · listening", instruction_es: "Escucha la palabra y elige la correcta", prompt: it.term, options: shuffle([it.term, ...others.map((o) => o.term)]), answer: it.term, explanation_es: `${it.term}: ${it.meaning}` } });
  });
  const seen = new Set<string>();
  failed
    .filter((f) => (f.exercise_type === "translate" || f.exercise_type === "open_question") && f.expected && !seen.has(f.prompt) && seen.add(f.prompt))
    .slice(0, Math.max(1, Math.floor(count / 4)))
    .forEach((f) =>
      out.push({ unit_id: f.unit_id, block: f.block, ex: { type: f.exercise_type as Exercise["type"], section: "Repaso · lo que falló", instruction_es: f.exercise_type === "translate" ? "Vuelve a traducir al inglés" : "Responde de nuevo en inglés", prompt: f.prompt, options: [], answer: f.expected!, explanation_es: "" } }),
    );
  return out;
}

export function ReviewSession({ count = 8, compact = false }: { count?: number; compact?: boolean }) {
  const items = useItems();
  const attempts = useAttempts();
  const record = useRecordAttempt();
  const [seed, setSeed] = useState(0);
  const [i, setI] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [right, setRight] = useState(0);

  const questions = useMemo(() => {
    if (!items.data || !attempts.data) return [];
    const failed = attempts.data.filter((a) => !a.correct);
    return buildReview(items.data as Item[], failed, count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.data?.length, attempts.data?.length === 0, seed, count]);

  if (items.isLoading || attempts.isLoading) return <Loading />;
  if (!questions.length)
    return (
      <Empty title="Aún no hay nada que repasar" text="Completa tu primera lección y aquí aparecerán ejercicios sobre lo que más te cuesta.">
        <Link to="/block/$block" params={{ block: "daily" }} className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground">Empezar una lección</Link>
      </Empty>
    );

  if (i >= questions.length)
    return (
      <div className="space-y-4 rounded-3xl bg-mint-soft p-6 text-center">
        <p className="text-4xl">🎯</p>
        <p className="text-xl font-extrabold text-navy">¡Repaso terminado! {right}/{questions.length}</p>
        <p className="text-sm text-muted-foreground">Lo que fallaste volverá a salir hasta que lo consolides.</p>
        <button onClick={() => { setSeed(seed + 1); setI(0); setRight(0); setAnswered(false); }} className="h-12 rounded-full bg-primary px-6 font-bold text-primary-foreground">Otra ronda</button>
      </div>
    );

  const q = questions[i];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-sun transition-all" style={{ width: `${(i / questions.length) * 100}%` }} /></div>
        <span className="text-xs font-bold text-muted-foreground">{i + 1}/{questions.length}</span>
      </div>
      <div className={compact ? "" : "rounded-3xl border bg-card p-5 shadow-soft"}>
        <ExerciseCard
          key={`${seed}-${i}`}
          ex={q.ex.section === "Repaso · listening" ? { ...q.ex, type: "listening_choice" as never } : q.ex}
          onDone={async (answer: string, fb: Feedback) => {
            setAnswered(true);
            if (fb.correct) setRight((r) => r + 1);
            await record({
              item_id: q.item?.id,
              unit_id: q.item?.unit_id ?? q.unit_id,
              block: q.item?.block ?? q.block,
              exercise_type: q.ex.type,
              prompt: q.ex.prompt,
              answer,
              expected: q.ex.answer,
              correct: fb.correct,
              score: fb.score,
              feedback: fb.feedback_es,
              currentMastery: q.item?.mastery,
              itemAttempts: q.item?.attempts,
              itemCorrect: q.item?.correct,
            });
          }}
        />
        {answered && (
          <button onClick={() => { setI(i + 1); setAnswered(false); }} className="mt-4 h-12 w-full rounded-full bg-navy font-bold text-navy-foreground">Siguiente</button>
        )}
      </div>
    </div>
  );
}

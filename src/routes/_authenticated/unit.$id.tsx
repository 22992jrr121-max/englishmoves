import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Page, Loading, Empty } from "@/components/Page";
import { DialogueSim, ExerciseCard, FlashCards, type Feedback } from "@/components/lesson";
import { ListenButton, ReadAloud } from "@/components/audio";
import { useItems, useRecordAttempt } from "@/lib/data";
import { BLOCKS, normalize, type Block, type UnitContent } from "@/lib/learning";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/unit/$id")({
  head: () => ({ meta: [{ title: "Lección — English Moves" }, { name: "description", content: "Aprende, escucha y practica." }, { property: "og:title", content: "Lección — English Moves" }, { property: "og:description", content: "Aprende, escucha y practica." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: UnitPage,
});

type Tab = "learn" | "dialogue" | "practice";

function UnitPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const record = useRecordAttempt();
  const items = useItems();
  const unit = useQuery({
    queryKey: ["unit", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [tab, setTab] = useState<Tab>("learn");
  const [idx, setIdx] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [scores, setScores] = useState<number[]>([]);

  if (unit.isLoading) return <Loading />;
  if (!unit.data) return <Page><Empty title="Lección no encontrada" text="Puede que se haya borrado." /></Page>;
  const u = unit.data;
  const course = (u.content as { course?: string } | null)?.course;
  if (course) return <Navigate to="/course/$code" params={{ code: course }} />;
  const c = u.content as unknown as UnitContent;
  const block = u.block as Block;
  const unitItems = (items.data ?? []).filter((i) => i.unit_id === u.id);

  function itemFor(text: string) {
    const t = normalize(text);
    return unitItems.find((i) => t.includes(normalize(i.term)));
  }

  async function saveProgress(nextIdx: number, newScores: number[]) {
    const total = c.exercises.length;
    const progress = Math.round((nextIdx / total) * 100);
    const finished = nextIdx >= total;
    const avg = newScores.length ? Math.round(newScores.reduce((a, b) => a + b, 0) / newScores.length) : 0;
    await supabase.from("units").update({ progress, status: finished ? "done" : "in_progress", score: finished ? avg : u.score, updated_at: new Date().toISOString() }).eq("id", u.id);
    qc.invalidateQueries({ queryKey: ["units"] });
    qc.invalidateQueries({ queryKey: ["unit", id] });
  }

  async function onExercise(prompt: string, expected: string, type: string, answer: string, fb: Feedback) {
    const it = itemFor(`${expected} ${prompt}`);
    await record({ unit_id: u.id, block, item_id: it?.id, exercise_type: type, prompt, answer, expected, correct: fb.correct, score: fb.score, feedback: fb.feedback_es, currentMastery: it?.mastery, itemAttempts: it?.attempts, itemCorrect: it?.correct });
  }

  async function markCard(term: string, known: boolean) {
    const it = unitItems.find((i) => i.term === term);
    if (it) await record({ unit_id: u.id, block, item_id: it.id, exercise_type: "flashcard", prompt: term, answer: known ? "known" : "review", expected: term, correct: known, score: known ? 100 : 0, currentMastery: it.mastery, itemAttempts: it.attempts, itemCorrect: it.correct });
  }

  const tabs: { k: Tab; label: string }[] = [
    { k: "learn", label: "Aprende" },
    ...(c.dialogue?.length ? [{ k: "dialogue" as Tab, label: "Diálogo" }] : []),
    { k: "practice", label: `Practica (${c.exercises.length})` },
  ];
  const ex = c.exercises[idx]!;

  return (
    <Page>
      <Link to="/block/$block" params={{ block }} className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-primary"><ArrowLeft className="h-4 w-4" /> {BLOCKS[block].name}</Link>
      <div className="mb-4">
        <span className="rounded-full bg-cobalt-soft px-3 py-1 text-xs font-bold text-primary">{u.level}</span>
        <h1 className="mt-2 text-2xl font-extrabold text-navy sm:text-3xl">{c.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">🎯 {c.objective_es}</p>
      </div>

      <div className="sticky top-0 z-30 -mx-4 mb-5 bg-background/90 px-4 py-2 backdrop-blur">
        <div className="flex gap-1 rounded-full bg-muted p-1">
          {tabs.map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)} className={cn("h-11 flex-1 rounded-full text-sm font-bold transition", tab === t.k ? "bg-card text-navy shadow-soft" : "text-muted-foreground")}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-2xl">
        {tab === "learn" && (
          <div className="space-y-6">
            <p className="rounded-3xl bg-card p-5 text-base leading-relaxed shadow-soft">{c.intro_es}</p>
            <section>
              <h2 className="mb-3 text-lg font-extrabold text-navy">Tarjetas de vocabulario</h2>
              <FlashCards cards={c.cards} onMark={markCard} />
            </section>
            {c.grammar?.title && (
              <section className="space-y-3 rounded-3xl bg-cobalt-soft p-5">
                <h2 className="text-lg font-extrabold text-navy">📐 {c.grammar.title}</h2>
                <p className="text-sm leading-relaxed">{c.grammar.explanation_es}</p>
                <ul className="space-y-2">
                  {c.grammar.examples.map((e) => (
                    <li key={e} className="flex items-center gap-2 rounded-2xl bg-card p-3"><span className="min-w-0 flex-1 font-medium">{e}</span><ListenButton text={e} size="sm" /></li>
                  ))}
                </ul>
              </section>
            )}
            {c.reading?.text && (
              <section className="space-y-3 rounded-3xl bg-card p-5 shadow-soft">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-extrabold text-navy">📖 {c.reading.title}</h2>
                  <ListenButton text={c.reading.text} label="Escuchar" />
                </div>
                <p className="whitespace-pre-line leading-relaxed">{c.reading.text}</p>
                <ReadAloud expected={c.reading.text.split(/(?<=[.!?])\s/).slice(0, 2).join(" ")} />
              </section>
            )}
            <button onClick={() => setTab(c.dialogue?.length ? "dialogue" : "practice")} className="h-14 w-full rounded-full bg-primary text-lg font-bold text-primary-foreground">Continuar</button>
          </div>
        )}

        {tab === "dialogue" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Simulación real: traduce cada frase al inglés, revisa la corrección y léela en voz alta.</p>
            <DialogueSim lines={c.dialogue} onLine={(prompt, answer, fb) => onExercise(prompt, fb.corrected ?? "", "translate", answer, fb)} />
            <button onClick={() => setTab("practice")} className="h-12 w-full rounded-full bg-secondary font-bold">Ir a los ejercicios</button>
          </div>
        )}

        {tab === "practice" && (
          idx >= c.exercises.length ? (
            <div className="space-y-4 rounded-3xl bg-mint-soft p-8 text-center">
              <p className="text-5xl">🏆</p>
              <p className="text-2xl font-extrabold text-navy">¡Unidad completada!</p>
              <p className="text-muted-foreground">Puntuación media: {scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : u.score ?? 0}%</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Link to="/review" className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 font-bold text-primary-foreground">Repasar lo difícil</Link>
                <button onClick={() => { setIdx(0); setScores([]); setAnswered(false); }} className="h-12 rounded-full bg-card px-6 font-bold">Repetir</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-mint transition-all" style={{ width: `${(idx / c.exercises.length) * 100}%` }} /></div>
                <span className="text-xs font-bold text-muted-foreground">{idx + 1}/{c.exercises.length}</span>
              </div>
              <div className="rounded-3xl border bg-card p-5 shadow-soft">
                <ExerciseCard
                  key={idx}
                  ex={ex}
                  context={`${BLOCKS[block].name}: ${c.title}`}
                  onDone={(answer, fb) => {
                    if (answered) return;
                    setAnswered(true);
                    setScores((s) => [...s, fb.score]);
                    onExercise(ex.prompt, ex.answer, ex.type, answer, fb);
                  }}
                />
                {(answered || ex.type === "read_aloud") && (
                  <button
                    onClick={() => { const n = idx + 1; setIdx(n); setAnswered(false); saveProgress(n, scores.length ? scores : [0]); }}
                    className="mt-4 h-14 w-full rounded-full bg-navy text-base font-bold text-navy-foreground"
                  >
                    {idx + 1 === c.exercises.length ? "Terminar unidad" : answered ? "Siguiente" : "Saltar"}
                  </button>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </Page>
  );
}

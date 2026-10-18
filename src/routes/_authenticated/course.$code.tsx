import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Page, Loading, Empty } from "@/components/Page";
import { FlashCards } from "@/components/lesson";
import { ListenButton, ReadAloud } from "@/components/audio";
import { CourseExerciseCard, SpeechPlayer } from "@/components/course";
import { ensureCourseUnit, useItems, useProfile, useRecordAttempt, useUnits } from "@/lib/data";
import { loadCourseUnit, type CourseSection, type CourseState, type CourseUnit } from "@/lib/course";
import { normalize, unitUnlocked } from "@/lib/learning";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/course/$code")({
  head: () => ({ meta: [{ title: "Unidad de Inglés General — English Moves" }, { name: "description", content: "Vocabulario, gramática, phrasal verbs, listening, speaking, reading y writing." }, { property: "og:title", content: "Unidad de Inglés General — English Moves" }, { property: "og:description", content: "Vocabulario, gramática, phrasal verbs, listening, speaking, reading y writing." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: CoursePage,
});

function CoursePage() {
  const { code } = Route.useParams();
  const profile = useProfile();
  const units = useUnits();
  const unit = useQuery({ queryKey: ["course-unit", code], queryFn: () => loadCourseUnit(code), staleTime: Infinity });
  if (profile.isLoading || units.isLoading || unit.isLoading) return <Loading />;
  if (!unit.data) return <Page><Empty title="Unidad no encontrada" text="Vuelve a Inglés General y elige otra unidad." /></Page>;
  const done = (units.data ?? []).filter((u) => u.block === "general" && u.status === "done").map((u) => u.topic);
  if (!unitUnlocked(code, profile.data?.level, done))
    return (
      <Page>
        <Empty title="Unidad bloqueada" text="Termina primero las unidades anteriores de tu nivel o aprueba el examen de nivel.">
          <Link to="/block/$block" params={{ block: "general" }} className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 font-bold text-primary-foreground"><Lock className="h-4 w-4" /> Ver unidades</Link>
        </Empty>
      </Page>
    );
  return <UnitView unit={unit.data} />;
}

function UnitView({ unit: c }: { unit: CourseUnit }) {
  const qc = useQueryClient();
  const record = useRecordAttempt();
  const items = useItems();
  const row = useQuery({ queryKey: ["course-row", c.id], queryFn: () => ensureCourseUnit(c) });
  const sections = [...c.sections].sort((a, b) => a.order - b.order);
  const [sel, setSel] = useState<string | null>(null);

  if (row.isLoading) return <Loading />;
  if (!row.data) return <Page><Empty title="No se pudo abrir la unidad" text="Inténtalo de nuevo en unos segundos." /></Page>;
  const r = row.data;
  const state = (r.content as unknown as CourseState) ?? { course: c.id, done: [], scores: {} };
  const current = sel ?? sections.find((s) => !state.done.includes(s.key))?.key ?? sections[0]!.key;
  const section = sections.find((s) => s.key === current)!;
  const unitItems = (items.data ?? []).filter((i) => i.unit_id === r.id);

  async function finishSection(key: string, score: number | null) {
    const done = Array.from(new Set([...state.done, key]));
    const scores = { ...state.scores, ...(score === null ? {} : { [key]: score }) };
    const all = sections.every((s) => done.includes(s.key));
    const vals = Object.values(scores);
    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 100;
    await supabase
      .from("units")
      .update({ content: { course: c.id, done, scores }, progress: Math.round((done.length / sections.length) * 100), status: all ? "done" : "in_progress", score: all ? avg : r.score, updated_at: new Date().toISOString() })
      .eq("id", r.id);
    await qc.invalidateQueries({ queryKey: ["course-row", c.id] });
    qc.invalidateQueries({ queryKey: ["units"] });
    const next = sections.find((s) => !done.includes(s.key));
    setSel(next?.key ?? key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function markCard(term: string, known: boolean) {
    const it = unitItems.find((i) => i.term === term);
    if (it) record({ unit_id: r.id, block: "general", item_id: it.id, exercise_type: "flashcard", prompt: term, answer: known ? "known" : "review", expected: term, correct: known, score: known ? 100 : 0, currentMastery: it.mastery, itemAttempts: it.attempts, itemCorrect: it.correct });
  }

  function onAnswer(prompt: string, expected: string, format: string, answer: string, correct: boolean) {
    const t = normalize(`${prompt} ${expected}`);
    const it = unitItems.find((i) => t.includes(normalize(i.term)));
    record({ unit_id: r.id, block: "general", item_id: it?.id, exercise_type: format, prompt, answer, expected, correct, score: correct ? 100 : 0, currentMastery: it?.mastery, itemAttempts: it?.attempts, itemCorrect: it?.correct });
  }

  const allDone = sections.every((s) => state.done.includes(s.key));

  return (
    <Page>
      <Link to="/block/$block" params={{ block: "general" }} className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-primary"><ArrowLeft className="h-4 w-4" /> Inglés General</Link>
      <div className="mb-4">
        <span className="rounded-full bg-cobalt-soft px-3 py-1 text-xs font-bold text-primary">{c.level} · Unidad {c.sequence}</span>
        <h1 className="mt-2 text-2xl font-extrabold text-navy sm:text-3xl">{c.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">🎯 {c.objective}</p>
      </div>

      <div className="sticky top-0 z-30 -mx-4 mb-5 bg-background/90 px-4 py-2 backdrop-blur">
        <div className="flex gap-1 overflow-x-auto rounded-full bg-muted p-1">
          {sections.map((s) => (
            <button key={s.key} onClick={() => setSel(s.key)} className={cn("flex h-10 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-bold transition sm:text-sm", current === s.key ? "bg-card text-navy shadow-soft" : "text-muted-foreground")}>
              {state.done.includes(s.key) && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
              {s.key === "phrasal_verbs" ? "Phrasal verbs" : s.title}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-2xl">
        {allDone && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-3xl bg-mint-soft p-4">
            <p className="font-extrabold text-navy">🏆 Unidad completada · {r.score ?? 0}%</p>
            <Link to="/block/$block" params={{ block: "general" }} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Siguiente unidad</Link>
          </div>
        )}
        <SectionView
          key={section.key}
          section={section}
          unit={c}
          isDone={state.done.includes(section.key)}
          onCard={markCard}
          onAnswer={onAnswer}
          onFinish={(score) => finishSection(section.key, score)}
        />
        <p className="mt-8 text-center text-xs text-muted-foreground">Práctica original inspirada en los formatos Cambridge. No es material oficial.</p>
      </div>
    </Page>
  );
}

function SectionView({ section: s, unit, isDone, onCard, onAnswer, onFinish }: {
  section: CourseSection;
  unit: CourseUnit;
  isDone: boolean;
  onCard: (term: string, known: boolean) => void;
  onAnswer: (prompt: string, expected: string, format: string, answer: string, correct: boolean) => void;
  onFinish: (score: number | null) => void;
}) {
  const exs = unit.exercises.filter((e) => e.section === s.key);
  const [phase, setPhase] = useState<"learn" | "practice" | "end">("learn");
  const [idx, setIdx] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [graded, setGraded] = useState<boolean[]>([]);
  const topics = s.additional_topics ?? [];
  const ex = exs[idx];
  const score = graded.length ? Math.round((graded.filter(Boolean).length / graded.length) * 100) : null;

  return (
    <div className="space-y-5">
      <p className="rounded-3xl bg-card p-5 text-base leading-relaxed shadow-soft">{s.explanation}</p>

      {phase === "learn" && (
        <>
          {s.items?.length ? (
            <section>
              <h2 className="mb-3 text-lg font-extrabold text-navy">{s.key === "vocabulary" ? `Tarjetas de vocabulario (${s.items.length})` : "Phrasal verbs"}</h2>
              <FlashCards cards={s.items.map((i) => ({ term: i.en, meaning_es: i.es, example_en: i.example, example_es: "" }))} onMark={onCard} />
              <ul className="mt-4 divide-y rounded-3xl bg-card shadow-soft">
                {s.items.map((i) => (
                  <li key={i.en} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1"><p className="font-bold text-navy">{i.en} <span className="font-medium text-muted-foreground">· {i.es}</span></p><p className="truncate text-sm text-muted-foreground">{i.example}</p></div>
                    <ListenButton text={`${i.en}. ${i.example}`} size="sm" />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {s.key === "grammar" && (
            <>
              <GrammarBox title="📐 Estructura" form={s.form} examples={s.examples} />
              {topics.map((t) => <GrammarBox key={t.id} title={`➕ ${t.title}`} text={t.explanation} form={t.form} examples={t.examples} />)}
            </>
          )}

          {s.key === "listening" && s.script && <SpeechPlayer text={s.script} rate={s.tts?.rate ?? 0.9} reps={s.tts?.repetitions ?? 2} label="Escucha el audio" />}

          {s.key === "speaking" && s.prompts && (
            <ul className="space-y-2">{s.prompts.map((p) => <li key={p} className="flex items-center gap-2 rounded-2xl bg-cobalt-soft p-3"><span className="min-w-0 flex-1 font-medium">{p}</span><ListenButton text={p} size="sm" /></li>)}</ul>
          )}

          {s.key === "reading" && s.text && (
            <section className="space-y-3 rounded-3xl bg-card p-5 shadow-soft">
              <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-extrabold text-navy">📖 Lee el texto</h2><ListenButton text={s.text} label="Escuchar" /></div>
              <p className="whitespace-pre-line leading-relaxed">{s.text}</p>
              <ReadAloud expected={s.text.split(/(?<=[.!?])\s/).slice(0, 2).join(" ")} />
            </section>
          )}

          {s.key === "writing" && s.prompt && <p className="rounded-3xl bg-cobalt-soft p-5 font-semibold text-navy">✍️ {s.prompt}{s.word_range ? ` (${s.word_range})` : ""}</p>}

          <button onClick={() => (exs.length ? setPhase("practice") : onFinish(null))} className="h-14 w-full rounded-full bg-primary text-lg font-bold text-primary-foreground">
            {exs.length ? `Practicar (${exs.length} ejercicios)` : isDone ? "Siguiente sección" : "Marcar como hecha"}
          </button>
        </>
      )}

      {phase === "practice" && ex && (
        <div className="space-y-4">
          {s.key === "listening" && s.script && <SpeechPlayer text={s.script} rate={s.tts?.rate ?? 0.9} reps={s.tts?.repetitions ?? 2} label="Audio de la sección" />}
          {s.key === "reading" && s.text && <details className="rounded-2xl bg-card p-4 shadow-soft"><summary className="cursor-pointer font-bold text-primary">Ver el texto</summary><p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{s.text}</p></details>}
          <div className="flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-mint transition-all" style={{ width: `${(idx / exs.length) * 100}%` }} /></div>
            <span className="text-xs font-bold text-muted-foreground">{idx + 1}/{exs.length}</span>
          </div>
          <div className="rounded-3xl border bg-card p-5 shadow-soft">
            {ex.topic_id && <p className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">{topics.find((t) => t.id === ex.topic_id)?.title}</p>}
            <CourseExerciseCard
              key={ex.id}
              ex={ex}
              criteria={s.success_criteria ?? []}
              range={s.word_range}
              onDone={(answer, correct) => {
                setAnswered(true);
                if (correct !== null) {
                  setGraded((g) => [...g, correct]);
                  onAnswer(ex.prompt, ex.answer ?? "", ex.format, answer, correct);
                }
              }}
            />
            {answered && (
              <button onClick={() => { setAnswered(false); if (idx + 1 >= exs.length) setPhase("end"); else setIdx(idx + 1); }} className="mt-4 h-14 w-full rounded-full bg-navy text-base font-bold text-navy-foreground">
                {idx + 1 === exs.length ? "Terminar sección" : "Siguiente"}
              </button>
            )}
          </div>
        </div>
      )}

      {phase === "end" && (
        <div className="space-y-4 rounded-3xl bg-mint-soft p-6 text-center">
          <p className="text-4xl">🎉</p>
          <p className="text-xl font-extrabold text-navy">¡{s.key === "phrasal_verbs" ? "Phrasal verbs" : s.title} terminado!</p>
          {score !== null && <p className="text-muted-foreground">Aciertos: {score}%</p>}
          {s.key === "listening" && s.script && (
            <details className="rounded-2xl bg-card p-4 text-left"><summary className="cursor-pointer font-bold text-primary">Ver el guion</summary><p className="mt-2 text-sm leading-relaxed">{s.script}</p></details>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button onClick={() => onFinish(score)} className="h-12 rounded-full bg-primary px-6 font-bold text-primary-foreground">Continuar</button>
            <button onClick={() => { setIdx(0); setGraded([]); setAnswered(false); setPhase("practice"); }} className="h-12 rounded-full bg-card px-6 font-bold">Repetir</button>
          </div>
        </div>
      )}
    </div>
  );
}

function GrammarBox({ title, text, form, examples }: { title: string; text?: string | undefined; form?: string | undefined; examples?: string[] | undefined }) {
  return (
    <section className="space-y-3 rounded-3xl bg-cobalt-soft p-5">
      <h2 className="text-lg font-extrabold text-navy">{title}</h2>
      {text && <p className="text-sm leading-relaxed">{text}</p>}
      {form && <p className="rounded-2xl bg-card p-3 font-mono text-sm">{form}</p>}
      {examples?.length ? (
        <ul className="space-y-2">{examples.map((e) => <li key={e} className="flex items-center gap-2 rounded-2xl bg-card p-3"><span className="min-w-0 flex-1 font-medium">{e}</span><ListenButton text={e} size="sm" /></li>)}</ul>
      ) : null}
    </section>
  );
}

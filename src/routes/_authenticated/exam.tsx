import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Lock, RotateCcw, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { Page, Loading, Empty } from "@/components/Page";
import { Criteria, OralPractice, SpeechPlayer, WrittenPractice } from "@/components/course";
import { generateExam, submitExam } from "@/lib/ai.functions";
import { useProfile, useUnits } from "@/lib/data";
import { PAPER_LABEL, type ExamItem, type ExamReview, type ExamTask } from "@/lib/course";
import { EXAM_PASS, REQUIRED_UNITS, examUnlocked, nextLevel, qualifyingUnits, type Level } from "@/lib/learning";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/exam")({
  head: () => ({ meta: [{ title: "Examen de nivel — GoEnglish!" }, { name: "description", content: "Demuestra lo aprendido y sube al siguiente nivel." }] }),
  component: ExamPage,
});

type Answers = Record<string, Record<string, string>>;

function ExamPage() {
  const profile = useProfile();
  const units = useUnits();
  const qc = useQueryClient();
  const gen = useServerFn(generateExam);
  const submit = useServerFn(submitExam);
  const [tasks, setTasks] = useState<ExamTask[] | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ passed: boolean; score: number; newLevel: string | null; review: ExamReview } | null>(null);
  if (profile.isLoading || units.isLoading) return <Loading />;
  const level = (profile.data?.level ?? "A1") as Level;
  const next = nextLevel(level);
  const unlocked = examUnlocked(units.data ?? [], level);
  const have = qualifyingUnits(units.data ?? [], level);

  async function begin() {
    setLoading(true);
    const r = await gen();
    setLoading(false);
    if (r.error || !r.tasks.length) { toast.error(r.error ?? "No se pudo abrir el examen"); return; }
    setTasks(r.tasks);
    setAnswers({});
    setResult(null);
    window.scrollTo({ top: 0 });
  }
  async function finish() {
    setLoading(true);
    const r = await submit({ data: { answers } });
    setLoading(false);
    if (r.error) { toast.error(r.error); return; }
    setResult(r as typeof result & object);
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["exams"] });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const setA = (task: string, n: number, v: string) => !result && setAnswers((a) => ({ ...a, [task]: { ...a[task], [n]: v } }));

  if (!next) return <Page title="Examen de nivel"><Empty title="¡Has llegado a C1!" text="Es el nivel más alto del curso. Sigue practicando para mantenerlo." /></Page>;

  if (!unlocked)
    return (
      <Page title={`Examen ${level} → ${next}`}>
        <Empty title="Examen bloqueado" text={`Termina las ${REQUIRED_UNITS} unidades de Inglés General ${level}. Llevas ${have} de ${REQUIRED_UNITS}.`}>
          <Link to="/block/$block" params={{ block: "general" }} className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 font-bold text-primary-foreground"><Lock className="h-4 w-4" /> Ir a las unidades</Link>
        </Empty>
      </Page>
    );

  if (!tasks)
    return (
      <Page title={`Examen ${level} → ${next}`} subtitle={`Aprobado con ${EXAM_PASS} %`}>
        <div className="mx-auto max-w-md rounded-3xl bg-cobalt-soft p-8 text-center">
          <Trophy className="mx-auto h-14 w-14 text-primary" />
          <p className="mt-3 text-lg font-extrabold text-navy">¡Has desbloqueado el examen!</p>
          <p className="mt-1 text-sm text-muted-foreground">Listening, reading, writing y speaking en formato de práctica Cambridge. Las partes de expresión oral y escrita se autoevalúan con su rúbrica.</p>
          <button onClick={begin} disabled={loading} className="mt-5 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 font-bold text-primary-foreground">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Empezar examen
          </button>
          <p className="mt-4 text-xs text-muted-foreground">Práctica original inspirada en los formatos Cambridge. No es un examen oficial.</p>
        </div>
      </Page>
    );

  const gradableCount = tasks.reduce((n, t) => n + t.items.filter((i) => i.gradable).length, 0);
  const answeredCount = tasks.reduce((n, t) => n + t.items.filter((i) => i.gradable && answers[t.id]?.[i.n]?.trim()).length, 0);

  return (
    <Page title={`Examen ${level} → ${next}`} subtitle={`${tasks.length} tareas · ${gradableCount} preguntas corregibles · aprobado con ${EXAM_PASS} %`}>
      {result && (
        <div className={cn("mx-auto mb-6 max-w-md rounded-3xl p-8 text-center", result.passed ? "bg-mint-soft" : "bg-sun-soft")}>
          <Trophy className={cn("mx-auto h-14 w-14", result.passed ? "text-mint" : "text-sun")} />
          <p className="mt-3 text-4xl font-extrabold text-navy">{result.score}%</p>
          <p className="mt-2 text-lg font-extrabold text-navy">{result.passed ? `¡Enhorabuena! Ahora eres ${result.newLevel}` : "Casi lo tienes"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{result.passed ? "Se han abierto las unidades del nuevo nivel." : `Necesitas un ${EXAM_PASS} %. Revisa las soluciones abajo, haz el repaso inteligente y vuelve a intentarlo.`}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Link to="/home" className="inline-flex h-12 items-center rounded-full bg-primary px-6 font-bold text-primary-foreground">Ir al inicio</Link>
            {!result.passed && <button onClick={begin} className="inline-flex h-12 items-center gap-2 rounded-full bg-card px-5 font-bold text-primary"><RotateCcw className="h-4 w-4" /> Repetir</button>}
          </div>
        </div>
      )}
      <div className="mx-auto max-w-2xl space-y-5">
        {tasks.map((t, i) => (
          <TaskCard key={t.id} index={i + 1} task={t} answers={answers[t.id] ?? {}} review={result?.review[t.id]} onAnswer={(n, v) => setA(t.id, n, v)} />
        ))}
        {!result && (
          <button onClick={finish} disabled={loading} className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-50">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Entregar ({answeredCount}/{gradableCount})
          </button>
        )}
      </div>
    </Page>
  );
}

const fillGaps = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, n) => (n === "gap" ? "________" : `(${n}) ______`));

function choicesFor(t: ExamTask, it: ExamItem): string[] | null {
  if (it.options?.length) return it.options;
  if (t.options) return Array.isArray(t.options) ? t.options : Object.keys(t.options);
  if (t.candidate_paragraphs) return Object.keys(t.candidate_paragraphs);
  if (t.candidate_sentences) return Object.keys(t.candidate_sentences);
  if (t.word_bank) return t.word_bank;
  return null;
}

function TaskCard({ index, task: t, answers, review, onAnswer }: { index: number; task: ExamTask; answers: Record<string, string>; review?: Record<string, { correct: boolean; answer: string; explanation?: string }>; onAnswer: (n: number, v: string) => void }) {
  const dict = (t.options && !Array.isArray(t.options) ? t.options : null) ?? t.candidate_paragraphs ?? t.candidate_sentences ?? null;
  const text = t.text_with_gaps ?? t.text;
  const done = !!review;
  return (
    <section className="space-y-4 rounded-3xl bg-card p-5 shadow-soft">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tarea {index} · {PAPER_LABEL[t.paper] ?? t.paper} · Parte {t.part}</p>
        <h2 className="mt-1 text-lg font-extrabold text-navy">{t.title}</h2>
      </div>
      {t.strategy_es && <p className="rounded-2xl bg-sun-soft p-3 text-sm"><span className="font-bold">💡 Estrategia: </span>{t.strategy_es}</p>}
      <p className="text-sm font-semibold">{t.instructions}</p>

      {t.images?.length ? <div className={cn("grid gap-2", t.images.length > 1 && "sm:grid-cols-2")}>{t.images.map((src) => <img key={src} src={src} alt="Imagen de la tarea" loading="lazy" className="w-full rounded-2xl border bg-muted object-cover" />)}</div> : null}

      {t.segments?.length ? (
        <div className="space-y-2">{t.segments.map((s, k) => <div key={k} className="space-y-1"><SpeechPlayer text={s} rate={t.tts?.rate ?? 0.9} label={`Fragmento ${k + 1}`} />{done && <p className="px-2 text-xs text-muted-foreground">{s}</p>}</div>)}</div>
      ) : t.script ? (
        <div className="space-y-1"><SpeechPlayer text={t.script} rate={t.tts?.rate ?? 0.9} label="Escucha el audio" />{done && <p className="px-2 text-xs text-muted-foreground">{t.script}</p>}</div>
      ) : null}

      {text && <p className="whitespace-pre-line rounded-2xl bg-muted p-4 text-sm leading-relaxed">{fillGaps(text)}</p>}
      {dict && <ul className="space-y-1.5 rounded-2xl bg-cobalt-soft p-3 text-sm">{Object.entries(dict).map(([k, v]) => <li key={k}><span className="font-extrabold text-primary">{k}.</span> {v}</li>)}</ul>}
      {t.concept_cards?.length ? <div className="flex flex-wrap gap-2">{t.concept_cards.map((c) => <span key={c} className="rounded-full bg-cobalt-soft px-3 py-1 text-sm font-semibold">{c}</span>)}</div> : null}
      {t.text_labels?.length && !dict ? <p className="text-xs text-muted-foreground">Responde con las letras de los textos ({t.text_labels.join(", ")}), por ejemplo «A and C».</p> : null}

      <ol className="space-y-3">
        {t.items.map((it) => {
          const choices = choicesFor(t, it);
          const rv = review?.[String(it.n)];
          const val = answers[String(it.n)] ?? "";
          return (
            <li key={it.n} className="space-y-2 rounded-2xl border p-3">
              <p className="text-sm font-bold text-navy">
                {it.n}. {it.question ?? (it.base ? `Palabra base: ${it.base}` : "")}
              </p>
              {it.source && (
                <div className="space-y-1 text-sm">
                  <p>{it.source}</p>
                  <p className="font-extrabold tracking-wider text-primary">{it.keyword}</p>
                  <p>{it.target ? fillGaps(it.target) : ""}</p>
                </div>
              )}
              {!it.gradable ? (
                it.response_type === "written_response" ? <WrittenPractice criteria={t.rubric ?? []} range={t.word_range} value={val} onChange={(v) => onAnswer(it.n, v)} /> : <OralPractice criteria={[]} />
              ) : choices ? (
                <div className="flex flex-wrap gap-2">
                  {choices.map((o) => (
                    <button key={o} onClick={() => onAnswer(it.n, o)} className={cn("rounded-2xl border-2 px-3 py-2 text-sm font-semibold", val === o ? "border-primary bg-cobalt-soft" : "bg-background")}>{o}</button>
                  ))}
                </div>
              ) : (
                <input value={val} onChange={(e) => onAnswer(it.n, e.target.value)} disabled={done} autoCapitalize="off" placeholder="Tu respuesta" className="h-11 w-full rounded-full border-2 bg-background px-4 text-sm outline-none focus:border-primary" />
              )}
              {rv && (
                <p className={cn("flex items-start gap-1.5 rounded-xl px-3 py-2 text-sm", rv.correct ? "bg-mint-soft" : "bg-sun-soft")}>
                  {rv.correct ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                  <span>{rv.correct ? "Correcto" : <>Solución: <b>{rv.answer}</b></>}{rv.explanation ? ` — ${rv.explanation}` : ""}</span>
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {t.requires_human_review && t.rubric?.length ? <div><p className="mb-1 text-xs font-bold text-muted-foreground">Esta tarea no puntúa: evalúate con la rúbrica.</p><Criteria items={t.rubric} /></div> : null}
    </section>
  );
}

import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronLeft, ChevronRight, Loader2, RotateCcw, X } from "lucide-react";
import { correctAnswer } from "@/lib/ai.functions";
import { checkLocal, isLocallyChecked, normalize, type Card, type Exercise } from "@/lib/learning";
import { ListenButton, ReadAloud } from "./audio";
import { cn } from "@/lib/utils";

export type Feedback = { correct: boolean; score: number; corrected?: string; feedback_es?: string };

/** Interactive flashcards: tap to flip, listen, mark "Lo sé" / "A repasar". */
export function FlashCards({ cards, onMark }: { cards: Card[]; onMark?: (term: string, known: boolean) => void }) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  if (!cards.length) return null;
  const c = cards[i];
  const go = (d: number) => {
    setFlipped(false);
    setI((x) => (x + d + cards.length) % cards.length);
  };
  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setFlipped((f) => !f)}
        className={cn(
          "relative flex min-h-64 cursor-pointer select-none flex-col justify-between rounded-3xl p-6 shadow-soft transition-colors sm:min-h-72",
          flipped ? "bg-mint-soft" : "bg-cobalt-soft",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {i + 1} / {cards.length} · {flipped ? "Significado" : "Toca para girar"}
          </span>
          <ListenButton text={flipped ? c.example_en : c.term} />
        </div>
        {!flipped ? (
          <p className="py-6 text-center text-3xl font-extrabold leading-tight text-navy sm:text-4xl">{c.term}</p>
        ) : (
          <div className="space-y-3 py-4">
            <p className="text-2xl font-bold text-navy">{c.meaning_es}</p>
            <p className="text-lg font-medium">“{c.example_en}”</p>
            <p className="text-sm text-muted-foreground">{c.example_es}</p>
          </div>
        )}
        <span />
      </div>
      <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-2">
        <button onClick={() => go(-1)} aria-label="Anterior" className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary active:scale-95"><ChevronLeft /></button>
        <button onClick={() => { onMark?.(c.term, false); go(1); }} className="h-12 rounded-full bg-sun-soft text-sm font-bold text-sun-foreground active:scale-95">A repasar</button>
        <button onClick={() => { onMark?.(c.term, true); go(1); }} className="h-12 rounded-full bg-mint text-sm font-bold text-mint-foreground active:scale-95">¡Lo sé!</button>
        <button onClick={() => go(1)} aria-label="Siguiente" className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary active:scale-95"><ChevronRight /></button>
      </div>
    </div>
  );
}

function FeedbackBox({ fb, expected }: { fb: Feedback; expected: string }) {
  return (
    <div className={cn("space-y-2 rounded-2xl p-4", fb.correct ? "bg-mint-soft" : "bg-sun-soft")}>
      <p className="flex items-center gap-2 font-bold">
        {fb.correct ? <Check className="h-5 w-5 text-success" /> : <X className="h-5 w-5 text-destructive" />}
        {fb.correct ? "¡Correcto!" : "Casi…"} <span className="ml-auto text-sm font-semibold">{fb.score}%</span>
      </p>
      {fb.corrected && (
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 text-sm">
            <span className="text-muted-foreground">Versión correcta: </span>
            <span className="font-semibold">{fb.corrected}</span>
          </p>
          <ListenButton text={fb.corrected} size="sm" />
        </div>
      )}
      {!fb.corrected && !fb.correct && (
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 text-sm"><span className="text-muted-foreground">Respuesta: </span><span className="font-semibold">{expected}</span></p>
          <ListenButton text={expected} size="sm" />
        </div>
      )}
      {fb.feedback_es && <p className="text-sm">{fb.feedback_es}</p>}
    </div>
  );
}

/** One exercise of any type, with checking (local or AI) and feedback. */
export function ExerciseCard({
  ex,
  context,
  onDone,
}: {
  ex: Exercise;
  context?: string;
  onDone: (answer: string, fb: Feedback) => void;
}) {
  const correct = useServerFn(correctAnswer);
  const [answer, setAnswer] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const words = useMemo(() => (ex.type === "order_words" ? ex.prompt.split("/").map((w) => w.trim()).filter(Boolean) : []), [ex]);

  async function submit(value = answer) {
    if (!value.trim()) return;
    setErr("");
    if (isLocallyChecked(ex.type)) {
      const ok = checkLocal(value, ex.answer);
      const f = { correct: ok, score: ok ? 100 : 0, feedback_es: ex.explanation_es };
      setFb(f);
      onDone(value, f);
      return;
    }
    setBusy(true);
    try {
      const r = await correct({ data: { type: ex.type, prompt: ex.prompt, expected: ex.answer, answer: value, context } });
      if ("error" in r && r.error) throw new Error(r.error);
      const f = { correct: r.correct, score: r.score, corrected: r.corrected, feedback_es: r.feedback_es };
      setFb(f);
      onDone(value, f);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo corregir.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <span className="rounded-full bg-cobalt-soft px-3 py-1 text-xs font-bold text-primary">{ex.section}</span>
        <p className="mt-3 text-sm font-medium text-muted-foreground">{ex.instruction_es}</p>
      </div>

      {ex.type === "listening" || ex.type === "listening_choice" ? (
        <div className="flex items-center gap-3 rounded-2xl bg-cobalt-soft p-4">
          <ListenButton text={ex.prompt} size="lg" />
          <p className="text-sm font-semibold">{ex.type === "listening" ? "Escucha y escribe lo que oyes" : "Escucha y elige lo que oyes"}</p>
        </div>
      ) : ex.type === "order_words" ? null : (
        <div className="flex items-start gap-3">
          <p className="min-w-0 flex-1 text-xl font-bold leading-snug text-navy">{ex.prompt}</p>
          {ex.type !== "translate" && <ListenButton text={ex.prompt.replace(/_{2,}/g, "blank")} size="sm" />}
        </div>
      )}

      {ex.type === "read_aloud" ? (
        <ReadAloud
          expected={ex.prompt}
          onResult={(r) => !fb && onDone(r.text, { correct: r.score >= 70, score: r.score })}
        />
      ) : ex.type === "multiple_choice" || ex.type === "listening_choice" ? (
        <div className="grid gap-2">
          {ex.options.map((o) => {
            const isAns = normalize(o) === normalize(ex.answer);
            return (
              <button
                key={o}
                disabled={!!fb}
                onClick={() => { setAnswer(o); submit(o); }}
                className={cn(
                  "min-h-12 rounded-2xl border-2 px-4 py-3 text-left font-semibold transition active:scale-[0.98]",
                  fb && isAns && "border-mint bg-mint-soft",
                  fb && answer === o && !isAns && "border-destructive bg-destructive/10",
                  !fb && "hover:border-primary",
                )}
              >
                {o}
              </button>
            );
          })}
        </div>
      ) : ex.type === "order_words" ? (
        <div className="space-y-3">
          <div className="min-h-14 rounded-2xl border-2 border-dashed p-3 text-lg font-semibold">{picked.join(" ") || <span className="text-sm font-normal text-muted-foreground">Toca las palabras en orden</span>}</div>
          <div className="flex flex-wrap gap-2">
            {words.map((w, idx) => {
              const used = picked.filter((p) => p === w).length >= words.slice(0, idx + 1).filter((x) => x === w).length;
              return (
                <button key={idx} disabled={used || !!fb} onClick={() => setPicked((p) => [...p, w])} className="h-11 rounded-full bg-secondary px-4 font-semibold disabled:opacity-30 active:scale-95">
                  {w}
                </button>
              );
            })}
          </div>
          {!fb && (
            <div className="flex gap-2">
              <button onClick={() => setPicked([])} className="flex h-12 items-center gap-2 rounded-full bg-secondary px-4 text-sm font-semibold"><RotateCcw className="h-4 w-4" /> Borrar</button>
              <button onClick={() => { const v = picked.join(" "); setAnswer(v); submit(v); }} disabled={!picked.length} className="h-12 flex-1 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-40">Comprobar</button>
            </div>
          )}
        </div>
      ) : (
        !fb && (
          <div className="space-y-2">
            {ex.type === "fill_blank" || ex.type === "listening" ? (
              <input
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                aria-label="Tu respuesta"
                autoCapitalize="off"
                className="h-14 w-full rounded-2xl border-2 bg-card px-4 text-lg outline-none focus:border-primary"
                placeholder="Escribe tu respuesta"
              />
            ) : (
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                aria-label="Tu respuesta en inglés"
                rows={3}
                className="w-full rounded-2xl border-2 bg-card p-4 text-lg outline-none focus:border-primary"
                placeholder="Escribe en inglés…"
              />
            )}
            {err && <p className="text-sm font-semibold text-destructive">{err}</p>}
            <button onClick={() => submit()} disabled={busy || !answer.trim()} className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-bold text-primary-foreground disabled:opacity-40 active:scale-[0.98]">
              {busy ? <><Loader2 className="h-5 w-5 animate-spin" /> Corrigiendo…</> : err ? "Reintentar" : "Comprobar"}
            </button>
          </div>
        )
      )}

      {fb && ex.type !== "read_aloud" && <FeedbackBox fb={fb} expected={ex.answer} />}
      {fb && (ex.type === "translate" || ex.type === "open_question") && (fb.corrected || ex.answer) && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Ahora léelo en voz alta:</p>
          <ReadAloud expected={fb.corrected || ex.answer} />
        </div>
      )}
    </div>
  );
}

/** Dialogue simulation: translate each Spanish line, get correction, then read it aloud. */
export function DialogueSim({
  lines,
  onLine,
}: {
  lines: { speaker: string; es: string; en: string }[];
  onLine: (prompt: string, answer: string, fb: Feedback) => void;
}) {
  const [i, setI] = useState(0);
  const [done, setDone] = useState<Record<number, Feedback>>({});
  if (!lines.length) return null;
  const line = lines[i];
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {lines.slice(0, i).map((l, k) => (
          <div key={k} className={cn("flex items-center gap-2", k % 2 ? "justify-end" : "")}>
            <div className={cn("max-w-[85%] rounded-2xl px-4 py-2 text-sm", k % 2 ? "bg-mint-soft" : "bg-cobalt-soft")}>
              <span className="block text-xs font-bold text-muted-foreground">{l.speaker}</span>
              {done[k]?.corrected || l.en}
            </div>
            <ListenButton text={done[k]?.corrected || l.en} size="sm" />
          </div>
        ))}
      </div>
      <div className="rounded-3xl border bg-card p-4 shadow-soft">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Línea {i + 1} de {lines.length} · {line.speaker}</p>
        <ExerciseCard
          key={i}
          ex={{ type: "translate", section: "Diálogo", instruction_es: "Traduce esta frase al inglés", prompt: line.es, options: [], answer: line.en, explanation_es: "" }}
          onDone={(a, fb) => { setDone((d) => ({ ...d, [i]: fb })); onLine(line.es, a, fb); }}
        />
        {done[i] && i < lines.length - 1 && (
          <button onClick={() => setI(i + 1)} className="mt-4 h-12 w-full rounded-full bg-navy font-bold text-navy-foreground">Siguiente línea</button>
        )}
        {done[i] && i === lines.length - 1 && <p className="mt-4 text-center font-bold text-success">¡Diálogo completado! 🎉</p>}
      </div>
    </div>
  );
}

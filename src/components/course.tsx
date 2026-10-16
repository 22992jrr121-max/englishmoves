import { useEffect, useRef, useState } from "react";
import { Check, Mic, Pause, Play, Square, X } from "lucide-react";
import { checkCourseAnswer } from "@/lib/learning";
import type { CourseExercise } from "@/lib/course";
import { ListenButton } from "./audio";
import { cn } from "@/lib/utils";

/** Device voice (en-GB preferred), limited number of plays, with pause/resume. */
export function SpeechPlayer({ text, rate = 0.9, reps = 2, label = "Escuchar" }: { text: string; rate?: number; reps?: number; label?: string }) {
  const [state, setState] = useState<"idle" | "playing" | "paused">("idle");
  const [plays, setPlays] = useState(0);
  useEffect(() => () => { if (typeof window !== "undefined") window.speechSynthesis?.cancel(); }, []);
  const left = reps - plays;

  function play() {
    const ss = window.speechSynthesis;
    if (!ss) return;
    if (state === "playing") { ss.pause(); setState("paused"); return; }
    if (state === "paused") { ss.resume(); setState("playing"); return; }
    if (left <= 0) return;
    ss.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB";
    u.rate = rate;
    const vs = ss.getVoices();
    const v = vs.find((x) => x.lang === "en-GB") ?? vs.find((x) => x.lang.startsWith("en"));
    if (v) u.voice = v;
    u.onend = () => { setState("idle"); setPlays((p) => p + 1); };
    u.onerror = () => setState("idle");
    ss.speak(u);
    setState("playing");
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-cobalt-soft p-3">
      <button onClick={play} disabled={left <= 0 && state === "idle"} aria-label={label} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40">
        {state === "playing" ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-navy">{label}</p>
        <p className="text-xs text-muted-foreground">{left > 0 ? `Te quedan ${left} de ${reps} escuchas` : "Ya has escuchado el audio dos veces"}</p>
      </div>
    </div>
  );
}

/** Record yourself and play it back, then self-check against the criteria. */
export function OralPractice({ criteria }: { criteria: string[] }) {
  const [state, setState] = useState<"idle" | "rec" | "done" | "error">("idle");
  const [url, setUrl] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  useEffect(() => () => rec.current?.stream.getTracks().forEach((t) => t.stop()), []);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = () => { setUrl(URL.createObjectURL(new Blob(chunks, { type: r.mimeType }))); stream.getTracks().forEach((t) => t.stop()); setState("done"); };
      rec.current = r;
      r.start();
      setState("rec");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {state === "rec" ? (
          <button onClick={() => rec.current?.stop()} className="inline-flex h-12 items-center gap-2 rounded-full bg-destructive px-5 font-bold text-destructive-foreground"><Square className="h-4 w-4" /> Parar</button>
        ) : (
          <button onClick={start} className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-5 font-bold text-primary-foreground"><Mic className="h-4 w-4" /> {url ? "Grabar otra vez" : "Grabar mi respuesta"}</button>
        )}
        {url && <audio src={url} controls className="h-10 max-w-full" />}
      </div>
      {state === "error" && <p className="text-sm text-destructive">No se pudo usar el micrófono. Puedes practicar en voz alta igualmente.</p>}
      <Criteria items={criteria} />
    </div>
  );
}

export function Criteria({ items }: { items: string[] }) {
  const [ok, setOk] = useState<Record<number, boolean>>({});
  if (!items.length) return null;
  return (
    <div className="rounded-2xl bg-muted p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Revisa tu respuesta</p>
      <ul className="space-y-1.5">
        {items.map((c, i) => (
          <li key={c}>
            <button onClick={() => setOk((o) => ({ ...o, [i]: !o[i] }))} className="flex w-full items-center gap-2 text-left text-sm">
              <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2", ok[i] ? "border-success bg-success text-success-foreground" : "bg-card")}>{ok[i] && <Check className="h-3.5 w-3.5" />}</span>
              {c}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WrittenPractice({ criteria, range, value, onChange }: { criteria: string[]; range?: string | undefined; value: string; onChange: (v: string) => void }) {
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  return (
    <div className="space-y-3">
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={6} placeholder="Escribe aquí en inglés…" className="w-full rounded-2xl border-2 bg-background p-4 outline-none focus:border-primary" />
      <p className="text-xs font-bold text-muted-foreground">{words} palabras{range ? ` · objetivo ${range}` : ""}</p>
      <Criteria items={criteria} />
    </div>
  );
}

/** One course exercise. onDone(answer, correct) — correct is null for open tasks. */
export function CourseExerciseCard({ ex, criteria, range, onDone }: { ex: CourseExercise; criteria: string[]; range?: string | undefined; onDone: (answer: string, correct: boolean | null) => void }) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<boolean | null | undefined>(undefined);
  const sent = result !== undefined;

  function send(a: string) {
    if (sent) return;
    const ok = checkCourseAnswer(a, ex.answer);
    setValue(a);
    setResult(ok);
    onDone(a, ok);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-lg font-bold text-navy">{ex.prompt}</p>
        {(ex.format === "oral_recording" || /[a-z]{3}/.test(ex.prompt) && ex.section !== "vocabulary") && <ListenButton text={ex.prompt} size="sm" />}
      </div>

      {ex.format === "multiple_choice" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {ex.options.map((o) => (
            <button key={o} onClick={() => send(o)} disabled={sent} className={cn("rounded-2xl border-2 px-4 py-3 text-left font-semibold transition", sent && o === ex.answer ? "border-success bg-mint-soft" : sent && o === value ? "border-destructive bg-sun-soft" : "bg-background hover:border-primary")}>{o}</button>
          ))}
        </div>
      )}

      {ex.format === "short_answer" && (
        <form onSubmit={(e) => { e.preventDefault(); if (value.trim()) send(value); }} className="flex gap-2">
          <input value={value} onChange={(e) => setValue(e.target.value)} disabled={sent} autoCapitalize="off" placeholder="Tu respuesta" className="h-12 min-w-0 flex-1 rounded-full border-2 bg-background px-4 outline-none focus:border-primary" />
          <button disabled={sent || !value.trim()} className="h-12 rounded-full bg-primary px-5 font-bold text-primary-foreground disabled:opacity-50">Comprobar</button>
        </form>
      )}

      {ex.format === "oral_recording" && (
        <>
          <OralPractice criteria={criteria} />
          {!sent && <button onClick={() => { setResult(null); onDone("oral", null); }} className="h-12 w-full rounded-full bg-secondary font-bold">He practicado en voz alta</button>}
        </>
      )}

      {ex.format === "written_response" && (
        <>
          <WrittenPractice criteria={criteria} range={range} value={value} onChange={setValue} />
          {!sent && <button disabled={!value.trim()} onClick={() => { setResult(null); onDone(value, null); }} className="h-12 w-full rounded-full bg-secondary font-bold disabled:opacity-50">He revisado mi texto</button>}
        </>
      )}

      {sent && result !== null && (
        <div className={cn("space-y-1 rounded-2xl p-4", result ? "bg-mint-soft" : "bg-sun-soft")}>
          <p className="flex items-center gap-2 font-bold">{result ? <Check className="h-5 w-5 text-success" /> : <X className="h-5 w-5 text-destructive" />}{result ? "¡Correcto!" : "Casi…"}</p>
          {!result && <p className="text-sm"><span className="text-muted-foreground">Respuesta: </span><span className="font-semibold">{ex.answer}</span></p>}
          {ex.explanation && <p className="text-sm">{ex.explanation}</p>}
        </div>
      )}
    </div>
  );
}

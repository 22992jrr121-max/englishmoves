import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mic, MicOff, Phone, PhoneOff, Play, ArrowLeft, Sparkle } from "lucide-react";
import { useLiveVoice, type LiveEvent } from "@/hooks/use-live-voice";
import { supabase } from "@/integrations/supabase/client";
import { summarizeCall } from "@/lib/ai.functions";
import { SCENARIOS, type ScenarioId } from "@/lib/learning";
import { SaveNoteButton } from "@/components/NotesFab";
import emma from "@/assets/emma.png";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/speaking")({
  head: () => ({ meta: [{ title: "Speaking en directo — English Moves" }, { name: "description", content: "Practica conversación en inglés en una llamada en tiempo real." }, { property: "og:title", content: "Speaking en directo — English Moves" }, { property: "og:description", content: "Practica conversación en inglés en una llamada en tiempo real." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: SpeakingPage,
});

type Line = { role: "user" | "assistant"; text: string };
type Summary = { fluency: number; strengths_es: string[]; improvements: { said: string; better: string; note_es: string }[]; new_words: string[]; error?: string };

function SpeakingPage() {
  const [scenario, setScenario] = useState<ScenarioId>("day");
  const [lines, setLines] = useState<Line[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const finishing = useRef(false);
  const linesRef = useRef<Line[]>([]);
  const summarize = useServerFn(summarizeCall);

  function append(role: Line["role"], delta: string) {
    setLines((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last && last.role === role) next[next.length - 1] = { role, text: last.text + delta };
      else next.push({ role, text: delta });
      linesRef.current = next;
      return next;
    });
  }

  function onEvent(e: LiveEvent) {
    const ev = e as LiveEvent & { delta?: string };
    if (ev.type === "session.input_transcript.delta" && ev.delta) append("user", ev.delta);
    if (ev.type === "session.output_transcript.delta" && ev.delta) append("assistant", ev.delta);
    if (ev.type === "app.closed" && finishing.current) {
      finishing.current = false;
      const t = linesRef.current.filter((l) => l.text.trim());
      if (t.some((l) => l.role === "user")) {
        setSummarizing(true);
        void summarize({ data: { scenario: SCENARIOS[scenario].title, transcript: t } }).then((r) => {
          setSummary(r as Summary);
          setSummarizing(false);
        });
      }
    }
  }

  const call = useLiveVoice({
    onEvent,
    startPayload: async () => {
      const { data } = await supabase.auth.getSession();
      return { scenario, token: data.session?.access_token ?? "" };
    },
  });
  const idle = call.status === "idle" || call.status === "closed";
  const live = call.status === "connected";

  function start() {
    setLines([]);
    linesRef.current = [];
    setSummary(null);
    finishing.current = false;
    call.start();
  }
  function hangUp() {
    finishing.current = true;
    call.stop();
  }

  return (
    <div className="mx-auto max-w-3xl px-3 pt-3 sm:px-6 sm:pt-6">
      <Link to="/home" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-primary"><ArrowLeft className="h-4 w-4" /> Inicio</Link>
      <section className="overflow-hidden rounded-[2rem] bg-navy text-navy-foreground shadow-float">
        <div className="relative flex flex-col items-center px-5 pb-6 pt-8 text-center">
          <div className={cn("relative rounded-full p-2", live && "animate-pulse bg-primary/30")}>
            <img src={emma} alt="Emma" width={160} height={160} className="h-36 w-36 rounded-full bg-card object-cover sm:h-40 sm:w-40" />
          </div>
          <p className="mt-4 text-2xl font-extrabold">Emma</p>
          <p className="text-sm opacity-75">
            {call.status === "connecting" ? "Conectando…" : live ? `En llamada · ${SCENARIOS[scenario].title}` : call.status === "stopping" ? "Colgando…" : "Tu compañera de speaking"}
          </p>

          {idle && !summarizing && (
            <div className="mt-5 flex w-full flex-wrap justify-center gap-2">
              {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => (
                <button key={id} onClick={() => setScenario(id)} className={cn("rounded-full border-2 px-4 py-2 text-sm font-bold transition", scenario === id ? "border-sun bg-sun text-sun-foreground" : "border-navy-foreground/20 hover:border-navy-foreground/50")}>
                  {SCENARIOS[id].emoji} {SCENARIOS[id].title}
                </button>
              ))}
            </div>
          )}

          <div className="mt-6 flex items-center gap-4">
            {idle ? (
              <button onClick={start} disabled={summarizing} className="flex h-16 items-center gap-2 rounded-full bg-mint px-8 text-lg font-extrabold text-mint-foreground shadow-soft transition hover:scale-105 disabled:opacity-50">
                <Phone className="h-6 w-6" /> Llamar
              </button>
            ) : (
              <>
                <button onClick={() => call.setMuted(!call.muted)} disabled={!live} aria-label={call.muted ? "Activar micrófono" : "Silenciar"} className="flex h-14 w-14 items-center justify-center rounded-full bg-navy-foreground/15 disabled:opacity-40">
                  {call.muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </button>
                <button onClick={hangUp} disabled={call.status === "stopping"} aria-label="Colgar" className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-soft">
                  {call.status === "connecting" ? <Loader2 className="h-6 w-6 animate-spin" /> : <PhoneOff className="h-7 w-7" />}
                </button>
              </>
            )}
            {call.playbackBlocked && (
              <button onClick={call.resumePlayback} className="flex h-14 items-center gap-2 rounded-full bg-sun px-5 font-bold text-sun-foreground"><Play className="h-5 w-5" /> Activar sonido</button>
            )}
          </div>
          {call.error && <p role="alert" className="mt-4 rounded-2xl bg-destructive/20 px-4 py-2 text-sm">{call.error.includes("micro") || call.error.toLowerCase().includes("permission") ? "Permite el acceso al micrófono para poder hablar con Emma." : call.error}</p>}
          <audio ref={call.audioRef} className="hidden" />
        </div>

        {lines.length > 0 && (
          <div className="max-h-72 space-y-2 overflow-y-auto bg-navy-foreground/5 px-4 py-4">
            {lines.map((l, i) => (
              <p key={i} className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm", l.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-card text-card-foreground")}>{l.text}</p>
            ))}
          </div>
        )}
      </section>

      {summarizing && (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-3xl bg-card p-6 shadow-soft text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Preparando tu resumen…</div>
      )}
      {summary && !summary.error && (
        <section className="mt-4 space-y-4 rounded-3xl bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-navy">Resumen de la llamada</h2>
            <span className="rounded-full bg-mint-soft px-3 py-1 text-sm font-extrabold text-navy">Fluidez {summary.fluency}%</span>
          </div>
          {summary.strengths_es.length > 0 && (
            <ul className="space-y-1 text-sm">{summary.strengths_es.map((s) => <li key={s} className="flex gap-2"><Sparkle className="mt-0.5 h-4 w-4 shrink-0 text-sun" /> {s}</li>)}</ul>
          )}
          {summary.improvements.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-navy">Para mejorar</p>
              {summary.improvements.map((m, i) => (
                <div key={i} className="rounded-2xl bg-sun-soft p-3 text-sm">
                  <p className="text-muted-foreground line-through">{m.said}</p>
                  <p className="font-bold text-navy">{m.better}</p>
                  <p className="text-xs text-muted-foreground">{m.note_es}</p>
                  <SaveNoteButton text={`${m.better} — ${m.note_es}`} source="call" label="Speaking en directo" className="mt-1" />
                </div>
              ))}
            </div>
          )}
          {summary.new_words.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-bold text-navy">Palabras para guardar</p>
              <div className="flex flex-wrap gap-2">
                {summary.new_words.map((w) => (
                  <span key={w} className="inline-flex items-center gap-1 rounded-full bg-cobalt-soft py-1 pl-3 pr-1 text-sm font-semibold text-navy">{w} <SaveNoteButton text={w} source="call" label="Speaking en directo" /></span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
      {summary?.error && <p className="mt-4 rounded-3xl bg-card p-4 text-sm text-destructive">No se pudo crear el resumen: {summary.error}</p>}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mic, MicOff, RotateCcw, Square, Volume2, AlertTriangle } from "lucide-react";
import { speak, transcribe } from "@/lib/ai.functions";
import { pronunciationScore } from "@/lib/learning";
import { cn } from "@/lib/utils";

const cache = new Map<string, string>();
let current: HTMLAudioElement | null = null;

function fallbackSpeak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  return true;
}

/** Big, thumb-friendly "listen" button. Uses AI voice, falls back to device voice. */
export function ListenButton({
  text,
  label,
  size = "md",
  className,
}: {
  text: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const speakFn = useServerFn(speak);
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");

  async function play(e?: React.MouseEvent) {
    e?.stopPropagation();
    if (state !== "idle") {
      current?.pause();
      setState("idle");
      return;
    }
    try {
      setState("loading");
      let url = cache.get(text);
      if (!url) {
        const r = await speakFn({ data: { text } });
        if (!r.audio) throw new Error(r.error ?? "audio");
        const bytes = Uint8Array.from(atob(r.audio), (c) => c.charCodeAt(0));
        url = URL.createObjectURL(new Blob([bytes], { type: r.mime }));
        cache.set(text, url);
      }
      current?.pause();
      const a = new Audio(url);
      current = a;
      a.onended = () => setState("idle");
      a.onerror = () => setState("idle");
      setState("playing");
      await a.play();
    } catch {
      setState("idle");
      fallbackSpeak(text);
    }
  }

  const dims = size === "sm" ? "h-9 w-9" : size === "lg" ? "h-14 w-14" : "h-11 w-11";
  return (
    <button
      type="button"
      onClick={play}
      aria-label={label ?? `Escuchar: ${text}`}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground shadow-soft transition active:scale-95",
        label ? "h-11 px-4 text-sm font-semibold" : dims,
        state === "playing" && "bg-mint",
        className,
      )}
    >
      {state === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Volume2 className={cn("h-5 w-5", state === "playing" && "animate-pulse")} />}
      {label && <span>{label}</span>}
    </button>
  );
}

type MicState = "idle" | "requesting" | "recording" | "processing" | "done" | "denied" | "unsupported" | "error";

function blobToBase64(b: Blob) {
  return new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = rej;
    r.readAsDataURL(b);
  });
}

/** Read-aloud recorder with clear states for mobile: permission, recording, processing, errors, retry. */
export function ReadAloud({
  expected,
  onResult,
  className,
}: {
  expected: string;
  onResult?: (r: { text: string; score: number }) => void;
  className?: string;
}) {
  const transcribeFn = useServerFn(transcribe);
  const [state, setState] = useState<MicState>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ text: string; score: number } | null>(null);
  const [seconds, setSeconds] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => () => cleanup(), []);

  function cleanup() {
    if (timer.current) window.clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }

  async function start() {
    setError("");
    setResult(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setState("unsupported");
      return;
    }
    setState("requesting");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
      const mimeType = types.find((t) => MediaRecorder.isTypeSupported?.(t));
      const r = new MediaRecorder(s, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = async () => {
        cleanup();
        const blob = new Blob(chunks, { type: r.mimeType || "audio/webm" });
        if (blob.size < 1500) {
          setError("La grabación ha sido demasiado corta. Mantén pulsado un poco más.");
          setState("error");
          return;
        }
        setState("processing");
        try {
          const audio = await blobToBase64(blob);
          const out = await transcribeFn({ data: { audio, mime: blob.type, hint: expected } });
          if (out.error) throw new Error(out.error);
          if (!out.text) throw new Error("No hemos oído nada. Habla más cerca del micrófono.");
          const res = { text: out.text, score: pronunciationScore(out.text, expected) };
          setResult(res);
          setState("done");
          onResult?.(res);
        } catch (e) {
          setError(e instanceof Error ? e.message : "No se pudo procesar el audio.");
          setState("error");
        }
      };
      rec.current = r;
      r.start();
      setSeconds(0);
      timer.current = window.setInterval(() => {
        setSeconds((x) => {
          if (x >= 59) stop();
          return x + 1;
        });
      }, 1000);
      setState("recording");
    } catch (e) {
      cleanup();
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") setState("denied");
      else if (name === "NotFoundError") {
        setError("No encontramos ningún micrófono en este dispositivo.");
        setState("error");
      } else {
        setError("No se pudo acceder al micrófono. Puede que otra app lo esté usando.");
        setState("error");
      }
    }
  }

  function stop() {
    if (rec.current?.state === "recording") rec.current.stop();
  }

  const retry = (
    <button type="button" onClick={start} className="inline-flex h-11 items-center gap-2 rounded-full bg-secondary px-4 text-sm font-semibold text-secondary-foreground active:scale-95">
      <RotateCcw className="h-4 w-4" /> Reintentar
    </button>
  );

  return (
    <div className={cn("rounded-2xl border bg-card p-4", className)} aria-live="polite">
      {state === "idle" && (
        <button type="button" onClick={start} className="flex w-full items-center justify-center gap-3 rounded-2xl bg-navy py-4 text-base font-bold text-navy-foreground active:scale-[0.98]">
          <Mic className="h-6 w-6" /> Pulsa y lee en voz alta
        </button>
      )}
      {state === "requesting" && (
        <p className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Pidiendo permiso para usar el micrófono…
        </p>
      )}
      {state === "recording" && (
        <button type="button" onClick={stop} className="flex w-full items-center justify-center gap-3 rounded-2xl bg-destructive py-4 text-base font-bold text-destructive-foreground active:scale-[0.98]">
          <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive-foreground opacity-75" /><span className="relative inline-flex h-3 w-3 rounded-full bg-destructive-foreground" /></span>
          Grabando 0:{String(seconds).padStart(2, "0")} · Pulsa para terminar <Square className="h-5 w-5" />
        </button>
      )}
      {state === "processing" && (
        <p className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-primary">
          <Loader2 className="h-5 w-5 animate-spin" /> Analizando tu pronunciación…
        </p>
      )}
      {state === "denied" && (
        <div className="space-y-3 text-sm">
          <p className="flex items-start gap-2 font-semibold text-destructive"><MicOff className="mt-0.5 h-5 w-5 shrink-0" /> Permiso de micrófono denegado</p>
          <p className="text-muted-foreground">Activa el micrófono para esta web: toca el icono del candado o “aA” junto a la dirección, permite el micrófono y vuelve a intentarlo.</p>
          {retry}
        </div>
      )}
      {state === "unsupported" && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-sun" /> Este navegador no permite grabar audio. Prueba con Chrome o Safari actualizados.</p>
      )}
      {state === "error" && (
        <div className="space-y-3 text-sm">
          <p className="flex items-start gap-2 font-semibold text-destructive"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /> {error}</p>
          {retry}
        </div>
      )}
      {state === "done" && result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Pronunciación</p>
            <span className={cn("rounded-full px-3 py-1 text-sm font-bold", result.score >= 80 ? "bg-mint-soft text-accent-foreground" : result.score >= 50 ? "bg-sun-soft text-sun-foreground" : "bg-destructive/10 text-destructive")}>
              {result.score}%
            </span>
          </div>
          <p className="text-sm text-muted-foreground">Hemos entendido: <span className="font-medium text-foreground">“{result.text}”</span></p>
          <p className="text-sm">{result.score >= 80 ? "¡Muy bien! Se te entiende perfectamente." : result.score >= 50 ? "Bien, pero algunas palabras no se reconocieron. Escucha y repite." : "Vuelve a escuchar el modelo e inténtalo otra vez despacio."}</p>
          {retry}
        </div>
      )}
    </div>
  );
}

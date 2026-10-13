import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DIAGNOSTIC, LEVELS, levelFromScore, type Level } from "@/lib/learning";
import { ListenButton } from "@/components/audio";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Test de nivel — GoEnglish!" }, { name: "description", content: "Descubre tu nivel de inglés en 10 preguntas." }] }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0); // 0 intro, 1..10 questions, 11 result, 12 job
  const [answers, setAnswers] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [level, setLevel] = useState<Level>("A2");
  const [job, setJob] = useState("");
  const [goal, setGoal] = useState("");
  const [saving, setSaving] = useState(false);
  const correct = answers.filter((a, i) => a === DIAGNOSTIC[i]?.answer).length;

  function choose(i: number) {
    setPicked(i);
    setTimeout(() => {
      const next = [...answers, i];
      setAnswers(next);
      setPicked(null);
      if (next.length === DIAGNOSTIC.length) {
        setLevel(levelFromScore(next.filter((a, k) => a === DIAGNOSTIC[k]?.answer).length));
        setStep(11);
      } else setStep(step + 1);
    }, 250);
  }

  async function finish() {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("profiles")
      .update({ level, diagnostic_score: correct, job_description: job.trim(), goal: goal.trim() || null, onboarded: true, work_topics: [] })
      .eq("id", u.user!.id);
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar. Inténtalo de nuevo.");
      return;
    }
    await qc.refetchQueries({ queryKey: ["profile"] });
    navigate({ to: "/home" });
  }

  const q = DIAGNOSTIC[step - 1];
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col px-4 py-6">
      <Logo />
      {step >= 1 && step <= 10 && (
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(step / 10) * 100}%` }} />
        </div>
      )}
      <div className="flex flex-1 flex-col justify-center py-8">
        {step === 0 && (
          <div className="space-y-5">
            <h1 className="text-3xl font-extrabold text-navy">¡Hola! Vamos a conocer tu nivel 👋</h1>
            <p className="text-muted-foreground">10 preguntas cortas, de más fácil a más difícil. Si no sabes una, elige la que te suene mejor. Con el resultado activamos tus contenidos en los 3 bloques.</p>
            <button onClick={() => setStep(1)} className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-lg font-bold text-primary-foreground">Empezar test <ArrowRight /></button>
          </div>
        )}
        {q && (
          <div className="space-y-5">
            <p className="text-sm font-bold text-muted-foreground">Pregunta {step} de 10</p>
            <div className="flex items-start gap-3">
              <h2 className="min-w-0 flex-1 text-2xl font-extrabold text-navy">{q.q}</h2>
              <ListenButton text={q.q.replace("___", "blank")} size="sm" />
            </div>
            <div className="grid gap-2">
              {q.options.map((o, i) => (
                <button key={o} onClick={() => choose(i)} disabled={picked !== null} className={cn("min-h-14 rounded-2xl border-2 bg-card px-4 text-left text-lg font-semibold transition active:scale-[0.98]", picked === i ? "border-primary bg-cobalt-soft" : "hover:border-primary")}>
                  {o}
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 11 && (
          <div className="space-y-5 text-center">
            <p className="text-sm font-bold text-muted-foreground">Has acertado {correct} de 10</p>
            <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-primary text-5xl font-extrabold text-primary-foreground shadow-soft">{level}</div>
            <h2 className="text-2xl font-extrabold text-navy">Tu nivel sugerido es {level}</h2>
            <p className="text-sm text-muted-foreground">Puedes ajustarlo si lo prefieres:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {LEVELS.map((l) => (
                <button key={l} onClick={() => setLevel(l)} className={cn("h-11 w-14 rounded-full border-2 font-bold", l === level ? "border-primary bg-cobalt-soft text-primary" : "")}>{l}</button>
              ))}
            </div>
            <button onClick={() => setStep(12)} className="h-14 w-full rounded-full bg-primary text-lg font-bold text-primary-foreground">Continuar</button>
          </div>
        )}
        {step === 12 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-extrabold text-navy">Cuéntanos sobre tu trabajo 💼</h2>
            <p className="text-sm text-muted-foreground">Con esto la IA crea tu temario profesional a medida. Describe tu puesto y tus tareas habituales (sin datos confidenciales).</p>
            <label className="block text-sm font-semibold">Tu puesto y tareas
              <textarea value={job} onChange={(e) => setJob(e.target.value)} rows={5} placeholder="Ej.: Soy enfermera en urgencias. Hago triaje, administro medicación y hablo con familias…" className="mt-1 w-full rounded-2xl border-2 bg-card p-4 outline-none focus:border-primary" />
            </label>
            <label className="block text-sm font-semibold">Tu objetivo (opcional)
              <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Ej.: hacer reuniones con clientes en inglés" className="mt-1 h-12 w-full rounded-2xl border-2 bg-card px-4 outline-none focus:border-primary" />
            </label>
            <button onClick={finish} disabled={saving || job.trim().length < 10} className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-lg font-bold text-primary-foreground disabled:opacity-40">
              {saving && <Loader2 className="h-5 w-5 animate-spin" />} Ir a mi panel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

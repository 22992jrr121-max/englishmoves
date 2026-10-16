import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Trophy, RotateCcw, Lock } from "lucide-react";
import { toast } from "sonner";
import { Page, Loading, Empty } from "@/components/Page";
import { generateExam, submitExam } from "@/lib/ai.functions";
import { useProfile, useUnits } from "@/lib/data";
import { EXAM_PASS, REQUIRED_UNITS, examUnlocked, nextLevel, qualifyingUnits, type Level } from "@/lib/learning";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/exam")({
  head: () => ({ meta: [{ title: "Examen de nivel — GoEnglish!" }, { name: "description", content: "Demuestra lo aprendido y sube al siguiente nivel." }] }),
  component: ExamPage,
});

type Q = { q: string; options: string[]; answer: string; skill: string };

function ExamPage() {
  const profile = useProfile();
  const units = useUnits();
  const qc = useQueryClient();
  const gen = useServerFn(generateExam);
  const submit = useServerFn(submitExam);
  const [qs, setQs] = useState<Q[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ passed: boolean; score: number; newLevel: string | null } | null>(null);
  if (profile.isLoading || units.isLoading) return <Loading />;
  const level = (profile.data?.level ?? "A2") as Level;
  const unlocked = examUnlocked(units.data ?? [], level);
  const have = qualifyingUnits(units.data ?? [], level);

  async function begin() {
    setLoading(true);
    const r = await gen();
    setLoading(false);
    if (r.error || !r.questions.length) { toast.error(r.error ?? "No se pudo crear el examen"); return; }
    setQs(r.questions);
    setAnswers({});
    setResult(null);
  }
  async function finish() {
    if (!qs) return;
    const correct = qs.filter((q, i) => answers[i] === q.answer).length;
    setLoading(true);
    const r = await submit({ data: { correct, total: qs.length } });
    setLoading(false);
    if (r.error) { toast.error(r.error); return; }
    setResult(r);
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["exams"] });
  }

  if (!nextLevel(level)) return <Page title="Examen de nivel"><Empty title="¡Ya estás en C2!" text="Has llegado al nivel más alto. Sigue practicando para mantenerlo." /></Page>;

  if (!unlocked)
    return (
      <Page title={`Examen ${level} → ${nextLevel(level)}`}>
        <Empty title="Examen bloqueado" text={`Completa ${REQUIRED_UNITS} unidades de Inglés General ${level} con al menos un 60 %. Llevas ${have} de ${REQUIRED_UNITS}.`}>
          <Link to="/block/$block" params={{ block: "general" }} className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 font-bold text-primary-foreground"><Lock className="h-4 w-4" /> Ir a las unidades</Link>
        </Empty>
      </Page>
    );

  if (result)
    return (
      <Page>
        <div className={cn("mx-auto max-w-md rounded-3xl p-8 text-center", result.passed ? "bg-mint-soft" : "bg-sun-soft")}>
          <Trophy className={cn("mx-auto h-14 w-14", result.passed ? "text-mint" : "text-sun")} />
          <p className="mt-3 text-4xl font-extrabold text-navy">{result.score}%</p>
          <p className="mt-2 text-lg font-extrabold text-navy">{result.passed ? `¡Enhorabuena! Ahora eres ${result.newLevel}` : "Casi lo tienes"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{result.passed ? "Se ha desbloqueado el contenido del nuevo nivel en los tres bloques." : `Necesitas un ${EXAM_PASS} %. Haz el repaso inteligente y vuelve a intentarlo.`}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Link to="/home" className="inline-flex h-12 items-center rounded-full bg-primary px-6 font-bold text-primary-foreground">Ir al inicio</Link>
            {!result.passed && <button onClick={begin} className="inline-flex h-12 items-center gap-2 rounded-full bg-card px-5 font-bold text-primary"><RotateCcw className="h-4 w-4" /> Repetir</button>}
          </div>
        </div>
      </Page>
    );

  return (
    <Page title={`Examen ${level} → ${nextLevel(level)}`} subtitle={`${qs?.length ?? 15} preguntas · aprobado con ${EXAM_PASS} %`}>
      {!qs ? (
        <div className="mx-auto max-w-md rounded-3xl bg-cobalt-soft p-8 text-center">
          <Trophy className="mx-auto h-14 w-14 text-primary" />
          <p className="mt-3 text-lg font-extrabold text-navy">¡Has desbloqueado el examen!</p>
          <p className="mt-1 text-sm text-muted-foreground">Gramática, vocabulario, phrasal verbs y comprensión de lo que has estudiado.</p>
          <button onClick={begin} disabled={loading} className="mt-5 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 font-bold text-primary-foreground">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Empezar examen
          </button>
        </div>
      ) : (
        <div className="mx-auto max-w-2xl space-y-3">
          {qs.map((q, i) => (
            <div key={i} className="rounded-3xl bg-card p-5 shadow-soft">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{i + 1}. {q.skill}</p>
              <p className="mt-1 font-bold text-navy">{q.q}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {q.options.map((o) => (
                  <button key={o} onClick={() => setAnswers((a) => ({ ...a, [i]: o }))} className={cn("rounded-2xl border-2 px-4 py-3 text-left text-sm font-semibold", answers[i] === o ? "border-primary bg-cobalt-soft" : "bg-background")}>{o}</button>
                ))}
              </div>
            </div>
          ))}
          <button onClick={finish} disabled={loading || Object.keys(answers).length < qs.length} className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-50">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Entregar ({Object.keys(answers).length}/{qs.length})
          </button>
        </div>
      )}
    </Page>
  );
}

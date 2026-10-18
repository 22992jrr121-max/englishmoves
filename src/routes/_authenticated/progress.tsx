import { createFileRoute, Link } from "@tanstack/react-router";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Page, Loading } from "@/components/Page";
import { useAttempts, useItems, useProfile, useUnits, streakFrom } from "@/lib/data";
import { BLOCKS, CONSOLIDATED, COURSE_LEVELS, REQUIRED_UNITS, courseLevel, examUnlocked, nextLevel, type Block, type Level } from "@/lib/learning";
import { COURSE_INDEX } from "@/lib/course";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({ meta: [{ title: "Progreso — English Moves" }, { name: "description", content: "Tu avance por bloque, aciertos y racha." }, { property: "og:title", content: "Progreso — English Moves" }, { property: "og:description", content: "Tu avance por bloque, aciertos y racha." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Progress,
});

const blockColor: Record<Block, string> = { daily: "bg-mint", general: "bg-primary", work: "bg-sun" };

function Progress() {
  const profile = useProfile();
  const units = useUnits();
  const items = useItems();
  const attempts = useAttempts();
  if (units.isLoading || attempts.isLoading || items.isLoading) return <Loading />;
  const att = attempts.data ?? [];
  const accuracy = att.length ? Math.round((att.filter((a) => a.correct).length / att.length) * 100) : 0;
  const consolidated = (items.data ?? []).filter((i) => i.mastery >= CONSOLIDATED).length;
  const days = Array.from({ length: 14 }, (_, k) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - k));
    const key = d.toDateString();
    return { day: d.toLocaleDateString("es", { day: "numeric", month: "short" }), ejercicios: att.filter((a) => new Date(a.created_at).toDateString() === key).length };
  });

  return (
    <Page title="Tu progreso" subtitle={`Nivel ${profile.data?.level ?? "-"}`}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["🔥", streakFrom(att.map((a) => a.created_at)), "Días de racha"],
          ["🎯", `${accuracy}%`, "Aciertos"],
          ["🧠", `${consolidated}/${items.data?.length ?? 0}`, "Consolidadas"],
          ["✅", att.length, "Ejercicios"],
        ].map(([e, v, l]) => (
          <div key={l as string} className="rounded-3xl bg-card p-4 shadow-soft">
            <p className="text-2xl">{e}</p>
            <p className="mt-1 text-2xl font-extrabold text-navy">{v}</p>
            <p className="text-xs text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>

      <LevelPath level={(profile.data?.level ?? "A2") as Level} units={units.data ?? []} />

      <section className="mt-4 rounded-3xl bg-card p-5 shadow-soft">
        <h2 className="mb-3 font-extrabold text-navy">Actividad (14 días)</h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={days}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={2} axisLine={false} tickLine={false} />
              <Tooltip />
              <Area type="monotone" dataKey="ejercicios" stroke="var(--color-primary)" fill="var(--color-cobalt-soft)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        {(Object.keys(BLOCKS) as Block[]).map((b) => {
          const us = (units.data ?? []).filter((u) => u.block === b);
          const done = us.filter((u) => u.status === "done");
          const avg = done.length ? Math.round(done.reduce((s, u) => s + (u.score ?? 0), 0) / done.length) : 0;
          return (
            <div key={b} className="rounded-3xl bg-card p-5 shadow-soft">
              <p className="font-extrabold text-navy">{BLOCKS[b].name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{done.length} de {us.length} unidades · media {avg}%</p>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${blockColor[b]}`} style={{ width: `${us.length ? (done.length / us.length) * 100 : 0}%` }} /></div>
            </div>
          );
        })}
      </section>
    </Page>
  );
}

type U = { id: string; block: string; level: string | null; topic: string; status: string; score: number | null };

function LevelPath({ level, units }: { level: Level; units: U[] }) {
  const next = nextLevel(level);
  const general = units.filter((u) => u.block === "general" && u.level === level);
  const stations = COURSE_INDEX.filter((c) => c.level === courseLevel(level)).map((c) => ({ topic: c.id, title: c.title, unit: general.find((u) => u.topic === c.id) }));
  const unlocked = examUnlocked(units, level);
  return (
    <section className="mt-4 rounded-3xl bg-card p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-extrabold text-navy">Tu camino {level}{next ? ` → ${next}` : ""}</h2>
        <div className="flex gap-1">{COURSE_LEVELS.map((l) => <span key={l} className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", l === courseLevel(level) ? "bg-primary text-primary-foreground" : COURSE_LEVELS.indexOf(l) < COURSE_LEVELS.indexOf(courseLevel(level)) ? "bg-mint text-mint-foreground" : "bg-muted text-muted-foreground")}>{l}</span>)}</div>
      </div>
      <ol className="relative space-y-3 pl-8 before:absolute before:left-3 before:top-2 before:h-[calc(100%-1rem)] before:w-1 before:rounded-full before:bg-muted">
        {stations.map(({ topic, title, unit }, i) => {
          const ok = unit?.status === "done";
          return (
            <li key={topic} className="relative">
              <span className={cn("absolute -left-8 top-1 flex h-7 w-7 items-center justify-center rounded-full border-4 border-card text-[11px] font-extrabold", ok ? "bg-mint text-mint-foreground" : unit ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{i + 1}</span>
              <Link to="/block/$block" params={{ block: "general" }} className="block rounded-2xl bg-background px-4 py-2.5">
                <p className="text-sm font-bold text-navy">{title}</p>
                <p className="text-xs text-muted-foreground">{ok ? `Completada · ${unit?.score}%` : unit ? "En curso" : "Pendiente"}</p>
              </Link>
            </li>
          );
        })}
        {next && (
          <li className="relative">
            <span className={cn("absolute -left-8 top-1 flex h-7 w-7 items-center justify-center rounded-full border-4 border-card text-sm", unlocked ? "bg-sun" : "bg-muted")}>🏆</span>
            <Link to="/exam" className={cn("block rounded-2xl px-4 py-3", unlocked ? "bg-sun text-sun-foreground" : "bg-sun-soft text-navy")}>
              <p className="text-sm font-extrabold">Examen de nivel {level} → {next}</p>
              <p className="text-xs opacity-80">{unlocked ? "¡Desbloqueado! Pulsa para hacerlo" : `Se desbloquea al terminar las ${REQUIRED_UNITS} unidades`}</p>
            </Link>
          </li>
        )}
      </ol>
    </section>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Page, Loading } from "@/components/Page";
import { useAttempts, useItems, useProfile, useUnits, streakFrom } from "@/lib/data";
import { BLOCKS, CONSOLIDATED, type Block } from "@/lib/learning";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({ meta: [{ title: "Progreso — GoEnglish!" }, { name: "description", content: "Tu avance por bloque, aciertos y racha." }] }),
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

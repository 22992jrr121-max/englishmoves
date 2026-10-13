import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ArrowRight, Flame, BookOpen, Trophy, Brain } from "lucide-react";
import { Page, Loading } from "@/components/Page";
import { ReviewSession } from "@/components/ReviewSession";
import { useAttempts, useItems, useProfile, useUnits, streakFrom } from "@/lib/data";
import { BLOCKS, CONSOLIDATED, type Block } from "@/lib/learning";
import daily from "@/assets/block-daily.png";
import general from "@/assets/block-general.png";
import work from "@/assets/block-work.png";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Inicio — GoEnglish!" }, { name: "description", content: "Tu panel de estudio con repaso inteligente y tus tres recorridos." }] }),
  component: Home,
});

const blockStyle: Record<Block, { img: string; cls: string }> = {
  daily: { img: daily, cls: "bg-mint text-mint-foreground" },
  general: { img: general, cls: "bg-primary text-primary-foreground" },
  work: { img: work, cls: "bg-sun text-sun-foreground" },
};

function Home() {
  const profile = useProfile();
  const units = useUnits();
  const items = useItems();
  const attempts = useAttempts();
  if (profile.isLoading) return <Loading />;
  if (profile.data && !profile.data.onboarded) return <Navigate to="/onboarding" />;
  const p = profile.data;
  const streak = streakFrom((attempts.data ?? []).map((a) => a.created_at));
  const weak = (items.data ?? []).filter((i) => i.mastery < CONSOLIDATED).length;
  const done = (units.data ?? []).filter((u) => u.status === "done").length;
  const last = (units.data ?? []).find((u) => u.status !== "done");

  return (
    <Page>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <section className="flex items-center justify-between gap-4 rounded-3xl bg-navy p-5 text-navy-foreground sm:p-6">
            <div className="min-w-0">
              <p className="text-sm opacity-75">¡Hola, {p?.display_name ?? "estudiante"}! 👋</p>
              <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">¿Qué aprendemos hoy?</h1>
              <p className="mt-1 truncate text-sm opacity-75">{p?.job_description}</p>
            </div>
            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-primary">
              <span className="text-[10px] font-bold uppercase opacity-80">Nivel</span>
              <span className="text-2xl font-extrabold">{p?.level}</span>
            </div>
          </section>

          <section className="rounded-3xl bg-sun-soft p-5 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-extrabold text-navy"><Brain className="h-5 w-5 text-sun-foreground" /> Repaso inteligente</h2>
                <p className="text-sm text-muted-foreground">{weak ? `${weak} conceptos aún sin consolidar` : "Ejercicios sobre todo lo aprendido"}</p>
              </div>
              <Link to="/review" className="shrink-0 text-sm font-bold text-primary">Ver todo</Link>
            </div>
            <div className="rounded-2xl bg-card p-4">
              <ReviewSession count={4} compact />
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(BLOCKS) as Block[]).map((b) => (
              <Link key={b} to="/block/$block" params={{ block: b }} className={cn("group relative flex min-h-44 flex-col justify-between overflow-hidden rounded-3xl p-5 transition hover:-translate-y-1", blockStyle[b].cls)}>
                <img src={blockStyle[b].img} alt="" width={420} height={420} className="absolute -right-4 -bottom-4 h-32 w-32 object-contain transition group-hover:scale-110" />
                <span className="text-xs font-bold uppercase tracking-wider opacity-80">Bloque</span>
                <div className="relative max-w-[65%]">
                  <h3 className="text-lg font-extrabold leading-tight">{BLOCKS[b].name}</h3>
                  <p className="mt-1 text-xs opacity-85">{BLOCKS[b].tagline}</p>
                </div>
              </Link>
            ))}
          </section>
        </div>

        <aside className="space-y-4">
          {last && (
            <Link to="/unit/$id" params={{ id: last.id }} className="block rounded-3xl bg-card p-5 shadow-soft">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Continúa</p>
              <p className="mt-1 font-extrabold text-navy">{last.title}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${last.progress}%` }} /></div>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-primary">Seguir <ArrowRight className="h-4 w-4" /></span>
            </Link>
          )}
          <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
            <Stat icon={<Flame className="h-5 w-5 text-sun" />} value={streak} label="Días seguidos" />
            <Stat icon={<BookOpen className="h-5 w-5 text-primary" />} value={items.data?.length ?? 0} label="Palabras" />
            <Stat icon={<Trophy className="h-5 w-5 text-mint" />} value={done} label="Unidades" />
          </div>
        </aside>
      </div>
    </Page>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-3xl bg-card p-4 shadow-soft lg:flex-row lg:items-center lg:gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted">{icon}</span>
      <div>
        <p className="text-2xl font-extrabold text-navy">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Lock, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Page, Loading, Empty } from "@/components/Page";
import { generateUnit, generateWorkTopics } from "@/lib/ai.functions";
import { useProfile, useUnits } from "@/lib/data";
import { BLOCKS, COURSE_LEVELS, DAILY_TOPICS, courseLevel, isCourseCode, unitUnlocked, type Block, type CourseLevel, type Level } from "@/lib/learning";
import { COURSE_INDEX } from "@/lib/course";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/block/$block")({
  beforeLoad: ({ params }) => {
    if (!["daily", "general", "work"].includes(params.block)) throw notFound();
  },
  head: ({ params }) => ({ meta: [{ title: `${BLOCKS[params.block as Block]?.name ?? "Bloque"} — English Moves` }, { name: "description", content: "Elige una unidad y empieza a practicar." }, { property: "og:title", content: `${BLOCKS[params.block as Block]?.name ?? "Bloque"} — English Moves` }, { property: "og:description", content: "Elige una unidad y empieza a practicar." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: BlockPage,
});

type Topic = { title: string; description: string; emoji: string };

function BlockPage() {
  const { block } = Route.useParams() as { block: Block };
  const profile = useProfile();
  const units = useUnits();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const gen = useServerFn(generateUnit);
  const genTopics = useServerFn(generateWorkTopics);
  const [creating, setCreating] = useState<string | null>(null);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [custom, setCustom] = useState("");
  const userLevel = (profile.data?.level ?? "A2") as Level;

  if (profile.isLoading || units.isLoading) return <Loading />;
  if (block === "general") return <CourseList studentLevel={profile.data?.level ?? "A1"} units={units.data ?? []} />;


  const mine = (units.data ?? []).filter((u) => u.block === block);
  const byTopic = new Map(mine.map((u) => [u.topic, u]));

  async function create(topic: string) {
    const existing = byTopic.get(topic);
    if (existing) {
      navigate({ to: "/unit/$id", params: { id: existing.id } });
      return;
    }
    setCreating(topic);
    const r = await gen({ data: { block, topic } });
    setCreating(null);
    if (!r.id) {
      toast.error(r.error ?? "No se pudo crear la lección");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["units"] });
    qc.invalidateQueries({ queryKey: ["items"] });
    navigate({ to: "/unit/$id", params: { id: r.id } });
  }

  async function loadTopics() {
    setLoadingTopics(true);
    const r = await genTopics();
    setLoadingTopics(false);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  let topics: Topic[] = [];
  if (block === "daily") topics = DAILY_TOPICS;
  if (block === "work") topics = (profile.data?.work_topics as Topic[]) ?? [];

  return (
    <Page title={BLOCKS[block].name} subtitle={block === "work" ? `Temario a medida para: ${profile.data?.job_description ?? ""}` : BLOCKS[block].tagline}>
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-6 backdrop-blur-sm">
          <div className="max-w-sm space-y-3 rounded-3xl bg-card p-6 text-center shadow-float">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <p className="text-lg font-extrabold text-navy">Creando tu lección…</p>
            <p className="text-sm text-muted-foreground">“{creating}” adaptada a tu nivel {userLevel}. Tarda unos segundos.</p>
          </div>
        </div>
      )}

      {block === "work" && !topics.length ? (
        <Empty title="Aún no tienes temario profesional" text="La IA preparará los temas más útiles para tu puesto.">
          <button onClick={loadTopics} disabled={loadingTopics} className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 font-bold text-primary-foreground">
            {loadingTopics && <Loader2 className="h-4 w-4 animate-spin" />} Crear mi temario
          </button>
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((t) => {
            const u = byTopic.get(t.title);
            return (
              <button key={t.title} onClick={() => create(t.title)} disabled={!!creating} className="flex items-center gap-4 rounded-3xl bg-card p-4 text-left shadow-soft transition hover:-translate-y-0.5 active:scale-[0.98]">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-muted text-2xl">{t.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-extrabold text-navy">{t.title}</span>
                  <span className="block truncate text-sm text-muted-foreground">{t.description}</span>
                  {u && (
                    <span className={cn("mt-1 inline-flex items-center gap-1 text-xs font-bold", u.status === "done" ? "text-success" : "text-primary")}>
                      {u.status === "done" ? <><CheckCircle2 className="h-3.5 w-3.5" /> Completada · {u.score}%</> : `En curso · ${u.progress}%`}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {(block === "work" || block === "daily") && (
        <div className="mt-6 rounded-3xl border-2 border-dashed p-4">
          <p className="mb-2 text-sm font-bold">{block === "work" ? "¿Otro tema de tu trabajo?" : "¿Otra situación?"}</p>
          <div className="flex gap-2">
            <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={block === "work" ? "Ej.: negociar con proveedores" : "Ej.: en el gimnasio"} className="h-12 min-w-0 flex-1 rounded-full border-2 bg-card px-4 outline-none focus:border-primary" />
            <button onClick={() => custom.trim() && create(custom.trim())} aria-label="Crear" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Plus /></button>
          </div>
          {block === "work" && topics.length > 0 && (
            <button onClick={loadTopics} disabled={loadingTopics} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-primary">
              {loadingTopics ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Regenerar temario
            </button>
          )}
        </div>
      )}
      <p className="mt-6 text-center text-sm"><Link to="/home" className="font-bold text-primary">← Volver al inicio</Link></p>
    </Page>
  );
}

function CourseList({ studentLevel, units }: { studentLevel: string; units: { block: string; topic: string; status: string; progress: number; score: number | null }[] }) {
  const cur = courseLevel(studentLevel);
  const [level, setLevel] = useState<CourseLevel>(cur);
  const general = units.filter((u) => u.block === "general" && isCourseCode(u.topic));
  const byCode = new Map(general.map((u) => [u.topic, u]));
  const done = general.filter((u) => u.status === "done").map((u) => u.topic);
  const list = COURSE_INDEX.filter((u) => u.level === level);
  const emojis = ["📘", "🗣️", "🎧", "✍️", "📖", "💡"];
  return (
    <Page title={BLOCKS.general.name} subtitle="Tu curso A1–C1: vocabulario, gramática, phrasal verbs, listening, speaking, reading y writing">
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {COURSE_LEVELS.map((l) => {
          const locked = COURSE_LEVELS.indexOf(l) > COURSE_LEVELS.indexOf(cur);
          return (
            <button key={l} onClick={() => setLevel(l)} className={cn("inline-flex h-11 shrink-0 items-center gap-1 rounded-full border-2 px-5 font-bold", l === level ? "border-primary bg-primary text-primary-foreground" : "bg-card", l === cur && l !== level && "border-primary")}>
              {locked && <Lock className="h-3.5 w-3.5" />}{l}{l === cur && " ★"}
            </button>
          );
        })}
      </div>
      {COURSE_LEVELS.indexOf(level) > COURSE_LEVELS.indexOf(cur) && (
        <p className="mb-4 rounded-2xl bg-sun-soft p-3 text-sm font-semibold text-navy">🔒 Se abre al aprobar el examen de nivel {cur}. <Link to="/exam" className="font-bold text-primary">Ver examen</Link></p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((t, i) => {
          const u = byCode.get(t.id);
          const open = unitUnlocked(t.id, studentLevel, done);
          const inner = (
            <>
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-muted text-2xl">{open ? emojis[i % 6] : <Lock className="h-5 w-5 text-muted-foreground" />}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-muted-foreground">Unidad {t.sequence}</span>
                <span className="block font-extrabold text-navy">{t.title}</span>
                <span className="line-clamp-2 block text-sm text-muted-foreground">{t.objective}</span>
                {u && (
                  <span className={cn("mt-1 inline-flex items-center gap-1 text-xs font-bold", u.status === "done" ? "text-success" : "text-primary")}>
                    {u.status === "done" ? <><CheckCircle2 className="h-3.5 w-3.5" /> Completada · {u.score}%</> : `En curso · ${u.progress}%`}
                  </span>
                )}
              </span>
            </>
          );
          return open ? (
            <Link key={t.id} to="/course/$code" params={{ code: t.id }} className="flex items-center gap-4 rounded-3xl bg-card p-4 text-left shadow-soft transition hover:-translate-y-0.5 active:scale-[0.98]">{inner}</Link>
          ) : (
            <div key={t.id} className="flex items-center gap-4 rounded-3xl bg-card/60 p-4 text-left opacity-70">{inner}</div>
          );
        })}
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">Las unidades se abren una tras otra. Práctica original inspirada en los formatos Cambridge; no es material oficial.</p>
      <p className="mt-3 text-center text-sm"><Link to="/home" className="font-bold text-primary">← Volver al inicio</Link></p>
    </Page>
  );
}

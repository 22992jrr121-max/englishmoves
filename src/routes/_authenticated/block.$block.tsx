import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Page, Loading, Empty } from "@/components/Page";
import { generateUnit, generateWorkTopics } from "@/lib/ai.functions";
import { useProfile, useUnits } from "@/lib/data";
import { BLOCKS, DAILY_TOPICS, GENERAL_UNITS, LEVELS, type Block, type Level } from "@/lib/learning";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/block/$block")({
  beforeLoad: ({ params }) => {
    if (!["daily", "general", "work"].includes(params.block)) throw notFound();
  },
  head: ({ params }) => ({ meta: [{ title: `${BLOCKS[params.block as Block]?.name ?? "Bloque"} — GoEnglish!` }, { name: "description", content: "Elige una unidad y empieza a practicar." }] }),
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
  const [level, setLevel] = useState<Level>(userLevel);

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
  if (block === "general") topics = GENERAL_UNITS[level].map((t, i) => ({ title: t, description: `Unidad ${i + 1} · ${level}`, emoji: ["📘", "🗣️", "🎧", "✍️", "📖", "💡"][i % 6] ?? "📘" }));
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

      {block === "general" && (
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {LEVELS.map((l) => (
            <button key={l} onClick={() => setLevel(l)} className={cn("h-11 shrink-0 rounded-full border-2 px-5 font-bold", l === level ? "border-primary bg-primary text-primary-foreground" : "bg-card", l === userLevel && l !== level && "border-primary")}>
              {l}{l === userLevel && " ★"}
            </button>
          ))}
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

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { Page, Loading, Empty } from "@/components/Page";
import { ListenButton } from "@/components/audio";
import { useItems, useUnits } from "@/lib/data";
import { BLOCKS, CONSOLIDATED, type Block } from "@/lib/learning";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "Histórico — GoEnglish!" }, { name: "description", content: "Consulta todo el vocabulario y las unidades que has estudiado." }] }),
  component: History,
});

function History() {
  const items = useItems();
  const units = useUnits();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Block | "all">("all");
  const [view, setView] = useState<"words" | "units">("words");
  if (items.isLoading || units.isLoading) return <Loading />;
  const s = q.toLowerCase();
  const words = (items.data ?? []).filter((i) => (filter === "all" || i.block === filter) && (i.term.toLowerCase().includes(s) || i.meaning.toLowerCase().includes(s)));
  const us = (units.data ?? []).filter((u) => (filter === "all" || u.block === filter) && u.title.toLowerCase().includes(s));

  return (
    <Page title="Histórico" subtitle="Todo lo que has aprendido, para consultarlo cuando quieras.">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar palabra o unidad" aria-label="Buscar" className="h-12 w-full rounded-full border-2 bg-card pl-12 pr-4 outline-none focus:border-primary" />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {(["words", "units"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn("h-10 shrink-0 rounded-full px-4 text-sm font-bold", view === v ? "bg-navy text-navy-foreground" : "bg-card")}>{v === "words" ? `Vocabulario (${words.length})` : `Unidades (${us.length})`}</button>
          ))}
          <span className="w-2 shrink-0" />
          {(["all", "daily", "general", "work"] as const).map((b) => (
            <button key={b} onClick={() => setFilter(b)} className={cn("h-10 shrink-0 rounded-full border-2 px-4 text-sm font-bold", filter === b ? "border-primary text-primary" : "bg-card")}>{b === "all" ? "Todo" : BLOCKS[b].short}</button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {view === "words" ? (
          words.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {words.map((i) => (
                <li key={i.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft">
                  <ListenButton text={i.term} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-navy">{i.term}</p>
                    <p className="truncate text-sm text-muted-foreground">{i.meaning}</p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-bold", i.mastery >= CONSOLIDATED ? "bg-mint-soft text-accent-foreground" : "bg-sun-soft text-sun-foreground")}>{i.mastery >= CONSOLIDATED ? "Consolidada" : `${i.mastery}%`}</span>
                </li>
              ))}
            </ul>
          ) : <Empty title="Nada por aquí aún" text="Las palabras de tus lecciones aparecerán aquí." />
        ) : us.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {us.map((u) => (
              <li key={u.id}>
                <Link to="/unit/$id" params={{ id: u.id }} className="block rounded-2xl bg-card p-4 shadow-soft">
                  <p className="text-xs font-bold text-muted-foreground">{BLOCKS[u.block as Block]?.short} · {u.level} · {new Date(u.created_at).toLocaleDateString("es")}</p>
                  <p className="font-bold text-navy">{u.title}</p>
                  <p className="text-sm text-muted-foreground">{u.status === "done" ? `Completada · ${u.score}%` : `En curso · ${u.progress}%`}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : <Empty title="Aún no hay unidades" text="Empieza una lección desde el inicio." />}
      </div>
    </Page>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/Page";
import { ReviewSession } from "@/components/ReviewSession";
import { useItems } from "@/lib/data";
import { CONSOLIDATED } from "@/lib/learning";

export const Route = createFileRoute("/_authenticated/review")({
  head: () => ({ meta: [{ title: "Repaso — English Moves" }, { name: "description", content: "Ejercicios adaptativos sobre lo que aún no tienes consolidado." }, { property: "og:title", content: "Repaso — English Moves" }, { property: "og:description", content: "Ejercicios adaptativos sobre lo que aún no tienes consolidado." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Review,
});

function Review() {
  const items = useItems();
  const weak = (items.data ?? []).filter((i) => i.mastery < CONSOLIDATED);
  return (
    <Page title="Repaso inteligente" subtitle="Priorizamos lo que más te cuesta según tus resultados.">
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="mx-auto w-full max-w-2xl">
          <ReviewSession count={10} />
        </div>
        <aside className="rounded-3xl bg-card p-5 shadow-soft">
          <h2 className="font-extrabold text-navy">Por consolidar ({weak.length})</h2>
          <ul className="mt-3 max-h-96 space-y-2 overflow-auto">
            {weak.slice(0, 30).map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-semibold">{i.term}</span>
                <span className="h-2 w-16 shrink-0 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-sun" style={{ width: `${i.mastery}%` }} /></span>
              </li>
            ))}
            {!weak.length && <li className="text-sm text-muted-foreground">¡Todo consolidado por ahora! 🎉</li>}
          </ul>
        </aside>
      </div>
    </Page>
  );
}

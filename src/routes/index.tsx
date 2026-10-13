import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Headphones, Mic, Target } from "lucide-react";
import { Logo } from "@/components/Logo";
import daily from "@/assets/block-daily.png";
import general from "@/assets/block-general.png";
import work from "@/assets/block-work.png";
import logo from "@/assets/goenglish-logo.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GoEnglish! — Inglés para tu vida y tu trabajo" },
      { name: "description", content: "Aprende inglés cotidiano, general A1–C2 y vocabulario de tu profesión con lecciones creadas a tu medida, audio y corrección de pronunciación." },
      { property: "og:title", content: "GoEnglish! — Inglés para tu vida y tu trabajo" },
      { property: "og:description", content: "Tres recorridos, un test de nivel y lecciones a medida con corrección inteligente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const blocks = [
  { img: daily, title: "Inglés Cotidiano", text: "Tarjetas en contexto y diálogos reales: restaurante, médico, compras…", cls: "bg-mint-soft" },
  { img: general, title: "Inglés General", text: "Unidades estilo Cambridge con gramática, phrasal verbs, listening y reading.", cls: "bg-cobalt-soft" },
  { img: work, title: "Para tu Trabajo", text: "Vocabulario técnico de tu puesto, traducciones y preguntas sobre tu día a día.", cls: "bg-sun-soft" },
];

function Landing() {
  return (
    <div className="min-h-screen bg-grid-soft">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <Link to="/auth" className="rounded-full px-4 py-2 text-sm font-bold text-primary hover:bg-cobalt-soft">Entrar</Link>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20">
        <section className="grid items-center gap-8 py-8 md:grid-cols-2 md:py-16">
          <div className="space-y-6">
            <span className="inline-flex rounded-full bg-sun-soft px-3 py-1 text-xs font-bold text-sun-foreground">Test de nivel gratis · 2 minutos</span>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-navy sm:text-6xl">
              El inglés que <span className="text-primary">de verdad</span> vas a <span className="text-mint">usar</span>.
            </h1>
            <p className="max-w-lg text-lg text-muted-foreground">
              Lecciones creadas para ti según tu nivel y tu trabajo. Escucha, habla y recibe correcciones al momento.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/auth" className="inline-flex h-14 items-center gap-2 rounded-full bg-primary px-7 text-base font-bold text-primary-foreground shadow-soft transition hover:-translate-y-0.5">
                Empezar ahora <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
            <div className="flex flex-wrap gap-4 text-sm font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Headphones className="h-4 w-4 text-primary" /> Audio en todo</span>
              <span className="inline-flex items-center gap-1.5"><Mic className="h-4 w-4 text-mint" /> Corrige tu pronunciación</span>
              <span className="inline-flex items-center gap-1.5"><Target className="h-4 w-4 text-sun" /> Repaso inteligente</span>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute inset-6 rounded-[3rem] bg-cobalt-soft" />
            <img src={logo.url} alt="Logo de GoEnglish!" className="relative w-full" />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {blocks.map((b) => (
            <article key={b.title} className={`rounded-3xl p-6 ${b.cls}`}>
              <img src={b.img} alt="" width={420} height={420} loading="lazy" className="mx-auto h-36 w-36 object-contain" />
              <h2 className="mt-3 text-xl font-extrabold text-navy">{b.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{b.text}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}

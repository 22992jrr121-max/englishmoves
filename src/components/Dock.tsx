import { Link, useRouterState } from "@tanstack/react-router";
import home from "@/assets/dock-home.png";
import progress from "@/assets/dock-progress.png";
import history from "@/assets/dock-history.png";
import review from "@/assets/dock-review.png";
import profile from "@/assets/dock-profile.png";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/home", label: "Inicio", hint: "Tu panel y tareas de hoy", img: home },
  { to: "/progress", label: "Progreso", hint: "Estadísticas y avance", img: progress },
  { to: "/review", label: "Repaso", hint: "Refuerza lo que te cuesta", img: review },
  { to: "/history", label: "Histórico", hint: "Todo lo aprendido", img: history },
  { to: "/profile", label: "Perfil", hint: "Nivel, trabajo y ajustes", img: profile },
] as const;

/** Floating bubble dock: bubbles grow on hover (desktop) and show a label; tap to navigate on mobile. */
export function Dock() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-2 pb-[max(0.6rem,env(safe-area-inset-bottom))]"
    >
      <ul className="flex items-end gap-1.5 rounded-full border bg-card/90 px-2.5 py-2 shadow-float backdrop-blur-md sm:gap-3 sm:px-4">
        {ITEMS.map((it) => {
          const active = path.startsWith(it.to);
          return (
            <li key={it.to} className="group relative flex flex-col items-center">
              <span className="pointer-events-none absolute bottom-full mb-3 hidden w-max max-w-44 scale-90 rounded-xl bg-navy px-3 py-2 text-center opacity-0 transition duration-200 group-hover:scale-100 group-hover:opacity-100 sm:block">
                <span className="block text-sm font-bold text-navy-foreground">{it.label}</span>
                <span className="block text-xs text-navy-foreground/75">{it.hint}</span>
              </span>
              <Link
                to={it.to}
                aria-label={it.label}
                className={cn(
                  "flex h-14 w-14 origin-bottom items-center justify-center rounded-full border-2 bg-background transition-all duration-300 ease-out sm:h-14 sm:w-14 sm:group-hover:-translate-y-2 sm:group-hover:scale-[1.45]",
                  active ? "border-primary bg-cobalt-soft" : "border-transparent",
                )}
              >
                <img src={it.img} alt="" width={192} height={192} className="h-10 w-10 object-contain" />
              </Link>
              <span className={cn("mt-0.5 text-[11px] font-semibold sm:hidden", active ? "text-primary" : "text-muted-foreground")}>
                {it.label}
              </span>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

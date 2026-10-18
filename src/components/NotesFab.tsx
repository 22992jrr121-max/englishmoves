import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { NotebookPen, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAddNote, useNotes } from "@/lib/data";
import { cn } from "@/lib/utils";

function sourceFromPath(path: string) {
  const unit = path.match(/^\/unit\/([0-9a-f-]{36})/);
  if (unit) return { source: "unit", source_label: "Lección", unit_id: unit[1] ?? null };
  if (path.startsWith("/chat")) return { source: "chat", source_label: "Chat con Emma", unit_id: null };
  if (path.startsWith("/speaking")) return { source: "call", source_label: "Speaking en directo", unit_id: null };
  if (path.startsWith("/review") || path.startsWith("/home")) return { source: "review", source_label: "Repaso", unit_id: null };
  if (path.startsWith("/exam")) return { source: "exam", source_label: "Examen", unit_id: null };
  return { source: "manual", source_label: null, unit_id: null };
}

/** Side notebook available on every signed-in screen. */
export function NotesFab() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const add = useAddNote();
  const notes = useNotes();
  if (path.startsWith("/notes")) return null;

  async function save() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await add({ text: text.trim(), ...sourceFromPath(path) });
      setText("");
      toast.success("Guardado en tu libreta");
    } catch {
      toast.error("No se pudo guardar la nota");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Abrir mi libreta"
        className="fixed bottom-40 right-0 z-40 flex items-center gap-1.5 rounded-l-2xl bg-sun px-2.5 py-3 text-sm font-extrabold text-sun-foreground shadow-float transition hover:pr-4"
      >
        <NotebookPen className="h-5 w-5" />
        <span className="hidden sm:inline [writing-mode:vertical-rl] rotate-180">Notas</span>
      </button>
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-[min(22rem,100vw)] flex-col border-l bg-card shadow-float transition-transform duration-300",
          open ? "translate-x-0" : "invisible translate-x-full",
        )}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b p-4">
          <p className="flex items-center gap-2 font-extrabold text-navy"><NotebookPen className="h-5 w-5 text-sun-foreground" /> Mi libreta</p>
          <button onClick={() => setOpen(false)} aria-label="Cerrar" className="rounded-full p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-2 p-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Apunta una palabra, una frase o algo que quieras recordar… (ej.: to catch up — ponerse al día)"
            className="w-full resize-none rounded-2xl border-2 bg-background p-3 text-sm outline-none focus:border-primary"
          />
          <button onClick={save} disabled={saving || !text.trim()} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar nota
          </button>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Últimas notas</p>
          {(notes.data ?? []).slice(0, 8).map((n) => (
            <div key={n.id} className="rounded-2xl bg-sun-soft p-3 text-sm">
              <p className="whitespace-pre-wrap text-navy">{n.text}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{n.source_label ?? "Nota"} · {new Date(n.created_at).toLocaleDateString("es")}</p>
            </div>
          ))}
          <Link to="/notes" onClick={() => setOpen(false)} className="block pt-2 text-center text-sm font-bold text-primary">Ver toda la libreta →</Link>
        </div>
      </aside>
    </>
  );
}

/** Small inline "save to notes" action. */
export function SaveNoteButton({ text, source, label, className }: { text: string; source: string; label: string; className?: string }) {
  const add = useAddNote();
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await add({ text, source, source_label: label });
          setDone(true);
          toast.success("Guardado en tu libreta");
        } catch {
          toast.error("No se pudo guardar");
        }
      }}
      disabled={done}
      aria-label="Guardar en notas"
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-muted-foreground hover:bg-muted disabled:text-success", className)}
    >
      <NotebookPen className="h-3.5 w-3.5" /> {done ? "Guardado" : "Guardar"}
    </button>
  );
}

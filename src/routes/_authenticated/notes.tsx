import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Trash2, Layers, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Page, Loading, Empty } from "@/components/Page";
import { ListenButton } from "@/components/audio";
import { useAddNote, useNotes, noteToCard } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({ meta: [{ title: "Mi libreta — GoEnglish!" }, { name: "description", content: "Tus anotaciones personales para repasar cuando quieras." }] }),
  component: NotesPage,
});

function NotesPage() {
  const notes = useNotes();
  const add = useAddNote();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [text, setText] = useState("");
  if (notes.isLoading) return <Loading />;
  const s = q.toLowerCase();
  const list = (notes.data ?? []).filter((n) => n.text.toLowerCase().includes(s));

  async function remove(id: string) {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) { toast.error("No se pudo borrar"); return; }
    qc.invalidateQueries({ queryKey: ["notes"] });
  }
  async function toCard(n: (typeof list)[number]) {
    try {
      await noteToCard(n, "");
      toast.success("Añadida a tu repaso inteligente");
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: ["items"] });
    } catch {
      toast.error("No se pudo crear la tarjeta");
    }
  }

  return (
    <Page title="Mi libreta" subtitle="Lo que te ha llamado la atención, guardado para repasar.">
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="flex h-12 items-center gap-2 rounded-full border-2 bg-card px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en tus notas" className="min-w-0 flex-1 bg-transparent outline-none" />
        </div>
      </div>
      <div className="mb-5 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Nueva nota (ej.: to catch up — ponerse al día)" className="h-12 min-w-0 flex-1 rounded-full border-2 bg-card px-4 outline-none focus:border-primary" />
        <button
          onClick={async () => {
            if (!text.trim()) return;
            await add({ text: text.trim(), source: "manual" }).catch(() => toast.error("No se pudo guardar"));
            setText("");
          }}
          className="h-12 shrink-0 rounded-full bg-primary px-5 font-bold text-primary-foreground"
        >
          Añadir
        </button>
      </div>
      {!list.length ? (
        <Empty title="Tu libreta está vacía" text="Pulsa el botón amarillo «Notas» del lateral en cualquier ejercicio para apuntar algo." />
      ) : (
        <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
          {list.map((n) => (
            <article key={n.id} className="mb-3 break-inside-avoid rounded-3xl bg-sun-soft p-4">
              <p className="whitespace-pre-wrap font-semibold text-navy">{n.text}</p>
              <p className="mt-2 text-xs text-muted-foreground">{n.source_label ?? "Nota"} · {new Date(n.created_at).toLocaleDateString("es", { day: "numeric", month: "short" })}</p>
              <div className="mt-3 flex flex-wrap items-center gap-1">
                <ListenButton text={n.text} size="sm" />
                {n.item_id ? (
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-success"><CheckCircle2 className="h-3.5 w-3.5" /> En repaso</span>
                ) : (
                  <button onClick={() => toCard(n)} className="inline-flex items-center gap-1 rounded-full bg-card px-3 py-1.5 text-xs font-bold text-primary"><Layers className="h-3.5 w-3.5" /> Convertir en tarjeta</button>
                )}
                <button onClick={() => remove(n.id)} aria-label="Borrar nota" className="ml-auto rounded-full p-2 text-muted-foreground hover:bg-card"><Trash2 className="h-4 w-4" /></button>
              </div>
            </article>
          ))}
        </div>
      )}
    </Page>
  );
}

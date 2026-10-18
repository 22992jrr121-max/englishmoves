import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Page, Loading } from "@/components/Page";
import { useProfile } from "@/lib/data";
import { LEVELS } from "@/lib/learning";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Perfil — English Moves" }, { name: "description", content: "Edita tu nivel, tu trabajo y tus preferencias." }, { property: "og:title", content: "Perfil — English Moves" }, { property: "og:description", content: "Edita tu nivel, tu trabajo y tus preferencias." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Profile,
});

function Profile() {
  const profile = useProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [level, setLevel] = useState("A2");
  const [job, setJob] = useState("");
  const [goal, setGoal] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile.data) return;
    setName(profile.data.display_name ?? "");
    setLevel(profile.data.level ?? "A2");
    setJob(profile.data.job_description ?? "");
    setGoal(profile.data.goal ?? "");
  }, [profile.data]);

  if (profile.isLoading) return <Loading />;

  async function save() {
    setSaving(true);
    const jobChanged = job.trim() !== (profile.data?.job_description ?? "");
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name, level, job_description: job.trim(), goal: goal || null, ...(jobChanged ? { work_topics: [] } : {}), updated_at: new Date().toISOString() })
      .eq("id", profile.data!.id);
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar");
      return;
    }
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success(jobChanged ? "Guardado. Tu temario profesional se regenerará; tu historial se conserva." : "Perfil guardado");
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <Page title="Tu perfil" action={<button onClick={signOut} className="inline-flex h-10 items-center gap-2 rounded-full bg-secondary px-4 text-sm font-bold"><LogOut className="h-4 w-4" /> Salir</button>}>
      <div className="mx-auto max-w-xl space-y-4 rounded-3xl bg-card p-5 shadow-soft sm:p-6">
        <label className="block text-sm font-semibold">Nombre
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-12 w-full rounded-2xl border-2 bg-background px-4 outline-none focus:border-primary" />
        </label>
        <div>
          <p className="text-sm font-semibold">Nivel de inglés</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {LEVELS.map((l) => (
              <button key={l} onClick={() => setLevel(l)} className={cn("h-11 w-14 rounded-full border-2 font-bold", l === level && "border-primary bg-cobalt-soft text-primary")}>{l}</button>
            ))}
          </div>
          <button onClick={() => navigate({ to: "/onboarding" })} className="mt-2 text-sm font-bold text-primary">Repetir el test de nivel</button>
        </div>
        <label className="block text-sm font-semibold">Tu puesto y tareas
          <textarea value={job} onChange={(e) => setJob(e.target.value)} rows={4} className="mt-1 w-full rounded-2xl border-2 bg-background p-4 outline-none focus:border-primary" />
        </label>
        <label className="block text-sm font-semibold">Objetivo
          <input value={goal} onChange={(e) => setGoal(e.target.value)} className="mt-1 h-12 w-full rounded-2xl border-2 bg-background px-4 outline-none focus:border-primary" />
        </label>
        <button onClick={save} disabled={saving} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary font-bold text-primary-foreground">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar cambios
        </button>
        <p className="text-xs text-muted-foreground">Plan actual: gratuito.</p>
      </div>
    </Page>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — English Moves" },
      { name: "description", content: "Accede o crea tu cuenta de English Moves para guardar tu progreso." },
      { property: "og:title", content: "Entrar — English Moves" },
      { property: "og:description", content: "Accede o crea tu cuenta de English Moves." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => data.user && navigate({ to: "/home", replace: true }));
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "SIGNED_IN" && s) navigate({ to: "/home", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/home", data: { display_name: name } },
        });
        if (error) throw error;
        setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error";
      toast.error(msg.includes("Invalid login") ? "Correo o contraseña incorrectos" : msg);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error("No se pudo entrar con Google");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-grid-soft px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-soft sm:p-8">
        <Logo />
        {sent ? (
          <div className="mt-8 space-y-3">
            <h1 className="text-2xl font-extrabold text-navy">Revisa tu correo 📬</h1>
            <p className="text-muted-foreground">Te hemos enviado un enlace a <b>{email}</b> para confirmar tu cuenta. Después podrás hacer el test de nivel.</p>
            <button onClick={() => { setSent(false); setMode("in"); }} className="text-sm font-bold text-primary">Ya lo he confirmado, entrar</button>
          </div>
        ) : (
          <>
            <h1 className="mt-8 text-2xl font-extrabold text-navy">{mode === "up" ? "Crea tu cuenta" : "Bienvenido de nuevo"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{mode === "up" ? "Guarda tu progreso y recibe lecciones a medida." : "Sigue donde lo dejaste."}</p>
            <button onClick={google} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full border-2 font-bold hover:bg-muted">
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden><path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.68 3.7 14.55 2.8 12 2.8 6.92 2.8 2.8 6.92 2.8 12s4.12 9.2 9.2 9.2c5.31 0 8.83-3.73 8.83-8.99 0-.6-.07-1.06-.15-1.51Z"/></svg>
              Continuar con Google
            </button>
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />o con tu correo<span className="h-px flex-1 bg-border" /></div>
            <form onSubmit={submit} className="space-y-3">
              {mode === "up" && (
                <label className="block text-sm font-semibold">Nombre
                  <input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 h-12 w-full rounded-2xl border-2 bg-background px-4 outline-none focus:border-primary" />
                </label>
              )}
              <label className="block text-sm font-semibold">Correo electrónico
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="mt-1 h-12 w-full rounded-2xl border-2 bg-background px-4 outline-none focus:border-primary" />
              </label>
              <label className="block text-sm font-semibold">Contraseña
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === "up" ? "new-password" : "current-password"} className="mt-1 h-12 w-full rounded-2xl border-2 bg-background px-4 outline-none focus:border-primary" />
              </label>
              <button disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-60">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} {mode === "up" ? "Crear cuenta" : "Entrar"}
              </button>
            </form>
            <p className="mt-5 text-center text-sm text-muted-foreground">
              {mode === "up" ? "¿Ya tienes cuenta?" : "¿Aún no tienes cuenta?"}{" "}
              <button onClick={() => setMode(mode === "up" ? "in" : "up")} className="font-bold text-primary">{mode === "up" ? "Entrar" : "Regístrate"}</button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

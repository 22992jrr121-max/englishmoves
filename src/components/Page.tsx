import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Logo } from "./Logo";

export function Page({ title, subtitle, children, action }: { title?: string; subtitle?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6 sm:pt-6">
      <div className="mb-5 flex items-center justify-between">
        <Logo />
        {action}
      </div>
      {title && (
        <div className="mb-5">
          <h1 className="text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground sm:text-base">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Loading({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" /> {label}
    </div>
  );
}

export function Empty({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="rounded-3xl border-2 border-dashed p-8 text-center">
      <p className="text-lg font-bold text-navy">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

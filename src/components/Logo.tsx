import mark from "@/assets/logo-mark.png";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <img src={mark} alt="" width={128} height={128} className="h-9 w-9 shrink-0" />
      <span className="text-xl font-extrabold tracking-tight">
        <span className="text-primary">Go</span>
        <span className="text-navy">English</span>
        <span className="text-mint">!</span>
      </span>
    </span>
  );
}

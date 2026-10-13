import logo from "@/assets/goenglish-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <img src={logo.url} alt="" className="h-9 w-9 shrink-0 object-cover object-top" style={{ objectPosition: "50% 20%" }} />
      <span className="text-xl font-extrabold tracking-tight">
        <span className="text-primary">Go</span>
        <span className="text-navy">English</span>
        <span className="text-mint">!</span>
      </span>
    </span>
  );
}

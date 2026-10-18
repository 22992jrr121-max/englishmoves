import logo from "@/assets/english-moves-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center", className)}>
      <img src={logo.url} alt="English Moves" width={1200} height={1200} className="h-auto w-32 object-contain" />
    </span>
  );
}

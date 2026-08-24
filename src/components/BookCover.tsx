import { Headphones } from "lucide-react";
import { cn } from "@/lib/utils";

/** Deterministic gradient from a string, for cover placeholders. */
function gradientFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  const h2 = (h + 48) % 360;
  return `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${h2} 65% 40%))`;
}

export function BookCover({
  title,
  cover,
  className,
  rounded = "rounded-lg",
}: {
  title: string;
  cover?: string;
  className?: string;
  rounded?: string;
}) {
  if (cover) {
    return (
      <img
        src={cover}
        alt={`${title} cover`}
        className={cn("h-full w-full object-cover", rounded, className)}
        draggable={false}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center text-white/90",
        rounded,
        className,
      )}
      style={{ background: gradientFor(title) }}
    >
      <Headphones className="h-1/3 w-1/3 opacity-80" strokeWidth={1.5} />
    </div>
  );
}

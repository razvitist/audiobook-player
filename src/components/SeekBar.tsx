import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Playback scrubber with a hover-preview tooltip that shows the time under the
 * cursor, a thickening track on hover, and a glowing fill.
 */
export function SeekBar({
  value,
  max,
  onSeek,
  disabled,
}: {
  value: number;
  max: number;
  onSeek: (seconds: number) => void;
  disabled?: boolean;
}) {
  const trackRef = React.useRef<HTMLSpanElement>(null);
  const [hover, setHover] = React.useState<{ x: number; time: number } | null>(null);

  const updateHover = (clientX: number) => {
    const el = trackRef.current;
    if (!el || max <= 0) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setHover({ x, time: (x / rect.width) * max });
  };

  return (
    <div className="group/seek relative py-1.5">
      {hover && !disabled && (
        <div
          className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full rounded-md bg-popover px-2 py-1 text-xs font-medium tabular-nums text-popover-foreground shadow-md ring-1 ring-border"
          style={{ left: hover.x }}
        >
          {formatTime(hover.time)}
        </div>
      )}
      <SliderPrimitive.Root
        value={[Math.min(value, max || value)]}
        max={max || 1}
        step={1}
        disabled={disabled}
        onValueChange={([v]) => onSeek(v)}
        onPointerMove={(e) => updateHover(e.clientX)}
        onPointerLeave={() => setHover(null)}
        aria-label="Seek"
        className="relative flex w-full touch-none select-none items-center"
      >
        <SliderPrimitive.Track
          ref={trackRef}
          className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-secondary transition-all duration-150 group-hover/seek:h-2.5"
        >
          {/* Hover preview fill */}
          {hover && !disabled && (
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary/25"
              style={{ width: hover.x }}
            />
          )}
          <SliderPrimitive.Range className="absolute h-full rounded-full bg-gradient-to-r from-primary to-primary/70 shadow-[0_0_12px_-2px_hsl(var(--primary))]" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className={cn(
            "block h-3.5 w-3.5 rounded-full border-2 border-primary bg-background shadow-md transition-transform",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "scale-0 group-hover/seek:scale-100 data-[dragging]:scale-125",
            disabled && "hidden",
          )}
        />
      </SliderPrimitive.Root>
    </div>
  );
}

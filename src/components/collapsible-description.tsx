"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * A Competition's description, clamped to about six lines with a
 * "Show more" / "Show less" button when it is longer. The button only
 * appears when the content overflows the clamp.
 */
export function CollapsibleDescription({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      // Only measurable while clamped; once expanded keep what we knew.
      if (!expanded) setOverflows(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded]);

  return (
    <div className="flex flex-col items-start gap-1">
      <div
        ref={ref}
        data-slot="competition-description"
        data-expanded={expanded}
        className={
          expanded
            ? "w-full text-sm"
            : "max-h-36 w-full overflow-hidden text-sm"
        }
      >
        {children}
      </div>
      {overflows || expanded ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={expanded}
          onClick={() => setExpanded((on) => !on)}
        >
          {expanded ? "Show less" : "Show more"}
        </Button>
      ) : null}
    </div>
  );
}

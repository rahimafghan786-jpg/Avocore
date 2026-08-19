import { Decision } from "@/domain/opportunity";

const STYLES: Record<Decision, { bg: string; fg: string }> = {
  GO: { bg: "var(--accent-green-dim)", fg: "var(--accent-green)" },
  TEST: { bg: "var(--accent-blue-dim)", fg: "var(--accent-blue)" },
  INVESTIGATE: { bg: "var(--accent-amber-dim)", fg: "var(--accent-amber)" },
  WAIT: { bg: "var(--accent-purple-dim)", fg: "var(--accent-purple)" },
  REJECT: { bg: "var(--accent-red-dim)", fg: "var(--accent-red)" },
};

export function DecisionBadge({ decision, size = "md" }: { decision: Decision; size?: "sm" | "md" }) {
  const style = STYLES[decision];
  return (
    <span
      className={
        "inline-flex items-center rounded-md font-display font-semibold uppercase tracking-wide " +
        (size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-sm")
      }
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      {decision}
    </span>
  );
}

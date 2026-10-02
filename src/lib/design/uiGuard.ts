export interface GuardViolation {
  file: string;
  line: number;
  rule: string;
  text: string;
}

/**
 * Patterns the design system replaced (docs/superpowers/specs/
 * 2026-10-02-design-system-foundation-design.md §4). Overlays and
 * components/graphics are out of scope; components/ui is shadcn's own code.
 */
export const GUARD_RULES = [
  {
    id: "control-btn",
    pattern: /\bcontrol-btn\b/,
    message: 'Use <Button> (size="touch" for live controls).',
  },
  { id: "confirm", pattern: /\b(?:window\.)?confirm\(/, message: "Use <ConfirmAction>." },
  {
    id: "light-colour",
    pattern:
      /\b(?:text|bg|border)-(?:black|white)(?:\/\d+)?\b(?![\w-])|\bbg-repone-white\b|\btext-repone-black\b/,
    message: "Use theme tokens (foreground, card, border, muted-foreground…).",
  },
  {
    id: "status-colour",
    pattern: /\b(?:text|bg|border)-(?:green|red|amber|yellow|blue|emerald|orange)-\d{2,3}\b/,
    message: "Use success / warning / destructive / brand-text tokens.",
  },
  {
    id: "dim-text",
    pattern: /\btext-(?:white|black|foreground)\/[1-5]0\b/,
    message: "Below AA on dark: use text-muted-foreground.",
  },
  {
    id: "raw-control",
    pattern: /<(?:select|textarea)\b|<input\b(?![^>]*type=["']hidden["'])/,
    message: "Use the shadcn Input/Select/Textarea/Checkbox/Switch.",
  },
  {
    id: "focus",
    pattern: /\boutline-none\b(?![^"'`]*focus-visible:)/,
    message: "Keep a visible focus style (focus-visible:ring…).",
  },
  { id: "emoji", pattern: /[\u{1F300}-\u{1FAFF}]/u, message: "Use a lucide-react icon." },
] as const;

const IGNORE = "ui-guard-ignore";

export function checkSource(file: string, source: string): GuardViolation[] {
  const out: GuardViolation[] = [];
  const lines = source.split("\n");
  lines.forEach((text, i) => {
    if (text.includes(IGNORE) || (i > 0 && lines[i - 1].includes(IGNORE))) return;
    for (const r of GUARD_RULES)
      if (r.pattern.test(text)) out.push({ file, line: i + 1, rule: r.id, text: text.trim() });
  });
  return out;
}

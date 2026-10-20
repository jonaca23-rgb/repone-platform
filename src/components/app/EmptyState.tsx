import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  titleAs: Title = "p",
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** The element for the title; a page-level empty state passes "h1". */
  titleAs?: "p" | "h1" | "h2";
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-10 text-center">
      {Icon ? <Icon className="size-8 text-muted-foreground" aria-hidden /> : null}
      <Title className="font-semibold">{title}</Title>
      {description ? (
        <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action}
    </div>
  );
}

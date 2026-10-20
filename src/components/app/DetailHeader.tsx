/** The top of a long record: media, the page's h1, a subtitle, and its actions. */
export function DetailHeader({
  title,
  subtitle,
  media,
  actions,
  breadcrumb,
}: {
  title: string;
  subtitle?: React.ReactNode;
  media?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      {breadcrumb}
      <div className="flex flex-wrap items-center gap-4">
        {media ? <div className="shrink-0">{media}</div> : null}
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-balance">
            {title}
          </h1>
          {subtitle ? <p className="mt-1 text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div> : null}
      </div>
    </div>
  );
}

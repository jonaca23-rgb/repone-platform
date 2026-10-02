export function WodCard({
  name,
  description,
  timeCapSeconds,
  fullScreen = false,
}: {
  name: string;
  description: string | null;
  timeCapSeconds: number | null;
  fullScreen?: boolean;
}) {
  const timeCap = timeCapSeconds ? `${Math.floor(timeCapSeconds / 60)} MIN CAP` : null;

  return (
    <div
      className={
        fullScreen
          ? "flex h-screen w-screen flex-col items-center justify-center bg-broadcast-bg px-24 text-center text-broadcast-fg"
          : "flex w-[560px] flex-col bg-broadcast-bg/95 px-8 py-6 text-broadcast-fg shadow-2xl"
      }
    >
      <p className="font-display text-3xl font-bold uppercase tracking-widest text-broadcast-accent">
        {name}
      </p>
      {description ? (
        <p className="mt-4 whitespace-pre-line text-xl leading-relaxed">{description}</p>
      ) : null}
      {timeCap ? (
        <p className="mt-4 text-sm font-bold uppercase tracking-widest text-broadcast-fg/60">
          {timeCap}
        </p>
      ) : null}
    </div>
  );
}

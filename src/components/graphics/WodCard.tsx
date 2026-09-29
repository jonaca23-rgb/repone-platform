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
          ? "flex h-screen w-screen flex-col items-center justify-center bg-repone-black px-24 text-center text-repone-white"
          : "flex w-[560px] flex-col bg-repone-black/95 px-8 py-6 text-repone-white shadow-2xl"
      }
    >
      <p className="font-[family-name:var(--font-display)] text-3xl font-bold uppercase tracking-widest text-repone-red">
        {name}
      </p>
      {description ? (
        <p className="mt-4 whitespace-pre-line text-xl leading-relaxed">{description}</p>
      ) : null}
      {timeCap ? (
        <p className="mt-4 text-sm font-bold uppercase tracking-widest text-white/60">{timeCap}</p>
      ) : null}
    </div>
  );
}

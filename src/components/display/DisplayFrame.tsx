// The shared frame of every info block on the venue display: a full-width
// banner naming the block, the content, and a footer with the event and the
// RepOne mark. Sizes are 1080x1920 stage pixels; nothing here is under 40px
// because the screen is read from across a gym.
export function DisplayFrame({
  title,
  tone,
  eventName,
  children,
}: {
  title: string;
  /** "live" is the red banner, rationed to what is happening right now. */
  tone: "live" | "plain";
  eventName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 flex flex-col bg-broadcast-bg text-broadcast-fg">
      <h2
        className={`flex h-[200px] shrink-0 items-center px-[72px] font-display text-dp-title font-bold tracking-wide uppercase ${
          tone === "live" ? "bg-broadcast-accent" : "bg-broadcast-muted"
        }`}
      >
        {title}
      </h2>
      <div className="flex min-h-0 flex-1 flex-col px-[72px] pt-[64px] pb-[48px]">{children}</div>
      <footer className="flex h-[136px] shrink-0 items-center justify-between gap-[48px] border-t-2 border-broadcast-muted px-[72px]">
        <p className="min-w-0 truncate font-display text-dp-label font-bold tracking-wide text-broadcast-dim uppercase">
          {eventName}
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/repone-logo.png" alt="RepOne" className="h-[64px] w-auto shrink-0" />
      </footer>
    </div>
  );
}

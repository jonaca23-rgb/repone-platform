/** What the venue display shows when it is switched off or has nothing to rotate. */
export function StandbyScreen() {
  return (
    <div
      data-testid="display-standby"
      className="absolute inset-0 flex items-center justify-center bg-broadcast-bg"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/repone-logo.png" alt="RepOne" className="w-[560px]" />
    </div>
  );
}

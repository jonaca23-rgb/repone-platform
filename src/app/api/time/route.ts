// The server's clock, for useServerClockOffset(): timer screens (dashboard,
// OBS overlays) add the measured offset to Date.now() so a machine whose
// clock is a few seconds off still shows the same time as everyone else.
export function GET() {
  return Response.json({ now: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}

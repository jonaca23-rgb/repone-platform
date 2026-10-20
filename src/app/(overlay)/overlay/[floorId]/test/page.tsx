import { notFound } from "next/navigation";
import { getFloorContext } from "@/lib/db/queries";
import { BroadcastStage, SafeArea } from "@/components/graphics/BroadcastStage";
import { CalibrationReadout } from "./CalibrationReadout";

const CORNERS = [
  { label: "TL", className: "top-0 left-0" },
  { label: "TR", className: "top-0 right-0" },
  { label: "BL", className: "bottom-0 left-0" },
  { label: "BR", className: "bottom-0 right-0" },
];

// Calibration pattern for checking a browser source on the device (YoloBox,
// OBS): the whole stage, the safe area every graphic stays inside, the real
// viewport and scale, and a transparency check — the page has no background,
// so a solid frame on the device means it isn't honouring transparency.
export default async function OverlayCalibrationPage({
  params,
}: {
  params: Promise<{ floorId: string }>;
}) {
  const { floorId } = await params;
  if (!(await getFloorContext(floorId))) notFound();

  return (
    <BroadcastStage>
      <div className="absolute inset-0 border-2 border-broadcast-fg" />
      <SafeArea className="border-2 border-dashed border-broadcast-accent">
        {CORNERS.map((c) => (
          <span
            key={c.label}
            className={`absolute bg-broadcast-bg px-[12px] py-[4px] text-bc-label font-bold text-broadcast-fg ${c.className}`}
          >
            {c.label}
          </span>
        ))}
      </SafeArea>
      <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[16px] bg-broadcast-bg/80 px-[48px] py-[32px] text-center text-broadcast-fg">
        <p className="font-display text-bc-title leading-none font-bold uppercase">
          1920 × 1080 stage
        </p>
        <CalibrationReadout />
        <p className="max-w-[900px] text-bc-label">
          If you can see your camera behind this text, the background is transparent.
        </p>
      </div>
    </BroadcastStage>
  );
}

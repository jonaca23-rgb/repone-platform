/** Every overlay is laid out on this stage and scaled to the viewport. */
export const STAGE = { width: 1920, height: 1080, safeX: 96, safeY: 54 } as const;

/** The portrait venue display (9:16 TV) is laid out on this stage. */
export const DISPLAY_STAGE = { width: 1080, height: 1920 } as const;

/**
 * Full-frame cards keep the bottom of the stage free for the lower third, which
 * can go on air over them: the safe margin plus the lower third's height.
 */
export const CARD_BOTTOM = 216;

/** How a stage scales to fit a viewport keeping its shape, and where it starts so it sits centred. */
export function fitStage(
  stage: { width: number; height: number },
  width: number,
  height: number,
): { s: number; x: number; y: number } {
  const s = Math.min(width / stage.width, height / stage.height);
  return { s, x: (width - stage.width * s) / 2, y: (height - stage.height * s) / 2 };
}

/** How much the 1920x1080 stage scales to fit a viewport, keeping its shape. */
export function stageScale(width: number, height: number): number {
  return fitStage(STAGE, width, height).s;
}

/** Where the scaled stage starts, so it sits centred in a viewport of another shape. */
export function stageOffset(width: number, height: number): { x: number; y: number } {
  const { x, y } = fitStage(STAGE, width, height);
  return { x, y };
}

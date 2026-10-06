/** Every overlay is laid out on this stage and scaled to the viewport. */
export const STAGE = { width: 1920, height: 1080, safeX: 96, safeY: 54 } as const;

/**
 * Full-frame cards keep the bottom of the stage free for the lower third, which
 * can go on air over them: the safe margin plus the lower third's height.
 */
export const CARD_BOTTOM = 216;

/** How much the 1920x1080 stage scales to fit a viewport, keeping its shape. */
export function stageScale(width: number, height: number): number {
  return Math.min(width / STAGE.width, height / STAGE.height);
}

/** Where the scaled stage starts, so it sits centred in a viewport of another shape. */
export function stageOffset(width: number, height: number): { x: number; y: number } {
  const s = stageScale(width, height);
  return { x: (width - STAGE.width * s) / 2, y: (height - STAGE.height * s) / 2 };
}

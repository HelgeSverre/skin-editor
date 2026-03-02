import type { SkinElement, RenderState } from "../lib/types";

export function renderRotary(
  ctx: CanvasRenderingContext2D,
  element: SkinElement,
  x: number, y: number, w: number, h: number,
  state: RenderState,
): void {
  if (!element.spritesheet) return;
  const sheet = element.spritesheet;
  const img = state.images[sheet.texture];

  if (!img) {
    ctx.save();
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = "rgba(100, 150, 255, 0.5)";
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
    ctx.restore();
    return;
  }

  const totalFrames = Math.max(1, Math.floor(img.naturalHeight / sheet.tileSizeY));
  const frame = state.scrubFrames[element.name] ?? Math.floor(totalFrames / 2);
  const clampedFrame = Math.max(0, Math.min(frame, totalFrames - 1));

  const srcX = 0;
  const srcY = clampedFrame * sheet.tileSizeY;
  const srcW = sheet.tileSizeX;
  const srcH = sheet.tileSizeY;

  ctx.drawImage(img, srcX, srcY, srcW, srcH, x, y, w, h);
}

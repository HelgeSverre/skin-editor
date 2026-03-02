import type { SkinElement, RenderState } from "../lib/types";

export function renderImage(
  ctx: CanvasRenderingContext2D,
  element: SkinElement,
  x: number, y: number, w: number, h: number,
  state: RenderState,
): void {
  if (!element.image) return;
  const img = state.images[element.image.texture];
  if (!img) return;
  ctx.drawImage(img, x, y, w, h);
}

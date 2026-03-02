import type { SkinElement, RenderState } from "../lib/types";

export function renderContainer(
  ctx: CanvasRenderingContext2D,
  _element: SkinElement,
  x: number, y: number, w: number, h: number,
  state: RenderState,
): void {
  if (state.debugMode) {
    ctx.save();
    ctx.fillStyle = "rgba(0, 100, 255, 0.08)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(0, 100, 255, 0.3)";
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
    ctx.restore();
  }
}

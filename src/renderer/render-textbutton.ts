import type { SkinElement, RenderState } from "../lib/types";

export function renderTextbutton(
  ctx: CanvasRenderingContext2D,
  element: SkinElement,
  x: number, y: number, w: number, h: number,
  state: RenderState,
  scale: number,
): void {
  if (!element.textbutton) return;
  const tb = element.textbutton;

  if (state.hoveredElement === element.name) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  const fontSize = tb.textHeight * scale;
  ctx.font = `${fontSize}px sans-serif`;
  ctx.fillStyle = tb.color || "rgba(255, 255, 255, 1)";

  let textX = x;
  if (tb.alignH === "R") { ctx.textAlign = "right"; textX = x + w; }
  else if (tb.alignH === "C") { ctx.textAlign = "center"; textX = x + w / 2; }
  else { ctx.textAlign = "left"; }

  ctx.textBaseline = "middle";
  ctx.fillText(tb.text, textX, y + h / 2);
}

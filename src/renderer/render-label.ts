import type { SkinElement, RenderState } from "../lib/types";

export function renderLabel(
  ctx: CanvasRenderingContext2D,
  element: SkinElement,
  x: number, y: number, w: number, h: number,
  _state: RenderState,
  scale: number,
): void {
  if (!element.label) return;
  const label = element.label;

  if (label.backgroundColor) {
    ctx.fillStyle = label.backgroundColor;
    ctx.fillRect(x, y, w, h);
  }

  const fontSize = label.textHeight * scale;
  const fontWeight = label.bold ? "bold" : "normal";
  const fontFamily = label.fontFile || "sans-serif";
  ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}", sans-serif`;
  ctx.fillStyle = label.color || "rgba(255, 255, 255, 1)";

  let textX = x;
  if (label.alignH === "R") { ctx.textAlign = "right"; textX = x + w; }
  else if (label.alignH === "C") { ctx.textAlign = "center"; textX = x + w / 2; }
  else { ctx.textAlign = "left"; }

  let textY: number;
  if (label.alignV === "T") { ctx.textBaseline = "top"; textY = y; }
  else if (label.alignV === "B") { ctx.textBaseline = "bottom"; textY = y + h; }
  else { ctx.textBaseline = "middle"; textY = y + h / 2; }

  ctx.fillText(label.text, textX, textY);
}

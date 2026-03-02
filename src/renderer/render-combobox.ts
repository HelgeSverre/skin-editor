import type { SkinElement, RenderState } from "../lib/types";

export function renderCombobox(
  ctx: CanvasRenderingContext2D,
  element: SkinElement,
  x: number, y: number, w: number, h: number,
  _state: RenderState,
  scale: number,
): void {
  if (!element.combobox) return;
  const cb = element.combobox;

  const fontSize = cb.textHeight * scale;
  const fontFamily = cb.fontFile || "sans-serif";
  ctx.font = `${fontSize}px "${fontFamily}", sans-serif`;
  ctx.fillStyle = cb.color || "rgba(255, 255, 255, 1)";

  const padding = 4 * scale;
  const arrowSize = 6 * scale;

  let textX = x + padding;
  if (cb.alignH === "R") { ctx.textAlign = "right"; textX = x + w - padding - arrowSize - padding; }
  else if (cb.alignH === "C") { ctx.textAlign = "center"; textX = x + w / 2; }
  else { ctx.textAlign = "left"; }

  let textY: number;
  if (cb.alignV === "T") { ctx.textBaseline = "top"; textY = y; }
  else if (cb.alignV === "B") { ctx.textBaseline = "bottom"; textY = y + h; }
  else { ctx.textBaseline = "middle"; textY = y + h / 2; }

  ctx.fillText(cb.text, textX, textY);

  const arrowX = x + w - padding - arrowSize;
  const arrowY = y + h / 2 - arrowSize / 2;
  ctx.beginPath();
  ctx.moveTo(arrowX, arrowY);
  ctx.lineTo(arrowX + arrowSize, arrowY);
  ctx.lineTo(arrowX + arrowSize / 2, arrowY + arrowSize);
  ctx.closePath();
  ctx.fill();
}

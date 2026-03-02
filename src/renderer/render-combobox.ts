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
  ctx.font = `${fontSize}px sans-serif`;
  ctx.fillStyle = cb.color || "rgba(255, 255, 255, 1)";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  const textY = y + h / 2;
  const padding = 4 * scale;
  ctx.fillText(cb.text, x + padding, textY);

  const arrowSize = 6 * scale;
  const arrowX = x + w - padding - arrowSize;
  const arrowY = y + h / 2 - arrowSize / 2;
  ctx.beginPath();
  ctx.moveTo(arrowX, arrowY);
  ctx.lineTo(arrowX + arrowSize, arrowY);
  ctx.lineTo(arrowX + arrowSize / 2, arrowY + arrowSize);
  ctx.closePath();
  ctx.fill();
}

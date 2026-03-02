import type { SkinElement, RenderState } from "../lib/types";
import { getElementPosition } from "../lib/geometry";
import { renderImage } from "./render-image";
import { renderButton } from "./render-button";
import { renderLabel } from "./render-label";
import { renderRotary } from "./render-rotary";
import { renderCombobox } from "./render-combobox";
import { renderTextbutton } from "./render-textbutton";
import { renderContainer } from "./render-container";

const MAX_DEPTH = 20;

export function renderElementTree(
  ctx: CanvasRenderingContext2D,
  elements: SkinElement[],
  parentX: number, parentY: number,
  scale: number, state: RenderState,
  depth: number = 0,
): void {
  if (depth > MAX_DEPTH) return;
  for (const element of elements) {
    if (element._page && element._page !== state.activeTab) continue;
    renderElement(ctx, element, parentX, parentY, scale, state, depth);
  }
}

function renderElement(
  ctx: CanvasRenderingContext2D,
  element: SkinElement,
  parentX: number, parentY: number,
  scale: number, state: RenderState, depth: number,
): void {
  const pos = getElementPosition(element);
  if (!pos) return;

  const x = (parentX + pos.x) * scale;
  const y = (parentY + pos.y) * scale;
  const w = pos.width * scale;
  const h = pos.height * scale;

  switch (element._type) {
    case "image":
      renderImage(ctx, element, x, y, w, h, state);
      break;
    case "button":
      renderButton(ctx, element, x, y, w, h, state);
      break;
    case "label":
      renderLabel(ctx, element, x, y, w, h, state, scale);
      break;
    case "rotary":
      renderRotary(ctx, element, x, y, w, h, state);
      break;
    case "combobox":
      renderCombobox(ctx, element, x, y, w, h, state, scale);
      break;
    case "textbutton":
      renderTextbutton(ctx, element, x, y, w, h, state, scale);
      break;
    case "container":
    case "component":
      renderContainer(ctx, element, x, y, w, h, state);
      break;
    default:
      if (state.debugMode) {
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "10px sans-serif";
        ctx.fillText(element._type, x + 2, y + 12);
        ctx.restore();
      }
      break;
  }

  if (state.debugMode) {
    renderDebugOverlay(ctx, element, x, y, w, h, state);
  }

  // Recurse into children
  if (element.children) {
    renderElementTree(ctx, element.children, parentX + pos.x, parentY + pos.y, scale, state, depth + 1);
  }
}

function renderDebugOverlay(
  ctx: CanvasRenderingContext2D,
  element: SkinElement,
  x: number, y: number, w: number, h: number,
  state: RenderState,
): void {
  if (state.hoveredElement === element.name) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 0, 0.15)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(255, 255, 0, 0.8)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }
}

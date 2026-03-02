import type { SkinElement, RenderState } from "../lib/types";

export function renderButton(
  ctx: CanvasRenderingContext2D,
  element: SkinElement,
  x: number, y: number, w: number, h: number,
  state: RenderState,
): void {
  if (!element.button) return;
  const btn = element.button;
  const img = state.images[btn.texture];

  if (!img) {
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = "rgba(255, 200, 0, 0.5)";
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
    ctx.restore();
    return;
  }

  const isHovered = state.hoveredElement === element.name;
  const isTabButton = state.activeTab !== "" && element.name.startsWith("Tab");
  const isActive = isTabButton
    ? state.activeTab === element.name.replace("Tab", "page_").toLowerCase()
    : false;

  let spriteIndex: number;
  if (isActive || (btn.isToggle && isActive)) {
    spriteIndex = isHovered ? btn.overImageOn : btn.normalImageOn;
  } else {
    spriteIndex = isHovered ? btn.overImage : btn.normalImage;
  }

  const srcX = 0;
  const srcY = spriteIndex * btn.tileSizeY;
  const srcW = btn.tileSizeX;
  const srcH = btn.tileSizeY;

  if (srcY + srcH > img.naturalHeight) {
    ctx.drawImage(img, 0, 0, srcW, Math.min(srcH, img.naturalHeight), x, y, w, h);
    return;
  }

  ctx.drawImage(img, srcX, srcY, srcW, srcH, x, y, w, h);
}

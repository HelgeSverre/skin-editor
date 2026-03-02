import type { SkinElement, ElementPosition } from "./types";

export function getElementPosition(
  element: SkinElement,
): ElementPosition | null {
  if (element.image) return element.image;
  if (element.button) return element.button;
  if (element.label) return element.label;
  if (element.spritesheet) return element.spritesheet;
  if (element.combobox) return element.combobox;
  if (element.textbutton) return element.textbutton;
  if (element.container) return element.container;
  if (element.component) return element.component;
  return null;
}

export function hitTest(
  px: number,
  py: number,
  element: SkinElement,
  parentX: number,
  parentY: number,
): boolean {
  const pos = getElementPosition(element);
  if (!pos) return false;
  const ex = parentX + pos.x;
  const ey = parentY + pos.y;
  return px >= ex && px <= ex + pos.width && py >= ey && py <= ey + pos.height;
}

export function findElementAtPoint(
  px: number,
  py: number,
  elements: SkinElement[],
  parentX: number,
  parentY: number,
  activeTab: string,
): SkinElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el._page && el._page !== activeTab) continue;
    const pos = getElementPosition(el);
    if (!pos) continue;
    const elX = parentX + pos.x;
    const elY = parentY + pos.y;
    if (el.children) {
      const child = findElementAtPoint(px, py, el.children, elX, elY, activeTab);
      if (child) return child;
    }
    if (hitTest(px, py, el, parentX, parentY)) return el;
  }
  return null;
}

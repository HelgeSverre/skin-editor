# Skin Editor v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite the Osirus Skin Editor from scratch as a TypeScript + Svelte 5 application that correctly renders all skin element types with proper nested children, page filtering, and interactive previewing.

**Architecture:** Bottom-up build. Pure TypeScript modules for parsing, asset loading, and rendering logic. Svelte 5 components only for the UI shell. Canvas rendering via plain functions dispatched by element type. No state management library — Svelte runes handle reactivity.

**Tech Stack:** Svelte 5, TypeScript, Vite, TailwindCSS 3, JSON5, Canvas API

**Reference:** See `PLAN-REFACTOR-V2.md` for the full vision document describing the finished product.

---

## Pre-Implementation: Project Scaffold

### Task 0: Move old code and set up fresh project

**Files:**
- Move: `src/` → `old/src/`
- Move: `plain.html` → `old/plain.html`
- Keep in place: `package.json`, `vite.config.js`, `svelte.config.js`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `skins/`, `CLAUDE.md`, `PLAN-REFACTOR-V2.md`, `.gitignore`, `.prettierrc`
- Create: `src/main.ts`
- Create: `src/app.css`
- Create: `src/App.svelte`
- Modify: `package.json` (upgrade deps)
- Modify: `svelte.config.js`
- Modify: `vite.config.js`
- Create: `tsconfig.json`

**Step 1: Move old source to old/**

```bash
mkdir -p old
mv src old/
mv plain.html old/
```

**Step 2: Create fresh src directory structure**

```bash
mkdir -p src/lib src/renderer src/ui
```

**Step 3: Upgrade package.json**

Replace the dependencies and devDependencies in `package.json`:

```json
{
  "name": "skin-editor",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build",
    "dev": "vite",
    "format": "npx prettier --write src/",
    "preview": "vite preview"
  },
  "dependencies": {
    "json5": "^2.2.3"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^5.0.0",
    "autoprefixer": "^10.4.21",
    "prettier": "^3.6.2",
    "prettier-plugin-svelte": "^4.0.0",
    "prettier-plugin-tailwindcss": "^0.6.14",
    "svelte": "^5.0.0",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

Note: Use `svelte@^5` and `@sveltejs/vite-plugin-svelte@^5` — the npm resolver will pick the latest compatible versions. Removed unused `classnames` and `lucide-svelte`.

**Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "src/**/*.svelte"]
}
```

**Step 5: Update svelte.config.js**

```js
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default {
  preprocess: vitePreprocess(),
};
```

**Step 6: Update vite.config.js (unchanged but verify)**

```js
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
});
```

**Step 7: Create minimal bootstrap files**

`src/app.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`src/main.ts`:
```ts
import "./app.css";
import App from "./App.svelte";
import { mount } from "svelte";

const app = mount(App, { target: document.getElementById("app")! });

export default app;
```

`src/App.svelte`:
```svelte
<script lang="ts">
  // Placeholder — will be built out in Phase 4
</script>

<main class="flex h-screen w-screen bg-gray-900 text-white">
  <p class="m-auto text-xl">Skin Editor v2 — loading...</p>
</main>
```

**Step 8: Update index.html script src**

Change `/src/main.js` to `/src/main.ts` in `index.html`.

**Step 9: Install dependencies and verify dev server starts**

```bash
npm install
npm run dev
```

Expected: Dev server starts, browser shows "Skin Editor v2 — loading..." on dark background.

**Step 10: Commit**

```bash
git add -A
git commit -m "scaffold: move v1 to old/, set up Svelte 5 + TypeScript project"
```

---

## Phase 1: Foundation Types & Parser

### Task 1: Define skin schema types

**Files:**
- Create: `src/lib/types.ts`

**Step 1: Write the types file**

This file defines the full schema. All numeric fields are `number` (post-parsing). Colors are `string` in normalized `rgba()` format. The `_type` and `_page` fields are parser-added metadata.

```ts
// src/lib/types.ts

/** Parsed + normalized skin definition */
export interface SkinDefinition {
  name: string;
  root: RootConfig;
  tabgroup: TabGroup | null;
  templates: Template[];
  children: SkinElement[];
}

export interface RootConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

export interface TabGroup {
  name: string;
  buttons: string[];
  pages: string[];
}

export interface Template {
  name: string;
  [key: string]: unknown;
}

/** The primary renderable type of an element */
export type ElementType =
  | "image"
  | "button"
  | "label"
  | "rotary"
  | "combobox"
  | "textbutton"
  | "container"
  | "component"
  | "unknown";

/** Positional properties shared by most element types */
export interface ElementPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageProps extends ElementPosition {
  texture: string;
}

export interface ButtonProps extends ElementPosition {
  texture: string;
  tileSizeX: number;
  tileSizeY: number;
  isToggle: boolean;
  radioGroupId: string;
  normalImage: number;
  overImage: number;
  downImage: number;
  normalImageOn: number;
  overImageOn: number;
  downImageOn: number;
}

export interface LabelProps extends ElementPosition {
  text: string;
  textHeight: number;
  color: string; // normalized rgba()
  backgroundColor: string; // normalized rgba() or ""
  alignH: "L" | "C" | "R";
  alignV: "T" | "C" | "B";
  bold: boolean;
  fontFile: string;
}

export interface SpritesheetProps extends ElementPosition {
  texture: string;
  tileSizeX: number;
  tileSizeY: number;
}

export interface ComboboxProps extends ElementPosition {
  text: string;
  textHeight: number;
  color: string;
  alignH: "L" | "C" | "R";
  alignV: "T" | "C" | "B";
  tooltip: string;
}

export interface TextbuttonProps extends ElementPosition {
  text: string;
  textHeight: number;
  color: string;
  alignH: "L" | "C" | "R";
  alignV: "T" | "C" | "B";
}

export interface ConditionProps {
  enableOnParameter: string;
  enableOnValues: string;
}

export interface ParameterAttachment {
  parameter: string;
}

export interface SkinElement {
  name: string;
  _type: ElementType;
  _page: string | null;
  image?: ImageProps;
  button?: ButtonProps;
  label?: LabelProps;
  rotary?: Record<string, never>;
  spritesheet?: SpritesheetProps;
  combobox?: ComboboxProps;
  textbutton?: TextbuttonProps;
  container?: ElementPosition;
  component?: ElementPosition;
  condition?: ConditionProps;
  parameterAttachment?: ParameterAttachment;
  children?: SkinElement[];
}

/** Errors collected during parsing (non-fatal) */
export interface ParseError {
  path: string;
  message: string;
}

export interface ParseResult {
  skin: SkinDefinition;
  errors: ParseError[];
}

/** Render state passed to all renderers */
export interface RenderState {
  activeTab: string;
  hoveredElement: string | null;
  scrubFrames: Record<string, number>;
  debugMode: boolean;
  images: Record<string, HTMLImageElement>;
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add skin schema types"
```

---

### Task 2: Build the skin parser

**Files:**
- Create: `src/lib/parse.ts`

**Step 1: Write the parser**

The parser takes raw JSON5 text, parses it, and normalizes everything: strings to numbers, colors to rgba, detects primary element type, tags page elements, expands templates.

```ts
// src/lib/parse.ts
import JSON5 from "json5";
import type {
  SkinDefinition,
  SkinElement,
  ElementType,
  RootConfig,
  TabGroup,
  Template,
  ParseError,
  ParseResult,
  ImageProps,
  ButtonProps,
  LabelProps,
  SpritesheetProps,
  ComboboxProps,
  TextbuttonProps,
  ElementPosition,
} from "./types";

export function parseSkin(jsonText: string): ParseResult {
  const errors: ParseError[] = [];
  let raw: Record<string, unknown>;
  try {
    raw = JSON5.parse(jsonText);
  } catch (e) {
    return {
      skin: emptyDefinition(),
      errors: [{ path: "root", message: `JSON5 parse error: ${e}` }],
    };
  }

  const root = parseRoot(raw.root as Record<string, string> | undefined, errors);
  const tabgroup = parseTabGroup(raw.tabgroup as Record<string, unknown> | undefined);
  const templates = Array.isArray(raw.templates) ? (raw.templates as Template[]) : [];
  const pageNames = new Set(tabgroup?.pages ?? []);

  const children = Array.isArray(raw.children)
    ? raw.children.map((c: unknown, i: number) =>
        parseElement(c as Record<string, unknown>, `children[${i}]`, pageNames, templates, errors),
      )
    : [];

  return {
    skin: {
      name: typeof raw.name === "string" ? raw.name : "Untitled",
      root,
      tabgroup,
      templates,
      children,
    },
    errors,
  };
}

function emptyDefinition(): SkinDefinition {
  return {
    name: "Empty",
    root: { x: 0, y: 0, width: 800, height: 600, scale: 1 },
    tabgroup: null,
    templates: [],
    children: [],
  };
}

function parseRoot(raw: Record<string, string> | undefined, errors: ParseError[]): RootConfig {
  if (!raw) {
    errors.push({ path: "root", message: "Missing root config, using defaults" });
    return { x: 0, y: 0, width: 800, height: 600, scale: 1 };
  }
  return {
    x: num(raw.x, 0),
    y: num(raw.y, 0),
    width: num(raw.width, 800),
    height: num(raw.height, 600),
    scale: num(raw.scale, 1),
  };
}

function parseTabGroup(raw: Record<string, unknown> | undefined): TabGroup | null {
  if (!raw) return null;
  return {
    name: typeof raw.name === "string" ? raw.name : "pages",
    buttons: Array.isArray(raw.buttons) ? (raw.buttons as string[]) : [],
    pages: Array.isArray(raw.pages) ? (raw.pages as string[]) : [],
  };
}

function parseElement(
  raw: Record<string, unknown>,
  path: string,
  pageNames: Set<string>,
  templates: Template[],
  errors: ParseError[],
): SkinElement {
  const name = typeof raw.name === "string" ? raw.name : "";
  const _type = detectType(raw);
  const _page = pageNames.has(name) ? name : null;

  const element: SkinElement = { name, _type, _page };

  // Parse type-specific properties
  if (raw.image) {
    element.image = parseImageProps(raw.image as Record<string, string>);
  }
  if (raw.button) {
    element.button = parseButtonProps(raw.button as Record<string, string>);
  }
  if (raw.label) {
    const tpl = findTemplate(raw, templates, "label");
    element.label = parseLabelProps(mergeProps(tpl, raw.label as Record<string, string>));
  }
  if (raw.rotary !== undefined) {
    element.rotary = {};
  }
  if (raw.spritesheet) {
    element.spritesheet = parseSpritesheetProps(raw.spritesheet as Record<string, string>);
  }
  if (raw.combobox) {
    element.combobox = parseComboboxProps(raw.combobox as Record<string, string>);
  }
  if (raw.textbutton) {
    element.textbutton = parseTextbuttonProps(raw.textbutton as Record<string, string>);
  }
  if (raw.container) {
    element.container = parsePosition(raw.container as Record<string, string>);
  }
  if (raw.component) {
    element.component = parsePosition(raw.component as Record<string, string>);
  }
  if (raw.condition) {
    const c = raw.condition as Record<string, string>;
    element.condition = {
      enableOnParameter: c.enableOnParameter ?? "",
      enableOnValues: c.enableOnValues ?? "",
    };
  }
  if (raw.parameterAttachment) {
    const pa = raw.parameterAttachment as Record<string, string>;
    element.parameterAttachment = { parameter: pa.parameter ?? "" };
  }

  // Recurse into children
  if (Array.isArray(raw.children)) {
    element.children = raw.children.map((c: unknown, i: number) =>
      parseElement(c as Record<string, unknown>, `${path}.children[${i}]`, pageNames, templates, errors),
    );
  }

  return element;
}

/** Detect the primary renderable type of an element */
function detectType(raw: Record<string, unknown>): ElementType {
  // Priority order: image first (backgrounds), then interactive types
  if (raw.image) return "image";
  if (raw.button) return "button";
  if (raw.label) return "label";
  if (raw.rotary !== undefined) return "rotary";
  if (raw.combobox) return "combobox";
  if (raw.textbutton) return "textbutton";
  if (raw.container) return "container";
  if (raw.component) return "component";
  return "unknown";
}

function findTemplate(
  raw: Record<string, unknown>,
  templates: Template[],
  type: string,
): Record<string, string> | null {
  // Template matching: check if any template name matches a convention
  // This is a simplified version — in practice templates are referenced by name
  for (const tpl of templates) {
    if (tpl[type] && typeof tpl[type] === "object") {
      // Check if element references this template somehow
      // For now, templates are used as defaults when explicitly matching
    }
  }
  return null;
}

function mergeProps(
  template: Record<string, string> | null,
  props: Record<string, string>,
): Record<string, string> {
  if (!template) return props;
  return { ...template, ...props };
}

// --- Property parsers ---

function parsePosition(raw: Record<string, string>): ElementPosition {
  return {
    x: num(raw.x, 0),
    y: num(raw.y, 0),
    width: num(raw.width, 0),
    height: num(raw.height, 0),
  };
}

function parseImageProps(raw: Record<string, string>): ImageProps {
  return {
    ...parsePosition(raw),
    texture: raw.texture ?? "",
  };
}

function parseButtonProps(raw: Record<string, string>): ButtonProps {
  return {
    ...parsePosition(raw),
    texture: raw.texture ?? "",
    tileSizeX: num(raw.tileSizeX, 0),
    tileSizeY: num(raw.tileSizeY, 0),
    isToggle: raw.isToggle === "1",
    radioGroupId: raw.radioGroupId ?? "",
    normalImage: num(raw.normalImage, 0),
    overImage: num(raw.overImage, 0),
    downImage: num(raw.downImage, 0),
    normalImageOn: num(raw.normalImageOn, 0),
    overImageOn: num(raw.overImageOn, 0),
    downImageOn: num(raw.downImageOn, 0),
  };
}

function parseLabelProps(raw: Record<string, string>): LabelProps {
  return {
    ...parsePosition(raw),
    text: raw.text ?? "",
    textHeight: num(raw.textHeight, 14),
    color: normalizeColor(raw.color),
    backgroundColor: raw.backgroundColor ? normalizeColor(raw.backgroundColor) : "",
    alignH: (raw.alignH as "L" | "C" | "R") ?? "L",
    alignV: (raw.alignV as "T" | "C" | "B") ?? "C",
    bold: raw.bold === "1",
    fontFile: raw.fontFile ?? "",
  };
}

function parseSpritesheetProps(raw: Record<string, string>): SpritesheetProps {
  return {
    ...parsePosition(raw),
    texture: raw.texture ?? "",
    tileSizeX: num(raw.tileSizeX, 0),
    tileSizeY: num(raw.tileSizeY, 0),
  };
}

function parseComboboxProps(raw: Record<string, string>): ComboboxProps {
  return {
    ...parsePosition(raw),
    text: raw.text ?? "",
    textHeight: num(raw.textHeight, 14),
    color: normalizeColor(raw.color),
    alignH: (raw.alignH as "L" | "C" | "R") ?? "L",
    alignV: (raw.alignV as "T" | "C" | "B") ?? "C",
    tooltip: raw.tooltip ?? "",
  };
}

function parseTextbuttonProps(raw: Record<string, string>): TextbuttonProps {
  return {
    ...parsePosition(raw),
    text: raw.text ?? "",
    textHeight: num(raw.textHeight, 14),
    color: normalizeColor(raw.color),
    alignH: (raw.alignH as "L" | "C" | "R") ?? "L",
    alignV: (raw.alignV as "T" | "C" | "B") ?? "C",
  };
}

// --- Utilities ---

/** Parse a string to number, returning fallback on NaN */
function num(value: unknown, fallback: number): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = parseFloat(value);
    return Number.isNaN(n) ? fallback : n;
  }
  return fallback;
}

/**
 * Normalize skin color strings to CSS rgba().
 * Input formats: "RRGGBBAA" (8 chars) or "RRGGBB" (6 chars).
 * Returns "rgba(r, g, b, a)" or "transparent" on invalid input.
 */
export function normalizeColor(color: unknown): string {
  if (typeof color !== "string" || color.length < 6) return "transparent";
  const hex = color.replace(/^#/, "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const a = hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
  if ([r, g, b].some((v) => Number.isNaN(v))) return "transparent";
  return `rgba(${r}, ${g}, ${b}, ${Number.isNaN(a) ? 1 : a.toFixed(3)})`;
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/parse.ts
git commit -m "feat: add skin JSON parser with normalization"
```

---

### Task 3: Add geometry utilities

**Files:**
- Create: `src/lib/geometry.ts`

**Step 1: Write geometry.ts**

```ts
// src/lib/geometry.ts
import type { SkinElement, ElementPosition, RenderState } from "./types";

/** Get the positional properties for an element based on its primary type */
export function getElementPosition(element: SkinElement): ElementPosition | null {
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

/** Check if a point (in unscaled skin coordinates) is inside an element */
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

/**
 * Find the deepest element under a point.
 * Searches children-first for correct z-order (later/deeper = on top).
 * Respects page visibility.
 */
export function findElementAtPoint(
  px: number,
  py: number,
  elements: SkinElement[],
  parentX: number,
  parentY: number,
  activeTab: string,
): SkinElement | null {
  // Iterate in reverse (last drawn = on top)
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];

    // Skip elements on inactive pages
    if (el._page && el._page !== activeTab) continue;

    const pos = getElementPosition(el);
    if (!pos) continue;

    const elX = parentX + pos.x;
    const elY = parentY + pos.y;

    // Check children first (deeper = higher z)
    if (el.children) {
      const child = findElementAtPoint(px, py, el.children, elX, elY, activeTab);
      if (child) return child;
    }

    // Then check this element
    if (hitTest(px, py, el, parentX, parentY)) {
      return el;
    }
  }
  return null;
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/lib/geometry.ts
git commit -m "feat: add geometry utilities for hit testing"
```

---

## Phase 2: Asset Loading

### Task 4: Build the asset loader

**Files:**
- Create: `src/lib/asset-loader.ts`

**Step 1: Write asset-loader.ts**

```ts
// src/lib/asset-loader.ts
import type { SkinElement } from "./types";

export interface AssetLoadProgress {
  loaded: number;
  total: number;
}

export interface AssetCache {
  images: Record<string, HTMLImageElement>;
  fonts: Set<string>;
}

/**
 * Collect all unique texture names from the element tree.
 */
export function collectTextures(elements: SkinElement[]): Set<string> {
  const textures = new Set<string>();

  function walk(el: SkinElement): void {
    if (el.image?.texture) textures.add(el.image.texture);
    if (el.button?.texture) textures.add(el.button.texture);
    if (el.spritesheet?.texture) textures.add(el.spritesheet.texture);
    el.children?.forEach(walk);
  }

  elements.forEach(walk);
  return textures;
}

/**
 * Collect all unique font names from the element tree.
 */
export function collectFonts(elements: SkinElement[]): Set<string> {
  const fonts = new Set<string>();

  function walk(el: SkinElement): void {
    if (el.label?.fontFile) fonts.add(el.label.fontFile);
    el.children?.forEach(walk);
  }

  elements.forEach(walk);
  return fonts;
}

/**
 * Load a single image with retry logic.
 */
async function loadImageWithRetry(
  url: string,
  retries: number = 2,
  delays: number[] = [1000, 3000],
): Promise<HTMLImageElement> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await loadImage(url);
    } catch (e) {
      lastError = e;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delays[attempt]));
      }
    }
  }
  throw lastError;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image: ${url}`));
    img.crossOrigin = "anonymous";
    img.src = url;
  });
}

/**
 * Load a font via the FontFace API.
 */
async function loadFont(name: string, url: string): Promise<void> {
  try {
    const face = new FontFace(name, `url(${url})`);
    const loaded = await face.load();
    document.fonts.add(loaded);
  } catch {
    console.warn(`Font failed to load: ${name} from ${url}`);
  }
}

/**
 * Load all assets for a skin.
 * Returns the cache and a list of textures that failed.
 */
export async function loadAssets(
  textures: Set<string>,
  fonts: Set<string>,
  baseUrl: string,
  skinName: string,
  onProgress?: (progress: AssetLoadProgress) => void,
): Promise<{ cache: AssetCache; missingTextures: string[] }> {
  const total = textures.size + fonts.size;
  let loaded = 0;
  const images: Record<string, HTMLImageElement> = {};
  const loadedFonts = new Set<string>();
  const missingTextures: string[] = [];

  const report = () => onProgress?.({ loaded, total });

  // Load images with allSettled so failures don't block others
  const imageEntries = Array.from(textures);
  const imageResults = await Promise.allSettled(
    imageEntries.map(async (name) => {
      const url = `${baseUrl}/${skinName}/${name}.png`;
      try {
        const img = await loadImageWithRetry(url);
        images[name] = img;
      } catch {
        missingTextures.push(name);
      }
      loaded++;
      report();
    }),
  );

  // Load fonts
  const fontEntries = Array.from(fonts);
  await Promise.allSettled(
    fontEntries.map(async (name) => {
      const url = `${baseUrl}/${skinName}/${name}.ttf`;
      await loadFont(name, url);
      loadedFonts.add(name);
      loaded++;
      report();
    }),
  );

  return { cache: { images, fonts: loadedFonts }, missingTextures };
}

/**
 * Revoke any object URLs in the cache (for local file cleanup).
 */
export function disposeCache(cache: AssetCache): void {
  for (const img of Object.values(cache.images)) {
    if (img.src.startsWith("blob:")) {
      URL.revokeObjectURL(img.src);
    }
  }
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/lib/asset-loader.ts
git commit -m "feat: add asset loader with retry, progress, and font support"
```

---

## Phase 3: Renderers

### Task 5: Build render-tree and render-image

**Files:**
- Create: `src/renderer/render-tree.ts`
- Create: `src/renderer/render-image.ts`

**Step 1: Write render-image.ts**

```ts
// src/renderer/render-image.ts
import type { SkinElement, RenderState } from "../lib/types";

export function renderImage(
  ctx: CanvasRenderingContext2D,
  element: SkinElement,
  x: number,
  y: number,
  w: number,
  h: number,
  state: RenderState,
): void {
  if (!element.image) return;
  const img = state.images[element.image.texture];
  if (!img) return; // Missing images render as invisible
  ctx.drawImage(img, x, y, w, h);
}
```

**Step 2: Write render-tree.ts**

This is the core recursive traversal. It accumulates parent offsets in unscaled space, converts to scaled space for drawing, and filters by active page.

```ts
// src/renderer/render-tree.ts
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
  parentX: number,
  parentY: number,
  scale: number,
  state: RenderState,
  depth: number = 0,
): void {
  if (depth > MAX_DEPTH) return;

  for (const element of elements) {
    // Skip elements on inactive pages
    if (element._page && element._page !== state.activeTab) continue;

    renderElement(ctx, element, parentX, parentY, scale, state, depth);
  }
}

function renderElement(
  ctx: CanvasRenderingContext2D,
  element: SkinElement,
  parentX: number,
  parentY: number,
  scale: number,
  state: RenderState,
  depth: number,
): void {
  const pos = getElementPosition(element);
  if (!pos) return;

  const x = (parentX + pos.x) * scale;
  const y = (parentY + pos.y) * scale;
  const w = pos.width * scale;
  const h = pos.height * scale;

  // Dispatch to type-specific renderer
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
      // Unknown types: dashed outline in debug mode
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

  // Debug overlays
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
  x: number,
  y: number,
  w: number,
  h: number,
  state: RenderState,
): void {
  // Highlight hovered element
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
```

**Step 3: Verify it compiles** (will fail — the other renderers don't exist yet). Create stubs:

Create stub files for the renderers that don't exist yet. Each one is a no-op function with the correct signature — they'll be implemented in the next tasks.

```ts
// src/renderer/render-button.ts
import type { SkinElement, RenderState } from "../lib/types";
export function renderButton(ctx: CanvasRenderingContext2D, element: SkinElement, x: number, y: number, w: number, h: number, state: RenderState): void {}

// src/renderer/render-label.ts
import type { SkinElement, RenderState } from "../lib/types";
export function renderLabel(ctx: CanvasRenderingContext2D, element: SkinElement, x: number, y: number, w: number, h: number, state: RenderState, scale: number): void {}

// src/renderer/render-rotary.ts
import type { SkinElement, RenderState } from "../lib/types";
export function renderRotary(ctx: CanvasRenderingContext2D, element: SkinElement, x: number, y: number, w: number, h: number, state: RenderState): void {}

// src/renderer/render-combobox.ts
import type { SkinElement, RenderState } from "../lib/types";
export function renderCombobox(ctx: CanvasRenderingContext2D, element: SkinElement, x: number, y: number, w: number, h: number, state: RenderState, scale: number): void {}

// src/renderer/render-textbutton.ts
import type { SkinElement, RenderState } from "../lib/types";
export function renderTextbutton(ctx: CanvasRenderingContext2D, element: SkinElement, x: number, y: number, w: number, h: number, state: RenderState, scale: number): void {}

// src/renderer/render-container.ts
import type { SkinElement, RenderState } from "../lib/types";
export function renderContainer(ctx: CanvasRenderingContext2D, element: SkinElement, x: number, y: number, w: number, h: number, state: RenderState): void {}
```

**Step 4: Verify it all compiles**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/renderer/
git commit -m "feat: add render tree with recursive traversal and renderer stubs"
```

---

### Task 6: Implement render-button

**Files:**
- Modify: `src/renderer/render-button.ts`

**Step 1: Write the full button renderer**

```ts
// src/renderer/render-button.ts
import type { SkinElement, RenderState } from "../lib/types";

export function renderButton(
  ctx: CanvasRenderingContext2D,
  element: SkinElement,
  x: number,
  y: number,
  w: number,
  h: number,
  state: RenderState,
): void {
  if (!element.button) return;
  const btn = element.button;
  const img = state.images[btn.texture];

  if (!img) {
    // Missing spritesheet: dashed outline
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = "rgba(255, 200, 0, 0.5)";
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
    ctx.restore();
    return;
  }

  // Determine which sprite index to use
  const isHovered = state.hoveredElement === element.name;
  const isTabButton = state.activeTab !== "" && element.name.startsWith("Tab");
  const isActive = isTabButton
    ? state.activeTab === element.name.replace("Tab", "page_").toLowerCase()
    : false; // TODO: radio group state tracking for non-tab buttons

  let spriteIndex: number;
  if (isActive || (btn.isToggle && isActive)) {
    spriteIndex = isHovered ? btn.overImageOn : btn.normalImageOn;
  } else {
    spriteIndex = isHovered ? btn.overImage : btn.normalImage;
  }

  // Compute source rectangle from spritesheet
  const srcX = 0;
  const srcY = spriteIndex * btn.tileSizeY;
  const srcW = btn.tileSizeX;
  const srcH = btn.tileSizeY;

  // Guard against drawing outside image bounds
  if (srcY + srcH > img.naturalHeight) {
    // Fallback: draw the first tile
    ctx.drawImage(img, 0, 0, srcW, Math.min(srcH, img.naturalHeight), x, y, w, h);
    return;
  }

  ctx.drawImage(img, srcX, srcY, srcW, srcH, x, y, w, h);
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/renderer/render-button.ts
git commit -m "feat: implement button renderer with spritesheet state selection"
```

---

### Task 7: Implement render-label

**Files:**
- Modify: `src/renderer/render-label.ts`

**Step 1: Write the full label renderer**

```ts
// src/renderer/render-label.ts
import type { SkinElement, RenderState } from "../lib/types";

export function renderLabel(
  ctx: CanvasRenderingContext2D,
  element: SkinElement,
  x: number,
  y: number,
  w: number,
  h: number,
  state: RenderState,
  scale: number,
): void {
  if (!element.label) return;
  const label = element.label;

  // Background fill
  if (label.backgroundColor) {
    ctx.fillStyle = label.backgroundColor;
    ctx.fillRect(x, y, w, h);
  }

  // Font setup
  const fontSize = label.textHeight * scale;
  const fontWeight = label.bold ? "bold" : "normal";
  const fontFamily = label.fontFile || "sans-serif";
  ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}", sans-serif`;
  ctx.fillStyle = label.color || "rgba(255, 255, 255, 1)";

  // Horizontal alignment
  let textX = x;
  if (label.alignH === "R") {
    ctx.textAlign = "right";
    textX = x + w;
  } else if (label.alignH === "C") {
    ctx.textAlign = "center";
    textX = x + w / 2;
  } else {
    ctx.textAlign = "left";
  }

  // Vertical alignment
  let textY: number;
  if (label.alignV === "T") {
    ctx.textBaseline = "top";
    textY = y;
  } else if (label.alignV === "B") {
    ctx.textBaseline = "bottom";
    textY = y + h;
  } else {
    ctx.textBaseline = "middle";
    textY = y + h / 2;
  }

  ctx.fillText(label.text, textX, textY);
}
```

**Step 2: Commit**

```bash
git add src/renderer/render-label.ts
git commit -m "feat: implement label renderer with alignment and font support"
```

---

### Task 8: Implement render-rotary

**Files:**
- Modify: `src/renderer/render-rotary.ts`

**Step 1: Write the full rotary renderer**

```ts
// src/renderer/render-rotary.ts
import type { SkinElement, RenderState } from "../lib/types";

export function renderRotary(
  ctx: CanvasRenderingContext2D,
  element: SkinElement,
  x: number,
  y: number,
  w: number,
  h: number,
  state: RenderState,
): void {
  // Rotaries use the companion spritesheet for rendering
  if (!element.spritesheet) return;
  const sheet = element.spritesheet;
  const img = state.images[sheet.texture];

  if (!img) {
    // Missing spritesheet: dashed outline
    ctx.save();
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = "rgba(100, 150, 255, 0.5)";
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
    ctx.restore();
    return;
  }

  // Calculate total frames in the spritesheet
  const totalFrames = Math.max(1, Math.floor(img.naturalHeight / sheet.tileSizeY));

  // Get current frame — default to middle (noon position)
  const frame = state.scrubFrames[element.name] ?? Math.floor(totalFrames / 2);
  const clampedFrame = Math.max(0, Math.min(frame, totalFrames - 1));

  // Source rectangle
  const srcX = 0;
  const srcY = clampedFrame * sheet.tileSizeY;
  const srcW = sheet.tileSizeX;
  const srcH = sheet.tileSizeY;

  ctx.drawImage(img, srcX, srcY, srcW, srcH, x, y, w, h);
}
```

**Step 2: Commit**

```bash
git add src/renderer/render-rotary.ts
git commit -m "feat: implement rotary renderer with spritesheet frame selection"
```

---

### Task 9: Implement render-combobox, render-textbutton, render-container

**Files:**
- Modify: `src/renderer/render-combobox.ts`
- Modify: `src/renderer/render-textbutton.ts`
- Modify: `src/renderer/render-container.ts`

**Step 1: Write render-combobox.ts**

```ts
// src/renderer/render-combobox.ts
import type { SkinElement, RenderState } from "../lib/types";

export function renderCombobox(
  ctx: CanvasRenderingContext2D,
  element: SkinElement,
  x: number,
  y: number,
  w: number,
  h: number,
  state: RenderState,
  scale: number,
): void {
  if (!element.combobox) return;
  const cb = element.combobox;

  // Text
  const fontSize = cb.textHeight * scale;
  ctx.font = `${fontSize}px sans-serif`;
  ctx.fillStyle = cb.color || "rgba(255, 255, 255, 1)";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  const textY = y + h / 2;
  const padding = 4 * scale;
  ctx.fillText(cb.text, x + padding, textY);

  // Dropdown arrow indicator
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
```

**Step 2: Write render-textbutton.ts**

```ts
// src/renderer/render-textbutton.ts
import type { SkinElement, RenderState } from "../lib/types";

export function renderTextbutton(
  ctx: CanvasRenderingContext2D,
  element: SkinElement,
  x: number,
  y: number,
  w: number,
  h: number,
  state: RenderState,
  scale: number,
): void {
  if (!element.textbutton) return;
  const tb = element.textbutton;

  // Hover highlight
  if (state.hoveredElement === element.name) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  const fontSize = tb.textHeight * scale;
  ctx.font = `${fontSize}px sans-serif`;
  ctx.fillStyle = tb.color || "rgba(255, 255, 255, 1)";

  // Horizontal alignment
  let textX = x;
  if (tb.alignH === "R") {
    ctx.textAlign = "right";
    textX = x + w;
  } else if (tb.alignH === "C") {
    ctx.textAlign = "center";
    textX = x + w / 2;
  } else {
    ctx.textAlign = "left";
  }

  ctx.textBaseline = "middle";
  ctx.fillText(tb.text, textX, y + h / 2);
}
```

**Step 3: Write render-container.ts**

```ts
// src/renderer/render-container.ts
import type { SkinElement, RenderState } from "../lib/types";

export function renderContainer(
  ctx: CanvasRenderingContext2D,
  element: SkinElement,
  x: number,
  y: number,
  w: number,
  h: number,
  state: RenderState,
): void {
  // Containers are invisible by default — they only provide coordinate offset for children.
  // Children are rendered by render-tree.ts after this function returns.

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
```

**Step 4: Verify all compiles**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/renderer/render-combobox.ts src/renderer/render-textbutton.ts src/renderer/render-container.ts
git commit -m "feat: implement combobox, textbutton, and container renderers"
```

---

### Task 10: Build SkinViewport.svelte

**Files:**
- Create: `src/renderer/SkinViewport.svelte`

**Step 1: Write SkinViewport.svelte**

This is the canvas component with DPR handling and dirty-flag repaint.

```svelte
<!-- src/renderer/SkinViewport.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import type { SkinDefinition, RenderState } from "../lib/types";
  import { renderElementTree } from "./render-tree";
  import { findElementAtPoint } from "../lib/geometry";

  interface Props {
    skin: SkinDefinition;
    scale: number;
    renderState: RenderState;
    onelementHover?: (name: string | null) => void;
    onelementClick?: (element: import("../lib/types").SkinElement | null) => void;
  }

  let { skin, scale, renderState, onelementHover, onelementClick }: Props = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  let ctx: CanvasRenderingContext2D | null = $state(null);
  let dirty = $state(true);
  let rafId: number = 0;

  // Canvas CSS dimensions
  let cssWidth = $derived(skin.root.width * scale);
  let cssHeight = $derived(skin.root.height * scale);

  // Mark dirty when any render input changes
  $effect(() => {
    // Touch all reactive deps
    void skin;
    void scale;
    void renderState;
    dirty = true;
  });

  onMount(() => {
    function loop() {
      if (dirty && canvas && ctx) {
        paint();
        dirty = false;
      }
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  });

  $effect(() => {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
    dirty = true;
  });

  function paint() {
    if (!ctx) return;
    // Clear
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    // Render all elements
    renderElementTree(ctx, skin.children, 0, 0, scale, renderState);
  }

  function handlePointerMove(event: PointerEvent) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = (event.clientX - rect.left) / scale;
    const py = (event.clientY - rect.top) / scale;

    const hit = findElementAtPoint(px, py, skin.children, 0, 0, renderState.activeTab);
    onelementHover?.(hit?.name ?? null);
  }

  function handlePointerDown(event: PointerEvent) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = (event.clientX - rect.left) / scale;
    const py = (event.clientY - rect.top) / scale;

    const hit = findElementAtPoint(px, py, skin.children, 0, 0, renderState.activeTab);
    onelementClick?.(hit);
  }

  function handlePointerLeave() {
    onelementHover?.(null);
  }
</script>

<canvas
  bind:this={canvas}
  style="width: {cssWidth}px; height: {cssHeight}px;"
  onpointermove={handlePointerMove}
  onpointerdown={handlePointerDown}
  onpointerleave={handlePointerLeave}
></canvas>
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/renderer/SkinViewport.svelte
git commit -m "feat: add SkinViewport canvas component with DPR and interaction"
```

---

## Phase 4: Shell UI

### Task 11: Build Sidebar, Toolbar, ErrorBanner, Tooltip components

**Files:**
- Create: `src/ui/Sidebar.svelte`
- Create: `src/ui/Toolbar.svelte`
- Create: `src/ui/ErrorBanner.svelte`
- Create: `src/ui/Tooltip.svelte`

**Step 1: Write Sidebar.svelte**

```svelte
<!-- src/ui/Sidebar.svelte -->
<script lang="ts">
  interface SkinEntry {
    name: string;
    url: string;
  }

  interface Props {
    skins: SkinEntry[];
    activeSkin: string;
    onskinSelect: (skin: SkinEntry) => void;
  }

  let { skins, activeSkin, onskinSelect }: Props = $props();
</script>

<div class="flex w-64 flex-col bg-gray-800 p-4 text-white">
  <h2 class="mb-4 text-lg font-bold">Skins</h2>
  <div class="flex flex-col gap-1">
    {#each skins as skin}
      <button
        class="rounded px-3 py-2 text-left text-sm transition-colors {activeSkin === skin.name
          ? 'bg-blue-600'
          : 'hover:bg-gray-700'}"
        onclick={() => onskinSelect(skin)}
      >
        {skin.name}
      </button>
    {/each}
  </div>
</div>
```

**Step 2: Write Toolbar.svelte**

```svelte
<!-- src/ui/Toolbar.svelte -->
<script lang="ts">
  import type { TabGroup, AssetLoadProgress } from "../lib/types";

  interface Props {
    tabgroup: TabGroup | null;
    activeTab: string;
    scale: number;
    debugMode: boolean;
    missingCount: number;
    progress: AssetLoadProgress | null;
    ontabSelect: (page: string) => void;
    onscaleChange: (scale: number) => void;
    ondebugToggle: () => void;
  }

  let {
    tabgroup,
    activeTab,
    scale,
    debugMode,
    missingCount,
    progress,
    ontabSelect,
    onscaleChange,
    ondebugToggle,
  }: Props = $props();
</script>

<div class="flex items-center gap-3 bg-gray-700 px-3 py-1.5 text-sm text-white">
  <!-- Tab buttons -->
  {#if tabgroup}
    <div class="flex gap-1">
      {#each tabgroup.pages as page, i}
        <button
          class="rounded px-2 py-1 transition-colors {activeTab === page ? 'bg-blue-600' : 'hover:bg-gray-600'}"
          onclick={() => ontabSelect(page)}
        >
          {tabgroup.buttons[i] ?? page}
        </button>
      {/each}
    </div>
  {/if}

  <div class="flex-1"></div>

  <!-- Progress -->
  {#if progress && progress.loaded < progress.total}
    <span class="text-xs text-gray-400">
      Loading {progress.loaded}/{progress.total}
    </span>
  {/if}

  <!-- Missing textures indicator -->
  {#if missingCount > 0}
    <span class="text-xs text-yellow-400" title="Missing textures">
      {missingCount} missing
    </span>
  {/if}

  <!-- Scale slider -->
  <label class="flex items-center gap-1 text-xs text-gray-400">
    Scale
    <input
      type="range"
      min="0.25"
      max="2"
      step="0.05"
      value={scale}
      oninput={(e) => onscaleChange(parseFloat(e.currentTarget.value))}
      class="w-20"
    />
    <span class="w-8">{scale.toFixed(2)}</span>
  </label>

  <!-- Debug toggle -->
  <button
    class="rounded px-2 py-1 text-xs transition-colors {debugMode ? 'bg-yellow-600' : 'hover:bg-gray-600'}"
    onclick={ondebugToggle}
  >
    Debug
  </button>
</div>
```

Note: `AssetLoadProgress` is defined in `asset-loader.ts`, not `types.ts`. Add this type to `types.ts` or import from asset-loader. For simplicity, add to types.ts:

Add to `src/lib/types.ts`:
```ts
export interface AssetLoadProgress {
  loaded: number;
  total: number;
}
```

And remove the duplicate from `asset-loader.ts` (import from types instead).

**Step 3: Write ErrorBanner.svelte**

```svelte
<!-- src/ui/ErrorBanner.svelte -->
<script lang="ts">
  import type { ParseError } from "../lib/types";

  interface Props {
    errors: ParseError[];
    missingTextures: string[];
  }

  let { errors, missingTextures }: Props = $props();

  let expanded = $state(false);

  let hasIssues = $derived(errors.length > 0 || missingTextures.length > 0);
</script>

{#if hasIssues}
  <div class="bg-yellow-900/80 px-3 py-2 text-sm text-yellow-200">
    <button class="w-full text-left" onclick={() => (expanded = !expanded)}>
      {errors.length} parse error{errors.length !== 1 ? "s" : ""}, {missingTextures.length} missing texture{missingTextures.length !== 1 ? "s" : ""}
      <span class="text-xs">{expanded ? "▲" : "▼"}</span>
    </button>
    {#if expanded}
      <div class="mt-2 max-h-40 overflow-auto text-xs">
        {#each errors as err}
          <div><span class="text-yellow-400">{err.path}:</span> {err.message}</div>
        {/each}
        {#each missingTextures as tex}
          <div><span class="text-yellow-400">missing:</span> {tex}.png</div>
        {/each}
      </div>
    {/if}
  </div>
{/if}
```

**Step 4: Write Tooltip.svelte**

```svelte
<!-- src/ui/Tooltip.svelte -->
<script lang="ts">
  import type { SkinElement } from "../lib/types";

  interface Props {
    element: SkinElement | null;
    mouseX: number;
    mouseY: number;
  }

  let { element, mouseX, mouseY }: Props = $props();
</script>

{#if element}
  <div
    class="pointer-events-none fixed z-50 rounded bg-black/90 px-2 py-1 text-xs text-white shadow-lg"
    style="left: {mouseX + 12}px; top: {mouseY + 12}px;"
  >
    <div class="font-bold">{element.name}</div>
    <div class="text-gray-400">{element._type}</div>
    {#if element.parameterAttachment}
      <div class="text-blue-300">{element.parameterAttachment.parameter}</div>
    {/if}
  </div>
{/if}
```

**Step 5: Verify it all compiles**

```bash
npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add src/ui/
git commit -m "feat: add shell UI components (Sidebar, Toolbar, ErrorBanner, Tooltip)"
```

---

### Task 12: Wire up App.svelte

**Files:**
- Modify: `src/App.svelte`

**Step 1: Write the full App.svelte**

This is the top-level component that wires everything together: loads skins, manages state, passes props.

```svelte
<!-- src/App.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import JSON5 from "json5";
  import { parseSkin } from "./lib/parse";
  import { collectTextures, collectFonts, loadAssets, disposeCache } from "./lib/asset-loader";
  import type {
    SkinDefinition,
    SkinElement,
    RenderState,
    ParseError,
    AssetLoadProgress,
  } from "./lib/types";
  import type { AssetCache } from "./lib/asset-loader";
  import SkinViewport from "./renderer/SkinViewport.svelte";
  import Sidebar from "./ui/Sidebar.svelte";
  import Toolbar from "./ui/Toolbar.svelte";
  import ErrorBanner from "./ui/ErrorBanner.svelte";
  import Tooltip from "./ui/Tooltip.svelte";

  const baseUrl =
    "https://raw.githubusercontent.com/dsp56300/gearmulator/main/source/osirusJucePlugin/skins";

  const availableSkins = [
    { name: "Galaxpel", url: `${baseUrl}/Galaxpel/VirusC_Galaxpel.json` },
    { name: "Trancy", url: `${baseUrl}/Trancy/VirusC_Trancy.json` },
    { name: "Hoverland", url: `${baseUrl}/Hoverland/VirusC_Hoverland.json` },
  ];

  let skin: SkinDefinition | null = $state(null);
  let activeSkinName = $state("");
  let scale = $state(0.5);
  let activeTab = $state("");
  let debugMode = $state(false);
  let hoveredElement: SkinElement | null = $state(null);
  let mouseX = $state(0);
  let mouseY = $state(0);

  let parseErrors: ParseError[] = $state([]);
  let missingTextures: string[] = $state([]);
  let loadProgress: AssetLoadProgress | null = $state(null);
  let imageCache: Record<string, HTMLImageElement> = $state({});
  let currentCache: AssetCache | null = $state(null);
  let scrubFrames: Record<string, number> = $state({});

  let renderState: RenderState = $derived({
    activeTab,
    hoveredElement: hoveredElement?.name ?? null,
    scrubFrames,
    debugMode,
    images: imageCache,
  });

  onMount(() => {
    loadSkin(availableSkins[2]); // Default to Hoverland

    function trackMouse(e: MouseEvent) {
      mouseX = e.clientX;
      mouseY = e.clientY;
    }
    window.addEventListener("mousemove", trackMouse);
    return () => window.removeEventListener("mousemove", trackMouse);
  });

  async function loadSkin(entry: { name: string; url: string }) {
    // Dispose old cache
    if (currentCache) {
      disposeCache(currentCache);
      currentCache = null;
    }

    activeSkinName = entry.name;
    imageCache = {};
    missingTextures = [];
    parseErrors = [];
    scrubFrames = {};
    loadProgress = { loaded: 0, total: 0 };

    try {
      const response = await fetch(entry.url);
      if (!response.ok) {
        parseErrors = [{ path: "fetch", message: `HTTP ${response.status}: ${response.statusText}` }];
        return;
      }
      const text = await response.text();
      const result = parseSkin(text);
      skin = result.skin;
      parseErrors = result.errors;
      scale = skin.root.scale || 0.5;
      activeTab = skin.tabgroup?.pages[0] ?? "";

      // Load assets
      const textures = collectTextures(skin.children);
      const fonts = collectFonts(skin.children);

      const { cache, missingTextures: missing } = await loadAssets(
        textures,
        fonts,
        baseUrl,
        entry.name,
        (p) => { loadProgress = p; },
      );

      currentCache = cache;
      imageCache = cache.images;
      missingTextures = missing;
      loadProgress = null;
    } catch (e) {
      parseErrors = [{ path: "load", message: `${e}` }];
    }
  }

  function handleTabSelect(page: string) {
    activeTab = page;
  }

  function handleElementClick(element: SkinElement | null) {
    if (!element || !skin?.tabgroup) return;
    // Check if it's a tab button
    const tabIndex = skin.tabgroup.buttons.indexOf(element.name);
    if (tabIndex >= 0) {
      activeTab = skin.tabgroup.pages[tabIndex];
    }
  }

  function handleElementHover(name: string | null) {
    if (name && skin) {
      hoveredElement = findByName(skin.children, name);
    } else {
      hoveredElement = null;
    }
  }

  function findByName(elements: SkinElement[], name: string): SkinElement | null {
    for (const el of elements) {
      if (el.name === name) return el;
      if (el.children) {
        const found = findByName(el.children, name);
        if (found) return found;
      }
    }
    return null;
  }
</script>

<main class="flex h-screen w-screen bg-gray-900">
  <Sidebar
    skins={availableSkins}
    activeSkin={activeSkinName}
    onskinSelect={loadSkin}
  />

  <div class="flex flex-1 flex-col overflow-hidden">
    {#if skin}
      <Toolbar
        tabgroup={skin.tabgroup}
        {activeTab}
        {scale}
        {debugMode}
        missingCount={missingTextures.length}
        progress={loadProgress}
        ontabSelect={handleTabSelect}
        onscaleChange={(s) => { scale = s; }}
        ondebugToggle={() => { debugMode = !debugMode; }}
      />

      <ErrorBanner errors={parseErrors} {missingTextures} />

      <div class="flex-1 overflow-auto p-4">
        <SkinViewport
          {skin}
          {scale}
          {renderState}
          onelementHover={handleElementHover}
          onelementClick={handleElementClick}
        />
      </div>
    {:else if parseErrors.length > 0}
      <ErrorBanner errors={parseErrors} {missingTextures} />
    {:else}
      <div class="flex flex-1 items-center justify-center text-gray-500">
        Loading skin...
      </div>
    {/if}
  </div>

  <Tooltip element={hoveredElement} {mouseX} {mouseY} />
</main>
```

**Step 2: Verify it compiles and dev server starts**

```bash
npx tsc --noEmit
npm run dev
```

Expected: App loads in browser, shows sidebar with 3 skins, loads Hoverland by default, renders the skin on canvas with all element types.

**Step 3: Commit**

```bash
git add src/App.svelte
git commit -m "feat: wire up App.svelte with full skin loading pipeline"
```

---

## Phase 5: Interactions

### Task 13: Add rotary scrubbing

**Files:**
- Modify: `src/renderer/SkinViewport.svelte`

**Step 1: Add pointer capture drag handling to SkinViewport**

Add rotary scrub interaction. On pointerdown over a rotary, capture the pointer and track vertical drag to adjust the frame.

Add these to the `<script>` section of `SkinViewport.svelte`:

```ts
let dragElement: string | null = $state(null);
let dragStartY: number = 0;
let dragStartFrame: number = 0;

interface Props {
  // ... existing props ...
  onscrubFrame?: (name: string, frame: number) => void;
}

let { skin, scale, renderState, onelementHover, onelementClick, onscrubFrame }: Props = $props();
```

Replace `handlePointerDown`:

```ts
function handlePointerDown(event: PointerEvent) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const px = (event.clientX - rect.left) / scale;
  const py = (event.clientY - rect.top) / scale;

  const hit = findElementAtPoint(px, py, skin.children, 0, 0, renderState.activeTab);
  onelementClick?.(hit);

  // Start rotary drag
  if (hit && hit._type === "rotary" && hit.spritesheet) {
    dragElement = hit.name;
    dragStartY = event.clientY;
    dragStartFrame = renderState.scrubFrames[hit.name] ?? 0;
    canvas.setPointerCapture(event.pointerId);
  }
}
```

Add `handlePointerUp`:

```ts
function handlePointerUp(event: PointerEvent) {
  if (dragElement && canvas) {
    canvas.releasePointerCapture(event.pointerId);
    dragElement = null;
  }
}
```

Modify `handlePointerMove` to handle drag:

```ts
function handlePointerMove(event: PointerEvent) {
  if (!canvas) return;

  // Handle rotary drag
  if (dragElement) {
    const deltaY = dragStartY - event.clientY;
    const sensitivity = 0.5; // pixels per frame
    const frameDelta = Math.round(deltaY * sensitivity);
    onscrubFrame?.(dragElement, dragStartFrame + frameDelta);
    dirty = true;
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const px = (event.clientX - rect.left) / scale;
  const py = (event.clientY - rect.top) / scale;

  const hit = findElementAtPoint(px, py, skin.children, 0, 0, renderState.activeTab);
  onelementHover?.(hit?.name ?? null);
}
```

Add `onpointerup` to the canvas element:

```svelte
<canvas
  bind:this={canvas}
  style="width: {cssWidth}px; height: {cssHeight}px;"
  onpointermove={handlePointerMove}
  onpointerdown={handlePointerDown}
  onpointerup={handlePointerUp}
  onpointerleave={handlePointerLeave}
></canvas>
```

**Step 2: Wire up scrub handler in App.svelte**

Add to `SkinViewport` usage in `App.svelte`:

```svelte
<SkinViewport
  {skin}
  {scale}
  {renderState}
  onelementHover={handleElementHover}
  onelementClick={handleElementClick}
  onscrubFrame={(name, frame) => { scrubFrames = { ...scrubFrames, [name]: frame }; }}
/>
```

**Step 3: Verify rotary scrubbing works**

```bash
npm run dev
```

Load a skin, find a rotary knob, click and drag vertically. The knob should scrub through spritesheet frames.

**Step 4: Commit**

```bash
git add src/renderer/SkinViewport.svelte src/App.svelte
git commit -m "feat: add rotary scrubbing interaction with pointer capture"
```

---

### Task 14: Add Ctrl+wheel zoom

**Files:**
- Modify: `src/renderer/SkinViewport.svelte`

**Step 1: Add wheel handler to SkinViewport**

Add to the `<script>` section:

```ts
function handleWheel(event: WheelEvent) {
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  const delta = event.deltaY > 0 ? -0.05 : 0.05;
  const newScale = Math.max(0.25, Math.min(2, scale + delta));
  // Emit scale change to parent
  onscaleChange?.(newScale);
}
```

Add to Props interface:

```ts
onscaleChange?: (scale: number) => void;
```

Add to canvas element:

```svelte
<canvas
  ...
  onwheel={handleWheel}
></canvas>
```

**Step 2: Wire in App.svelte**

```svelte
<SkinViewport
  ...
  onscaleChange={(s) => { scale = s; }}
/>
```

**Step 3: Commit**

```bash
git add src/renderer/SkinViewport.svelte src/App.svelte
git commit -m "feat: add Ctrl+wheel zoom on canvas"
```

---

### Task 15: Final verification and cleanup

**Step 1: Run type check**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 2: Run dev server and test all features**

```bash
npm run dev
```

Manual verification checklist:
- [ ] App loads, sidebar shows 3 skins
- [ ] Clicking a skin loads it and renders on canvas
- [ ] Tab buttons in toolbar switch pages
- [ ] Clicking tab buttons on canvas switches pages
- [ ] Rotary knobs show spritesheet frames (not blue rectangles)
- [ ] Rotary click+drag scrubs through frames
- [ ] Labels render with correct fonts, colors, alignment
- [ ] Buttons show correct active/inactive sprites
- [ ] Comboboxes show text with dropdown arrow
- [ ] Textbuttons render text
- [ ] Nested children inside page containers render correctly
- [ ] Hover shows tooltip with element name and type
- [ ] Scale slider adjusts canvas size
- [ ] Ctrl+wheel zooms
- [ ] Debug mode shows container bounds and element highlights
- [ ] Missing texture count shows in toolbar
- [ ] ErrorBanner expands to show details

**Step 3: Run build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: Osirus Skin Editor v2 complete"
```

---

## Summary of all files created

```
src/
  main.ts                          -- App bootstrap
  app.css                          -- Tailwind imports
  App.svelte                       -- Root component, skin loading, state management

  lib/
    types.ts                       -- Full TypeScript schema (~120 lines)
    parse.ts                       -- JSON5 parser + normalizer (~250 lines)
    asset-loader.ts                -- Image/font loader with retry (~130 lines)
    geometry.ts                    -- Hit testing + coordinate helpers (~70 lines)

  renderer/
    SkinViewport.svelte            -- Canvas with DPR, RAF, interactions (~120 lines)
    render-tree.ts                 -- Recursive traversal + dispatch (~100 lines)
    render-image.ts                -- Image drawing (~15 lines)
    render-button.ts               -- Button spritesheet rendering (~60 lines)
    render-label.ts                -- Text with alignment/font (~50 lines)
    render-rotary.ts               -- Rotary spritesheet frames (~40 lines)
    render-combobox.ts             -- Combobox with dropdown arrow (~30 lines)
    render-textbutton.ts           -- Text button rendering (~35 lines)
    render-container.ts            -- Debug-only container bounds (~20 lines)

  ui/
    Sidebar.svelte                 -- Skin list (~25 lines)
    Toolbar.svelte                 -- Tabs, scale, debug (~60 lines)
    ErrorBanner.svelte             -- Parse errors + missing textures (~30 lines)
    Tooltip.svelte                 -- Hover element info (~20 lines)
```

Estimated total: ~1,200 lines of TypeScript + Svelte.

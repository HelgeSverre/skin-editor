import type { SkinElement, AssetLoadProgress } from "./types";

export interface AssetCache {
  images: Record<string, HTMLImageElement>;
  fonts: Set<string>;
}

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

/** Split textures into global (always visible) and per-page sets. */
export function collectTexturesByPage(
  elements: SkinElement[],
): { global: Set<string>; byPage: Record<string, Set<string>> } {
  const global = new Set<string>();
  const byPage: Record<string, Set<string>> = {};

  function addTexture(el: SkinElement, page: string | null) {
    const tex =
      el.image?.texture ?? el.button?.texture ?? el.spritesheet?.texture;
    if (!tex) return;
    if (page) {
      (byPage[page] ??= new Set()).add(tex);
    } else {
      global.add(tex);
    }
  }

  function walk(el: SkinElement, ownerPage: string | null): void {
    // If this element is a page root, its subtree belongs to that page
    const page = el._page ?? ownerPage;
    addTexture(el, page);
    el.children?.forEach((child) => walk(child, page));
  }

  elements.forEach((el) => walk(el, null));
  return { global, byPage };
}

export function collectFonts(elements: SkinElement[]): Set<string> {
  const fonts = new Set<string>();
  function walk(el: SkinElement): void {
    if (el.label?.fontFile) fonts.add(el.label.fontFile);
    if (el.combobox?.fontFile) fonts.add(el.combobox.fontFile);
    el.children?.forEach(walk);
  }
  elements.forEach(walk);
  return fonts;
}

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
      if (attempt < retries)
        await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
  throw lastError;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.crossOrigin = "anonymous";
    img.src = url;
  });
}

async function loadFont(name: string, url: string): Promise<void> {
  try {
    const face = new FontFace(name, `url(${url})`);
    const loaded = await face.load();
    document.fonts.add(loaded);
  } catch {
    console.warn(`Font failed to load: ${name} from ${url}`);
  }
}

/** Load a batch of textures, calling onImage as each one resolves. */
export async function loadImageBatch(
  names: Set<string>,
  baseUrl: string,
  skinName: string,
  onImage?: (name: string, img: HTMLImageElement) => void,
  onProgress?: (loaded: number, total: number) => void,
): Promise<{ images: Record<string, HTMLImageElement>; missing: string[] }> {
  const images: Record<string, HTMLImageElement> = {};
  const missing: string[] = [];
  let loaded = 0;
  const total = names.size;

  await Promise.allSettled(
    Array.from(names).map(async (name) => {
      const url = `${baseUrl}/${skinName}/${name}.png`;
      try {
        const img = await loadImageWithRetry(url);
        images[name] = img;
        onImage?.(name, img);
      } catch {
        missing.push(name);
      }
      loaded++;
      onProgress?.(loaded, total);
    }),
  );

  return { images, missing };
}

export async function loadFontBatch(
  fonts: Set<string>,
  baseUrl: string,
  skinName: string,
): Promise<Set<string>> {
  const loadedFonts = new Set<string>();
  await Promise.allSettled(
    Array.from(fonts).map(async (name) => {
      const url = `${baseUrl}/${skinName}/${name}.ttf`;
      await loadFont(name, url);
      loadedFonts.add(name);
    }),
  );
  return loadedFonts;
}

export async function loadAssets(
  textures: Set<string>,
  fonts: Set<string>,
  baseUrl: string,
  skinName: string,
  onProgress?: (progress: AssetLoadProgress) => void,
): Promise<{ cache: AssetCache; missingTextures: string[] }> {
  const total = textures.size + fonts.size;
  let loaded = 0;
  const report = () => onProgress?.({ loaded, total });

  const { images, missing } = await loadImageBatch(
    textures,
    baseUrl,
    skinName,
    undefined,
    (l) => {
      loaded = l;
      report();
    },
  );

  const loadedFonts = await loadFontBatch(fonts, baseUrl, skinName);
  loaded = total;
  report();

  return { cache: { images, fonts: loadedFonts }, missingTextures: missing };
}

export function disposeCache(cache: AssetCache): void {
  for (const img of Object.values(cache.images)) {
    if (img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
  }
}

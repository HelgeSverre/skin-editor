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

export function collectFonts(elements: SkinElement[]): Set<string> {
  const fonts = new Set<string>();
  function walk(el: SkinElement): void {
    if (el.label?.fontFile) fonts.add(el.label.fontFile);
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

  const imageEntries = Array.from(textures);
  await Promise.allSettled(
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

export function disposeCache(cache: AssetCache): void {
  for (const img of Object.values(cache.images)) {
    if (img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
  }
}

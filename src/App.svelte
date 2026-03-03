<script lang="ts">
  import { onMount } from "svelte";
  import { parseSkin } from "./lib/parse";
  import {
    collectTexturesByPage,
    collectFonts,
    loadImageBatch,
    loadFontBatch,
    disposeCache,
  } from "./lib/asset-loader";
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

  interface SkinEntry {
    name: string;
    url: string;
    baseUrl: string;
    folder: string;
    emulator: string;
  }

  function local(emulator: string, dir: string, folder: string, json: string): SkinEntry {
    const baseUrl = `/skins-repo/${dir}`;
    return { name: folder, url: `${baseUrl}/${folder}/${json}`, baseUrl, folder, emulator };
  }

  function community(emulator: string, folder: string, json: string): SkinEntry {
    const baseUrl = `/skins`;
    return { name: folder, url: `${baseUrl}/${folder}/${json}`, baseUrl, folder, emulator };
  }

  const availableSkins: SkinEntry[] = [
    // Osirus — Access Virus A/B/C
    local("Osirus", "osirus", "Galaxpel", "VirusC_Galaxpel.json"),
    local("Osirus", "osirus", "Trancy", "VirusC_Trancy.json"),
    local("Osirus", "osirus", "Hoverland", "VirusC_Hoverland.json"),
    community("Osirus", "OSIRUS-C", "osirus-C.json"),
    community("Osirus", "Polar_V1", "osirus-polar.json"),
    community("Osirus", "OspirusXD", "OspirusXD.json"),
    community("Osirus", "Vanguard", "Vanguard.json"),
    community("Osirus", "XFutureNeon", "XFutureNeon.json"),
    community("Osirus", "IceyBlues", "VirusC_IceyBlues.json"),
    community("Osirus", "ShadyBlues", "VirusC_ShadyBlues.json"),
    community("Osirus", "SummerBlues", "VirusC_SummerBlues.json"),
    community("Osirus", "GalaxpelMM", "VirusC_GalaxpelMM.json"),
    // OsTIrus — Access Virus TI/TI2/Snow
    local("OsTIrus", "ostirus", "TrancyTI", "VirusTI_Trancy.json"),
    // Vavra — Waldorf microQ
    local("Vavra", "vavra", "mqDefault", "mqDefault.json"),
    local("Vavra", "vavra", "mqFrontPanel", "mqFrontPanel.json"),
    community("Vavra", "FundorinGrey", "mqDefault.json"),
    community("Vavra", "FundorinPanel", "mqFrontPanel.json"),
    community("Vavra", "FundorinTeal", "mqDefault.json"),
    community("Vavra", "mQ_Fried", "mQ_Fried_Full.json"),
    community("Vavra", "mqYellowEdit", "mqYellowEdit.json"),
    community("Vavra", "Red", "Red.json"),
    community("Vavra", "VavraDeepPurple", "Vavra E+D Deep Purple.json"),
    community("Vavra", "Vavra98", "Vavra98.json"),
    community("Vavra", "VavraWhiteout", "VavraWhiteoutV3.0.json"),
    // Xenia — Waldorf Microwave II/XT
    local("Xenia", "xenia", "xtDefault", "xtDefault.json"),
    // JE-8086 — Roland JU-06/JP-08
    local("JE-8086", "je8086", "jeTrancy", "jeTrancy.json"),
    // Nodal Red 2x — Clavia Nord Lead/Rack 2x
    local("Nodal Red 2x", "nodal-red-2x", "n2xTrancy", "n2xTrancy.json"),
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
    loadSkin(availableSkins[2]);
    function trackMouse(e: MouseEvent) {
      mouseX = e.clientX;
      mouseY = e.clientY;
    }
    window.addEventListener("mousemove", trackMouse);
    return () => window.removeEventListener("mousemove", trackMouse);
  });

  let loadGeneration = 0;

  async function loadSkin(entry: SkinEntry) {
    const gen = ++loadGeneration;
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
        parseErrors = [
          {
            path: "fetch",
            message: `HTTP ${response.status}: ${response.statusText}`,
          },
        ];
        return;
      }
      if (gen !== loadGeneration) return;

      const text = await response.text();
      const result = parseSkin(text);
      skin = result.skin;
      parseErrors = result.errors;
      scale = skin.root.scale || 0.5;
      activeTab = skin.tabgroup?.pages[0] ?? "";

      const { global, byPage } = collectTexturesByPage(skin.children);
      const fonts = collectFonts(skin.children);

      // Phase 1: load global textures + active tab textures + fonts in parallel
      const activePageTextures = byPage[activeTab] ?? new Set();
      const priorityTextures = new Set([...global, ...activePageTextures]);
      const allTextures = new Set([
        ...priorityTextures,
        ...Object.values(byPage).flatMap((s) => [...s]),
      ]);
      const totalAssets = allTextures.size + fonts.size;
      let loadedCount = 0;

      const allImages: Record<string, HTMLImageElement> = {};
      const allMissing: string[] = [];

      const streamer = (name: string, img: HTMLImageElement) => {
        if (gen !== loadGeneration) return;
        allImages[name] = img;
        imageCache = { ...imageCache, [name]: img };
      };

      const [priorityResult] = await Promise.all([
        loadImageBatch(
          priorityTextures,
          entry.baseUrl,
          entry.folder,
          streamer,
          (l) => {
            loadedCount = l;
            loadProgress = { loaded: loadedCount, total: totalAssets };
          },
        ),
        loadFontBatch(fonts, entry.baseUrl, entry.folder),
      ]);
      if (gen !== loadGeneration) return;

      Object.assign(allImages, priorityResult.images);
      allMissing.push(...priorityResult.missing);

      // Phase 2: load remaining tab textures in background
      const remainingTextures = new Set<string>();
      for (const tex of allTextures) {
        if (!priorityTextures.has(tex)) remainingTextures.add(tex);
      }

      if (remainingTextures.size > 0) {
        const bgResult = await loadImageBatch(
          remainingTextures,
          entry.baseUrl,
          entry.folder,
          streamer,
          (l) => {
            loadedCount = priorityTextures.size + l;
            loadProgress = { loaded: loadedCount, total: totalAssets };
          },
        );
        if (gen !== loadGeneration) return;

        Object.assign(allImages, bgResult.images);
        allMissing.push(...bgResult.missing);
      }

      currentCache = { images: allImages, fonts: new Set() };
      imageCache = { ...allImages };
      missingTextures = allMissing;
      loadProgress = null;
    } catch (e) {
      if (gen === loadGeneration) {
        parseErrors = [{ path: "load", message: `${e}` }];
      }
    }
  }

  function handleTabSelect(page: string) {
    activeTab = page;
  }

  function handleElementClick(element: SkinElement | null) {
    if (!element || !skin?.tabgroup) return;
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

  function findByName(
    elements: SkinElement[],
    name: string,
  ): SkinElement | null {
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
        onscaleChange={(s) => {
          scale = s;
        }}
        ondebugToggle={() => {
          debugMode = !debugMode;
        }}
      />
      <ErrorBanner errors={parseErrors} {missingTextures} />
      <div class="flex-1 overflow-auto p-4">
        <SkinViewport
          {skin}
          {scale}
          {renderState}
          onelementHover={handleElementHover}
          onelementClick={handleElementClick}
          onscrubFrame={(name, frame) => {
            scrubFrames = { ...scrubFrames, [name]: frame };
          }}
          onscaleChange={(s) => {
            scale = s;
          }}
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

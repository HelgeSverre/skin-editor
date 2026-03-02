<script lang="ts">
  import { onMount } from "svelte";
  import { parseSkin } from "./lib/parse";
  import {
    collectTextures,
    collectFonts,
    loadAssets,
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

  const ghBase = "https://raw.githubusercontent.com/dsp56300/gearmulator/main/source";

  interface SkinEntry {
    name: string;
    url: string;
    baseUrl: string;
    folder: string;
    emulator: string;
  }

  function entry(emulator: string, plugin: string, folder: string, json: string): SkinEntry {
    const baseUrl = `${ghBase}/${plugin}/skins`;
    return { name: folder, url: `${baseUrl}/${folder}/${json}`, baseUrl, folder, emulator };
  }

  const availableSkins: SkinEntry[] = [
    // Osirus — Access Virus A/B/C
    entry("Osirus", "osirusJucePlugin", "Galaxpel", "VirusC_Galaxpel.json"),
    entry("Osirus", "osirusJucePlugin", "Trancy", "VirusC_Trancy.json"),
    entry("Osirus", "osirusJucePlugin", "Hoverland", "VirusC_Hoverland.json"),
    // OsTIrus — Access Virus TI/TI2/Snow
    entry("OsTIrus", "osTIrusJucePlugin", "TrancyTI", "VirusTI_Trancy.json"),
    // Vavra — Waldorf microQ
    entry("Vavra", "mqJucePlugin", "mqDefault", "mqDefault.json"),
    entry("Vavra", "mqJucePlugin", "mqFrontPanel", "mqFrontPanel.json"),
    // Xenia — Waldorf Microwave II/XT
    entry("Xenia", "xtJucePlugin", "xtDefault", "xtDefault.json"),
    // Nodal Red 2x — Clavia Nord Lead/Rack 2x
    entry("Nodal Red 2x", "nord/n2x/n2xJucePlugin", "n2xTrancy", "n2xTrancy.json"),
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

  async function loadSkin(entry: SkinEntry) {
    if (currentCache) {
      disposeCache(currentCache);
      currentCache = null;
    }
    activeSkinName = entry.name;
    activeSkinEntry = entry;
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
      const text = await response.text();
      const result = parseSkin(text);
      skin = result.skin;
      parseErrors = result.errors;
      scale = skin.root.scale || 0.5;
      activeTab = skin.tabgroup?.pages[0] ?? "";

      const textures = collectTextures(skin.children);
      const fonts = collectFonts(skin.children);

      const { cache, missingTextures: missing } = await loadAssets(
        textures,
        fonts,
        entry.baseUrl,
        entry.folder,
        (p) => {
          loadProgress = p;
        },
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

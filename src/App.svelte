<script>
  import { onMount } from "svelte";
  import JSON5 from "json5";
  import CanvasRenderer from "./CanvasRenderer.svelte";

  const baseUrl = "https://raw.githubusercontent.com/dsp56300/gearmulator/main/source/osirusJucePlugin/skins";

  let availableSkins = [
    { name: "Galaxpel", url: `${baseUrl}/Galaxpel/VirusC_Galaxpel.json` },
    { name: "Trancy", url: `${baseUrl}/Trancy/VirusC_Trancy.json` },
    { name: "Hoverland", url: `${baseUrl}/Hoverland/VirusC_Hoverland.json` },
  ];

  let selectedSkin = null;
  let skin = null;
  let scale = 1;
  let activeTab = "";

  onMount(async () => {
    await loadSkin(availableSkins[2]);
  });

  async function loadSkin(s) {
    selectedSkin = s;
    try {
      const response = await fetch(s.url);
      const text = await response.text();
      skin = JSON5.parse(text);
      scale = skin.root.scale || 1;
      activeTab = skin.tabgroup?.pages[0] || "";
      console.log("Skin loaded successfully:", selectedSkin.name);
    } catch (error) {
      console.error("Error loading skin:", error);
    }
  }

  function handleTabClick(tabName) {
    activeTab = tabName.replace("Tab", "page_").toLowerCase();
  }
</script>

<main class="flex h-screen w-screen">
  <div class="w-64 bg-gray-800 p-4 text-white">
    <h2 class="mb-4 text-xl font-bold">Available Skins</h2>
    <div class="flex flex-col gap-1">
      {#each availableSkins as s}
        <button class="w-full p-2 text-left hover:bg-gray-700" on:click={() => loadSkin(s)}>
          {s.name}
        </button>
      {/each}
    </div>
  </div>

  <div class="flex flex-1 flex-col">
    {#if skin}
      <div class=" bg-gray-700 p-1 text-white">
        <div class="flex flex-wrap gap-3">
          {#each skin?.tabgroup?.pages as page}
            <button class=" p-1 text-left hover:bg-gray-700" on:click={() => (activeTab = page)}>
              {page}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="flex-1 overflow-auto p-4">
      {#if skin}
        <CanvasRenderer
          skin={skin}
          scale={scale}
          baseUrl={baseUrl}
          skinName={selectedSkin.name}
          activeTab={activeTab}
          on:tabClick={handleTabClick}
        />
      {/if}
    </div>
  </div>
</main>

<style>
  @font-face {
    font-family: "Digital";
    src: url("https://raw.githubusercontent.com/dsp56300/gearmulator/main/source/osirusJucePlugin/skins/Trancy/Digital.ttf")
      format("truetype");
  }
</style>

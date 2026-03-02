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

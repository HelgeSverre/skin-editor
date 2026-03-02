<script lang="ts">
  interface SkinEntry {
    name: string;
    url: string;
    baseUrl: string;
    folder: string;
    emulator: string;
  }

  interface Props {
    skins: SkinEntry[];
    activeSkin: string;
    onskinSelect: (skin: SkinEntry) => void;
  }

  let { skins, activeSkin, onskinSelect }: Props = $props();

  // Group skins by emulator
  let groups = $derived(
    skins.reduce<Record<string, SkinEntry[]>>((acc, skin) => {
      (acc[skin.emulator] ??= []).push(skin);
      return acc;
    }, {}),
  );
</script>

<div class="flex w-64 flex-col overflow-auto bg-gray-800 p-4 text-white">
  <h2 class="mb-4 text-lg font-bold">Skins</h2>
  {#each Object.entries(groups) as [emulator, entries]}
    <div class="mb-3">
      <h3 class="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
        {emulator}
      </h3>
      <div class="flex flex-col gap-0.5">
        {#each entries as skin}
          <button
            class="rounded px-3 py-1.5 text-left text-sm transition-colors {activeSkin === skin.name
              ? 'bg-blue-600'
              : 'hover:bg-gray-700'}"
            onclick={() => onskinSelect(skin)}
          >
            {skin.name}
          </button>
        {/each}
      </div>
    </div>
  {/each}
</div>

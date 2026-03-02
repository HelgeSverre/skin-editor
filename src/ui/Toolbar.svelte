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
  {#if tabgroup}
    <div class="flex gap-1">
      {#each tabgroup.pages as page, i}
        <button
          class="rounded px-2 py-1 transition-colors {activeTab === page
            ? 'bg-blue-600'
            : 'hover:bg-gray-600'}"
          onclick={() => ontabSelect(page)}
        >
          {tabgroup.buttons[i] ?? page}
        </button>
      {/each}
    </div>
  {/if}
  <div class="flex-1"></div>
  {#if progress && progress.loaded < progress.total}
    <span class="text-xs text-gray-400"
      >Loading {progress.loaded}/{progress.total}</span
    >
  {/if}
  {#if missingCount > 0}
    <span class="text-xs text-yellow-400">{missingCount} missing</span>
  {/if}
  <label class="flex items-center gap-1 text-xs text-gray-400">
    Scale
    <input
      type="range"
      min="0.25"
      max="2"
      step="0.05"
      value={scale}
      oninput={(e) =>
        onscaleChange(
          parseFloat((e.currentTarget as HTMLInputElement).value),
        )}
      class="w-20"
    />
    <span class="w-8">{scale.toFixed(2)}</span>
  </label>
  <button
    class="rounded px-2 py-1 text-xs transition-colors {debugMode
      ? 'bg-yellow-600'
      : 'hover:bg-gray-600'}"
    onclick={ondebugToggle}
  >
    Debug
  </button>
</div>

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

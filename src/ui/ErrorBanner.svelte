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
      {errors.length} parse error{errors.length !== 1 ? "s" : ""}, {missingTextures.length}
      missing texture{missingTextures.length !== 1 ? "s" : ""}
      <span class="text-xs">{expanded ? "\u25B2" : "\u25BC"}</span>
    </button>
    {#if expanded}
      <div class="mt-2 max-h-40 overflow-auto text-xs">
        {#each errors as err}
          <div>
            <span class="text-yellow-400">{err.path}:</span>
            {err.message}
          </div>
        {/each}
        {#each missingTextures as tex}
          <div>
            <span class="text-yellow-400">missing:</span>
            {tex}.png
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

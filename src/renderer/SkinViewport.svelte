<script lang="ts">
  import { onMount } from "svelte";
  import type { SkinDefinition, RenderState, SkinElement } from "../lib/types";
  import { renderElementTree } from "./render-tree";
  import { findElementAtPoint } from "../lib/geometry";

  interface Props {
    skin: SkinDefinition;
    scale: number;
    renderState: RenderState;
    onelementHover?: (name: string | null) => void;
    onelementClick?: (element: SkinElement | null) => void;
    onscrubFrame?: (name: string, frame: number) => void;
    onscaleChange?: (scale: number) => void;
  }

  let { skin, scale, renderState, onelementHover, onelementClick, onscrubFrame, onscaleChange }: Props = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  let ctx: CanvasRenderingContext2D | null = $state(null);
  let dirty = $state(true);
  let rafId: number = 0;

  let dragElement: string | null = $state(null);
  let dragStartY: number = 0;
  let dragStartFrame: number = 0;

  let cssWidth = $derived(skin.root.width * scale);
  let cssHeight = $derived(skin.root.height * scale);

  $effect(() => {
    void skin;
    void scale;
    void renderState;
    dirty = true;
  });

  onMount(() => {
    function loop() {
      if (dirty && canvas && ctx) {
        paint();
        dirty = false;
      }
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  });

  $effect(() => {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dirty = true;
  });

  function paint() {
    if (!ctx) return;
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    renderElementTree(ctx, skin.children, 0, 0, scale, renderState);
  }

  function handlePointerMove(event: PointerEvent) {
    if (!canvas) return;
    if (dragElement) {
      const deltaY = dragStartY - event.clientY;
      const sensitivity = 0.5;
      const frameDelta = Math.round(deltaY * sensitivity);
      onscrubFrame?.(dragElement, dragStartFrame + frameDelta);
      dirty = true;
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const px = (event.clientX - rect.left) / scale;
    const py = (event.clientY - rect.top) / scale;
    const hit = findElementAtPoint(px, py, skin.children, 0, 0, renderState.activeTab);
    onelementHover?.(hit?.name ?? null);
  }

  function handlePointerDown(event: PointerEvent) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = (event.clientX - rect.left) / scale;
    const py = (event.clientY - rect.top) / scale;
    const hit = findElementAtPoint(px, py, skin.children, 0, 0, renderState.activeTab);
    onelementClick?.(hit ?? null);

    if (hit && hit._type === "rotary" && hit.spritesheet) {
      dragElement = hit.name;
      dragStartY = event.clientY;
      dragStartFrame = renderState.scrubFrames[hit.name] ?? 0;
      canvas.setPointerCapture(event.pointerId);
    }
  }

  function handlePointerUp(event: PointerEvent) {
    if (dragElement && canvas) {
      canvas.releasePointerCapture(event.pointerId);
      dragElement = null;
    }
  }

  function handlePointerLeave() {
    onelementHover?.(null);
  }

  function handleWheel(event: WheelEvent) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.05 : 0.05;
    const newScale = Math.max(0.25, Math.min(2, scale + delta));
    onscaleChange?.(newScale);
  }
</script>

<canvas
  bind:this={canvas}
  style="width: {cssWidth}px; height: {cssHeight}px;"
  onpointermove={handlePointerMove}
  onpointerdown={handlePointerDown}
  onpointerup={handlePointerUp}
  onpointerleave={handlePointerLeave}
  onwheel={handleWheel}
></canvas>

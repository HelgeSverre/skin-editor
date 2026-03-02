# Osirus Skin Editor v2

> A description of the skin editor as it exists today — after months of real-world use,
> edge-case fixes, and organic iteration. This document describes what the tool *is*,
> not what it aspires to be.

---

## What It Does

The Osirus Skin Editor is a browser-based tool for loading, rendering, and visually
inspecting synthesizer skin definitions used by the [gearmulator](https://github.com/dsp56300/gearmulator)
Virus C emulator. Skin authors use it to preview their work without launching the plugin.

You open it in a browser. You pick a skin (or drop a folder onto it). The full
synthesizer interface appears — background, knobs, buttons, tabs, labels, dropdowns —
rendered exactly as the plugin would show it. You click tabs to flip pages. You hover
over controls to see their names and parameter bindings. You click a rotary and drag
to scrub through its spritesheet frames. That's it. It's a previewer, not an editor
in the authoring sense. The name stuck from v1.

---

## Architecture

### Technology

- **TypeScript** throughout, with strict mode. No `any` escape hatches.
- **Svelte 5** with runes. Components are small and single-purpose.
- **Vite** for dev and build. Nothing exotic in the config.
- **Canvas API** for the skin viewport. DOM for the shell UI around it.
- **JSON5** for parsing skin configs (they have comments everywhere).

No state management library. Svelte's reactivity handles everything. A few
module-level stores for things that cross component boundaries (active skin,
active page, hover target). Nothing more.

### File Layout

```
src/
  app.css                  -- Tailwind base imports
  main.ts                  -- Mount point
  App.svelte               -- Shell: sidebar, toolbar, viewport wrapper

  lib/
    types.ts               -- Full skin schema types (SkinDefinition, Element, etc.)
    parse.ts               -- JSON5 parsing + validation + normalization
    asset-loader.ts        -- Image/font loading with caching and error recovery
    geometry.ts            -- Hit testing, coordinate transforms, scaling math

  renderer/
    SkinViewport.svelte    -- Canvas element, sizing, DPR handling, render loop
    render-tree.ts         -- Recursive element traversal + dispatch
    render-image.ts        -- Image element drawing
    render-button.ts       -- Button spritesheet drawing (all 8 states)
    render-rotary.ts       -- Rotary spritesheet drawing with frame selection
    render-label.ts        -- Text rendering with font/color/alignment
    render-combobox.ts     -- Combobox rendering with current value text
    render-textbutton.ts   -- Text-only buttons
    render-container.ts    -- Container with child coordinate offset

  ui/
    Sidebar.svelte         -- Skin list, local folder drop zone
    Toolbar.svelte         -- Tab bar, scale slider, debug toggles
    Tooltip.svelte         -- Hover info overlay (element name, param, bounds)
    ErrorBanner.svelte     -- Non-fatal error display (missing images, bad JSON, etc.)
```

Renderers are plain functions, not components. They take a `CanvasRenderingContext2D`,
an element, a parent offset, the scale, the image cache, and whatever state they need
(active tab, hovered element, scrub frame). They draw and return. No side effects.

---

## Skin Loading

### Sources

1. **Remote** — fetches from the gearmulator GitHub raw URL. The skin list is
   hardcoded (Galaxpel, Trancy, Hoverland) but trivially extensible.
2. **Local folder** — drag a skin folder onto the sidebar. Uses the
   File System Access API where available, falls back to `<input webkitdirectory>`.
   Reads the JSON config and all `.png`/`.ttf` files. Creates object URLs for assets.
3. **Local JSON file** — drop a single `.json` file. The editor asks where to
   resolve textures from (a base URL or another dropped folder).

### Parsing & Validation

`parse.ts` does more than `JSON5.parse()`:

- **Type coercion**: All coordinates and dimensions arrive as strings in the JSON
  (`"786.9999"`, `"0"`, `"52"`). The parser converts them to numbers once, upfront,
  for every element. No `parseFloat` scattered through renderers.
- **Missing fields**: If `root.scale` is absent, it defaults to `1`. If `tabgroup`
  is missing, the toolbar hides the tab bar. If an element has no position, it's
  placed at `(0, 0)`.
- **Color normalization**: Skin colors are 8-character hex strings in RRGGBBAA format
  (e.g., `"75A7FEFF"`). The parser converts them to standard CSS `rgba()` values.
  Invalid colors become transparent with a console warning.
- **Element type detection**: Each element in the tree can have multiple type
  properties (`rotary` + `spritesheet`, `button` + `parameterAttachment`). The
  parser identifies the *primary* type and attaches it as `element._type` for
  fast dispatch during rendering.
- **Children flattening for pages**: Elements whose name matches a `tabgroup.pages`
  entry are tagged with `_page`. The renderer uses this to show/hide elements
  based on the active tab. Elements not belonging to any page are always visible
  (backgrounds, global controls).
- **Template expansion**: If an element references a template (by matching a template
  name), the parser merges template properties as defaults before the element's own
  properties. This happens once at parse time, not at render time.
- **Validation errors** are collected, not thrown. The skin still renders with
  whatever is valid. Errors appear in the `ErrorBanner`.

### Asset Loading

`asset-loader.ts` handles images and fonts:

- **Parallel loading**: All unique texture names are collected from the full element
  tree (including nested children). Images load via `Promise.allSettled` — failures
  don't block the rest.
- **Retry with backoff**: Failed image loads retry twice with 1s/3s delays. GitHub
  raw content occasionally 503s.
- **Object URL caching**: For local skins, dropped files become object URLs stored
  in the same cache. Remote images use their URL directly via `Image` elements.
- **Font loading**: `.ttf` files referenced by `fontFile` properties are loaded via
  `FontFace` API and added to `document.fonts`. If a font fails to load, the
  renderer falls back to the system sans-serif. No layout shift — text renders
  immediately with the fallback, then re-renders if the font arrives.
- **Cache invalidation**: Switching skins revokes old object URLs and clears the
  image cache. No memory leaks from accumulated blob URLs.
- **Progress reporting**: The asset loader emits a count of loaded/total assets.
  The toolbar shows a subtle progress bar during initial load.

---

## Rendering

### The Render Loop

`SkinViewport.svelte` owns a `<canvas>` element and a `requestAnimationFrame` loop.
Rendering is not continuous — it only repaints when state changes (skin loaded,
tab switched, element hovered, rotary scrubbed, window resized). A dirty flag
avoids redundant frames.

### Device Pixel Ratio

The canvas dimensions account for `window.devicePixelRatio`. The canvas element's
CSS size is `width * scale` by `height * scale`. Its backing store is that times
DPR. The context is scaled by DPR at the start of each frame. This means crisp
rendering on Retina displays without any per-element math changes.

### Coordinate System

All element coordinates are relative to their parent container. `render-tree.ts`
recurses through the element tree, accumulating a parent offset:

```ts
function renderElement(ctx, element, parentX, parentY, scale, state) {
  const type = element._type;
  const props = element[type];
  const x = (parentX + props.x) * scale;
  const y = (parentY + props.y) * scale;
  const w = props.width * scale;
  const h = props.height * scale;

  renderers[type]?.(ctx, element, x, y, w, h, state);

  if (element.children) {
    for (const child of element.children) {
      renderElement(ctx, child, parentX + props.x, parentY + props.y, scale, state);
    }
  }
}
```

Children inherit the parent's offset. This is the fix that v1 never shipped — it
had the recursive call commented out with a `// TODO: implement`. Getting coordinate
accumulation right (parent offset is in unscaled space, final position is scaled)
was the main bug source in early v2 development.

### Page Visibility

Elements tagged with `_page` only render when `_page === activeTab`. Elements with
no `_page` tag always render. This means backgrounds, global labels, and the tab
buttons themselves are always visible, while page-specific controls (the 179 rotaries,
64 comboboxes, etc.) only appear for their page.

This was a big missing piece in v1, which rendered every element from every page
simultaneously, stacked on top of each other.

### Element Renderers

Each renderer is a focused function. Here's what they handle:

**`render-image.ts`**
- Draws the texture at the element's position and size.
- If the texture is missing from the cache, draws nothing (no placeholder rectangle).
- Handles the common case where the image is the full-skin background.

**`render-button.ts`**
- Reads `normalImage`, `overImage`, `downImage`, `normalImageOn`, `overImageOn`,
  `downImageOn` indices to select the correct sprite from the sheet.
- Computes source rectangle: `srcY = index * tileSizeY`, `srcX = 0`,
  `srcW = tileSizeX`, `srcH = tileSizeY`.
- Active state is determined by: for tab buttons, whether the button's page matches
  `activeTab`. For toggle buttons in a radio group, whichever was last clicked.
- Hover state shows the `overImage`/`overImageOn` variant.
- If the spritesheet image is missing, renders a subtle dashed outline so the author
  knows something should be there.

**`render-rotary.ts`**
- Rotaries have an empty `rotary: {}` object and a companion `spritesheet` object.
- The spritesheet contains N frames of the knob at different rotation angles,
  tiled vertically (each frame is `tileSizeX` x `tileSizeY`).
- The current frame is `state.scrubFrames[element.name]` — defaults to the middle
  frame (noon position) when no interaction has occurred.
- Draws the correct tile: `srcY = frame * tileSizeY`.
- On hover, shows the element name and current frame number in the tooltip.
- On click+drag (vertical), scrubs through frames. This is purely visual — there's
  no MIDI or parameter output. It just lets skin authors verify that all frames
  look correct and the animation is smooth.

**`render-label.ts`**
- Sets font from `fontFile` (if loaded) or falls back to sans-serif.
- Applies `textHeight` as font size, scaled.
- Applies horizontal alignment (`L`/`C`/`R`) via `textAlign`.
- Applies vertical alignment (`T`/`C`/`B`) via `textBaseline` and offset math.
- Fills `backgroundColor` first if present, then draws text on top.
- Color is the normalized `rgba()` value from parsing.

**`render-combobox.ts`**
- Renders as a label with the `text` value (the default/placeholder text from the
  skin definition).
- Draws a small dropdown arrow indicator on the right edge.
- On hover, shows the tooltip text if the element has one.
- No actual dropdown interaction — this is a previewer. The combobox just shows
  what the default state looks like.

**`render-textbutton.ts`**
- Renders text using the button's `text`, `textHeight`, `color`, and alignment
  properties. No spritesheet — purely text.
- On hover, shows a subtle highlight.

**`render-container.ts`**
- Invisible by default. Just establishes a coordinate offset for children.
- In debug mode, draws a semi-transparent blue overlay so authors can see
  container bounds.

**Unhandled element types** (`treeview`, `listbox`, `scrollbar`, `texteditor`,
`hyperlinkbutton`, `condition`, `component`):
- Rendered as a dashed outline with the element type name in small text.
- These are rare (1-2 per skin) and are JUCE-specific widgets that don't
  have a meaningful static preview. The outline at least shows the author
  where the widget will appear and how much space it occupies.

---

## Interaction

### Tab Navigation

Clicking a tab button (detected via hit testing against elements whose name starts
with `Tab` or that are listed in `tabgroup.buttons`) switches `activeTab`. The
canvas re-renders showing only that page's elements plus always-visible globals.

The toolbar also shows text tab buttons as a secondary navigation method, useful
when the skin's own tab buttons are small or hard to find.

### Rotary Scrubbing

Click and drag vertically on a rotary to scrub through spritesheet frames. Drag up
to increase the frame index, down to decrease. The sensitivity is tuned so that
dragging the full height of the rotary sweeps through all frames.

Mouse capture (`setPointerCapture`) is used during drag so the cursor can leave
the canvas without interrupting the scrub.

### Hover Inspection

Moving the mouse over the canvas runs hit testing against the element tree (deepest
child first, for correct z-order). The hovered element's name, type, parameter
attachment (if any), and bounding box appear in the tooltip.

In debug mode, the hovered element also gets a highlight rectangle drawn over it
on the canvas.

Hit testing respects page visibility — you can't accidentally hover over an element
from a hidden page.

### Zoom / Scale

A scale slider in the toolbar lets you override the skin's default scale. Range is
0.25x to 2x. The canvas resizes accordingly. This is useful for skins designed at
2x resolution that are hard to see at 0.5x default scale on smaller screens.

The mouse wheel with Ctrl/Cmd also zooms, centered on the cursor position.

---

## Error Handling

The philosophy is: always render something. Never show a blank screen.

- **Network failure loading skin JSON**: Error banner with retry button. Previous
  skin stays visible.
- **JSON5 parse error**: Error banner showing the parse error message with line
  number. If a previously valid skin was loaded, it stays visible.
- **Missing textures**: Elements with missing textures render as invisible (images)
  or dashed outlines (buttons, rotaries). A count of missing textures shows in the
  toolbar. Clicking it lists the missing filenames — useful for skin authors who
  misnamed a file.
- **Invalid coordinates/dimensions**: The parser replaces `NaN` results with `0`.
  Elements may appear at the wrong position but won't crash the renderer.
- **Invalid colors**: Replaced with transparent at parse time. Logged to console.
- **Missing fonts**: System sans-serif fallback. Text still appears, just in the
  wrong typeface.
- **Oversized images**: No special handling needed — Canvas API handles large images
  fine. The browser's own memory limits apply.
- **Circular element trees**: The parser caps recursion depth at 20 levels. Anything
  deeper is silently dropped. No skin in the wild goes past 5 levels.
- **CORS issues with remote assets**: All assets come from `raw.githubusercontent.com`
  which sets appropriate CORS headers. Local files use object URLs which have no
  CORS restrictions.

---

## Debug Mode

A toggle in the toolbar enables debug overlays:

- **Container bounds**: Semi-transparent blue rectangles around containers.
- **Element bounds**: Thin outlines around every element, color-coded by type
  (blue for images, green for rotaries, yellow for buttons, etc.).
- **Element names**: Small text labels at the top-left of each element.
- **Hit test visualization**: The currently hovered element gets a highlight.
- **Missing asset list**: Panel listing all textures/fonts that failed to load.
- **Render stats**: Frame time, element count, image cache size.

Debug mode is off by default. Skin authors toggle it when troubleshooting
layout issues.

---

## What It Doesn't Do

This is explicitly a **previewer**, not a full editor. It does not:

- Modify skin JSON files
- Export or save anything
- Connect to the synthesizer plugin
- Play audio or respond to MIDI
- Support drag-and-drop repositioning of elements
- Generate skin templates or boilerplate
- Validate skins against the gearmulator spec (beyond what's needed to render)

These boundaries are intentional. The tool does one thing — show you what your
skin looks like — and it does it reliably. Skin authoring (editing JSON, creating
textures) happens in text editors and image editors where those tools are better.

---

## What v1 Got Wrong

For context, here's what the v2 rewrite fixed:

1. **No nested children rendering.** v1 only rendered top-level `skin.children`.
   Elements inside containers were invisible. This meant ~30% of UI elements in
   typical skins simply didn't appear.

2. **No page filtering.** v1 rendered all elements from all pages simultaneously,
   creating an unreadable mess of overlapping controls.

3. **Rotaries and comboboxes were colored rectangles.** v1 drew blue/green placeholder
   outlines instead of actual spritesheet frames or text.

4. **Button state logic was hardcoded for tabs.** v1 only handled tab buttons.
   Regular toggle buttons, radio groups, and multi-state buttons were not supported.

5. **Coordinates were strings.** v1 passed string values from the JSON straight into
   Canvas drawing calls, relying on JavaScript's implicit coercion. This mostly
   worked but caused subtle positioning bugs when values were concatenated instead
   of added.

6. **Debug artifacts in production.** Yellow rectangles around every button.
   `alert("clicked")` on tab clicks. `console.log` on every rendered element.
   Light gray background filling the canvas.

7. **Single font.** v1 loaded exactly one font (Digital.ttf from Trancy) hardcoded
   in a `<style>` block. Other skins referencing different fonts got sans-serif.

8. **No DPR handling.** Canvas looked blurry on Retina displays.

9. **Hit testing used top-level element bounds.** Clicking a tab button checked
   against `element.x`/`element.width`, but button position data lives inside
   `element.button.x`/`element.button.width`. Hit testing was broken for any
   element where these differed.

10. **Image load errors were swallowed.** `Promise.all` with rejected image loads
    meant `renderSkin()` sometimes never fired.

---

## Performance Notes

With a typical skin (Galaxpel: ~500 elements, ~40 unique textures, 2754x1600 base
resolution at 0.5x scale):

- **Initial load**: ~2s (dominated by network time for ~40 PNG fetches from GitHub).
  Local skins load in <200ms.
- **Render time**: <5ms per frame. The element tree is flat enough and Canvas API
  fast enough that no optimization was needed beyond avoiding unnecessary repaints.
- **Memory**: ~30MB for image cache (compressed PNGs decompress to larger bitmaps).
  Switching skins releases the previous cache.
- **Bundle size**: ~45KB gzipped (Svelte runtime + JSON5 + app code). No heavy
  dependencies.

---

## Running It

```bash
npm install
npm run dev       # http://localhost:5173
```

Drop a skin folder onto the sidebar or click one of the built-in remote skins.
That's it.

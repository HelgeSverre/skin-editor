# Gearmulator Skin Formats

Gearmulator uses two different skin definition formats. This document describes
both, with the JSON format (which our editor supports) documented in full detail.

---

## The Two Formats

### JSON Skin Format (v1 / JUCE era)

- **Files:** `*.json` (actually JSON5 — comments and trailing commas allowed)
- **Used by:** Official skins bundled with gearmulator pre-2.0, and many community skins
- **Structure:** A single JSON file defining root dimensions, tab navigation, templates,
  and a recursive tree of UI elements (images, buttons, knobs, labels, comboboxes)
- **Assets:** PNG spritesheets and TTF fonts referenced by name, resolved relative
  to the skin folder
- **Our editor:** Fully supported. This is the format `src/lib/parse.ts` parses.

### RML/RCSS Skin Format (v2 / RmlUi era)

- **Files:** `*.rml` (markup) + `*.rcss` (styles) + shared `tus_*.rml`/`tus_*.rcss` templates
- **Used by:** Gearmulator v2.0+ (December 2024 onward), newer community skins
- **Structure:** XML markup based on [RmlUi](https://github.com/mikke89/RmlUi), a C++
  HTML/CSS rendering engine. Custom elements (`<knob>`, `<combo>`, `<button>`) extend
  standard HTML tags. Styling uses CSS2-like syntax with extensions for spritesheets.
- **Assets:** Same PNG/TTF files, but referenced via CSS `@spritesheet` rules and
  `src` attributes
- **Our editor:** Not currently supported

### Relationship Between Formats

Both formats describe the same thing — a 2D layout of synthesizer controls over
background images. They reference identical PNG spritesheets and font files.
Gearmulator v2.0 includes a built-in converter that auto-converts legacy JSON
skins to RML/RCSS on first load.

The key difference is how layout is expressed:

| Aspect | JSON | RML/RCSS |
|--------|------|----------|
| Position | Explicit `x`, `y` per element | CSS `left`, `top` in `dp` units |
| Styling | Inline per element | Cascading stylesheets with classes |
| Spritesheets | `texture` name + `tileSizeX/Y` | CSS `@spritesheet` blocks with named frames |
| Tab pages | `tabgroup.pages[]` + child `_page` tagging | `tabgroup`/`tabpage` HTML attributes |
| Reuse | `templates[]` array merged at parse time | CSS classes + `<link>` includes |

---

## JSON Skin Format — Full Reference

### File Structure

A skin is a folder containing:

```
MySkin/
  MySkin.json          -- Skin definition (JSON5)
  main_bg.png          -- Background image
  knob_2-104x104.png   -- Rotary spritesheet (vertical strip)
  osc-btn-306x83.png   -- Button spritesheet (states stacked vertically)
  Digital.ttf          -- Font file
  osc_page.png         -- Tab page background
  ...
```

### Top-Level Schema

```jsonc
{
  "name": "Root",                    // Skin name (always "Root")

  "root": {                          // Canvas dimensions
    "x": "0",                        // Always "0"
    "y": "0",                        // Always "0"
    "width": "2754",                 // Canvas width in skin units
    "height": "1600",                // Canvas height in skin units
    "scale": "0.5"                   // Default display scale (0.5 = half size)
  },

  "tabgroup": {                      // Tab navigation (optional)
    "name": "pages",                 // Group identifier
    "buttons": ["TabOsc", "TabLfo", "TabEffects", "TabArp", "Presets"],
    "pages": ["page_osc", "page_lfo", "page_fx", "page_arp", "page_presets"]
  },

  "templates": [ ... ],             // Reusable property sets (optional)

  "children": [ ... ]               // Element tree (the actual UI)
}
```

**Important:** All numeric values arrive as **strings** in the JSON (`"2754"`, `"0.5"`,
`"104"`). The parser converts them to numbers at parse time.

### Tab Group

Maps button element names to page element names by index:

```jsonc
"tabgroup": {
  "name": "pages",
  "buttons": ["TabOsc",   "TabLfo",   "TabEffects"],  // Element names
  "pages":   ["page_osc", "page_lfo", "page_fx"]      // Element names
}
```

- `buttons[0]` controls `pages[0]`, `buttons[1]` controls `pages[1]`, etc.
- Clicking a button whose name is in `buttons[]` activates the corresponding page
- Elements whose `name` matches a `pages[]` entry only render when that page is active
- Elements NOT in any page always render (backgrounds, global controls, tab buttons)

### Templates

Reusable property defaults that elements can inherit:

```jsonc
"templates": [
  {
    "name": "pm_treeview",
    "treeview": {
      "alignH": "L",
      "alignV": "C",
      "color": "75A7FEFF",
      "backgroundColor": "1c1f22ff"
    }
  }
]
```

When an element's name matches a template name, the template's properties are
merged as defaults (element's own properties take precedence).

### Element Types

Each child in `children[]` is an object with a `name` and one or more type
properties. The primary type determines how it renders.

#### `image` — Static Image

```jsonc
{
  "name": "bg",
  "image": {
    "x": "0",
    "y": "0",
    "width": "2754",
    "height": "1600",
    "texture": "main_bg"           // PNG filename without extension
  }
}
```

The `texture` field references a PNG file in the skin folder. `main_bg` resolves
to `main_bg.png`.

#### `button` — Spritesheet Button

```jsonc
{
  "name": "TabOsc",
  "button": {
    "x": "719",
    "y": "227",
    "width": "306",
    "height": "83",
    "texture": "osc-btn-306x83",   // Spritesheet PNG
    "tileSizeX": "306",            // Width of one frame
    "tileSizeY": "83",             // Height of one frame
    "isToggle": "1",               // "1" = toggle, "0" = momentary
    "radioGroupId": "42",          // Buttons in same group are mutually exclusive
    "normalImage": "1",            // Frame index for: off state, idle
    "overImage": "1",              // Frame index for: off state, hovered
    "downImage": "0",              // Frame index for: off state, pressed
    "normalImageOn": "0",          // Frame index for: on state, idle
    "overImageOn": "0",            // Frame index for: on state, hovered
    "downImageOn": "0"             // Frame index for: on state, pressed
  }
}
```

**Spritesheet layout:** Frames are stacked **vertically**. Frame 0 starts at
`srcY = 0`, frame 1 at `srcY = tileSizeY`, frame 2 at `srcY = 2 * tileSizeY`, etc.

**State selection:** The renderer picks a frame index based on the button's current
state (normal/over/down) and toggle state (on/off). For tab buttons, "on" means
the button's page is the active tab.

#### `rotary` + `spritesheet` — Rotary Knob

```jsonc
{
  "name": "Osc1Shape",
  "parameterAttachment": {
    "parameter": "Osc1 Shape"
  },
  "rotary": {},                     // Marker — always empty object
  "spritesheet": {
    "x": "223.3",
    "y": "58",
    "width": "104",
    "height": "104",
    "texture": "knob_2-104x104",   // Vertical strip of rotation frames
    "tileSizeX": "104",
    "tileSizeY": "104"
  }
}
```

A rotary always has an empty `rotary: {}` object alongside a `spritesheet` object.
The spritesheet contains N frames of the knob at different rotation angles, tiled
vertically. The number of frames = `imageHeight / tileSizeY`.

Default display frame is the middle frame (noon position). Scrubbing (click+drag
vertically) sweeps through all frames.

#### `label` — Text Label

```jsonc
{
  "name": "PatchName",
  "label": {
    "x": "818.6",
    "y": "95.9",
    "width": "372",
    "height": "75",
    "text": "OvertureCK",           // Display text (placeholder in previewer)
    "textHeight": "64",             // Font size in skin units
    "color": "79AAFFFF",            // RRGGBBAA hex color
    "backgroundColor": "",          // Optional background fill
    "alignH": "L",                  // Horizontal: "L" (left), "C" (center), "R" (right)
    "alignV": "C",                  // Vertical: "T" (top), "C" (center), "B" (bottom)
    "bold": "0",                    // "1" = bold
    "fontFile": "Digital",          // Font filename without extension → Digital.ttf
    "fontName": "Digital"           // Font family name (for registration)
  }
}
```

**Color format:** 8-character hex string, `RRGGBBAA`. Examples:
- `"79AAFFFF"` → `rgba(121, 170, 255, 1.0)` (opaque blue)
- `"888888ff"` → `rgba(136, 136, 136, 1.0)` (gray)
- `"00000000"` → `rgba(0, 0, 0, 0.0)` (transparent)

#### `combobox` — Dropdown

```jsonc
{
  "name": "RomSelector",
  "combobox": {
    "x": "2024",
    "y": "120",
    "width": "520",
    "height": "50",
    "text": "Access_Virus_C_OS_6.5.bin",  // Default/placeholder text
    "textHeight": "32",
    "color": "79AAFFFF",
    "alignH": "L",
    "alignV": "C",
    "fontFile": "Digital",
    "tooltip": "Copy a valid ROM file..."
  }
}
```

In the previewer, comboboxes render as static text with a dropdown arrow indicator.
No interactive dropdown — this is a layout preview tool.

#### `textbutton` — Text-Only Button

```jsonc
{
  "name": "PresetPrev",
  "textbutton": {
    "x": "454",
    "y": "343",
    "width": "36",
    "height": "30",
    "text": "<",
    "textHeight": "24",
    "color": "FFFFFFFF",
    "alignH": "C",
    "alignV": "C"
  }
}
```

No spritesheet — just text rendered directly.

#### `container` — Invisible Group

```jsonc
{
  "name": "mixer_section",
  "container": {
    "x": "800",
    "y": "50",
    "width": "400",
    "height": "300"
  },
  "children": [ ... ]
}
```

Establishes a coordinate offset for children. Invisible in normal mode, shown as
a blue overlay in debug mode.

#### `parameterAttachment` — Synth Parameter Binding

```jsonc
"parameterAttachment": {
  "parameter": "Osc1 Shape"
}
```

Not a visual element. Declares which synthesizer parameter this control is bound
to. Our previewer displays this in the hover tooltip.

#### `condition` — Conditional Visibility

```jsonc
"condition": {
  "enableOnParameter": "Arp Mode",
  "enableOnValues": "1,2,3"
}
```

Makes the element visible only when the specified parameter has one of the listed
values. Not evaluated in the previewer (we always show the element).

### Children / Nesting

Elements can have a `children` array containing nested elements:

```jsonc
{
  "name": "page_osc",
  "image": { ... },                 // Page background
  "children": [
    { "name": "Osc1Shape", "rotary": {}, "spritesheet": { ... } },
    { "name": "Osc1PW", "rotary": {}, "spritesheet": { ... } },
    ...
  ]
}
```

Child coordinates are **relative to their parent**. The renderer accumulates
parent offsets during recursive traversal:

```
final_x = (parentX + element.x) * scale
final_y = (parentY + element.y) * scale
```

### Page Visibility

When an element's `name` matches an entry in `tabgroup.pages`, it becomes a "page
element." Page elements and their children only render when that page is the active
tab. Everything else renders always.

```
tabgroup.pages = ["page_osc", "page_lfo", "page_fx"]

Element "page_osc" → only visible when activeTab = "page_osc"
Element "bg"       → always visible (not in pages list)
Element "TabOsc"   → always visible (it's a button, not a page)
```

### Asset Resolution

- **Textures:** `"texture": "main_bg"` → look for `main_bg.png` in the skin folder
- **Fonts:** `"fontFile": "Digital"` → look for `Digital.ttf` in the skin folder
- Both are case-sensitive on most systems
- Missing assets don't crash — the element renders as invisible (images) or with
  a system fallback font (labels)

---

## RML/RCSS Format — Overview

RML skins use [RmlUi](https://github.com/mikke89/RmlUi), a C++ library that
renders HTML/CSS-like markup with hardware acceleration. It's not actual HTML —
it's a subset of HTML4/CSS2 with custom extensions.

### What RmlUi Is

RmlUi is a fork of the now-defunct libRocket project. It provides:

- XML-based markup language (RML) similar to XHTML
- CSS-like stylesheet language (RCSS) based on CSS2 with extensions
- Custom element support (gearmulator adds `<knob>`, `<combo>`, etc.)
- Spritesheet definitions in CSS (`@spritesheet` blocks)
- Data binding for model-view patterns
- `dp` units (density-independent pixels) instead of `px`

### RML Structure

```xml
<rml>
  <head>
    <link type="text/template" href="tus_colorpicker.rml"/>
    <link type="text/rcss" href="tus_default.rcss"/>
    <link type="text/rcss" href="VirusC_IceyBlues.rcss"/>
  </head>
  <body id="Root" rootScale="0.5"
        style="left: 0dp; top: 0dp; width: 2754dp; height: 1600dp;">

    <img id="bg" src="main_bg.png"
         style="left: 0dp; top: 0dp; width: 2754dp; height: 1600dp;"/>

    <button id="TabOsc" class="juceButton osc-btn-306x83"
            isToggle="1" tabbutton="0" tabgroup="pages"
            style="left: 724dp; top: 240dp; width: 306dp; height: 83dp;"/>

    <knob id="Osc1Shape" class="juceRotary knob1"
          data-model="partCurrent" param="Osc1 Shape"
          style="left: 223dp; top: 58dp; width: 104dp; height: 104dp;"/>

    <combo id="Osc1WaveSelect" class="txt2"
           data-model="partCurrent" param="Osc1 Wave Select"
           style="left: 20dp; top: 93dp; width: 185dp; height: 45dp;">
      <combotext>Wave 42</combotext>
    </combo>

    <div id="PatchName" class="juceLabel txt"
         style="left: 819dp; top: 96dp; width: 372dp; height: 75dp;">
      OvertureCK
    </div>

    <img id="page_osc" src="osc_page.png"
         tabgroup="pages" tabpage="0"
         style="left: 724dp; top: 325dp; width: 1970dp; height: 1125dp;">
      <!-- Page children are nested inside the <img> tag -->
      <knob id="Osc1Shape" .../>
    </img>
  </body>
</rml>
```

### RCSS Spritesheets

Instead of inline `texture`/`tileSizeX`/`tileSizeY`, spritesheets are defined in CSS:

```css
@spritesheet osc-btn-306x83 {
  src: osc-btn-306x83.png;
  osc-btn-306x83_default:        0px 83px 306px 83px;
  osc-btn-306x83_hover:          0px 83px 306px 83px;
  osc-btn-306x83_active:         0px 0px  306px 83px;
  osc-btn-306x83_checked:        0px 0px  306px 83px;
  osc-btn-306x83_checked-hover:  0px 0px  306px 83px;
  osc-btn-306x83_checked-active: 0px 0px  306px 83px;
}
```

Each named sprite maps to `x y width height` in the source image.

### Shared Templates

RML skins reference shared template files (`tus_default.rcss`, `tus_juceskin.rcss`,
`tus_patchmanager.rml`, etc.) that live in the gearmulator source tree, not in the
skin folder. This means RML skins are **not self-contained** — they depend on
framework files from the gearmulator build.

### Can We Support RML?

**Feasibility: Yes, but it's a significant effort.**

What would be needed:
1. **XML parser** for RML (straightforward — DOMParser in the browser)
2. **CSS parser** for RCSS `@spritesheet` blocks (custom parser needed)
3. **Resolve shared templates** — bundle `tus_*.rcss` and `tus_*.rml` from the
   gearmulator repo, or fetch them at load time
4. **Map RML elements to our renderers** — `<knob>` → rotary, `<button>` → button,
   `<combo>` → combobox, `<div class="juceLabel">` → label
5. **Parse inline styles** — extract `left`, `top`, `width`, `height` from
   `style="..."` attributes, convert `dp` units to numbers
6. **CSS class → spritesheet resolution** — match element classes to `@spritesheet`
   definitions to determine which PNG and frame indices to use

**Alternatively: RML → JSON converter.** Since both formats describe the same
thing, we could convert RML skins to our JSON format at load time:

- Parse the RML XML
- Parse the RCSS spritesheets
- Map elements to JSON equivalents
- Output a `SkinDefinition` object

This would let us reuse all existing renderers unchanged.

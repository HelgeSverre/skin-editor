#!/usr/bin/env node
/**
 * RML/RCSS → JSON skin converter for gearmulator.
 *
 * Usage:
 *   node convert.mjs <skin-dir>
 *
 * Expects a directory containing:
 *   - One .rml file (the skin markup)
 *   - One .rcss file (the skin stylesheet with @spritesheets + class rules)
 *
 * Outputs a .json file in the same directory.
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, basename, extname } from "path";

// ─── RCSS Parser ────────────────────────────────────────────────────────────

function parseRCSS(rcssText) {
  const spritesheets = new Map(); // name → { src, sprites: Map<spriteName, {x,y,w,h}> }
  const classes = new Map(); // className → { property: value, ... }

  // Parse @spritesheet blocks
  const sheetRe = /@spritesheet\s+([\w\-]+)\s*\{([^}]+)\}/g;
  let m;
  while ((m = sheetRe.exec(rcssText)) !== null) {
    const name = m[1];
    const body = m[2];
    const sprites = new Map();
    let src = null;

    for (const line of body.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "{" || trimmed === "}") continue;

      const srcMatch = trimmed.match(/^src:\s*(.+?);?\s*$/);
      if (srcMatch) {
        src = srcMatch[1].trim();
        continue;
      }

      // sprite_name: Xpx Ypx Wpx Hpx;
      const spriteMatch = trimmed.match(
        /^([\w\-]+):\s*(\d+)px\s+(\d+)px\s+(\d+)px\s+(\d+)px\s*;?\s*$/
      );
      if (spriteMatch) {
        sprites.set(spriteMatch[1], {
          x: parseInt(spriteMatch[2]),
          y: parseInt(spriteMatch[3]),
          w: parseInt(spriteMatch[4]),
          h: parseInt(spriteMatch[5]),
        });
      }
    }

    spritesheets.set(name, { src, sprites });
  }

  // Parse CSS class rules (after removing @spritesheet blocks)
  const withoutSheets = rcssText.replace(/@spritesheet\s+[\w\-]+\s*\{[^}]+\}/g, "");

  // Match .className { ... } blocks (including pseudo-classes like :checked)
  const classRe = /\.([\w\-]+(?::[\w\-]+)*)\s*\{([^}]*)\}/g;
  while ((m = classRe.exec(withoutSheets)) !== null) {
    const className = m[1];
    const body = m[2];
    const props = {};

    for (const line of body.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const propMatch = trimmed.match(/^([\w\-]+)\s*:\s*(.+?);?\s*$/);
      if (propMatch) {
        props[propMatch[1]] = propMatch[2].trim();
      }
    }

    // Only store base classes (no pseudo-classes) for text styling
    if (!className.includes(":")) {
      classes.set(className, { ...(classes.get(className) || {}), ...props });
    }
  }

  return { spritesheets, classes };
}

// ─── RML Parser (XML) ──────────────────────────────────────────────────────

function parseRML(rmlText) {
  // Simple XML parser — good enough for well-formed RML
  // We'll use a state machine rather than DOMParser (not available in Node)
  const elements = [];
  const stack = [];

  // Normalize self-closing tags
  const normalized = rmlText
    .replace(/&lt;/g, "«LT»")
    .replace(/&gt;/g, "«GT»")
    .replace(/&amp;/g, "«AMP»");

  const tagRe =
    /<(\/?)(\w+)((?:\s+[\w\-:]+(?:\s*=\s*"[^"]*")?)*)\s*(\/?)>/g;
  let match;
  let root = null;

  while ((match = tagRe.exec(normalized)) !== null) {
    const isClosing = match[1] === "/";
    const tagName = match[2];
    const attrsStr = match[3];
    const isSelfClosing = match[4] === "/";

    if (isClosing) {
      if (stack.length > 0) {
        stack.pop();
      }
      continue;
    }

    // Parse attributes
    const attrs = {};
    const attrRe = /([\w\-:]+)\s*=\s*"([^"]*)"/g;
    let attrMatch;
    while ((attrMatch = attrRe.exec(attrsStr)) !== null) {
      attrs[attrMatch[1]] = attrMatch[2]
        .replace(/«LT»/g, "<")
        .replace(/«GT»/g, ">")
        .replace(/«AMP»/g, "&");
    }

    // Extract text content (for labels/combos)
    let textContent = "";
    if (!isSelfClosing) {
      const afterTag = normalized.slice(tagRe.lastIndex);
      const textMatch = afterTag.match(/^([^<]*)</);
      if (textMatch) {
        textContent = textMatch[1]
          .trim()
          .replace(/«LT»/g, "<")
          .replace(/«GT»/g, ">")
          .replace(/«AMP»/g, "&");
      }
    }

    const node = {
      tag: tagName,
      attrs,
      textContent,
      children: [],
    };

    if (tagName === "body") {
      root = node;
    }

    if (stack.length > 0) {
      stack[stack.length - 1].children.push(node);
    }

    if (!isSelfClosing && tagName !== "head" && tagName !== "link") {
      stack.push(node);
    }
  }

  return root;
}

// ─── Style Parser ───────────────────────────────────────────────────────────

function parseInlineStyle(style) {
  if (!style) return {};
  const result = {};
  for (const part of style.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx < 0) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    let value = trimmed.slice(colonIdx + 1).trim();
    // Strip dp units
    value = value.replace(/dp$/i, "");
    result[key] = value;
  }
  return result;
}

function stripDp(value) {
  if (typeof value !== "string") return value;
  return value.replace(/dp$/i, "").trim();
}

// ─── Color Conversion ───────────────────────────────────────────────────────

function cssColorToHex8(color) {
  if (!color) return undefined;
  color = color.trim();

  // #RRGGBB → RRGGBBFF
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color.slice(1).toUpperCase() + "FF";
  }
  // #RRGGBBAA → RRGGBBAA
  if (/^#[0-9a-fA-F]{8}$/.test(color)) {
    return color.slice(1).toUpperCase();
  }
  // #RGB → RRGGBBFF
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const r = color[1],
      g = color[2],
      b = color[3];
    return (r + r + g + g + b + b).toUpperCase() + "FF";
  }
  return color;
}

function cssAlignToJson(textAlign) {
  switch (textAlign) {
    case "left":
      return "L";
    case "right":
      return "R";
    case "center":
      return "C";
    default:
      return "L";
  }
}

// ─── Spritesheet Analysis ───────────────────────────────────────────────────

function getButtonSpriteIndices(spritesheet) {
  if (!spritesheet) return {};

  const sprites = spritesheet.sprites;
  const name = [...sprites.keys()][0];
  if (!name) return {};

  // Determine tile height from the first sprite
  const first = sprites.values().next().value;
  const tileH = first.h;

  // Map sprite states to Y-offset-based indices
  const stateMap = {};
  for (const [spriteName, rect] of sprites) {
    const suffix = spriteName.replace(/^.*?_/, "");
    stateMap[suffix] = Math.round(rect.y / tileH);
  }

  return {
    normalImage: String(stateMap["default"] ?? 0),
    overImage: String(stateMap["hover"] ?? stateMap["default"] ?? 0),
    downImage: String(stateMap["active"] ?? 1),
    normalImageOn: String(stateMap["checked"] ?? stateMap["active"] ?? 1),
    overImageOn: String(
      stateMap["checked-hover"] ?? stateMap["checked"] ?? 1
    ),
    downImageOn: String(
      stateMap["checked-active"] ?? stateMap["checked"] ?? 1
    ),
    tileW: String(first.w),
    tileH: String(first.h),
  };
}

function getSpritesheetSrc(spritesheet) {
  if (!spritesheet?.src) return null;
  // Strip .png extension for texture name
  return spritesheet.src.replace(/\.png$/i, "");
}

// ─── Main Conversion ────────────────────────────────────────────────────────

function findSpritesheetClass(classes, spritesheets) {
  // Given a list of CSS classes, find one that matches a spritesheet name
  for (const cls of classes) {
    if (spritesheets.has(cls)) return cls;
  }
  return null;
}

function findKnobClass(classes, cssClasses) {
  // Find a CSS class that has `spriteprefix` property (knob styling)
  for (const cls of classes) {
    const def = cssClasses.get(cls);
    if (def?.spriteprefix) return cls;
  }
  return null;
}

function findTextClass(classes, cssClasses) {
  // Find a CSS class that has color/font styling (text classes)
  for (const cls of classes) {
    if (cls.startsWith("juce")) continue; // skip jucePos etc
    const def = cssClasses.get(cls);
    if (def && (def.color || def["font-size"])) return cls;
  }
  return null;
}

function convertNode(node, rcss, tabInfo) {
  const { spritesheets, classes: cssClasses } = rcss;
  const style = parseInlineStyle(node.attrs.style);
  const nodeClasses = (node.attrs.class || "").split(/\s+/).filter(Boolean);
  const id = node.attrs.id;

  const x = style.left;
  const y = style.top;
  const w = style.width;
  const h = style.height;

  // Track tab buttons and pages
  if (node.attrs.tabbutton !== undefined && node.attrs.tabgroup) {
    const groupName = node.attrs.tabgroup;
    const idx = parseInt(node.attrs.tabbutton);
    if (!tabInfo.groups[groupName]) {
      tabInfo.groups[groupName] = { buttons: [], pages: [] };
    }
    tabInfo.groups[groupName].buttons[idx] = id;
  }

  if (node.attrs.tabpage !== undefined && node.attrs.tabgroup) {
    const groupName = node.attrs.tabgroup;
    const idx = parseInt(node.attrs.tabpage);
    if (!tabInfo.groups[groupName]) {
      tabInfo.groups[groupName] = { buttons: [], pages: [] };
    }
    tabInfo.groups[groupName].pages[idx] = id;
  }

  // Build the JSON element based on tag type
  const element = { name: id };

  switch (node.tag) {
    case "img": {
      const src = node.attrs.src?.replace(/\.png$/i, "") || "";
      element.image = {
        x: x || "0",
        y: y || "0",
        width: w || "0",
        height: h || "0",
        texture: src,
      };

      // Process children (page containers)
      if (node.children.length > 0) {
        element.children = [];
        for (const child of node.children) {
          if (child.tag === "head" || child.tag === "link") continue;
          const converted = convertNode(child, rcss, tabInfo);
          if (converted) element.children.push(converted);
        }
      }
      break;
    }

    case "button": {
      const sheetName = findSpritesheetClass(nodeClasses, spritesheets);
      const sheet = sheetName ? spritesheets.get(sheetName) : null;
      const indices = getButtonSpriteIndices(sheet);

      const btn = {
        x: x || "0",
        y: y || "0",
        width: w || "0",
        height: h || "0",
      };

      if (node.attrs.isToggle === "1") {
        btn.isToggle = "1";
      }

      if (sheetName) {
        btn.texture = sheetName;
        btn.tileSizeX = indices.tileW || w || "0";
        btn.tileSizeY = indices.tileH || h || "0";
        btn.normalImage = indices.normalImage || "0";
        btn.overImage = indices.overImage || "0";
        btn.downImage = indices.downImage || "1";
        if (node.attrs.isToggle === "1") {
          btn.normalImageOn = indices.normalImageOn || "1";
          btn.overImageOn = indices.overImageOn || "1";
          btn.downImageOn = indices.downImageOn || "1";
        }
      }

      element.button = btn;

      // Parameter attachment
      if (node.attrs.param) {
        element.parameterAttachment = { parameter: node.attrs.param };
      }
      break;
    }

    case "knob": {
      const knobClass = findKnobClass(nodeClasses, cssClasses);
      const knobDef = knobClass ? cssClasses.get(knobClass) : null;

      element.rotary = {};

      if (knobDef?.spriteprefix) {
        // Derive texture name: strip trailing underscore from prefix
        const prefix = knobDef.spriteprefix;
        const textureName = prefix.endsWith("_")
          ? prefix.slice(0, -1)
          : prefix;

        element.spritesheet = {
          x: x || "0",
          y: y || "0",
          width: w || "0",
          height: h || "0",
          texture: textureName,
          tileSizeX: w || "0",
          tileSizeY: h || "0",
        };
      } else {
        // Fallback: try to find a spritesheet matching a class
        const sheetName = findSpritesheetClass(nodeClasses, spritesheets);
        element.spritesheet = {
          x: x || "0",
          y: y || "0",
          width: w || "0",
          height: h || "0",
          texture: sheetName || "unknown",
          tileSizeX: w || "0",
          tileSizeY: h || "0",
        };
      }

      if (node.attrs.param) {
        element.parameterAttachment = { parameter: node.attrs.param };
      }
      break;
    }

    case "div": {
      const isLabel = nodeClasses.includes("juceLabel");
      const isTextButton = nodeClasses.includes("juceTextButton");
      const textClass = findTextClass(nodeClasses, cssClasses);
      const textDef = textClass ? cssClasses.get(textClass) : {};

      const textHeight = textDef["font-size"]
        ? stripDp(textDef["font-size"])
        : undefined;
      const color = cssColorToHex8(textDef.color);
      const alignH = cssAlignToJson(textDef["text-align"]);
      const bold = textDef["font-weight"] === "bold" ? "1" : undefined;

      // Get text content
      const text =
        node.textContent ||
        node.children.find((c) => c.textContent)?.textContent ||
        "";

      const props = {
        x: x || "0",
        y: y || "0",
        width: w || "0",
        height: h || "0",
      };

      if (text) props.text = text;
      if (textHeight) props.textHeight = textHeight;
      if (color) props.color = color;
      if (alignH) props.alignH = alignH;
      if (bold) props.bold = bold;

      if (textDef["font-family"]) {
        props.fontName = textDef["font-family"];
      }

      if (isTextButton) {
        element.textbutton = props;
      } else {
        element.label = props;
      }

      if (node.attrs.param) {
        element.parameterAttachment = { parameter: node.attrs.param };
      }
      break;
    }

    case "combo": {
      const textClass = findTextClass(nodeClasses, cssClasses);
      const textDef = textClass ? cssClasses.get(textClass) : {};

      const textHeight = textDef["font-size"]
        ? stripDp(textDef["font-size"])
        : undefined;
      const color = cssColorToHex8(textDef.color);
      const alignH = cssAlignToJson(textDef["text-align"]);

      // Get text from <combotext> child
      const comboTextNode = node.children.find((c) => c.tag === "combotext");
      const text = comboTextNode?.textContent || "";

      const props = {
        x: x || "0",
        y: y || "0",
        width: w || "0",
        height: h || "0",
      };

      if (text) props.text = text;
      if (textHeight) props.textHeight = textHeight;
      if (color) props.color = color;
      if (alignH) props.alignH = alignH;
      props.alignV = "C";

      element.combobox = props;

      if (node.attrs.param) {
        element.parameterAttachment = { parameter: node.attrs.param };
      }
      break;
    }

    default:
      // Unknown tag — skip or convert as container
      if (node.children.length > 0) {
        element.children = [];
        for (const child of node.children) {
          const converted = convertNode(child, rcss, tabInfo);
          if (converted) element.children.push(converted);
        }
      }
      return element.children ? element : null;
  }

  return element;
}

function convert(rmlText, rcssText) {
  const rcss = parseRCSS(rcssText);
  const root = parseRML(rmlText);

  if (!root) {
    throw new Error("No <body> element found in RML");
  }

  const style = parseInlineStyle(root.attrs.style);

  // Build tab info from traversal
  const tabInfo = { groups: {} };

  // Convert all children
  const children = [];
  for (const child of root.children) {
    if (child.tag === "head" || child.tag === "link") continue;
    const converted = convertNode(child, rcss, tabInfo);
    if (converted) children.push(converted);
  }

  // Build the JSON skin
  const skin = {
    name: root.attrs.id || "Root",
    root: {
      x: "0",
      y: "0",
      width: stripDp(style.width) || "0",
      height: stripDp(style.height) || "0",
      scale: root.attrs.rootScale || "0.5",
    },
  };

  // Add tab groups
  const groupNames = Object.keys(tabInfo.groups);
  if (groupNames.length > 0) {
    const mainGroup = tabInfo.groups[groupNames[0]];
    skin.tabgroup = {
      name: groupNames[0],
      buttons: mainGroup.buttons.filter(Boolean),
      pages: mainGroup.pages.filter(Boolean),
    };
  }

  skin.children = children;

  return skin;
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("Usage: node convert.mjs <skin-directory>");
    console.error("  Converts .rml + .rcss files in the directory to .json");
    process.exit(1);
  }

  const dir = args[0];
  const files = readdirSync(dir);

  const rmlFile = files.find((f) => f.endsWith(".rml"));
  const rcssFile = files.find((f) => f.endsWith(".rcss"));

  if (!rmlFile) {
    console.error(`No .rml file found in ${dir}`);
    process.exit(1);
  }
  if (!rcssFile) {
    console.error(`No .rcss file found in ${dir}`);
    process.exit(1);
  }

  console.log(`Converting: ${rmlFile} + ${rcssFile}`);

  const rmlText = readFileSync(join(dir, rmlFile), "utf8");
  const rcssText = readFileSync(join(dir, rcssFile), "utf8");

  const skin = convert(rmlText, rcssText);

  const jsonName = basename(rmlFile, ".rml") + ".json";
  const outPath = join(dir, jsonName);

  writeFileSync(outPath, JSON.stringify(skin, null, 4) + "\n");
  console.log(`Written: ${outPath}`);
  console.log(
    `  ${skin.children.length} elements, ` +
      `${skin.tabgroup ? skin.tabgroup.pages.length + " pages" : "no tabs"}`
  );
}

main();

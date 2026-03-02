import JSON5 from "json5";
import type {
  SkinDefinition,
  SkinElement,
  ElementType,
  RootConfig,
  TabGroup,
  Template,
  ParseError,
  ParseResult,
  ImageProps,
  ButtonProps,
  LabelProps,
  SpritesheetProps,
  ComboboxProps,
  TextbuttonProps,
  ElementPosition,
} from "./types";

export function parseSkin(jsonText: string): ParseResult {
  const errors: ParseError[] = [];
  let raw: Record<string, unknown>;
  try {
    raw = JSON5.parse(jsonText);
  } catch (e) {
    return {
      skin: emptyDefinition(),
      errors: [{ path: "root", message: `JSON5 parse error: ${e}` }],
    };
  }

  const root = parseRoot(
    raw.root as Record<string, string> | undefined,
    errors,
  );
  const tabgroup = parseTabGroup(
    raw.tabgroup as Record<string, unknown> | undefined,
  );
  const templates = Array.isArray(raw.templates)
    ? (raw.templates as Template[])
    : [];
  const pageNames = new Set(tabgroup?.pages ?? []);

  const children = Array.isArray(raw.children)
    ? raw.children.map((c: unknown, i: number) =>
        parseElement(
          c as Record<string, unknown>,
          `children[${i}]`,
          pageNames,
          templates,
          errors,
        ),
      )
    : [];

  return {
    skin: {
      name: typeof raw.name === "string" ? raw.name : "Untitled",
      root,
      tabgroup,
      templates,
      children,
    },
    errors,
  };
}

function emptyDefinition(): SkinDefinition {
  return {
    name: "Empty",
    root: { x: 0, y: 0, width: 800, height: 600, scale: 1 },
    tabgroup: null,
    templates: [],
    children: [],
  };
}

function parseRoot(
  raw: Record<string, string> | undefined,
  errors: ParseError[],
): RootConfig {
  if (!raw) {
    errors.push({
      path: "root",
      message: "Missing root config, using defaults",
    });
    return { x: 0, y: 0, width: 800, height: 600, scale: 1 };
  }
  return {
    x: num(raw.x, 0),
    y: num(raw.y, 0),
    width: num(raw.width, 800),
    height: num(raw.height, 600),
    scale: num(raw.scale, 1),
  };
}

function parseTabGroup(
  raw: Record<string, unknown> | undefined,
): TabGroup | null {
  if (!raw) return null;
  return {
    name: typeof raw.name === "string" ? raw.name : "pages",
    buttons: Array.isArray(raw.buttons) ? (raw.buttons as string[]) : [],
    pages: Array.isArray(raw.pages) ? (raw.pages as string[]) : [],
  };
}

function parseElement(
  raw: Record<string, unknown>,
  path: string,
  pageNames: Set<string>,
  templates: Template[],
  errors: ParseError[],
): SkinElement {
  const name = typeof raw.name === "string" ? raw.name : "";
  const _type = detectType(raw);
  const _page = pageNames.has(name) ? name : null;
  const element: SkinElement = { name, _type, _page };

  if (raw.image)
    element.image = parseImageProps(raw.image as Record<string, string>);
  if (raw.button)
    element.button = parseButtonProps(raw.button as Record<string, string>);
  if (raw.label) {
    const tpl = findTemplate(templates, "label");
    element.label = parseLabelProps(
      mergeProps(tpl, raw.label as Record<string, string>),
    );
  }
  if (raw.rotary !== undefined) element.rotary = {};
  if (raw.spritesheet)
    element.spritesheet = parseSpritesheetProps(
      raw.spritesheet as Record<string, string>,
    );
  if (raw.combobox)
    element.combobox = parseComboboxProps(
      raw.combobox as Record<string, string>,
    );
  if (raw.textbutton)
    element.textbutton = parseTextbuttonProps(
      raw.textbutton as Record<string, string>,
    );
  if (raw.container)
    element.container = parsePosition(
      raw.container as Record<string, string>,
    );
  if (raw.component)
    element.component = parsePosition(
      raw.component as Record<string, string>,
    );
  if (raw.condition) {
    const c = raw.condition as Record<string, string>;
    element.condition = {
      enableOnParameter: c.enableOnParameter ?? "",
      enableOnValues: c.enableOnValues ?? "",
    };
  }
  if (raw.parameterAttachment) {
    const pa = raw.parameterAttachment as Record<string, string>;
    element.parameterAttachment = { parameter: pa.parameter ?? "" };
  }

  if (Array.isArray(raw.children)) {
    element.children = raw.children.map((c: unknown, i: number) =>
      parseElement(
        c as Record<string, unknown>,
        `${path}.children[${i}]`,
        pageNames,
        templates,
        errors,
      ),
    );
  }

  return element;
}

function detectType(raw: Record<string, unknown>): ElementType {
  if (raw.image) return "image";
  if (raw.button) return "button";
  if (raw.label) return "label";
  if (raw.rotary !== undefined) return "rotary";
  if (raw.combobox) return "combobox";
  if (raw.textbutton) return "textbutton";
  if (raw.container) return "container";
  if (raw.component) return "component";
  return "unknown";
}

function findTemplate(
  _templates: Template[],
  _type: string,
): Record<string, string> | null {
  // Templates can be used as defaults -- simplified for now
  return null;
}

function mergeProps(
  template: Record<string, string> | null,
  props: Record<string, string>,
): Record<string, string> {
  if (!template) return props;
  return { ...template, ...props };
}

function parsePosition(raw: Record<string, string>): ElementPosition {
  return {
    x: num(raw.x, 0),
    y: num(raw.y, 0),
    width: num(raw.width, 0),
    height: num(raw.height, 0),
  };
}

function parseImageProps(raw: Record<string, string>): ImageProps {
  return { ...parsePosition(raw), texture: raw.texture ?? "" };
}

function parseButtonProps(raw: Record<string, string>): ButtonProps {
  return {
    ...parsePosition(raw),
    texture: raw.texture ?? "",
    tileSizeX: num(raw.tileSizeX, 0),
    tileSizeY: num(raw.tileSizeY, 0),
    isToggle: raw.isToggle === "1",
    radioGroupId: raw.radioGroupId ?? "",
    normalImage: num(raw.normalImage, 0),
    overImage: num(raw.overImage, 0),
    downImage: num(raw.downImage, 0),
    normalImageOn: num(raw.normalImageOn, 0),
    overImageOn: num(raw.overImageOn, 0),
    downImageOn: num(raw.downImageOn, 0),
  };
}

function parseLabelProps(raw: Record<string, string>): LabelProps {
  return {
    ...parsePosition(raw),
    text: raw.text ?? "",
    textHeight: num(raw.textHeight, 14),
    color: normalizeColor(raw.color),
    backgroundColor: raw.backgroundColor
      ? normalizeColor(raw.backgroundColor)
      : "",
    alignH: (raw.alignH as "L" | "C" | "R") ?? "L",
    alignV: (raw.alignV as "T" | "C" | "B") ?? "C",
    bold: raw.bold === "1",
    fontFile: raw.fontFile ?? "",
  };
}

function parseSpritesheetProps(
  raw: Record<string, string>,
): SpritesheetProps {
  return {
    ...parsePosition(raw),
    texture: raw.texture ?? "",
    tileSizeX: num(raw.tileSizeX, 0),
    tileSizeY: num(raw.tileSizeY, 0),
  };
}

function parseComboboxProps(raw: Record<string, string>): ComboboxProps {
  return {
    ...parsePosition(raw),
    text: raw.text ?? "",
    textHeight: num(raw.textHeight, 14),
    color: normalizeColor(raw.color),
    alignH: (raw.alignH as "L" | "C" | "R") ?? "L",
    alignV: (raw.alignV as "T" | "C" | "B") ?? "C",
    tooltip: raw.tooltip ?? "",
  };
}

function parseTextbuttonProps(raw: Record<string, string>): TextbuttonProps {
  return {
    ...parsePosition(raw),
    text: raw.text ?? "",
    textHeight: num(raw.textHeight, 14),
    color: normalizeColor(raw.color),
    alignH: (raw.alignH as "L" | "C" | "R") ?? "L",
    alignV: (raw.alignV as "T" | "C" | "B") ?? "C",
  };
}

function num(value: unknown, fallback: number): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = parseFloat(value);
    return Number.isNaN(n) ? fallback : n;
  }
  return fallback;
}

export function normalizeColor(color: unknown): string {
  if (typeof color !== "string" || color.length < 6) return "transparent";
  const hex = color.replace(/^#/, "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const a = hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
  if ([r, g, b].some((v) => Number.isNaN(v))) return "transparent";
  return `rgba(${r}, ${g}, ${b}, ${Number.isNaN(a) ? 1 : a.toFixed(3)})`;
}

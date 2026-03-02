// src/lib/types.ts

/** Parsed + normalized skin definition */
export interface SkinDefinition {
  name: string;
  root: RootConfig;
  tabgroup: TabGroup | null;
  templates: Template[];
  children: SkinElement[];
}

export interface RootConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

export interface TabGroup {
  name: string;
  buttons: string[];
  pages: string[];
}

export interface Template {
  name: string;
  [key: string]: unknown;
}

export type ElementType =
  | "image"
  | "button"
  | "label"
  | "rotary"
  | "combobox"
  | "textbutton"
  | "container"
  | "component"
  | "unknown";

export interface ElementPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageProps extends ElementPosition {
  texture: string;
}

export interface ButtonProps extends ElementPosition {
  texture: string;
  tileSizeX: number;
  tileSizeY: number;
  isToggle: boolean;
  radioGroupId: string;
  normalImage: number;
  overImage: number;
  downImage: number;
  normalImageOn: number;
  overImageOn: number;
  downImageOn: number;
  disabledImage: number;
  disabledImageOn: number;
}

export interface LabelProps extends ElementPosition {
  text: string;
  textHeight: number;
  color: string;
  backgroundColor: string;
  alignH: "L" | "C" | "R";
  alignV: "T" | "C" | "B";
  bold: boolean;
  fontFile: string;
}

export interface SpritesheetProps extends ElementPosition {
  texture: string;
  tileSizeX: number;
  tileSizeY: number;
}

export interface ComboboxProps extends ElementPosition {
  text: string;
  textHeight: number;
  color: string;
  alignH: "L" | "C" | "R";
  alignV: "T" | "C" | "B";
  tooltip: string;
  fontFile: string;
}

export interface TextbuttonProps extends ElementPosition {
  text: string;
  textHeight: number;
  color: string;
  alignH: "L" | "C" | "R";
  alignV: "T" | "C" | "B";
}

export interface ConditionProps {
  enableOnParameter: string;
  enableOnValues: string;
}

export interface ParameterAttachment {
  parameter: string;
}

export interface SkinElement {
  name: string;
  _type: ElementType;
  _page: string | null;
  image?: ImageProps;
  button?: ButtonProps;
  label?: LabelProps;
  rotary?: Record<string, never>;
  spritesheet?: SpritesheetProps;
  combobox?: ComboboxProps;
  textbutton?: TextbuttonProps;
  container?: ElementPosition;
  component?: ElementPosition;
  condition?: ConditionProps;
  parameterAttachment?: ParameterAttachment;
  children?: SkinElement[];
}

export interface ParseError {
  path: string;
  message: string;
}

export interface ParseResult {
  skin: SkinDefinition;
  errors: ParseError[];
}

export interface RenderState {
  activeTab: string;
  hoveredElement: string | null;
  scrubFrames: Record<string, number>;
  debugMode: boolean;
  images: Record<string, HTMLImageElement>;
}

export interface AssetLoadProgress {
  loaded: number;
  total: number;
}

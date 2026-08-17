// src/shared/types/shorthand-types.ts

// Fix #1: Simple union — no distributive conditional. Runtime classifier
// already checks typeof value === 'function' before CSS validity.
type Dynamic<T> = T | (() => T);

// Fix #2: Every property now accepts Dynamic<...> for mixed mode
// Fix #5: Added missing modern CSS properties used by macros

// ============================================================================
// Shorthand Method Types — ChainCSS
// ============================================================================

// ----------------------------------------------------------------------------
// Grid
// ----------------------------------------------------------------------------

export interface GridOptions {
  columns?: Dynamic<string | number>;
  rows?: Dynamic<string | number>;
  gap?: Dynamic<string | number>;
  columnGap?: Dynamic<string | number>;
  rowGap?: Dynamic<string | number>;
  area?: Dynamic<string>;
  autoFlow?: Dynamic<"row" | "column" | "dense" | "row dense" | "column dense">;
  autoColumns?: Dynamic<string | number>;
  autoRows?: Dynamic<string | number>;
  template?: Dynamic<string>;
  // Fix #5: Missing modern grid properties
  placeItems?: Dynamic<"stretch" | "center" | "start" | "end">;
  placeContent?: Dynamic<string>;
  justifyItems?: Dynamic<"stretch" | "center" | "start" | "end">;
  // Short aliases
  c?: Dynamic<string | number>;
  r?: Dynamic<string | number>;
  g?: Dynamic<string | number>;
  a?: Dynamic<string>;
}

// ----------------------------------------------------------------------------
// Flex
// ----------------------------------------------------------------------------

export interface FlexOptions {
  direction?: Dynamic<"row" | "row-reverse" | "column" | "column-reverse">;
  wrap?: Dynamic<"nowrap" | "wrap" | "wrap-reverse">;
  grow?: Dynamic<number>;
  shrink?: Dynamic<number>;
  basis?: Dynamic<string | number>;
  align?: Dynamic<"stretch" | "center" | "flex-start" | "flex-end" | "baseline">;
  justify?: Dynamic<
    "flex-start" | "flex-end" | "center" | "space-between" | "space-around" | "space-evenly"
  >;
  alignContent?: Dynamic<
    "stretch" | "center" | "flex-start" | "flex-end" | "space-between" | "space-around"
  >;
  alignSelf?: Dynamic<
    "auto" | "stretch" | "center" | "flex-start" | "flex-end" | "baseline"
  >;
  gap?: Dynamic<string | number>;
  // Short aliases
  d?: Dynamic<"row" | "row-reverse" | "column" | "column-reverse">;
  w?: Dynamic<"nowrap" | "wrap" | "wrap-reverse">;
  gr?: Dynamic<number>;
  sh?: Dynamic<number>;
  b?: Dynamic<string | number>;
  ai?: Dynamic<"stretch" | "center" | "flex-start" | "flex-end" | "baseline">;
  jc?: Dynamic<
    "flex-start" | "flex-end" | "center" | "space-between" | "space-around" | "space-evenly"
  >;
  f?: Dynamic<string>;
}

// ----------------------------------------------------------------------------
// Animation
// ----------------------------------------------------------------------------

export interface AnimationOptions {
  name?: Dynamic<string>;
  duration?: Dynamic<string>;
  timing?: Dynamic<string>;
  delay?: Dynamic<string>;
  iterationCount?: Dynamic<number | "infinite">;
  direction?: Dynamic<"normal" | "reverse" | "alternate" | "alternate-reverse">;
  fillMode?: Dynamic<"none" | "forwards" | "backwards" | "both">;
  playState?: Dynamic<"running" | "paused">;
  // Short aliases
  n?: Dynamic<string>;
  d?: Dynamic<string>;
  t?: Dynamic<string>;
  dl?: Dynamic<string>;
  i?: Dynamic<number | "infinite">;
  a?: Dynamic<string>;
}

// ----------------------------------------------------------------------------
// Background
// ----------------------------------------------------------------------------

export interface BackgroundOptions {
  color?: Dynamic<string>;
  image?: Dynamic<string>;
  position?: Dynamic<string>;
  size?: Dynamic<string>;
  repeat?: Dynamic<string>;
  attachment?: Dynamic<string>;
  origin?: Dynamic<string>;
  clip?: Dynamic<string>;
  blendMode?: Dynamic<string>;
  // Short aliases
  c?: Dynamic<string>;
  i?: Dynamic<string>;
  p?: Dynamic<string>;
  s?: Dynamic<string>;
  r?: Dynamic<string>;
  bg?: Dynamic<string>;
}

// ----------------------------------------------------------------------------
// Typography
// ----------------------------------------------------------------------------

export interface TypographyOptions {
  fontFamily?: Dynamic<string>;
  fontSize?: Dynamic<string | number>;
  fontWeight?: Dynamic<string | number>;
  fontStyle?: Dynamic<"normal" | "italic" | "oblique">;
  lineHeight?: Dynamic<string | number>;
  letterSpacing?: Dynamic<string | number>;
  textAlign?: Dynamic<"left" | "right" | "center" | "justify" | "start" | "end">;
  textTransform?: Dynamic<"none" | "uppercase" | "lowercase" | "capitalize">;
  textDecoration?: Dynamic<string>;
  textIndent?: Dynamic<string | number>;
  wordSpacing?: Dynamic<string | number>;
  whiteSpace?: Dynamic<
    "normal" | "nowrap" | "pre" | "pre-wrap" | "pre-line" | "break-spaces"
  >;
  wordBreak?: Dynamic<"normal" | "break-all" | "keep-all" | "break-word">;
  color?: Dynamic<string>;
  opacity?: Dynamic<string | number>;
  // Fix #5: Missing modern typography
  textOverflow?: Dynamic<"clip" | "ellipsis">;
  lineClamp?: Dynamic<number>;
  textWrap?: Dynamic<"wrap" | "nowrap" | "balance" | "pretty">;
  // Short aliases
  ff?: Dynamic<string>;
  fs?: Dynamic<string | number>;
  fw?: Dynamic<string | number>;
  lh?: Dynamic<string | number>;
  ta?: Dynamic<"left" | "right" | "center" | "justify" | "start" | "end">;
  tt?: Dynamic<"none" | "uppercase" | "lowercase" | "capitalize">;
  f?: Dynamic<string>;
}

// ----------------------------------------------------------------------------
// Box
// ----------------------------------------------------------------------------

export interface BoxOptions {
  margin?: Dynamic<string | number>;
  marginTop?: Dynamic<string | number>;
  marginRight?: Dynamic<string | number>;
  marginBottom?: Dynamic<string | number>;
  marginLeft?: Dynamic<string | number>;
  padding?: Dynamic<string | number>;
  paddingTop?: Dynamic<string | number>;
  paddingRight?: Dynamic<string | number>;
  paddingBottom?: Dynamic<string | number>;
  paddingLeft?: Dynamic<string | number>;
  border?: Dynamic<string>;
  borderRadius?: Dynamic<string | number>;
  borderWidth?: Dynamic<string | number>;
  borderColor?: Dynamic<string>;
  borderStyle?: Dynamic<string>;
  borderTop?: Dynamic<string>;
  borderRight?: Dynamic<string>;
  borderBottom?: Dynamic<string>;
  borderLeft?: Dynamic<string>;
  width?: Dynamic<string | number>;
  minWidth?: Dynamic<string | number>;
  maxWidth?: Dynamic<string | number>;
  height?: Dynamic<string | number>;
  minHeight?: Dynamic<string | number>;
  maxHeight?: Dynamic<string | number>;
  overflow?: Dynamic<string>;
  overflowX?: Dynamic<string>;
  overflowY?: Dynamic<string>;
  // Fix #5: Missing modern box properties
  boxSizing?: Dynamic<"content-box" | "border-box">;
  aspectRatio?: Dynamic<string | number>;
  // Short aliases
  m?: Dynamic<string | number>;
  p?: Dynamic<string | number>;
  br?: Dynamic<string | number>;
  w?: Dynamic<string | number>;
  h?: Dynamic<string | number>;
}

// ----------------------------------------------------------------------------
// Position
// ----------------------------------------------------------------------------

export interface PositionOptions {
  type?: Dynamic<"static" | "relative" | "absolute" | "fixed" | "sticky">;
  top?: Dynamic<string | number>;
  right?: Dynamic<string | number>;
  bottom?: Dynamic<string | number>;
  left?: Dynamic<string | number>;
  inset?: Dynamic<string | number>;
  zIndex?: Dynamic<number>;
  // Short aliases
  t?: Dynamic<"static" | "relative" | "absolute" | "fixed" | "sticky">;
  z?: Dynamic<number>;
}

// ----------------------------------------------------------------------------
// Transition
// ----------------------------------------------------------------------------

export interface TransitionOptions {
  property?: Dynamic<string>;
  duration?: Dynamic<string>;
  timing?: Dynamic<string>;
  delay?: Dynamic<string>;
  behavior?: Dynamic<string>;
  // Short aliases
  p?: Dynamic<string>;
  d?: Dynamic<string>;
  t?: Dynamic<string>;
  tr?: Dynamic<string>;
}

// ----------------------------------------------------------------------------
// Transform
// ----------------------------------------------------------------------------

export interface TransformOptions {
  translate?: Dynamic<string>;
  translateX?: Dynamic<string | number>;
  translateY?: Dynamic<string | number>;
  translateZ?: Dynamic<string | number>;
  scale?: Dynamic<number>;
  scaleX?: Dynamic<number>;
  scaleY?: Dynamic<number>;
  rotate?: Dynamic<string>;
  skew?: Dynamic<string>;
  skewX?: Dynamic<string>;
  skewY?: Dynamic<string>;
  origin?: Dynamic<string>;
}

// ----------------------------------------------------------------------------
// Filter / Effects
// ----------------------------------------------------------------------------

export interface FilterOptions {
  blur?: Dynamic<string | number>;
  brightness?: Dynamic<string | number>;
  contrast?: Dynamic<string | number>;
  grayscale?: Dynamic<string | number>;
  hueRotate?: Dynamic<string>;
  invert?: Dynamic<string | number>;
  filterOpacity?: Dynamic<string | number>;
  saturate?: Dynamic<string | number>;
  sepia?: Dynamic<string | number>;
  dropShadow?: Dynamic<string>;
  backdrop?: Dynamic<string>;
}

// ----------------------------------------------------------------------------
// Shadow
// ----------------------------------------------------------------------------

export interface ShadowOptions {
  box?: Dynamic<string>;
  text?: Dynamic<string>;
  color?: Dynamic<string>;
  x?: Dynamic<string | number>;
  y?: Dynamic<string | number>;
  blur?: Dynamic<string | number>;
  spread?: Dynamic<string | number>;
  inset?: Dynamic<boolean>;
}

// ----------------------------------------------------------------------------
// Container / Aspect
// ----------------------------------------------------------------------------

export interface ContainerOptions {
  type?: Dynamic<"normal" | "size" | "inline-size">;
  name?: Dynamic<string>;
}

// Fix #3: AspectOptions is now wired to ChainShorthandMethods
export interface AspectOptions {
  ratio?: Dynamic<string | number>;
  objectFit?: Dynamic<"fill" | "contain" | "cover" | "none" | "scale-down">;
  objectPosition?: Dynamic<string>;
}

// ----------------------------------------------------------------------------
// Outline
// ----------------------------------------------------------------------------

export interface OutlineOptions {
  width?: Dynamic<string | number>;
  style?: Dynamic<
    "none" | "solid" | "dashed" | "dotted" | "double" | "groove" | "ridge" | "inset" | "outset"
  >;
  color?: Dynamic<string>;
  offset?: Dynamic<string | number>;
  // Short aliases
  w?: Dynamic<string | number>;
  s?: Dynamic<
    "none" | "solid" | "dashed" | "dotted" | "double" | "groove" | "ridge" | "inset" | "outset"
  >;
  c?: Dynamic<string>;
  o?: Dynamic<string>;
}

// ----------------------------------------------------------------------------
// Scroll
// ----------------------------------------------------------------------------

export interface ScrollOptions {
  behavior?: Dynamic<"auto" | "smooth">;
  snapType?: Dynamic<
    "none" | "x mandatory" | "y mandatory" | "x proximity" | "y proximity" | "both mandatory" | "both proximity"
  >;
  snapAlign?: Dynamic<"none" | "start" | "center" | "end">;
  snapStop?: Dynamic<"normal" | "always">;
  margin?: Dynamic<string | number>;
  marginTop?: Dynamic<string | number>;
  marginRight?: Dynamic<string | number>;
  marginBottom?: Dynamic<string | number>;
  marginLeft?: Dynamic<string | number>;
  padding?: Dynamic<string | number>;
  paddingTop?: Dynamic<string | number>;
  paddingRight?: Dynamic<string | number>;
  paddingBottom?: Dynamic<string | number>;
  paddingLeft?: Dynamic<string | number>;
  scrollbarWidth?: Dynamic<"auto" | "thin" | "none">;
  scrollbarColor?: Dynamic<string>;
  overflowX?: Dynamic<"visible" | "hidden" | "scroll" | "auto">;
  overflowY?: Dynamic<"visible" | "hidden" | "scroll" | "auto">;
  // Short aliases
  b?: Dynamic<"auto" | "smooth">;
}

// ----------------------------------------------------------------------------
// List
// ----------------------------------------------------------------------------

export interface ListOptions {
  style?: Dynamic<
    "none" | "disc" | "circle" | "square" | "decimal" | "decimal-leading-zero"
    | "lower-roman" | "upper-roman" | "lower-alpha" | "upper-alpha" | string
  >;
  position?: Dynamic<"inside" | "outside">;
  image?: Dynamic<string>;
  list?: Dynamic<string>;
}
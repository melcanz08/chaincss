// src/core/shorthand-types.ts
type Dynamic<T> = T extends Function ? T : T | (() => T);


// ============================================================================
// Shorthand Method Types — ChainCSS
// ============================================================================
// These types define the options objects for shorthand methods.
// Each shorthand expands to multiple CSS properties in a single call.
// ============================================================================

// ----------------------------------------------------------------------------
// Grid
// ----------------------------------------------------------------------------

export interface GridOptions {
  /** grid-template-columns */
  columns?: Dynamic<string | number>;
  /** grid-template-rows */
  rows?: Dynamic<string | number>;
  /** gap (applies to both row-gap and column-gap) */
  gap?: Dynamic<string | number>;
  /** column-gap */
  columnGap?: Dynamic<string | number>;
  /** row-gap */
  rowGap?: Dynamic<string | number>;
  /** grid-area */
  area?: Dynamic<string>;
  /** grid-auto-flow */
  autoFlow?: 'row' | 'column' | 'dense' | 'row dense' | 'column dense';
  /** grid-auto-columns */
  autoColumns?: Dynamic<string | number>;
  /** grid-auto-rows */
  autoRows?: Dynamic<string | number>;
  /** grid-template (shorthand) */
  template?: Dynamic<string>;
  // Short aliases
  /** Alias for columns */
  c?: Dynamic<string | number>;
  /** Alias for rows */
  r?: Dynamic<string | number>;
  /** Alias for gap */
  g?: Dynamic<string | number>;
  /** Alias for area */
  a?: Dynamic<string>;
}

// ----------------------------------------------------------------------------
// Flex
// ----------------------------------------------------------------------------

export interface FlexOptions {
  /** flex-direction */
  direction?: 'row' | 'row-reverse' | 'column' | 'column-reverse';
  /** flex-wrap */
  wrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  /** flex-grow */
  grow?: Dynamic<number>;
  /** flex-shrink */
  shrink?: Dynamic<number>;
  /** flex-basis */
  basis?: Dynamic<string | number>;
  /** align-items */
  align?: 'stretch' | 'center' | 'flex-start' | 'flex-end' | 'baseline';
  /** justify-content */
  justify?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  /** align-content */
  alignContent?: 'stretch' | 'center' | 'flex-start' | 'flex-end' | 'space-between' | 'space-around';
  /** align-self */
  alignSelf?: 'auto' | 'stretch' | 'center' | 'flex-start' | 'flex-end' | 'baseline';
  /** gap (flex gap) */
  gap?: Dynamic<string | number>;
  // Short aliases
  /** Alias for direction */
  d?: 'row' | 'row-reverse' | 'column' | 'column-reverse';
  /** Alias for wrap */
  w?: 'nowrap' | 'wrap' | 'wrap-reverse';
  /** Alias for grow */
  gr?: Dynamic<number>;
  /** Alias for shrink */
  sh?: Dynamic<number>;
  /** Alias for basis */
  b?: Dynamic<string | number>;
  /** Alias for align */
  ai?: 'stretch' | 'center' | 'flex-start' | 'flex-end' | 'baseline';
  /** Alias for justify */
  jc?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  /** flex shorthand (grow shrink basis) */
  f?: Dynamic<string>;
}

// ----------------------------------------------------------------------------
// Animation
// ----------------------------------------------------------------------------

export interface AnimationOptions {
  /** animation-name */
  name?: Dynamic<string>;
  /** animation-duration */
  duration?: Dynamic<string>;
  /** animation-timing-function */
  timing?: Dynamic<string>;
  /** animation-delay */
  delay?: Dynamic<string>;
  /** animation-iteration-count */
  iterationCount?: number | 'infinite';
  /** animation-direction */
  direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
  /** animation-fill-mode */
  fillMode?: 'none' | 'forwards' | 'backwards' | 'both';
  /** animation-play-state */
  playState?: 'running' | 'paused';
  // Short aliases
  /** Alias for name */
  n?: Dynamic<string>;
  /** Alias for duration */
  d?: Dynamic<string>;
  /** Alias for timing */
  t?: Dynamic<string>;
  /** Alias for delay */
  dl?: Dynamic<string>;
  /** Alias for iterationCount */
  i?: number | 'infinite';
  /** animation shorthand */
  a?: Dynamic<string>;
}

// ----------------------------------------------------------------------------
// Background
// ----------------------------------------------------------------------------

export interface BackgroundOptions {
  /** background-color */
  color?: Dynamic<string>;
  /** background-image */
  image?: Dynamic<string>;
  /** background-position */
  position?: Dynamic<string>;
  /** background-size */
  size?: Dynamic<string>;
  /** background-repeat */
  repeat?: Dynamic<string>;
  /** background-attachment */
  attachment?: Dynamic<string>;
  /** background-origin */
  origin?: Dynamic<string>;
  /** background-clip */
  clip?: Dynamic<string>;
  /** background-blend-mode */
  blendMode?: Dynamic<string>;
  // Short aliases
  /** Alias for color */
  c?: Dynamic<string>;
  /** Alias for image */
  i?: Dynamic<string>;
  /** Alias for position */
  p?: Dynamic<string>;
  /** Alias for size */
  s?: Dynamic<string>;
  /** Alias for repeat */
  r?: Dynamic<string>;
  /** background shorthand */
  bg?: Dynamic<string>;
}

// ----------------------------------------------------------------------------
// Typography
// ----------------------------------------------------------------------------

export interface TypographyOptions {
  /** font-family */
  fontFamily?: Dynamic<string>;
  /** font-size */
  fontSize?: Dynamic<string | number>;
  /** font-weight */
  fontWeight?: Dynamic<string | number>;
  /** font-style */
  fontStyle?: 'normal' | 'italic' | 'oblique';
  /** line-height */
  lineHeight?: Dynamic<string | number>;
  /** letter-spacing */
  letterSpacing?: Dynamic<string | number>;
  /** text-align */
  textAlign?: 'left' | 'right' | 'center' | 'justify' | 'start' | 'end';
  /** text-transform */
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  /** text-decoration */
  textDecoration?: Dynamic<string>;
  /** text-indent */
  textIndent?: Dynamic<string | number>;
  /** word-spacing */
  wordSpacing?: Dynamic<string | number>;
  /** white-space */
  whiteSpace?: 'normal' | 'nowrap' | 'pre' | 'pre-wrap' | 'pre-line' | 'break-spaces';
  /** overflow-wrap / word-break handling */
  wordBreak?: 'normal' | 'break-all' | 'keep-all' | 'break-word';
   /** text color */
  color?: Dynamic<string>;
  /** opacity */
  opacity?: Dynamic<string | number>;
  // Short aliases
  /** Alias for fontFamily */
  ff?: Dynamic<string>;
  /** Alias for fontSize */
  fs?: Dynamic<string | number>;
  /** Alias for fontWeight */
  fw?: Dynamic<string | number>;
  /** Alias for lineHeight */
  lh?: Dynamic<string | number>;
  /** Alias for textAlign */
  ta?: 'left' | 'right' | 'center' | 'justify' | 'start' | 'end';
  /** Alias for textTransform */
  tt?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  /** font shorthand */
  f?: Dynamic<string>;
}

// ----------------------------------------------------------------------------
// Box (margin, padding, border, dimensions)
// ----------------------------------------------------------------------------

export interface BoxOptions {
  /** margin (shorthand or single value) */
  margin?: Dynamic<string | number>;
  /** margin-top */
  marginTop?: Dynamic<string | number>;
  /** margin-right */
  marginRight?: Dynamic<string | number>;
  /** margin-bottom */
  marginBottom?: Dynamic<string | number>;
  /** margin-left */
  marginLeft?: Dynamic<string | number>;
  /** padding (shorthand or single value) */
  padding?: Dynamic<string | number>;
  /** padding-top */
  paddingTop?: Dynamic<string | number>;
  /** padding-right */
  paddingRight?: Dynamic<string | number>;
  /** padding-bottom */
  paddingBottom?: Dynamic<string | number>;
  /** padding-left */
  paddingLeft?: Dynamic<string | number>;
  /** border (shorthand) */
  border?: Dynamic<string>;
  /** border-radius */
  borderRadius?: Dynamic<string | number>;
  /** border-width */
  borderWidth?: Dynamic<string | number>;
  /** border-color */
  borderColor?: Dynamic<string>;
  /** border-style */
  borderStyle?: Dynamic<string>;
  /** border-top */
  borderTop?: Dynamic<string>;
  /** border-right */
  borderRight?: Dynamic<string>;
  /** border-bottom */
  borderBottom?: Dynamic<string>;
  /** border-left */
  borderLeft?: Dynamic<string>;
  /** width */
  width?: Dynamic<string | number>;
  /** min-width */
  minWidth?: Dynamic<string | number>;
  /** max-width */
  maxWidth?: Dynamic<string | number>;
  /** height */
  height?: Dynamic<string | number>;
  /** min-height */
  minHeight?: Dynamic<string | number>;
  /** max-height */
  maxHeight?: Dynamic<string | number>;
  /** overflow */
  overflow?: Dynamic<string>;
  /** overflow-x */
  overflowX?: Dynamic<string>;
  /** overflow-y */
  overflowY?: Dynamic<string>;
  // Short aliases
  /** Alias for margin */
  m?: Dynamic<string | number>;
  /** Alias for padding */
  p?: Dynamic<string | number>;
  /** Alias for borderRadius */
  br?: Dynamic<string | number>;
  /** Alias for width */
  w?: Dynamic<string | number>;
  /** Alias for height */
  h?: Dynamic<string | number>;
}

// ----------------------------------------------------------------------------
// Position
// ----------------------------------------------------------------------------

export interface PositionOptions {
  /** position */
  type?: 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky';
  /** top */
  top?: Dynamic<string | number>;
  /** right */
  right?: Dynamic<string | number>;
  /** bottom */
  bottom?: Dynamic<string | number>;
  /** left */
  left?: Dynamic<string | number>;
  /** inset (shorthand for top/right/bottom/left) */
  inset?: Dynamic<string | number>;
  /** z-index */
  zIndex?: Dynamic<number>;
  // Short aliases
  /** Alias for type */
  t?: 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky';
  /** Alias for zIndex */
  z?: Dynamic<number>;
}

// ----------------------------------------------------------------------------
// Transition
// ----------------------------------------------------------------------------

export interface TransitionOptions {
  /** transition-property */
  property?: Dynamic<string>;
  /** transition-duration */
  duration?: Dynamic<string>;
  /** transition-timing-function */
  timing?: Dynamic<string>;
  /** transition-delay */
  delay?: Dynamic<string>;
  /** transition-behavior */
  behavior?: Dynamic<string>;
  // Short aliases
  /** Alias for property */
  p?: Dynamic<string>;
  /** Alias for duration */
  d?: Dynamic<string>;
  /** Alias for timing */
  t?: Dynamic<string>;
  /** transition shorthand */
  tr?: Dynamic<string>;
}

// ----------------------------------------------------------------------------
// Transform
// ----------------------------------------------------------------------------

export interface TransformOptions {
  /** translate */
  translate?: Dynamic<string>;
  /** translateX */
  translateX?: Dynamic<string | number>;
  /** translateY */
  translateY?: Dynamic<string | number>;
  /** translateZ */
  translateZ?: Dynamic<string | number>;
  /** scale */
  scale?: Dynamic<number>;
  /** scaleX */
  scaleX?: Dynamic<number>;
  /** scaleY */
  scaleY?: Dynamic<number>;
  /** rotate */
  rotate?: Dynamic<string>;
  /** skew */
  skew?: Dynamic<string>;
  /** skewX */
  skewX?: Dynamic<string>;
  /** skewY */
  skewY?: Dynamic<string>;
  /** transform-origin */
  origin?: Dynamic<string>;
  /** raw transform string for complex transforms */
  custom?: Dynamic<string>;
}

// ----------------------------------------------------------------------------
// Filter / Effects
// ----------------------------------------------------------------------------

export interface FilterOptions {
  /** filter: blur() */
  blur?: Dynamic<string | number>;
  /** filter: brightness() */
  brightness?: Dynamic<string | number>;
  /** filter: contrast() */
  contrast?: Dynamic<string | number>;
  /** filter: grayscale() */
  grayscale?: Dynamic<string | number>;
  /** filter: hue-rotate() */
  hueRotate?: Dynamic<string>;
  /** filter: invert() */
  invert?: Dynamic<string | number>;
  /** filter: opacity() */
  filterOpacity?: Dynamic<string | number>;
  /** filter: saturate() */
  saturate?: Dynamic<string | number>;
  /** filter: sepia() */
  sepia?: Dynamic<string | number>;
  /** filter: drop-shadow() */
  dropShadow?: Dynamic<string>;
  /** backdrop-filter */
  backdrop?: Dynamic<string>;
  /** raw filter string */
  custom?: Dynamic<string>;
}

// ----------------------------------------------------------------------------
// Shadow
// ----------------------------------------------------------------------------

export interface ShadowOptions {
  /** box-shadow */
  box?: Dynamic<string>;
  /** text-shadow */
  text?: Dynamic<string>;
  /** box-shadow color */
  color?: Dynamic<string>;
  /** box-shadow offset-x */
  x?: Dynamic<string | number>;
  /** box-shadow offset-y */
  y?: Dynamic<string | number>;
  /** box-shadow blur */
  blur?: Dynamic<string | number>;
  /** box-shadow spread */
  spread?: Dynamic<string | number>;
  /** inset shadow */
  inset?: boolean;
}

// ----------------------------------------------------------------------------
// Container / Aspect
// ----------------------------------------------------------------------------

export interface ContainerOptions {
  /** container-type */
  type?: 'normal' | 'size' | 'inline-size';
  /** container-name */
  name?: Dynamic<string>;
}

export interface AspectOptions {
  /** aspect-ratio */
  ratio?: Dynamic<string | number>;
  /** object-fit */
  objectFit?: 'fill' | 'contain' | 'cover' | 'none' | 'scale-down';
  /** object-position */
  objectPosition?: Dynamic<string>;
}

// ----------------------------------------------------------------------------
// Outline
// ----------------------------------------------------------------------------

export interface OutlineOptions {
  /** outline-width */
  width?: Dynamic<string | number>;
  /** outline-style */
  style?: 'none' | 'solid' | 'dashed' | 'dotted' | 'double' | 'groove' | 'ridge' | 'inset' | 'outset';
  /** outline-color */
  color?: Dynamic<string>;
  /** outline-offset */
  offset?: Dynamic<string | number>;
  // Short aliases
  /** Alias for width */
  w?: Dynamic<string | number>;
  /** Alias for style */
  s?: 'none' | 'solid' | 'dashed' | 'dotted' | 'double' | 'groove' | 'ridge' | 'inset' | 'outset';
  /** Alias for color */
  c?: Dynamic<string>;
  /** outline shorthand */
  o?: Dynamic<string>;
}

// ----------------------------------------------------------------------------
// Scroll
// ----------------------------------------------------------------------------

export interface ScrollOptions {
  /** scroll-behavior */
  behavior?: 'auto' | 'smooth';
  /** scroll-snap-type */
  snapType?: 'none' | 'x mandatory' | 'y mandatory' | 'x proximity' | 'y proximity' | 'both mandatory' | 'both proximity';
  /** scroll-snap-align */
  snapAlign?: 'none' | 'start' | 'center' | 'end';
  /** scroll-snap-stop */
  snapStop?: 'normal' | 'always';
  /** scroll-margin */
  margin?: Dynamic<string | number>;
  /** scroll-margin-top */
  marginTop?: Dynamic<string | number>;
  /** scroll-margin-right */
  marginRight?: Dynamic<string | number>;
  /** scroll-margin-bottom */
  marginBottom?: Dynamic<string | number>;
  /** scroll-margin-left */
  marginLeft?: Dynamic<string | number>;
  /** scroll-padding */
  padding?: Dynamic<string | number>;
  /** scroll-padding-top */
  paddingTop?: Dynamic<string | number>;
  /** scroll-padding-right */
  paddingRight?: Dynamic<string | number>;
  /** scroll-padding-bottom */
  paddingBottom?: Dynamic<string | number>;
  /** scroll-padding-left */
  paddingLeft?: Dynamic<string | number>;
  /** scrollbar-width (Firefox) */
  scrollbarWidth?: 'auto' | 'thin' | 'none';
  /** scrollbar-color (Firefox) */
  scrollbarColor?: Dynamic<string>;
  /** overflow-x */
  overflowX?: 'visible' | 'hidden' | 'scroll' | 'auto';
  /** overflow-y */
  overflowY?: 'visible' | 'hidden' | 'scroll' | 'auto';
  // Short aliases
  /** Alias for behavior */
  b?: 'auto' | 'smooth';
}

// ----------------------------------------------------------------------------
// List
// ----------------------------------------------------------------------------

export interface ListOptions {
  /** list-style-type */
  style?: 'none' | 'disc' | 'circle' | 'square' | 'decimal' | 'decimal-leading-zero' | 'lower-roman' | 'upper-roman' | 'lower-alpha' | 'upper-alpha' | string;
  /** list-style-position */
  position?: 'inside' | 'outside';
  /** list-style-image */
  image?: Dynamic<string>;
  /** list-style shorthand */
  list?: Dynamic<string>;
}
// src/core-entry.ts

// chaincss/core - Core exports only
// Usage: import { chain, StyleCollector } from 'chaincss/core'

// Core exports
export { VERSION } from './shared/constants/index.js';
export { StyleCollector, chain } from '@core/entities/style-collector.js';
export type { StyleObject, AtRule, NestedRule } from '@core/entities/style-collector.js';

// Config
export { defineConfig } from '@shared/config/index.js';
export type { ChainCSSUserConfig, MacroHandler } from '@shared/config/index.js';

// Types
export type {
  StyleDefinition,
  ChainShorthandMethods,
  CompileResult,
  GraphCompileResult,
  CorrectionResult,
  MathResult,
  ChainCSSPlugin,
  ChainCSSPluginOptions,
  GridOptions,
  FlexOptions,
  AnimationOptions,
  BackgroundOptions,
  TypographyOptions,
  BoxOptions,
  PositionOptions,
  TransitionOptions,
  TransformOptions,
  FilterOptions,
  ShadowOptions,
  ContainerOptions,
  OutlineOptions,
  ScrollOptions,
  ListOptions
} from '@shared/types/index.js';

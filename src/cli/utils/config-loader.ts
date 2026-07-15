// src/cli/utils/config-loader.ts — with intents support
// Unified loader: shorthands, macros, intents, presets, robust TS loading
// Single source of truth — core/config.ts re-exports this

import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import { createLogger } from './logger.js'
import type { ChainCSSConfig } from '../types.js'
import { DEFAULT_CONFIG as CORE_DEFAULTS } from '../../core/constants.js'

// ------------------------------------------------------------------
// Extensibility types
// ------------------------------------------------------------------
export interface IntentDefinition {
  name?: string
  category?: 'layout' | 'component' | 'semantic' | 'interaction' | string
  description?: string
  semantics?: Array<{ category: string; intent: string }>
  properties?: Record<string, string | number>
  states?: Record<string, Record<string, string | number>>
  responsive?: Record<string, Record<string, string | number>>
  a11y?: string[]
}

export type MacroHandler = (value: any, catcher: Record<string, any>, useTokens: boolean) => void


export interface ChainCSSUserConfig extends ChainCSSConfig {
  shorthands?: Record<string, string>
  macros?: Record<string, MacroHandler>
  intents?: Record<string, IntentDefinition>
  allowOverride?: boolean
  presets?: Array<ChainCSSUserConfig | ((base: ChainCSSUserConfig) => ChainCSSUserConfig | Promise<ChainCSSUserConfig>)>
}

export function defineConfig(config: ChainCSSUserConfig): ChainCSSUserConfig { return config }

function isObject(v: any) { return v && typeof v === 'object' && !Array.isArray(v) }

function normalize(mod: any): ChainCSSUserConfig { return (mod?.default ?? mod) as ChainCSSUserConfig || {} as any }

function mergePresets(base: ChainCSSUserConfig): ChainCSSUserConfig {
  if (!base.presets?.length) return base
  let acc: ChainCSSUserConfig = { shorthands: {}, macros: {}, intents: {} } as any
  for (const p of base.presets) {
    let preset: ChainCSSUserConfig | undefined
    if (typeof p === 'function') { try { preset = (p as any)(base) } catch {} }
    else if (isObject(p)) preset = p as ChainCSSUserConfig
    if (preset) acc = mergeConfig(acc as any, preset as any) as ChainCSSUserConfig
  }
  return mergeConfig(acc as any, base as any) as ChainCSSUserConfig
}

async function tryLoadWithJiti(filePath: string, root: string): Promise<any | null> {
  try {
    const jitiMod: any = await import('jiti').catch(() => null)
    const createJiti = jitiMod?.createJiti || jitiMod?.default?.createJiti || jitiMod?.default
    if (!createJiti) return null
    const jiti = createJiti(root, { interopDefault: true, fsCache: false, moduleCache: false })
    return await jiti.import(filePath, { default: true })
  } catch { return null }
}

async function tryLoadWithVite(filePath: string, root: string): Promise<any | null> {
  try {
    const { loadConfigFromFile } = await import('vite')
    const res = await loadConfigFromFile({ command: 'serve', mode: 'development' } as any, filePath, root)
    return res?.config ?? null
  } catch { return null }
}

export async function loadConfig(configPath?: string): Promise<ChainCSSUserConfig> {
  const logger = createLogger(false)
  const root = process.cwd()
  const possiblePaths = configPath
    ? [path.isAbsolute(configPath) ? configPath : path.join(root, configPath)]
    : [
        path.join(root, 'chaincss.config.ts'),
        path.join(root, 'chaincss.config.js'),
        path.join(root, 'chaincss.config.mjs'),
        path.join(root, 'chaincss.config.cjs'),
        path.join(root, 'chaincss.config.json'),
        path.join(root, '.chaincssrc.js'),
        path.join(root, 'chaincss.json')
      ]

  for (const configFile of possiblePaths) {
    if (!fs.existsSync(configFile)) continue
    try {
      logger.debug(`Loading config from ${configFile}`)
      let loaded: any = null
      if (configFile.endsWith('.json')) {
        loaded = JSON.parse(fs.readFileSync(configFile, 'utf8'))
      } else {
        loaded = await tryLoadWithJiti(configFile, root)
        if (!loaded) loaded = await tryLoadWithVite(configFile, root)
        if (!loaded) {
          const url = pathToFileURL(configFile).href + `?t=${Date.now()}`
          const mod = await import(url)
          loaded = mod
        }
      }
      const userConfig = mergePresets(normalize(loaded))
      if (userConfig.intents) {
        const { registerIntents } = await import('../../compiler/pipeline/lowering/intent-resolver.js')
        registerIntents(userConfig.intents as any,!!userConfig.allowOverride)
      }
      return mergeConfig(CORE_DEFAULTS as any, userConfig as any) as ChainCSSUserConfig
    } catch (error) {
      logger.warn(`Failed to load config from ${configFile}:`, error)
    }
  }
  return CORE_DEFAULTS as unknown as ChainCSSUserConfig
}

function mergeConfig(defaults: any, user: any): ChainCSSConfig {
  if (!user) return defaults
  return {
    ...defaults,
    ...user,
    shorthands: { ...(defaults.shorthands || {}), ...(user.shorthands || {}) },
    macros: { ...(defaults.macros || {}), ...(user.macros || {}) },
    intents: { ...(defaults.intents || {}), ...(user.intents || {}) },
    tokens: { ...defaults.tokens, ...user.tokens },
    atomic: { ...defaults.atomic, ...user.atomic },
    prefixer: { ...defaults.prefixer, ...user.prefixer },
    output: { ...defaults.output, ...user.output },
    breakpoints: { ...defaults.breakpoints, ...user.breakpoints },
    allowOverride: user.allowOverride ?? defaults.allowOverride,
    presets: user.presets ?? defaults.presets
  } as any
}

export function saveConfigTemplate(outputPath: string = 'chaincss.config.js', full: boolean = false): void {
  let template = ''
  if (full) {
    template = `/**
 * ChainCSS Configuration v3.2
 * @type {import('chaincss').ChainCSSUserConfig}
 */
import { defineConfig } from 'chaincss'

export default defineConfig({
  // ========== CUSTOM EXTENSIBILITY (v3.2) ==========
  shorthands: {
    // bgSoft: 'backgroundColor'
  },
  macros: {
    // brandCard: (v, c) => { c.borderRadius='16px'; c.padding=v||'20px' }
  },
  intents: {
    // 'admin-card': {
    //   category: 'component',
    //   description: 'Admin dashboard card',
    //   properties: { display: 'flex', flexDirection: 'column', borderRadius: '12px' },
    //   states: { hover: { transform: 'translateY(-2px)' } },
    //   a11y: ['contrast', 'focus-visible']
    // }
  },
  allowOverride: false,
  // presets: [],

  inputs: ['src/**/*.chain.js', 'src/**/*.chain.ts'],
  output: 'dist/styles',
  tokens: { enabled: true, prefix: 'chain' },
  atomic: { enabled: true, naming: 'readable', minify: true },
  prefixer: { enabled: true },
  breakpoints: {
    mobile: '(max-width: 768px)',
    tablet: '(min-width: 769px) and (max-width: 1024px)',
    desktop: '(min-width: 1025px)'
  },
  debug: false,
  verbose: false
});
`
  } else {
    template = `/**
 * ChainCSS Configuration
 * @type {import('chaincss').ChainCSSUserConfig}
 */
import { defineConfig } from 'chaincss'

export default defineConfig({
  shorthands: {},
  macros: {},
  intents: {},
  inputs: ['src/**/*.chain.js', 'src/**/*.chain.ts'],
  output: 'dist/styles',
  atomic: { enabled: true, naming: 'readable', minify: true },
  prefixer: { enabled: true },
  breakpoints: {
    mobile: '(max-width: 768px)',
    tablet: '(min-width: 769px) and (max-width: 1024px)',
    desktop: '(min-width: 1025px)'
  },
  debug: false,
  verbose: false
});
`
  }
  fs.writeFileSync(outputPath, template, 'utf8')
}


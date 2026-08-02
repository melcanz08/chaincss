// ============================================================================
// FILE: src/adapters/cli/commands/init.ts
// ChainCSS CLI Initialization Subcommand Processor
// ============================================================================

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { createLogger } from "@shared/logger/index.js";

export interface InitOptions {
  force?: boolean;
  verbose?: boolean;
  template?: 'full' | 'minimal';
  typescript?: boolean;
  framework?: 'react' | 'vue' | 'svelte' | 'solid';
}

/**
 * Generates the clean interior layout for the ChainCSS configuration template.
 */
function generateConfigContent(options: InitOptions): string {
  const isTS = !!options.typescript;
  const importStatement = "import { defineConfig } from 'chaincss';\n";

  if (options.template === 'minimal') {
    return `${importStatement}
export default defineConfig({
  inputs: ['src/**/*.chain.${isTS ? '{ts,tsx}' : '{js,jsx}'}'],
  output: {
    cssFile: 'dist/styles.css'
  }
});\n`;
  }

  return `${importStatement}
export default defineConfig({
  namespace: 'chain-',
  inputs: ['src/**/*.chain.{ts,tsx,js,jsx}'],
  output: {
    cssFile: 'dist/styles.css',
    minify: false
  },
  atomic: {
    enabled: true
  },
  tokens: {
    relationships: [
      {
        type: 'derived',
        source: 'colors.primary.500',
        target: 'colors.primary.100',
        method: 'mix-white 80%'
      }
    ]
  }
});\n`;
}

/**
 * Returns the standard functional style blueprints for example stylesheets.
 */
function generateStyleContent(): string {
  return `/**
 * ChainCSS Example Style File
 * v3.0 Strict - 16 typed methods + raw()
 */

import { chain, recipe } from 'chaincss';

// Simple atom-level element styling mapping
export const button = chain()
  .background('#667eea')
  .typography({color:'white', size:'16px', weight:'600'})
  .box({p:'12px 24px', radius:'8px', border:'none'})
  .raw({cursor:'pointer'})
  .transition('all 0.2s ease')
  .hover()
    .background('#5a67d8')
    .transform('scale(1.05)')
  .end()
  .$el('button');

// Variant-driven component styling definitions
export const buttonVariants = recipe({
  base: chain()
    .box({p:'8px 16px', radius:'4px', border:'none'})
    .typography({weight:'500'})
    .raw({cursor:'pointer'})
    .transition('all 0.2s')
    .$el('button'),
  
  variants: {
    color: {
      primary: chain().background('#667eea').typography({color:'white'}).hover().background('#5a67d8').end().$el(),
      secondary: chain().background('#48bb78').typography({color:'white'}).hover().background('#38a169').end().$el(),
      danger: chain().background('#f56565').typography({color:'white'}).hover().background('#e53e3e').end().$el(),
    },
    size: {
      sm: chain().box({p:'4px 8px'}).typography({size:'12px'}).$el(),
      md: chain().box({p:'8px 16px'}).typography({size:'14px'}).$el(),
      lg: chain().box({p:'12px 24px'}).typography({size:'16px'}).$el()
    }
  },
  
  defaultVariants: {
    color: 'primary',
    size: 'md'
  }
});
`;
}

export async function initCommand(options: InitOptions): Promise<void> {
  const logger = createLogger(options.verbose);
  logger.header('ChainCSS Project Initialization Framework');

  const isTypeScript = !!options.typescript;
  const configFilename = isTypeScript ? 'chaincss.config.ts' : 'chaincss.config.js';
  const configPath = path.join(process.cwd(), configFilename);

  // 1. Process project configuration files
  if (fs.existsSync(configPath) && !options.force) {
    logger.warn(`Configuration asset [${configFilename}] already exists. Run with --force to overwrite.`);
    return;
  }

  logger.step(`Writing configuration resource file: ${configFilename}...`);
  fs.writeFileSync(configPath, generateConfigContent(options), 'utf8');
  // CHANGED: Restored the exact "Created" hook keyword so your integration tests pass gracefully
  logger.success(`✓ Created configuration: ${configPath}`);

  // 2. Process core style assets
  const srcDirectory = path.join(process.cwd(), 'src');
  const styleExtension = isTypeScript ? 'ts' : 'js';
  const finalStylePath = path.join(srcDirectory, `styles.chain.${styleExtension}`);

  if (!fs.existsSync(srcDirectory)) {
    fs.mkdirSync(srcDirectory, { recursive: true });
  }

  if (!fs.existsSync(finalStylePath) || options.force) {
    fs.writeFileSync(finalStylePath, generateStyleContent(), 'utf8');
    // CHANGED: Uses the explicit "Created" trigger word for test suite assertions
    logger.success(`✓ Created styling example module: ${finalStylePath}`);
  } else {
    logger.info(`Styling framework rules already established at: ${finalStylePath}`);
  }

  // 3. Process framework integration component examples safely without file type pollution
  if (options.framework) {
    const compDir = path.join(srcDirectory, 'components');
    if (!fs.existsSync(compDir)) {
      fs.mkdirSync(compDir, { recursive: true });
    }

    let compPath = '';
    let compContent = '';

    switch (options.framework) {
      case 'react':
      case 'solid':
        compPath = path.join(compDir, `Button.${isTypeScript ? 'tsx' : 'jsx'}`);
        compContent = `import React from 'react';\nimport { buttonVariants } from '../styles.chain';\n\nexport const Button = ({ children, variant = 'primary' }) => {\n  const className = buttonVariants({ color: variant });\n  return <button className={className}>{children}</button>;\n};\n`;
        break;

      case 'vue':
        compPath = path.join(compDir, 'Button.vue');
        compContent = `<template>\n  <button :class="buttonClass">\n    <slot />\n  </button>\n</template>\n\n<script>\nimport { buttonVariants } from '../styles.chain';\n\nexport default {\n  name: 'Button',\n  props: {\n    variant: { type: String, default: 'primary' }\n  },\n  computed: {\n    buttonClass() {\n      return buttonVariants({ color: this.variant });\n    }\n  }\n};\n</script>\n`;
        break;

      case 'svelte':
        compPath = path.join(compDir, 'Button.svelte');
        compContent = `<script>\n  import { buttonVariants } from '../styles.chain';\n  export let variant = 'primary';\n  $: buttonClass = buttonVariants({ color: variant });\n</script>\n\n<button class={buttonClass}>\n  <slot />\n</button>\n`;
        break;
    }

    if (compPath && (!fs.existsSync(compPath) || options.force)) {
      fs.writeFileSync(compPath, compContent, 'utf8');
      logger.success(`✓ Created framework component wrapper: ${compPath}`);
    }
  }

  // 4. Update project version control rules
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  const cacheIgnoreEntries = '\n# ChainCSS Cache and Log Boundaries\n.chaincss-cache/\n.chaincss/\n';

  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    if (!gitignoreContent.includes('.chaincss-cache')) {
      fs.appendFileSync(gitignorePath, cacheIgnoreEntries, 'utf8');
      logger.info('Updated .gitignore to exclude internal caching layers.');
    }
  }

  logger.divider();
  logger.success('🚀 ChainCSS project workspace successfully initialized!');
  logger.info('\n📚 Next Steps:');
  logger.info(`  1. Open and adjust parameters within ${chalk.cyan(configFilename)}`);
  logger.info(`  2. Add utility declaration blocks inside ${chalk.cyan(path.relative(process.cwd(), finalStylePath))}`);
  logger.info(`  3. Execute production asset build passes: ${chalk.cyan('npx chaincss build')}`);
  logger.info(`  4. Launch live directory development loops: ${chalk.cyan('npx chaincss watch')}\n`);
}
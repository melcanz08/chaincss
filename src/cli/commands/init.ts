// src/cli/commands/init.ts

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { createLogger } from '../utils/logger.js';
import { saveConfigTemplate } from '../utils/config-loader.js';

export interface InitOptions {
  force?: boolean;
  verbose?: boolean;
  template?: 'full' | 'minimal';
  typescript?: boolean;
  framework?: 'react' | 'vue' | 'svelte' | 'solid';
}

export async function initCommand(options: InitOptions): Promise<void> {
  const logger = createLogger(options.verbose);
  
  logger.header('ChainCSS Initialization');
  
  const configPath = path.join(process.cwd(), 'chaincss.config.js');
  
  if (fs.existsSync(configPath) && !options.force) {
    logger.warn('Config file already exists. Use --force to overwrite.');
    return;
  }
  
  logger.step('Creating chaincss.config.js...');
  
  // Save config template with options
  saveConfigTemplate(configPath);
  
  logger.success(`Created ${configPath}`);
  
  // Create example style file
  const exampleDir = path.join(process.cwd(), 'src');
  const examplePath = path.join(exampleDir, 'styles.chain.js');
  const isTypeScript = options.typescript || false;
  const exampleExt = isTypeScript ? 'ts' : 'js';
  const finalExamplePath = isTypeScript 
    ? path.join(exampleDir, 'styles.chain.ts')
    : examplePath;
  
  if (!fs.existsSync(finalExamplePath) || options.force) {
    if (!fs.existsSync(exampleDir)) {
      fs.mkdirSync(exampleDir, { recursive: true });
    }
    
    // Framework-specific example
    let frameworkImport = "import { $, recipe } from 'chaincss';";
    let frameworkSpecificCode = '';
    
    if (options.framework === 'react') {
      frameworkSpecificCode = `
// React component example
import React from 'react';

export const Button = ({ children, variant = 'primary' }) => {
  const className = buttonVariants({ color: variant });
  return <button className={className}>{children}</button>;
};`;
    } else if (options.framework === 'vue') {
      frameworkSpecificCode = `
// Vue component example
export default {
  name: 'Button',
  props: {
    variant: { type: String, default: 'primary' }
  },
  computed: {
    buttonClass() {
      return buttonVariants({ color: this.variant });
    }
  }
};`;
    } else if (options.framework === 'svelte') {
      frameworkSpecificCode = `
<!-- Svelte component example -->
<script>
  import { buttonVariants } from './styles.chain';
  export let variant = 'primary';
  $: buttonClass = buttonVariants({ color: variant });
</script>

<button class={buttonClass}>
  <slot />
</button>`;
    }
    
    const exampleContent = `/**
 * ChainCSS Example Style File
 * 
 * This file demonstrates ChainCSS syntax.
 * Run \`npx chaincss build\` to compile all styles.
 */

${frameworkImport}

// Simple button style
export const button = $()
  .backgroundColor('#667eea')
  .color('white')
  .padding('12px 24px')
  .borderRadius('8px')
  .border('none')
  .fontSize('16px')
  .fontWeight('600')
  .cursor('pointer')
  .transition('all 0.2s ease')
  .hover()
    .backgroundColor('#5a67d8')
    .transform('scale(1.05)')
  .end()
  .$el('button');

// Card style
export const card = $()
  .backgroundColor('white')
  .borderRadius('12px')
  .padding('24px')
  .boxShadow('0 10px 15px -3px rgba(0,0,0,0.1)')
  .transition('all 0.3s ease')
  .hover()
    .boxShadow('0 20px 25px -5px rgba(0,0,0,0.15)')
    .transform('translateY(-4px)')
  .end()
  .$el('.card');

// Container style
export const container = $()
  .maxWidth('1200px')
  .margin('0 auto')
  .padding('0 1rem')
  .$el('.container');

// Responsive design
export const responsive = $()
  .display('grid')
  .gridTemplateColumns('1fr')
  .gap('1rem')
  .md()
    .gridTemplateColumns('repeat(2, 1fr)')
  .end()
  .lg()
    .gridTemplateColumns('repeat(3, 1fr)')
  .end()
  .$el('.grid');

// Variant-based button component
export const buttonVariants = recipe({
  base: $()
    .padding('8px 16px')
    .borderRadius('4px')
    .fontWeight('500')
    .cursor('pointer')
    .transition('all 0.2s')
    .border('none')
    .$el('button'),
  
  variants: {
    color: {
      primary: $().backgroundColor('#667eea').color('white').hover().backgroundColor('#5a67d8').end().$el(),
      secondary: $().backgroundColor('#48bb78').color('white').hover().backgroundColor('#38a169').end().$el(),
      danger: $().backgroundColor('#f56565').color('white').hover().backgroundColor('#e53e3e').end().$el(),
      outline: $()
        .backgroundColor('transparent')
        .color('#667eea')
        .border('2px solid #667eea')
        .hover()
          .backgroundColor('#667eea')
          .color('white')
        .end()
        .$el()
    },
    size: {
      sm: $().padding('4px 8px').fontSize('12px').$el(),
      md: $().padding('8px 16px').fontSize('14px').$el(),
      lg: $().padding('12px 24px').fontSize('16px').$el()
    },
    fullWidth: {
      true: $().width('100%').$el()
    }
  },
  
  compoundVariants: [
    {
      variants: { color: 'outline', size: 'lg' },
      style: $().borderWidth('3px').$el()
    }
  ],
  
  defaultVariants: {
    color: 'primary',
    size: 'md'
  }
});
${frameworkSpecificCode}
`;
    
    fs.writeFileSync(finalExamplePath, exampleContent, 'utf8');
    logger.success(`Created example: ${finalExamplePath}`);
  } else {
    logger.info(`Example file already exists at ${finalExamplePath}`);
  }
  
  // Create .gitignore entry for cache if needed
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  const cacheIgnore = '\n# ChainCSS cache\n.chaincss-cache/\n.chaincss/\n';
  
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf8');
    if (!gitignore.includes('.chaincss-cache')) {
      fs.appendFileSync(gitignorePath, cacheIgnore);
      logger.info('Added cache directories to .gitignore');
    }
  }
  
  logger.divider();
  logger.success('ChainCSS initialized successfully!');
  logger.info('\n📚 Next steps:');
  logger.info(`  1. Edit ${chalk.cyan('chaincss.config.js')} to customize settings`);
  logger.info(`  2. Write styles in ${chalk.cyan(finalExamplePath)}`);
  logger.info(`  3. Run ${chalk.cyan('npx chaincss build')} to compile all styles`);
  logger.info('');
  logger.info(`  Or watch for changes:`);
  logger.info(`  ${chalk.cyan('npx chaincss watch')}`);
  logger.info('');
  logger.info(`  For more information, visit: ${chalk.blue('https://chaincss.dev')}\n`);
}
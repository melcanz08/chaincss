// chaincss/src/cli/commands/init.ts

import fs from 'fs';
import path from 'path';
import { createLogger } from '../utils/logger.js';
import { saveConfigTemplate } from '../utils/config-loader.js';

export async function initCommand(options: { force?: boolean; verbose?: boolean }): Promise<void> {
  const logger = createLogger(options.verbose);
  
  logger.header('ChainCSS Initialization');
  
  const configPath = path.join(process.cwd(), 'chaincss.config.js');
  
  if (fs.existsSync(configPath) && !options.force) {
    logger.warn('Config file already exists. Use --force to overwrite.');
    return;
  }
  
  logger.step('Creating chaincss.config.js...');
  saveConfigTemplate(configPath);
  logger.success(`Created ${configPath}`);
  
  // Create example style file
  const exampleDir = path.join(process.cwd(), 'src');
  const examplePath = path.join(exampleDir, 'styles.chain.js');
  
  if (!fs.existsSync(examplePath) || options.force) {
    if (!fs.existsSync(exampleDir)) {
      fs.mkdirSync(exampleDir, { recursive: true });
    }
    
    const exampleContent = `/**
 * ChainCSS Example Style File
 * 
 * This file demonstrates ChainCSS syntax.
 * Run \`npx chaincss compile src/styles.chain.js dist/styles\` to compile.
 */

import { $, recipe } from 'chaincss';

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
  .hover()
    .backgroundColor('#5a67d8')
    .transform('scale(1.05)')
  .end()
  .transition('all 0.2s ease')
  .block();

// Card style
export const card = $()
  .backgroundColor('white')
  .borderRadius('12px')
  .padding('24px')
  .boxShadow('0 10px 15px -3px rgba(0,0,0,0.1)')
  .hover()
    .boxShadow('0 20px 25px -5px rgba(0,0,0,0.15)')
    .transform('translateY(-4px)')
  .end()
  .transition('all 0.3s ease')
  .block();

// Variant-based button component
export const buttonVariants = recipe({
  base: $()
    .padding('8px 16px')
    .borderRadius('4px')
    .fontWeight('500')
    .cursor('pointer')
    .block(),
  
  variants: {
    color: {
      primary: $().backgroundColor('#667eea').color('white').block(),
      secondary: $().backgroundColor('#48bb78').color('white').block(),
      danger: $().backgroundColor('#f56565').color('white').block()
    },
    size: {
      small: $().padding('4px 8px').fontSize('12px').block(),
      medium: $().padding('8px 16px').fontSize('14px').block(),
      large: $().padding('12px 24px').fontSize('16px').block()
    }
  },
  
  defaultVariants: {
    color: 'primary',
    size: 'medium'
  }
});
`;
    
    fs.writeFileSync(examplePath, exampleContent, 'utf8');
    logger.success(`Created example: ${examplePath}`);
  }
  
  logger.divider();
  logger.info('Next steps:');
  logger.info(`  1. Edit ${configPath} to configure ChainCSS`);
  logger.info(`  2. Write styles in .chain.js files`);
  logger.info(`  3. Run ${chalk.cyan('npx chaincss build')} to compile`);
  logger.info('');
  logger.info(`  Or compile a single file:`);
  logger.info(`  ${chalk.cyan('npx chaincss compile src/styles.chain.js dist/styles')}`);
}

import chalk from 'chalk';
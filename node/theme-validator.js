import fs from 'fs';
import path from 'path';

export function validateThemeFiles(configPath) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  if (!config.themes) return;
  
  const { contract, themes } = config;
  
  console.log('\nValidating Theme Contract...\n');
  
  const errors = [];
  
  themes.forEach((theme, index) => {
    const themeName = theme.name || `theme-${index}`;
    try {
      validateTheme(contract, theme.values);
      console.log(`${themeName}: Valid`);
    } catch (err) {
      errors.push(`${themeName}: ${err.message}`);
    }
  });
  
  if (errors.length > 0) {
    console.error('\nTheme Contract Validation Failed:\n');
    errors.forEach(err => console.error(err));
    process.exit(1);
  }
  
  console.log('\nAll themes valid!\n');
}
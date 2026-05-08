import { describe, it, expect } from 'vitest';
import { generateComponentCode, detectFramework } from '../../src/compiler/component-generator.js';

describe('Component Generator', () => {
  const baseInfo = {
    name: 'Button',
    selector: '.btn-primary',
    styles: { color: 'white', background: '#3b82f6' },
    framework: 'react' as const,
  };

  describe('generateComponentCode', () => {
    it('should generate React component', () => {
      const code = generateComponentCode(baseInfo);
      expect(code).toContain('import React');
      expect(code).toContain('Button');
      expect(code).toContain('btn-primary');
      expect(code).toContain('export default Button');
    });

    it('should generate Vue component', () => {
      const code = generateComponentCode({ ...baseInfo, framework: 'vue' });
      expect(code).toContain('<template>');
      expect(code).toContain('export default');
      expect(code).toContain('ChainCSSButton');
    });

    it('should generate Svelte component', () => {
      const code = generateComponentCode({ ...baseInfo, framework: 'svelte' });
      expect(code).toContain('<svelte:element');
      expect(code).toContain('export let');
    });

    it('should generate Solid component', () => {
      const code = generateComponentCode({ ...baseInfo, framework: 'solid' });
      expect(code).toContain('splitProps');
      expect(code).toContain('export function Button');
    });

    it('should handle auto framework detection', () => {
      const code = generateComponentCode({ ...baseInfo, framework: 'auto' });
      expect(code).toContain('import React');
    });

    it('should strip leading dot from selector', () => {
      const code = generateComponentCode({ ...baseInfo, selector: '.my-btn' });
      expect(code).toContain('my-btn');
      expect(code).not.toContain('.my-btn}');
    });

    it('should include props definition', () => {
      const code = generateComponentCode({
        ...baseInfo,
        propsDefinition: { size: 'string', disabled: 'boolean' },
      });
      expect(code).toContain('size?: string');
      expect(code).toContain('disabled?: boolean');
    });
  });

  describe('detectFramework', () => {
    it('should return a string', () => {
      const fw = detectFramework();
      expect(typeof fw).toBe('string');
      expect(['react', 'vue', 'svelte', 'solid']).toContain(fw);
    });
  });
});
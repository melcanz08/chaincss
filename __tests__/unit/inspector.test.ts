import { describe, it, expect } from 'vitest';
import type { IRRule } from '../../src/compiler/pipeline/ir/types.js';
import type { PipelineReportEntry } from '../../src/compiler/pipeline/pipeline-types.js';
import { getAffectedDeclarations } from '../../src/compiler/pipeline/inspector/history.js';
import { buildSnapshots } from '../../src/compiler/pipeline/inspector/snapshots.js';

describe('ChainCSS Inspector Obsv Subsystem', () => {
  
  // Mock factory to quickly spin up predictable rule definitions
  const createMockRule = (declarations: any[]): IRRule => ({
    id: 'rule-test-123',
    selector: '.btn-primary',
    declarations,
    isDead: false,
  } as unknown as IRRule);

  describe('getAffectedDeclarations()', () => {
    it('should correctly parse intermediate before/after states for a specific pass', () => {
      const mockRule = createMockRule([
        {
          property: 'display',
          value: 'inline-flex', // Final value
          history: [
            { pass: 'cleaner-pass', action: 'modify', previous: 'block', reason: 'Initial fix' },
            { pass: 'prefixer-pass', action: 'modify', previous: 'flex', reason: 'Cross-browser compatibility' }
          ]
        }
      ]);

      const mockReportEntry = {
        pass: 'cleaner-pass',
        stage: 'optimize',
        duration: 0,
      } as PipelineReportEntry;

      const affected = getAffectedDeclarations(mockRule, mockReportEntry);
      
      expect(affected).toHaveLength(1);
      expect(affected[0]).toEqual({
        property: 'display',
        before: 'block',
        after: 'flex', // Matches the 'previous' value of the next event string
        reason: 'Initial fix'
      });
    });

    it('should safely return an empty array if no properties were mutated during the pass', () => {
      const mockRule = createMockRule([
        {
          property: 'color',
          value: '#fff',
          history: [{ pass: 'other-pass', action: 'modify', previous: 'red' }]
        }
      ]);

      const mockReportEntry2: PipelineReportEntry = { 
        pass: 'unrelated-pass', 
        stage: 'lint',
        duration: 0, // Satisfies the required layout property
      };
      const affected = getAffectedDeclarations(mockRule, mockReportEntry2);
      
      expect(affected).toEqual([]);
    });
  });

  describe('buildSnapshots()', () => {
    it('should generate a correct chronological O(N) timeline without duplicate step states', () => {
      // Setup a property that changes from block -> flex -> inline-flex
      const mockRule = createMockRule([
        {
          property: 'display',
          value: 'inline-flex',
          history: [
            { pass: 'pass-1', action: 'mutate', previous: 'block', reason: 'Step 1' },
            { pass: 'pass-2', action: 'mutate', previous: 'flex', reason: 'Step 2' }
          ]
        }
      ]);

      const pipelineReport: PipelineReportEntry[] = [
        { pass: 'pass-1', stage: 'transform', duration: 0 },
        { pass: 'no-op-pass', stage: 'lint', duration: 0 }, // Should be skipped completely
        { pass: 'pass-2', stage: 'optimize', duration: 0 }
      ];

      const snapshots = buildSnapshots(mockRule, pipelineReport);

      // Verify no-op-pass was skipped and exact matching counts returned
      expect(snapshots).toHaveLength(2);

      // Verify the state layout after pass-1
      expect(snapshots[0]).toEqual({
        pass: 'pass-1',
        stage: 'transform',
        declarations: [{ property: 'display', value: 'flex' }]
      });

      // Verify the final state layout after pass-2
      expect(snapshots[1]).toEqual({
        pass: 'pass-2',
        stage: 'optimize',
        declarations: [{ property: 'display', value: 'inline-flex' }]
      });
    });
  });
});
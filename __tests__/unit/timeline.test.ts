import { describe, it, expect, beforeEach } from 'vitest';
import {
  enableTimeline, getStyleHistory, getStyleChanges,
  getStyleDiff, exportTimeline, clearTimeline,
  takeSnapshot, isTimelineEnabled
} from '../../src/compiler/timeline.js';

describe('Timeline System', () => {
  beforeEach(() => {
    clearTimeline();
    enableTimeline(true);
  });

  describe('enableTimeline', () => {
    it('should enable and disable', () => {
      expect(isTimelineEnabled()).toBe(true);
      enableTimeline(false);
      expect(isTimelineEnabled()).toBe(false);
    });

    it('should clear history when disabled', () => {
      takeSnapshot('test', { color: 'red' }, 'test.ts:1');
      expect(getStyleHistory().length).toBe(1);
      enableTimeline(false);
      expect(getStyleHistory().length).toBe(0);
    });
  });

  describe('takeSnapshot', () => {
    it('should create a snapshot', () => {
      const id = takeSnapshot('btn', { color: 'red', padding: '20px' }, 'button.chain.ts:5');
      expect(id).toBeTruthy();
      expect(id).toContain('snapshot_');
    });

    it('should store styles', () => {
      takeSnapshot('btn', { color: 'red' }, 'test.ts:1');
      const history = getStyleHistory();
      expect(history.length).toBe(1);
      expect(history[0].selector).toBe('btn');
      expect(history[0].styles.color).toBe('red');
      expect(history[0].source).toBe('test.ts:1');
    });

    it('should deduplicate identical snapshots', () => {
      const id1 = takeSnapshot('btn', { color: 'red' }, 'test.ts:1');
      const id2 = takeSnapshot('btn', { color: 'red' }, 'test.ts:1');
      expect(id1).toBe(id2);
      expect(getStyleHistory().length).toBe(1);
    });

    it('should create new snapshot for different styles', () => {
      const id1 = takeSnapshot('btn', { color: 'red' }, 'test.ts:1');
      const id2 = takeSnapshot('btn', { color: 'blue' }, 'test.ts:2');
      expect(id1).not.toBe(id2);
      expect(getStyleHistory().length).toBe(2);
    });

    it('should not snapshot when disabled', () => {
      enableTimeline(false);
      const id = takeSnapshot('btn', { color: 'red' }, 'test.ts:1');
      expect(id).toBe('');
      expect(getStyleHistory().length).toBe(0);
    });
  });

  describe('getStyleDiff', () => {
    it('should detect added properties', () => {
      const id1 = takeSnapshot('btn', { color: 'red' }, 'test.ts:1');
      const id2 = takeSnapshot('btn', { color: 'red', background: 'blue' }, 'test.ts:2');
      const diff = getStyleDiff(id1, id2);
      expect(diff.added).toHaveProperty('background');
      expect(diff.added.background).toBe('blue');
    });

    it('should detect removed properties', () => {
      const id1 = takeSnapshot('btn', { color: 'red', padding: '20px' }, 'test.ts:1');
      const id2 = takeSnapshot('btn', { color: 'red' }, 'test.ts:2');
      const diff = getStyleDiff(id1, id2);
      expect(diff.removed).toHaveProperty('padding');
    });

    it('should detect modified properties', () => {
      const id1 = takeSnapshot('btn', { color: 'red' }, 'test.ts:1');
      const id2 = takeSnapshot('btn', { color: 'blue' }, 'test.ts:2');
      const diff = getStyleDiff(id1, id2);
      expect(diff.modified).toHaveProperty('color');
      expect(diff.modified.color.old).toBe('red');
      expect(diff.modified.color.new).toBe('blue');
    });

    it('should return error for unknown snapshots', () => {
      const diff = getStyleDiff('nonexistent1', 'nonexistent2');
      expect(diff.error).toBe('Snapshot not found');
    });
  });

  describe('getStyleChanges', () => {
    it('should track additions', () => {
      takeSnapshot('btn', { color: 'red' }, 'test.ts:1');
      takeSnapshot('btn', { color: 'red', background: 'blue' }, 'test.ts:2');
      const changes = getStyleChanges();
      const adds = changes.filter(c => c.type === 'add');
      expect(adds.length).toBeGreaterThan(0);
      expect(adds[0].property).toBe('background');
    });

    it('should track removals', () => {
      takeSnapshot('btn', { color: 'red', padding: '20px' }, 'test.ts:1');
      takeSnapshot('btn', { color: 'red' }, 'test.ts:2');
      const changes = getStyleChanges();
      const removals = changes.filter(c => c.type === 'remove');
      expect(removals.length).toBeGreaterThan(0);
    });

    it('should track modifications', () => {
      takeSnapshot('btn', { color: 'red' }, 'test.ts:1');
      takeSnapshot('btn', { color: 'blue' }, 'test.ts:2');
      const changes = getStyleChanges();
      const mods = changes.filter(c => c.type === 'modify');
      expect(mods.length).toBeGreaterThan(0);
    });
  });

  describe('exportTimeline', () => {
    it('should export valid JSON', () => {
      takeSnapshot('btn', { color: 'red' }, 'test.ts:1');
      const json = exportTimeline();
      const parsed = JSON.parse(json);
      expect(parsed.history).toBeDefined();
      expect(parsed.changes).toBeDefined();
      expect(parsed.exportedAt).toBeDefined();
    });
  });

  describe('clearTimeline', () => {
    it('should clear all data', () => {
      takeSnapshot('btn', { color: 'red' }, 'test.ts:1');
      clearTimeline();
      expect(getStyleHistory().length).toBe(0);
      expect(getStyleChanges().length).toBe(0);
    });
  });
});
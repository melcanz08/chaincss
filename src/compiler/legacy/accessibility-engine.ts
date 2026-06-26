/**
 * @deprecated This file is being replaced by the new Pipeline architecture.
 * For validation: use pipeline/validators/accessibility-validator.ts
 * For optimization: use pipeline/optimizers/accessibility-optimizer.ts
 * This file will be removed in v3.0.
 */

// src/compiler/accessibility-engine.ts

/**
 * Accessibility Intelligence Engine
 * 
 * Build-time WCAG 2.2 compliance checking. Auto-fixes where possible.
 * Runs only in build-time and hybrid-static modes. Zero runtime cost.
 * 
 * Detectors:
 *   - Contrast ratio (extends design-orchestrator)
 *   - Minimum font size (12px)
 *   - Touch target size (44×44px)
 *   - Missing focus indicators
 *   - prefers-reduced-motion
 *   - Hover-only interactions
 */

import type { StyleIR, IRRule, IRDeclaration, IRPass } from '../style-ir.js';
import { contrastRatio } from '../tokens/design-orchestrator.js';

// ============================================================================
// Types
// ============================================================================

export interface AccessibilityIssue {
  ruleId: string;
  selector: string;
  category: 'contrast' | 'font-size' | 'touch-target' | 'focus' | 'motion' | 'hover-only' | 'color-only';
  severity: 'error' | 'warning';
  wcagCriterion: string;
  message: string;
  suggestion: string;
  autoFixable: boolean;
}

export interface AccessibilityReport {
  issues: AccessibilityIssue[];
  errorCount: number;
  warningCount: number;
  passedCount: number;
  summary: string;
}

// ============================================================================
// Constants
// ============================================================================

const WCAG = {
  MIN_CONTRAST_AA: 4.5,
  MIN_CONTRAST_AA_LARGE: 3.0,
  MIN_CONTRAST_AAA: 7.0,
  MIN_FONT_SIZE: 12, // px
  MIN_TOUCH_TARGET: 44, // px
  CRITERIA: {
    contrast: '1.4.3 Contrast (Minimum) — AA',
    fontSize: '1.4.4 Resize Text — AA',
    touchTarget: '2.5.8 Target Size — AA',
    focus: '2.4.7 Focus Visible — AA',
    motion: '2.3.3 Animation from Interactions — AAA',
    hoverOnly: '1.4.13 Content on Hover or Focus — AA',
    colorOnly: '1.4.1 Use of Color — A',
  },
};

// ============================================================================
// Detectors
// ============================================================================

/**
 * Detect insufficient contrast between color and background.
 */
function detectContrast(rule: IRRule): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  const color = rule.declarations.find(d =>
    d.property === 'color' && typeof d.value === 'string'
  );
  const bg = rule.declarations.find(d =>
    (d.property === 'backgroundColor' || d.property === 'background') &&
    typeof d.value === 'string'
  );

  if (color && bg) {
    const ratio = contrastRatio(String(color.value), String(bg.value));

    if (ratio > 0 && ratio < WCAG.MIN_CONTRAST_AA) {
      issues.push({
        ruleId: rule.id,
        selector: rule.selector,
        category: 'contrast',
        severity: 'error',
        wcagCriterion: WCAG.CRITERIA.contrast,
        message: 'Contrast ratio ' + ratio.toFixed(1) + ':1 fails WCAG AA (needs ' + WCAG.MIN_CONTRAST_AA + ':1)',
        suggestion: 'Darken text or lighten background. Current: ' + color.value + ' on ' + bg.value,
        autoFixable: false, // Can't auto-fix without knowing design intent
      });
    } else if (ratio > 0 && ratio < WCAG.MIN_CONTRAST_AAA) {
      issues.push({
        ruleId: rule.id,
        selector: rule.selector,
        category: 'contrast',
        severity: 'warning',
        wcagCriterion: WCAG.CRITERIA.contrast,
        message: 'Contrast ratio ' + ratio.toFixed(1) + ':1 passes AA but fails AAA (' + WCAG.MIN_CONTRAST_AAA + ':1)',
        suggestion: 'Consider increasing contrast for better readability.',
        autoFixable: false,
      });
    }
  }

  return issues;
}

/**
 * Detect font sizes below WCAG minimum.
 */
function detectMinimumFontSize(rule: IRRule): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  for (const decl of rule.declarations) {
    if ((decl.property === 'fontSize' || decl.property === 'font-size') &&
        typeof decl.value === 'string') {
      const pxMatch = decl.value.match(/^(\d+(\.\d+)?)px$/);
      if (pxMatch) {
        const px = parseFloat(pxMatch[1]);
        if (px < WCAG.MIN_FONT_SIZE) {
          issues.push({
            ruleId: rule.id,
            selector: rule.selector,
            category: 'font-size',
            severity: 'warning',
            wcagCriterion: WCAG.CRITERIA.fontSize,
            message: 'font-size: ' + decl.value + ' is below WCAG minimum of ' + WCAG.MIN_FONT_SIZE + 'px',
            suggestion: 'font-size: max(' + WCAG.MIN_FONT_SIZE + 'px, ' + decl.value + ')',
            autoFixable: true,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Detect touch targets smaller than 44×44px.
 */
function detectTouchTargets(rule: IRRule): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  // Only check interactive elements (those with cursor: pointer or buttons)
  const isInteractive = rule.declarations.some(d =>
    d.property === 'cursor' && d.value === 'pointer'
  );
  const isButton = rule.selector.includes('btn') || rule.selector.includes('button');
  const isLink = rule.selector.includes('link') || rule.selector.includes('a');

  if (!isInteractive && !isButton && !isLink) return issues;

  const width = rule.declarations.find(d =>
    (d.property === 'width' || d.property === 'min-width') && typeof d.value === 'string'
  );
  const height = rule.declarations.find(d =>
    (d.property === 'height' || d.property === 'min-height') && typeof d.value === 'string'
  );

  const hasWidthIssue = width && extractPx(String(width.value)) < WCAG.MIN_TOUCH_TARGET;
  const hasHeightIssue = height && extractPx(String(height.value)) < WCAG.MIN_TOUCH_TARGET;

  if (hasWidthIssue || hasHeightIssue) {
    issues.push({
      ruleId: rule.id,
      selector: rule.selector,
      category: 'touch-target',
      severity: 'warning',
      wcagCriterion: WCAG.CRITERIA.touchTarget,
      message: 'Interactive element "' + rule.selector + '" may be too small for touch (needs ≥ ' + WCAG.MIN_TOUCH_TARGET + '×' + WCAG.MIN_TOUCH_TARGET + 'px)',
      suggestion: 'Add min-width: ' + WCAG.MIN_TOUCH_TARGET + 'px; min-height: ' + WCAG.MIN_TOUCH_TARGET + 'px;',
      autoFixable: true,
    });
  }

  return issues;
}

/**
 * Detect missing focus indicators on interactive elements.
 */
function detectMissingFocus(rule: IRRule): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  const isInteractive = rule.declarations.some(d =>
    d.property === 'cursor' && d.value === 'pointer'
  );
  if (!isInteractive) return issues;

  // Check if outline is explicitly set to none
  const outline = rule.declarations.find(d =>
    d.property === 'outline'
  );
  const hasFocusStyle = rule.pseudoClasses.some(pc =>
    (pc.name === 'focus' || pc.name === 'focus-visible') && pc.declarations.length > 0
  );

  if (outline && String(outline.value) === 'none' && !hasFocusStyle) {
    issues.push({
      ruleId: rule.id,
      selector: rule.selector,
      category: 'focus',
      severity: 'error',
      wcagCriterion: WCAG.CRITERIA.focus,
      message: '"' + rule.selector + '" has outline: none with no :focus-visible fallback',
      suggestion: 'Add .focusVisible(c => c.outline("2px solid #3b82f6").outlineOffset("2px"))',
      autoFixable: false,
    });
  }

  // If no outline and no focus styles at all
  if (!outline && !hasFocusStyle && isInteractive) {
    issues.push({
      ruleId: rule.id,
      selector: rule.selector,
      category: 'focus',
      severity: 'warning',
      wcagCriterion: WCAG.CRITERIA.focus,
      message: 'Interactive element "' + rule.selector + '" has no visible focus indicator',
      suggestion: 'Add :focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }',
      autoFixable: true,
    });
  }

  return issues;
}

/**
 * Detect animations without prefers-reduced-motion respect.
 */
function detectMotionRespect(rule: IRRule): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  const hasAnimation = rule.declarations.some(d =>
    (d.property === 'animation' || d.property === 'animation-name') &&
    typeof d.value === 'string' && String(d.value) !== 'none'
  );
  const hasTransition = rule.declarations.some(d =>
    d.property === 'transition' && typeof d.value === 'string'
  );

  // Check if motion is wrapped in a prefers-reduced-motion media query
  const hasReducedMotionWrapper = rule.atRules.some(at =>
    at.type === 'media' && at.query &&
    at.query.includes('prefers-reduced-motion')
  );

  if ((hasAnimation || hasTransition) && !hasReducedMotionWrapper) {
    issues.push({
      ruleId: rule.id,
      selector: rule.selector,
      category: 'motion',
      severity: 'warning',
      wcagCriterion: WCAG.CRITERIA.motion,
      message: 'Animations/transitions on "' + rule.selector + '" should respect prefers-reduced-motion',
      suggestion: 'Wrap in @media (prefers-reduced-motion: no-preference) { ... }',
      autoFixable: true,
    });
  }

  return issues;
}

/**
 * Detect hover-only interactions without focus fallback.
 */
function detectHoverOnly(rule: IRRule): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  const hasHover = rule.pseudoClasses.some(pc => pc.name === 'hover');
  const hasFocusVisible = rule.pseudoClasses.some(pc =>
    pc.name === 'focus' || pc.name === 'focus-visible'
  );

  if (hasHover && !hasFocusVisible) {
    issues.push({
      ruleId: rule.id,
      selector: rule.selector,
      category: 'hover-only',
      severity: 'warning',
      wcagCriterion: WCAG.CRITERIA.hoverOnly,
      message: '"' + rule.selector + '" has hover styles but no :focus-visible fallback. Keyboard users cannot access this interaction.',
      suggestion: 'Add the same styles to :focus-visible for keyboard accessibility.',
      autoFixable: true,
    });
  }

  return issues;
}

// ============================================================================
// Utilities
// ============================================================================

function extractPx(value: string): number {
  const match = value.match(/^(\d+(\.\d+)?)px$/);
  return match ? parseFloat(match[1]) : Infinity;
}

// ============================================================================
// Full Audit
// ============================================================================

function auditRule(rule: IRRule): AccessibilityIssue[] {
  if (rule.isDead) return [];

  return [
    ...detectContrast(rule),
    ...detectMinimumFontSize(rule),
    ...detectTouchTargets(rule),
    ...detectMissingFocus(rule),
    ...detectMotionRespect(rule),
    ...detectHoverOnly(rule),
  ];
}

function generateAccessibilityReport(rules: IRRule[]): AccessibilityReport {
  const allIssues: AccessibilityIssue[] = [];

  for (const rule of rules) {
    allIssues.push(...auditRule(rule));
  }

  const errors = allIssues.filter(i => i.severity === 'error');
  const warnings = allIssues.filter(i => i.severity === 'warning');

  let summary: string;
  if (allIssues.length === 0) {
    summary = '✅ All accessibility checks passed.';
  } else if (errors.length > 0) {
    summary = '❌ ' + errors.length + ' errors, ' + warnings.length + ' warnings — fix errors before shipping.';
  } else {
    summary = '⚠️ ' + warnings.length + ' warnings — recommended fixes available.';
  }

  return {
    issues: allIssues,
    errorCount: errors.length,
    warningCount: warnings.length,
    passedCount: rules.filter(r => !r.isDead).length - allIssues.length,
    summary,
  };
}

// ============================================================================
// Auto-Fix
// ============================================================================

function autoFixFontSize(decl: IRDeclaration): string {
  return 'max(' + WCAG.MIN_FONT_SIZE + 'px, ' + decl.value + ')';
}

function autoFixTouchTarget(): Record<string, string> {
  return {
    'min-width': WCAG.MIN_TOUCH_TARGET + 'px',
    'min-height': WCAG.MIN_TOUCH_TARGET + 'px',
  };
}

// ============================================================================
// IR Pass
// ============================================================================

export const accessibilityPass: IRPass = (ir: StyleIR): StyleIR => {
  for (const rule of ir.rules) {
    const issues = auditRule(rule);

    for (const issue of issues) {
      ir.diagnostics.push({
        id: 'a11y-' + issue.category + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        nodeId: issue.ruleId,
        severity: issue.severity,
        message: '[' + issue.wcagCriterion + '] ' + issue.message,
        suggestion: issue.suggestion,
        pass: 'accessibility',
      });

      // Auto-fix where possible
      if (issue.autoFixable) {
        if (issue.category === 'font-size') {
          const decl = rule.declarations.find(d =>
            d.property === 'fontSize' || d.property === 'font-size'
          );
          if (decl) {
            decl.value = autoFixFontSize(decl);
            decl.history.push({
              pass: 'accessibility',
              action: 'auto-fix-min-font',
              timestamp: Date.now(),
              reason: issue.message,
            });
          }
        }

        if (issue.category === 'touch-target') {
          const fixes = autoFixTouchTarget();
          for (const [prop, value] of Object.entries(fixes)) {
            rule.declarations.push({
              id: 'a11y-fix-' + Date.now(),
              property: prop,
              value,
              history: [{
                pass: 'accessibility',
                action: 'auto-fix-touch-target',
                timestamp: Date.now(),
                reason: issue.message,
              }],
              meta: { a11y: true },
            });
          }
        }

        if (issue.category === 'focus' && issue.autoFixable) {
          rule.pseudoClasses.push({
            id: 'a11y-focus-' + Date.now(),
            name: 'focus-visible',
            declarations: [{
              id: 'a11y-focus-outline',
              property: 'outline',
              value: '2px solid #3b82f6',
              history: [{
                pass: 'accessibility',
                action: 'auto-fix-focus',
                timestamp: Date.now(),
                reason: issue.message,
              }],
              meta: {},
            }, {
              id: 'a11y-focus-offset',
              property: 'outlineOffset',
              value: '2px',
              history: [],
              meta: {},
            }],
            source: rule.source,
            history: [],
          });
        }

        if (issue.category === 'motion' && issue.autoFixable) {
          // Move existing animation/transition declarations into a reduced-motion query
          const motionDecls = rule.declarations.filter(d =>
            d.property === 'animation' || d.property === 'transition'
          );
          if (motionDecls.length > 0) {
            rule.atRules.push({
              id: 'a11y-motion-' + Date.now(),
              type: 'media',
              query: '(prefers-reduced-motion: no-preference)',
              declarations: motionDecls.map(d => ({ ...d, id: d.id + '-motion' })),
              nestedRules: [],
              source: rule.source,
              history: [{
                pass: 'accessibility',
                action: 'auto-fix-motion',
                timestamp: Date.now(),
                reason: 'Wrapped in prefers-reduced-motion query',
              }],
            });
            // Remove from main declarations
            rule.declarations = rule.declarations.filter(d =>
              !motionDecls.includes(d)
            );
          }
        }
      }
    }
  }

  // Store report
  ir.meta = ir.meta || {};
  (ir.meta as any).accessibilityReport = generateAccessibilityReport(ir.rules);

  return ir;
};

// ============================================================================
// Standalone API
// ============================================================================

export function auditAccessibility(rules: IRRule[]): AccessibilityReport {
  return generateAccessibilityReport(rules);
}

export function checkRule(rule: IRRule): AccessibilityIssue[] {
  return auditRule(rule);
}

export const accessibilityEngine = {
  audit: auditAccessibility,
  checkRule,
  pass: accessibilityPass,
  wcag: WCAG,
};

export default accessibilityEngine;

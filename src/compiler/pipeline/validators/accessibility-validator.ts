// src/compiler/pipeline/validators/accessibility-validator.ts

import type { StyleIR, IRRule } from '../../style-ir.js';
import type { ValidationPass, ValidationResult, Diagnostic } from '../pipeline-types.js';
import { contrastRatio } from '../../tokens/design-orchestrator.js';

const WCAG = {
  MIN_CONTRAST_AA: 4.5,
  MIN_FONT_SIZE: 12,
  MIN_TOUCH_TARGET: 44,
};

function extractPx(value: string): number {
  const match = value.match(/^(\d+(\.\d+)?)px$/);
  return match ? parseFloat(match[1]) : Infinity;
}

function detectContrastIssues(rule: IRRule): Diagnostic[] {
  const issues: Diagnostic[] = [];
  const color = rule.declarations.find(d => d.property === 'color' && typeof d.value === 'string');
  const bg = rule.declarations.find(d => 
    (d.property === 'backgroundColor' || d.property === 'background') && typeof d.value === 'string'
  );

  if (color && bg) {
    const ratio = contrastRatio(String(color.value), String(bg.value));
    if (ratio > 0 && ratio < WCAG.MIN_CONTRAST_AA) {
      issues.push({
        id: `a11y-contrast-${rule.id}`,
        nodeId: rule.id,
        severity: 'error',
        category: 'contrast',
        message: `Contrast ratio ${ratio.toFixed(1)}:1 fails WCAG AA (needs ${WCAG.MIN_CONTRAST_AA}:1)`,
        suggestion: `Darken text or lighten background. Current: ${color.value} on ${bg.value}`,
        wcagCriterion: '1.4.3 Contrast (Minimum) — AA',
        autoFixable: false,
      });
    }
  }
  return issues;
}

function detectFontSizeIssues(rule: IRRule): Diagnostic[] {
  const issues: Diagnostic[] = [];
  for (const decl of rule.declarations) {
    if ((decl.property === 'fontSize' || decl.property === 'font-size') && typeof decl.value === 'string') {
      const pxMatch = decl.value.match(/^(\d+(\.\d+)?)px$/);
      if (pxMatch) {
        const px = parseFloat(pxMatch[1]);
        if (px < WCAG.MIN_FONT_SIZE) {
          issues.push({
            id: `a11y-fontsize-${rule.id}`,
            nodeId: rule.id,
            severity: 'warning',
            category: 'font-size',
            message: `font-size: ${decl.value} is below WCAG minimum of ${WCAG.MIN_FONT_SIZE}px`,
            suggestion: `font-size: max(${WCAG.MIN_FONT_SIZE}px, ${decl.value})`,
            wcagCriterion: '1.4.4 Resize Text — AA',
            autoFixable: true,
          });
        }
      }
    }
  }
  return issues;
}

function detectTouchTargetIssues(rule: IRRule): Diagnostic[] {
  const issues: Diagnostic[] = [];
  const isInteractive = rule.declarations.some(d => d.property === 'cursor' && d.value === 'pointer');
  const isButton = rule.selector.includes('btn') || rule.selector.includes('button');
  if (!isInteractive && !isButton) return issues;

  const width = rule.declarations.find(d => (d.property === 'width' || d.property === 'min-width') && typeof d.value === 'string');
  const height = rule.declarations.find(d => (d.property === 'height' || d.property === 'min-height') && typeof d.value === 'string');
  
  const hasWidthIssue = width && extractPx(String(width.value)) < WCAG.MIN_TOUCH_TARGET;
  const hasHeightIssue = height && extractPx(String(height.value)) < WCAG.MIN_TOUCH_TARGET;

  if (hasWidthIssue || hasHeightIssue) {
    issues.push({
      id: `a11y-touch-${rule.id}`,
      nodeId: rule.id,
      severity: 'warning',
      category: 'touch-target',
      message: `Interactive element "${rule.selector}" may be too small for touch (needs ≥ ${WCAG.MIN_TOUCH_TARGET}×${WCAG.MIN_TOUCH_TARGET}px)`,
      suggestion: `Add min-width: ${WCAG.MIN_TOUCH_TARGET}px; min-height: ${WCAG.MIN_TOUCH_TARGET}px;`,
      wcagCriterion: '2.5.8 Target Size — AA',
      autoFixable: true,
    });
  }
  return issues;
}

function detectFocusIssues(rule: IRRule): Diagnostic[] {
  const issues: Diagnostic[] = [];
  const isInteractive = rule.declarations.some(d => d.property === 'cursor' && d.value === 'pointer');
  if (!isInteractive) return issues;

  const outline = rule.declarations.find(d => d.property === 'outline');
  const hasFocusStyle = rule.pseudoClasses.some(pc => 
    (pc.name === 'focus' || pc.name === 'focus-visible') && pc.declarations.length > 0
  );

  if (outline && String(outline.value) === 'none' && !hasFocusStyle) {
    issues.push({
      id: `a11y-focus-${rule.id}`,
      nodeId: rule.id,
      severity: 'error',
      category: 'focus',
      message: `"${rule.selector}" has outline: none with no :focus-visible fallback`,
      suggestion: 'Add :focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }',
      wcagCriterion: '2.4.7 Focus Visible — AA',
      autoFixable: true,
    });
  }
  return issues;
}

function detectMotionIssues(rule: IRRule): Diagnostic[] {
  const issues: Diagnostic[] = [];
  const hasAnimation = rule.declarations.some(d => d.property === 'animation' || d.property === 'transition');
  const hasReducedMotion = rule.atRules.some(at => at.type === 'media' && at.query && at.query.includes('prefers-reduced-motion'));

  if (hasAnimation && !hasReducedMotion) {
    issues.push({
      id: `a11y-motion-${rule.id}`,
      nodeId: rule.id,
      severity: 'warning',
      category: 'motion',
      message: `"${rule.selector}" has animations without prefers-reduced-motion support`,
      suggestion: 'Wrap in @media (prefers-reduced-motion: no-preference) { ... }',
      wcagCriterion: '2.3.3 Animation from Interactions — AAA',
      autoFixable: true,
    });
  }
  return issues;
}

function detectHoverOnlyIssues(rule: IRRule): Diagnostic[] {
  const issues: Diagnostic[] = [];
  const hasHover = rule.pseudoClasses.some(pc => pc.name === 'hover');
  const hasFocus = rule.pseudoClasses.some(pc => pc.name === 'focus' || pc.name === 'focus-visible');

  if (hasHover && !hasFocus) {
    issues.push({
      id: `a11y-hover-${rule.id}`,
      nodeId: rule.id,
      severity: 'warning',
      category: 'hover-only',
      message: `"${rule.selector}" has hover styles but no :focus-visible fallback`,
      suggestion: 'Add the same styles to :focus-visible for keyboard accessibility.',
      wcagCriterion: '1.4.13 Content on Hover or Focus — AA',
      autoFixable: true,
    });
  }
  return issues;
}

export const accessibilityValidator: ValidationPass = {
  name: 'accessibility-validator',
  
  validate(ir: StyleIR): ValidationResult {
    const diagnostics: Diagnostic[] = [];
    
    for (const rule of ir.rules) {
      if (rule.isDead) continue;
      diagnostics.push(
        ...detectContrastIssues(rule),
        ...detectFontSizeIssues(rule),
        ...detectTouchTargetIssues(rule),
        ...detectFocusIssues(rule),
        ...detectMotionIssues(rule),
        ...detectHoverOnlyIssues(rule),
      );
    }

    const errors = diagnostics.filter(d => d.severity === 'error').length;
    const warnings = diagnostics.filter(d => d.severity === 'warning').length;
    const info = diagnostics.filter(d => d.severity === 'info').length;
    const hints = diagnostics.filter(d => d.severity === 'hint').length;

    return {
      diagnostics,
      passed: errors === 0,
      stats: { errors, warnings, info, hints },
    };
  },
};
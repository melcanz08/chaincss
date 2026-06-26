/**
 * @deprecated Use pipeline/analyzers/responsive-analyzer.ts instead.
 * This file will be removed in v3.0.
 */

// src/compiler/responsive-inference.ts
/**
 * Automatic Responsive Inference Engine
 * 
 * Detects layout patterns that will break on mobile and suggests fixes.
 * Positions ChainCSS as a layout advisor, not just a compiler.
 * 
 * Detection rules:
 *   - Fixed widths > 768px → suggest min(100%, width)
 *   - Grid columns > 2 → suggest auto-fit
 *   - Large font sizes → suggest clamp()
 *   - Fixed height: 100vh → suggest 100dvh
 *   - Large padding/gap → suggest responsive reduction
 *   - Multiple fixed-width columns → suggest auto-fit grid
 */

import type { StyleIR, IRRule, IRDeclaration, IRPass } from '../style-ir.js';

// ============================================================================
// Types
// ============================================================================

export interface ResponsiveIssue {
  ruleId: string;
  selector: string;
  property: string;
  currentValue: string;
  severity: 'error' | 'warning' | 'info';
  category: 'overflow' | 'grid' | 'typography' | 'spacing' | 'viewport' | 'columns';
  message: string;
  suggestedFix: string;
  autoFixAvailable: boolean;
  affectedViewports: string[];
}

export interface ResponsiveReport {
  issues: ResponsiveIssue[];
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  summary: string;
}

// ============================================================================
// Detection Rules
// ============================================================================

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;
const LARGE_FONT_THRESHOLD = 32; // px
const LARGE_PADDING_THRESHOLD = 48; // px
const LARGE_GAP_THRESHOLD = 32; // px
const MAX_GRID_COLUMNS = 2; // warn if more than this

/**
 * Detect fixed pixel widths that will overflow mobile.
 */
function detectFixedWidth(rule: IRRule): ResponsiveIssue[] {
  const issues: ResponsiveIssue[] = [];

  for (const decl of rule.declarations) {
    if ((decl.property === 'width' || decl.property === 'max-width') &&
        typeof decl.value === 'string') {
      const pxMatch = decl.value.match(/^(\d+(\.\d+)?)px$/);
      if (pxMatch) {
        const px = parseFloat(pxMatch[1]);
        if (px > MOBILE_BREAKPOINT) {
          issues.push({
            ruleId: rule.id,
            selector: rule.selector,
            property: decl.property,
            currentValue: decl.value,
            severity: px > TABLET_BREAKPOINT ? 'error' : 'warning',
            category: 'overflow',
            message: 'Fixed ' + decl.property + ': ' + decl.value + ' will overflow on viewports < ' + px + 'px',
            suggestedFix: decl.property + ': min(100%, ' + decl.value + ');',
            autoFixAvailable: true,
            affectedViewports: ['mobile', 'tablet'],
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Detect grid columns that won't fit on mobile.
 */
function detectGridColumns(rule: IRRule): ResponsiveIssue[] {
  const issues: ResponsiveIssue[] = [];

  for (const decl of rule.declarations) {
    if ((decl.property === 'gridTemplateColumns' || decl.property === 'grid-template-columns') &&
        typeof decl.value === 'string') {
      // Count explicit columns: 1fr 1fr 1fr 1fr or 300px 300px 300px
      const columns = decl.value.split(/\s+/).filter(c =>
        c.includes('fr') || c.includes('px') || c.includes('%')
      );
      const explicitColumns = columns.length;

      if (explicitColumns > MAX_GRID_COLUMNS) {
        const isFixed = columns.every(c => c.includes('px'));
        const suggestion = isFixed
          ? 'repeat(auto-fit, minmax(' + columns[0] + ', 1fr))'
          : 'repeat(auto-fit, minmax(250px, 1fr))';

        issues.push({
          ruleId: rule.id,
          selector: rule.selector,
          property: decl.property,
          currentValue: decl.value,
          severity: explicitColumns >= 4 ? 'error' : 'warning',
          category: 'grid',
          message: explicitColumns + ' columns will not fit on mobile screens (≤ ' + MOBILE_BREAKPOINT + 'px)',
          suggestedFix: 'grid-template-columns: ' + suggestion + ';',
          autoFixAvailable: true,
          affectedViewports: ['mobile'],
        });
      }
    }

    // Detect auto-fit without minmax
    if ((decl.property === 'gridTemplateColumns' || decl.property === 'grid-template-columns') &&
        typeof decl.value === 'string' &&
        decl.value.includes('auto-fit') &&
        !decl.value.includes('minmax')) {
      issues.push({
        ruleId: rule.id,
        selector: rule.selector,
        property: decl.property,
        currentValue: decl.value,
        severity: 'info',
        category: 'grid',
        message: 'auto-fit without minmax() may collapse to 0 on empty containers. Consider: repeat(auto-fit, minmax(250px, 1fr))',
        suggestedFix: 'grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));',
        autoFixAvailable: true,
        affectedViewports: ['all'],
      });
    }
  }

  return issues;
}

/**
 * Detect large font sizes that need responsive scaling.
 */
function detectLargeTypography(rule: IRRule): ResponsiveIssue[] {
  const issues: ResponsiveIssue[] = [];

  for (const decl of rule.declarations) {
    if ((decl.property === 'fontSize' || decl.property === 'font-size') &&
        typeof decl.value === 'string') {
      const pxMatch = decl.value.match(/^(\d+(\.\d+)?)px$/);
      if (pxMatch) {
        const px = parseFloat(pxMatch[1]);
        if (px > LARGE_FONT_THRESHOLD) {
          const minSize = Math.round(px * 0.5);
          issues.push({
            ruleId: rule.id,
            selector: rule.selector,
            property: decl.property,
            currentValue: decl.value,
            severity: 'warning',
            category: 'typography',
            message: 'font-size: ' + decl.value + ' may be too large on mobile. Consider responsive scaling.',
            suggestedFix: 'font-size: clamp(' + minSize + 'px, ' + Math.round(px / TABLET_BREAKPOINT * 100) + 'vw, ' + px + 'px);',
            autoFixAvailable: true,
            affectedViewports: ['mobile', 'tablet'],
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Detect large padding on fixed elements.
 */
function detectLargeSpacing(rule: IRRule): ResponsiveIssue[] {
  const issues: ResponsiveIssue[] = [];

  for (const decl of rule.declarations) {
    if ((decl.property === 'padding' || decl.property.startsWith('padding')) &&
        typeof decl.value === 'string') {
      const pxMatch = decl.value.match(/^(\d+(\.\d+)?)px$/);
      if (pxMatch) {
        const px = parseFloat(pxMatch[1]);
        if (px > LARGE_PADDING_THRESHOLD) {
          issues.push({
            ruleId: rule.id,
            selector: rule.selector,
            property: decl.property,
            currentValue: decl.value,
            severity: 'info',
            category: 'spacing',
            message: decl.property + ': ' + decl.value + ' may be excessive on mobile. Consider reducing to ' + Math.round(px * 0.5) + 'px on small screens.',
            suggestedFix: '@media (max-width: 768px) { ' + rule.selector + ' { ' + decl.property + ': ' + Math.round(px * 0.5) + 'px; } }',
            autoFixAvailable: true,
            affectedViewports: ['mobile'],
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Detect height: 100vh that should use dvh.
 */
function detectViewportUnits(rule: IRRule): ResponsiveIssue[] {
  const issues: ResponsiveIssue[] = [];

  for (const decl of rule.declarations) {
    if ((decl.property === 'height' || decl.property === 'min-height') &&
        typeof decl.value === 'string' &&
        decl.value.includes('100vh')) {
      issues.push({
        ruleId: rule.id,
        selector: rule.selector,
        property: decl.property,
        currentValue: decl.value,
        severity: 'warning',
        category: 'viewport',
        message: '100vh can cause issues on mobile browsers with dynamic toolbars. Consider 100dvh instead.',
        suggestedFix: decl.property + ': 100dvh;',
        autoFixAvailable: true,
        affectedViewports: ['mobile'],
      });
    }
  }

  return issues;
}

/**
 * Detect large gaps.
 */
function detectLargeGaps(rule: IRRule): ResponsiveIssue[] {
  const issues: ResponsiveIssue[] = [];

  for (const decl of rule.declarations) {
    if ((decl.property === 'gap' || decl.property === 'grid-gap') &&
        typeof decl.value === 'string') {
      const pxMatch = decl.value.match(/^(\d+(\.\d+)?)px$/);
      if (pxMatch) {
        const px = parseFloat(pxMatch[1]);
        if (px > LARGE_GAP_THRESHOLD) {
          issues.push({
            ruleId: rule.id,
            selector: rule.selector,
            property: decl.property,
            currentValue: decl.value,
            severity: 'info',
            category: 'spacing',
            message: 'gap: ' + decl.value + ' may be too large on mobile. Consider reducing to ' + Math.round(px * 0.5) + 'px on small screens.',
            suggestedFix: '@media (max-width: 768px) { ' + rule.selector + ' { gap: ' + Math.round(px * 0.5) + 'px; } }',
            autoFixAvailable: true,
            affectedViewports: ['mobile'],
          });
        }
      }
    }
  }

  return issues;
}

// ============================================================================
// IR Pass
// ============================================================================

/**
 * Responsive Inference IR pass.
 * Detects responsive issues and adds diagnostics with suggested fixes.
 */
export const responsiveInferencePass: IRPass = (ir: StyleIR): StyleIR => {
  const allIssues: ResponsiveIssue[] = [];

  for (const rule of ir.rules) {
    if (rule.isDead) continue;

    allIssues.push(...detectFixedWidth(rule));
    allIssues.push(...detectGridColumns(rule));
    allIssues.push(...detectLargeTypography(rule));
    allIssues.push(...detectLargeSpacing(rule));
    allIssues.push(...detectViewportUnits(rule));
    allIssues.push(...detectLargeGaps(rule));
  }

  // Convert issues to IR diagnostics
  for (const issue of allIssues) {
    ir.diagnostics.push({
      id: 'responsive-' + issue.category + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      nodeId: issue.ruleId,
      severity: issue.severity,
      message: issue.message,
      suggestion: issue.suggestedFix,
      pass: 'responsive-inference',
    });
  }

  // Store for reporting
  ir.meta = ir.meta || {};
  (ir.meta as any).responsiveIssues = allIssues;

  return ir;
};

// ============================================================================
// Standalone API
// ============================================================================

/**
 * Analyze declarations and return responsive issues.
 */
export function analyzeResponsive(
  selector: string,
  declarations: Record<string, string | number>
): ResponsiveIssue[] {
  const rule: IRRule = {
    id: 'temp-responsive',
    selector,
    declarations: Object.entries(declarations).map(([prop, value]) => ({
      id: 'temp-' + prop,
      property: prop,
      value,
      history: [],
      meta: {},
    })),
    pseudoClasses: [],
    atRules: [],
    nestedRules: [],
    conditions: [],
    isDead: false,
    specificity: 0,
    hash: '',
    source: {},
    history: [],
    meta: {},
  };

  return [
    ...detectFixedWidth(rule),
    ...detectGridColumns(rule),
    ...detectLargeTypography(rule),
    ...detectLargeSpacing(rule),
    ...detectViewportUnits(rule),
    ...detectLargeGaps(rule),
  ];
}

/**
 * Generate a full responsive report.
 */
export function generateResponsiveReport(issues: ResponsiveIssue[]): ResponsiveReport {
  const critical = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  const info = issues.filter(i => i.severity === 'info');

  let summary: string;
  if (issues.length === 0) {
    summary = '✅ No responsive issues detected.';
  } else if (critical.length > 0) {
    summary = '❌ ' + critical.length + ' critical, ' + warnings.length + ' warnings, ' + info.length + ' suggestions.';
  } else if (warnings.length > 0) {
    summary = '⚠️ ' + warnings.length + ' warnings, ' + info.length + ' suggestions.';
  } else {
    summary = '💡 ' + info.length + ' responsive suggestions.';
  }

  return {
    issues,
    criticalCount: critical.length,
    warningCount: warnings.length,
    infoCount: info.length,
    summary,
  };
}

/**
 * Auto-fix a single responsive issue.
 */
export function autoFixIssue(issue: ResponsiveIssue): string {
  return issue.suggestedFix;
}

/**
 * Auto-fix all auto-fixable issues.
 */
export function autoFixAll(issues: ResponsiveIssue[]): string[] {
  return issues
    .filter(i => i.autoFixAvailable)
    .map(i => i.suggestedFix);
}

// ============================================================================
// Quick API
// ============================================================================

export const responsiveInference = {
  analyze: analyzeResponsive,
  report: generateResponsiveReport,
  autoFix: autoFixIssue,
  autoFixAll,
  pass: responsiveInferencePass,
};

export default responsiveInference;

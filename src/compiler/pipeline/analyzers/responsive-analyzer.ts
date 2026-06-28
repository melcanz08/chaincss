// src/compiler/pipeline/analyzers/responsive-analyzer.ts

import type { StyleIR, IRRule } from '../ir/types.js';
import type { AnalysisPass, AnalysisResult, AnalysisAnnotation } from '../pipeline-types.js';

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;
const LARGE_FONT_THRESHOLD = 32;
const LARGE_PADDING_THRESHOLD = 48;
const LARGE_GAP_THRESHOLD = 32;
const MAX_GRID_COLUMNS = 2;

interface ResponsiveIssue {
  ruleId: string;
  selector: string;
  property: string;
  currentValue: string;
  severity: 'error' | 'warning' | 'info';
  category: 'overflow' | 'grid' | 'typography' | 'spacing' | 'viewport' | 'columns';
  message: string;
  suggestedFix: string;
  autoFixAvailable: boolean;
}

function detectFixedWidth(rule: IRRule): ResponsiveIssue[] {
  const issues: ResponsiveIssue[] = [];
  for (const decl of rule.declarations) {
    if ((decl.property === 'width' || decl.property === 'max-width') && typeof decl.value === 'string') {
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
            message: `Fixed ${decl.property}: ${decl.value} will overflow on viewports < ${px}px`,
            suggestedFix: `${decl.property}: min(100%, ${decl.value});`,
            autoFixAvailable: true,
          });
        }
      }
    }
  }
  return issues;
}

function detectGridColumns(rule: IRRule): ResponsiveIssue[] {
  const issues: ResponsiveIssue[] = [];
  for (const decl of rule.declarations) {
    if ((decl.property === 'gridTemplateColumns' || decl.property === 'grid-template-columns') && typeof decl.value === 'string') {
      const columns = decl.value.split(/\s+/).filter(c => c.includes('fr') || c.includes('px') || c.includes('%'));
      if (columns.length > MAX_GRID_COLUMNS) {
        issues.push({
          ruleId: rule.id, selector: rule.selector, property: decl.property, currentValue: decl.value,
          severity: columns.length >= 4 ? 'error' : 'warning',
          category: 'grid',
          message: `${columns.length} columns will not fit on mobile screens (≤ ${MOBILE_BREAKPOINT}px)`,
          suggestedFix: `grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));`,
          autoFixAvailable: true,
        });
      }
    }
  }
  return issues;
}

function detectLargeTypography(rule: IRRule): ResponsiveIssue[] {
  const issues: ResponsiveIssue[] = [];
  for (const decl of rule.declarations) {
    if ((decl.property === 'fontSize' || decl.property === 'font-size') && typeof decl.value === 'string') {
      const pxMatch = decl.value.match(/^(\d+(\.\d+)?)px$/);
      if (pxMatch) {
        const px = parseFloat(pxMatch[1]);
        if (px > LARGE_FONT_THRESHOLD) {
          const minSize = Math.round(px * 0.5);
          issues.push({
            ruleId: rule.id, selector: rule.selector, property: decl.property, currentValue: decl.value,
            severity: 'warning', category: 'typography',
            message: `font-size: ${decl.value} may be too large on mobile. Consider responsive scaling.`,
            suggestedFix: `font-size: clamp(${minSize}px, ${Math.round(px / TABLET_BREAKPOINT * 100)}vw, ${px}px);`,
            autoFixAvailable: true,
          });
        }
      }
    }
  }
  return issues;
}

function detectViewportUnits(rule: IRRule): ResponsiveIssue[] {
  const issues: ResponsiveIssue[] = [];
  for (const decl of rule.declarations) {
    if ((decl.property === 'height' || decl.property === 'min-height') && typeof decl.value === 'string' && decl.value.includes('100vh')) {
      issues.push({
        ruleId: rule.id, selector: rule.selector, property: decl.property, currentValue: decl.value,
        severity: 'warning', category: 'viewport',
        message: '100vh can cause issues on mobile browsers with dynamic toolbars. Consider 100dvh instead.',
        suggestedFix: `${decl.property}: 100dvh;`,
        autoFixAvailable: true,
      });
    }
  }
  return issues;
}

export const responsiveAnalyzer: AnalysisPass = {
  name: 'responsive-analyzer',

  analyze(ir: StyleIR): AnalysisResult {
    const annotations: AnalysisAnnotation[] = [];
    const allIssues: ResponsiveIssue[] = [];

    for (const rule of ir.rules) {
      if (rule.isDead) continue;
      const issues = [
        ...detectFixedWidth(rule),
        ...detectGridColumns(rule),
        ...detectLargeTypography(rule),
        ...detectViewportUnits(rule),
      ];
      allIssues.push(...issues);

      if (issues.length > 0) {
        annotations.push({
          nodeId: rule.id,
          type: 'responsive-issues',
          data: { issues, count: issues.length },
          confidence: issues.some(i => i.severity === 'error') ? 1 : 0.7,
        });
      }
    }

    // Add diagnostics for all issues
    for (const issue of allIssues) {
      ir.diagnostics.push({
        id: `responsive-${issue.category}-${issue.ruleId}`,
        nodeId: issue.ruleId,
        severity: issue.severity,
        message: issue.message,
        suggestion: issue.suggestedFix,
        pass: 'responsive-analyzer',
      });
    }

    return { ir, annotations };
  },
};
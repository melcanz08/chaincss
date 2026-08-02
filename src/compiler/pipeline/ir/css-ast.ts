// src/compiler/pipeline/ir/css-ast.ts
// CSS Value AST — tree representation for algebraic optimization

// ============================================================================
// AST Node Types
// ============================================================================

export type CSSValueNode =
  | DimensionNode
  | NumberNode
  | PercentageNode
  | ColorNode
  | KeywordNode
  | StringNode
  | FunctionNode
  | BinaryExpression
  | UnaryExpression
  | VariableNode
  | ListExpression;

export interface DimensionNode {
  kind: "dimension";
  value: number;
  unit: string;
}

export interface NumberNode {
  kind: "number";
  value: number;
}

export interface PercentageNode {
  kind: "percentage";
  value: number;
}

export interface ColorNode {
  kind: "color";
  hex: string;
  r?: number;
  g?: number;
  b?: number;
  a?: number;
}

export interface KeywordNode {
  kind: "keyword";
  value: string;
}

export interface StringNode {
  kind: "string";
  value: string;
}

export interface FunctionNode {
  kind: "function";
  name: string;
  args: CSSValueNode[];
}

export type BinaryOperator = "+" | "-" | "*" | "/";

export interface BinaryExpression {
  kind: "binary";
  operator: BinaryOperator;
  left: CSSValueNode;
  right: CSSValueNode;
}

export interface UnaryExpression {
  kind: "unary";
  operator: "+" | "-";
  argument: CSSValueNode;
}

export interface VariableNode {
  kind: "variable";
  name: string;
  fallback?: CSSValueNode;
}

export interface ListExpression {
  kind: "list";
  items: CSSValueNode[];
  separator: " " | ",";
}

// ============================================================================
// Parser: CSS value string → AST
// ============================================================================

/**
 * Parse a CSS value string into an AST.
 * Handles dimensions, percentages, colors, functions, calc(), and variables.
 */
export function parseCSSValue(input: string): CSSValueNode {
  const trimmed = input.trim();

  // Try numeric values
  const dimensionMatch = trimmed.match(
    /^(-?\d+(?:\.\d+)?)(px|em|rem|vh|vw|%|ms|s|deg|rad|ch|ex|cm|mm|in|pt|pc|dpi|dpcm|dppx)$/i,
  );
  if (dimensionMatch) {
    const value = parseFloat(dimensionMatch[1]);
    const unit = dimensionMatch[2].toLowerCase();
    if (unit === "%") return { kind: "percentage", value };
    return { kind: "dimension", value, unit };
  }

  const numberMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)$/);
  if (numberMatch) {
    return { kind: "number", value: parseFloat(numberMatch[1]) };
  }

  // Colors
  const hexMatch = trimmed.match(/^#([0-9a-fA-F]{3,8})$/);
  if (hexMatch) {
    return { kind: "color", hex: trimmed };
  }

  // Functions: calc(), var(), rgb(), etc.
  const funcMatch = trimmed.match(/^([a-zA-Z-]+)\((.+)\)$/s);
  if (funcMatch) {
    const name = funcMatch[1].toLowerCase();
    const argsStr = funcMatch[2];

    if (name === "calc") {
      return parseCalcExpression(argsStr);
    }

    if (name === "var") {
      return parseVariable(argsStr);
    }

    // Generic function
    const args = splitArgs(argsStr).map(parseCSSValue);
    return { kind: "function", name, args };
  }

  // List values (space or comma separated)
  if (
    trimmed.includes(" ") &&
    !trimmed.startsWith('"') &&
    !trimmed.startsWith("'")
  ) {
    const items = trimmed.split(/\s+/).map(parseCSSValue);
    if (items.length > 1) {
      return { kind: "list", items, separator: " " };
    }
  }

  if (trimmed.includes(",")) {
    const items = trimmed.split(",").map((s) => parseCSSValue(s.trim()));
    if (items.length > 1) {
      return { kind: "list", items, separator: "," };
    }
  }

  // Keywords: solid, none, auto, etc.
  return { kind: "keyword", value: trimmed };
}

function parseCalcExpression(input: string): CSSValueNode {
  return parseExpression(input);
}

function parseVariable(input: string): VariableNode {
  const parts = input.split(",");
  const name = parts[0].trim();
  const fallback =
    parts.length > 1
      ? parseCSSValue(parts.slice(1).join(",").trim())
      : undefined;
  return { kind: "variable", name, fallback };
}

function parseExpression(input: string): CSSValueNode {
  // Remove outer parentheses
  let expr = input.trim();
  if (expr.startsWith("(") && expr.endsWith(")")) {
    expr = expr.slice(1, -1).trim();
  }

  // Find the lowest-precedence operator (+ or -) not inside parens
  let depth = 0;
  let opIndex = -1;
  let op: BinaryOperator | null = null;

  for (let i = expr.length - 1; i >= 0; i--) {
    const ch = expr[i];
    if (ch === ")") depth++;
    if (ch === "(") depth--;
    if (depth === 0) {
      if (ch === "+" || ch === "-") {
        // Check it's not a sign prefix
        if (i > 0 && expr[i - 1] !== "(" && expr[i - 1] !== " ") {
          opIndex = i;
          op = ch as BinaryOperator;
          break;
        }
      }
    }
  }

  if (op && opIndex > 0) {
    const left = parseExpression(expr.slice(0, opIndex).trim());
    const right = parseExpression(expr.slice(opIndex + 1).trim());
    return { kind: "binary", operator: op, left, right };
  }

  // Try multiplication/division (higher precedence)
  depth = 0;
  for (let i = expr.length - 1; i >= 0; i--) {
    const ch = expr[i];
    if (ch === ")") depth++;
    if (ch === "(") depth--;
    if (depth === 0 && (ch === "*" || ch === "/")) {
      const left = parseExpression(expr.slice(0, i).trim());
      const right = parseExpression(expr.slice(i + 1).trim());
      return { kind: "binary", operator: ch as BinaryOperator, left, right };
    }
  }

  // Base case: single value
  return parseCSSValue(expr);
}

function splitArgs(input: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = "";

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      args.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }

  if (current.trim()) args.push(current.trim());
  return args;
}

// ============================================================================
// Optimizer: Simplify AST expressions
// ============================================================================

/**
 * Optimize a CSS value AST by evaluating constant expressions.
 * E.g., calc(50px + 50px) → 100px
 */
export function optimizeAST(node: CSSValueNode): CSSValueNode {
  switch (node.kind) {
    case "binary": {
      const left = optimizeAST(node.left);
      const right = optimizeAST(node.right);

      // Constant folding: both sides are dimensions with same unit
      if (
        left.kind === "dimension" &&
        right.kind === "dimension" &&
        left.unit === right.unit
      ) {
        const result = evaluateBinary(left.value, right.value, node.operator);
        if (result !== null) {
          return { kind: "dimension", value: result, unit: left.unit };
        }
      }

      // Constant folding: both sides are numbers
      if (left.kind === "number" && right.kind === "number") {
        const result = evaluateBinary(left.value, right.value, node.operator);
        if (result !== null) {
          return { kind: "number", value: result };
        }
      }

      // Constant folding: percentage + percentage
      if (left.kind === "percentage" && right.kind === "percentage") {
        const result = evaluateBinary(left.value, right.value, node.operator);
        if (result !== null) {
          return { kind: "percentage", value: result };
        }
      }

      // Identity operations: x + 0 = x, x - 0 = x, x * 1 = x, x / 1 = x
      if (
        right.kind === "number" &&
        right.value === 0 &&
        (node.operator === "+" || node.operator === "-")
      ) {
        return left;
      }
      if (
        right.kind === "number" &&
        right.value === 1 &&
        node.operator === "*"
      ) {
        return left;
      }
      if (
        right.kind === "number" &&
        right.value === 1 &&
        node.operator === "/"
      ) {
        return left;
      }
      if (left.kind === "number" && left.value === 0 && node.operator === "+") {
        return right;
      }

      // Zero operations: 0 * x = 0, 0 / x = 0
      if (
        left.kind === "number" &&
        left.value === 0 &&
        (node.operator === "*" || node.operator === "/")
      ) {
        return { kind: "number", value: 0 };
      }

      return { ...node, left, right };
    }

    case "function": {
      return { ...node, args: node.args.map(optimizeAST) };
    }

    case "list": {
      return { ...node, items: node.items.map(optimizeAST) };
    }

    default:
      return node;
  }
}

function evaluateBinary(
  a: number,
  b: number,
  op: BinaryOperator,
): number | null {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      return b !== 0 ? a / b : null;
  }
}

// ============================================================================
// Printer: AST → CSS string
// ============================================================================

/**
 * Convert an AST node back to a CSS string.
 */
export function printAST(node: CSSValueNode): string {
  switch (node.kind) {
    case "dimension":
      return `${node.value}${node.unit}`;
    case "number":
      return String(node.value);
    case "percentage":
      return `${node.value}%`;
    case "color":
      return node.hex;
    case "keyword":
      return node.value;
    case "string":
      return `"${node.value}"`;
    case "function":
      return `${node.name}(${node.args.map(printAST).join(", ")})`;
    case "binary":
      return `(${printAST(node.left)} ${node.operator} ${printAST(node.right)})`;
    case "unary":
      return `${node.operator}${printAST(node.argument)}`;
    case "variable":
      return node.fallback
        ? `var(${node.name}, ${printAST(node.fallback)})`
        : `var(${node.name})`;
    case "list":
      return node.items.map(printAST).join(node.separator === " " ? " " : ", ");
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if two AST nodes are equal.
 */
export function astEqual(a: CSSValueNode, b: CSSValueNode): boolean {
  return printAST(a) === printAST(b);
}

/**
 * Get the computed value if the AST is fully constant (no variables).
 */
export function isConstant(node: CSSValueNode): boolean {
  switch (node.kind) {
    case "variable":
      return false;
    case "binary":
      return isConstant(node.left) && isConstant(node.right);
    case "function":
      return node.args.every(isConstant);
    case "list":
      return node.items.every(isConstant);
    default:
      return true;
  }
}

/**
 * Convert a ParsedValue (from existing IR) to the new AST format.
 */
export function fromParsedValue(parsed: any): CSSValueNode {
  if (!parsed || !parsed.kind)
    return { kind: "keyword", value: String(parsed) };

  switch (parsed.kind) {
    case "dimension":
      return { kind: "dimension", value: parsed.value, unit: parsed.unit };
    case "number":
      return { kind: "number", value: parsed.value };
    case "keyword":
      return { kind: "keyword", value: parsed.value };
    case "color":
      return { kind: "color", hex: parsed.hex };
    case "function":
      return {
        kind: "function",
        name: parsed.name,
        args: (parsed.args || []).map(fromParsedValue),
      };
    case "list":
      return {
        kind: "list",
        items: (parsed.items || []).map(fromParsedValue),
        separator: " ",
      };
    case "raw":
      return parseCSSValue(parsed.value);
    default:
      return { kind: "keyword", value: String(parsed) };
  }
}

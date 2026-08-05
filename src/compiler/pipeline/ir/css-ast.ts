// ============================================================================
// FILE: src/compiler/pipeline/ir/css-ast.ts
// CSS Value AST — tree representation for algebraic optimization
// ============================================================================

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

const DIMENSION_REGEX =
  /^(-?\d+(?:\.\d+)?)(px|em|rem|vh|vw|%|ms|s|deg|rad|ch|ex|cm|mm|in|pt|pc|dpi|dpcm|dppx)$/i;

/**
 * Parse a CSS value string into an AST.
 * Handles dimensions, percentages, colors, functions, calc(), and variables.
 */
export function parseCSSValue(input: string): CSSValueNode {
  const trimmed = input.trim();
  if (!trimmed) return { kind: "keyword", value: "" };

  // Try dimension or percentage
  const dimensionMatch = trimmed.match(DIMENSION_REGEX);
  if (dimensionMatch) {
    const value = parseFloat(dimensionMatch[1]);
    const unit = dimensionMatch[2].toLowerCase();
    if (unit === "%") return { kind: "percentage", value };
    return { kind: "dimension", value, unit };
  }

  // Pure numbers
  const numberMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)$/);
  if (numberMatch) {
    return { kind: "number", value: parseFloat(numberMatch[1]) };
  }

  // Hex Colors
  if (/^#([0-9a-fA-F]{3,8})$/.test(trimmed)) {
    return { kind: "color", hex: trimmed };
  }

  // Functions: calc(), var(), rgb(), etc.
  const funcMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\((.*)\)$/s);
  if (funcMatch) {
    const name = funcMatch[1].toLowerCase();
    const argsStr = funcMatch[2];

    if (name === "calc") {
      return parseCalcExpression(argsStr);
    }

    if (name === "var") {
      return parseVariable(argsStr);
    }

    // Generic function (min, max, clamp, rgba, etc.)
    const args = splitArgs(argsStr).map(parseCSSValue);
    return { kind: "function", name, args };
  }

  // Strings
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return { kind: "string", value: trimmed.slice(1, -1) };
  }

  // List values (space or comma separated)
  if (trimmed.includes(",")) {
    const items = splitArgs(trimmed).map((s) => parseCSSValue(s.trim()));
    if (items.length > 1) {
      return { kind: "list", items, separator: "," };
    }
  }

  if (trimmed.includes(" ")) {
    const items = trimmed.split(/\s+/).map(parseCSSValue);
    if (items.length > 1) {
      return { kind: "list", items, separator: " " };
    }
  }

  // Keywords: solid, none, auto, etc.
  return { kind: "keyword", value: trimmed };
}

function parseCalcExpression(input: string): CSSValueNode {
  const expr = parseExpression(input);
  // If the parsed result is a raw binary expression, wrap in calc() function node
  if (expr.kind === "binary") {
    return { kind: "function", name: "calc", args: [expr] };
  }
  return expr;
}

function parseVariable(input: string): VariableNode {
  const parts = splitArgs(input);
  const name = parts[0].trim();
  const fallback =
    parts.length > 1
      ? parseCSSValue(parts.slice(1).join(",").trim())
      : undefined;
  return { kind: "variable", name, fallback };
}

function parseExpression(input: string): CSSValueNode {
  let expr = input.trim();

  // Strip matching outer parentheses
  while (expr.startsWith("(") && expr.endsWith(")")) {
    let depth = 0;
    let validEnclosure = true;
    for (let i = 0; i < expr.length - 1; i++) {
      if (expr[i] === "(") depth++;
      if (expr[i] === ")") depth--;
      if (depth === 0) {
        validEnclosure = false;
        break;
      }
    }
    if (validEnclosure) {
      expr = expr.slice(1, -1).trim();
    } else {
      break;
    }
  }

  // Find lowest-precedence operator (+ or -) outside parentheses
  // Note: CSS spec requires whitespace around + and - in calc()
  let depth = 0;
  for (let i = expr.length - 1; i >= 0; i--) {
    const ch = expr[i];
    if (ch === ")") depth++;
    if (ch === "(") depth--;
    if (depth === 0) {
      if (ch === "+" || ch === "-") {
        const isSpaced =
          i > 0 &&
          i < expr.length - 1 &&
          (expr[i - 1] === " " || expr[i + 1] === " ");
        if (isSpaced) {
          const left = parseExpression(expr.slice(0, i).trim());
          const right = parseExpression(expr.slice(i + 1).trim());
          return {
            kind: "binary",
            operator: ch as BinaryOperator,
            left,
            right,
          };
        }
      }
    }
  }

  // Multiplication and division (higher precedence, whitespace optional)
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

  // Base case
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
    case "unary": {
      const arg = optimizeAST(node.argument);
      if (node.operator === "-" && arg.kind === "number") {
        return { kind: "number", value: -arg.value };
      }
      if (node.operator === "-" && arg.kind === "dimension") {
        return { kind: "dimension", value: -arg.value, unit: arg.unit };
      }
      if (node.operator === "+") return arg;
      return { ...node, argument: arg };
    }

    case "binary": {
      const left = optimizeAST(node.left);
      const right = optimizeAST(node.right);

      // 1. Same-unit dimension arithmetic (addition / subtraction)
      if (
        left.kind === "dimension" &&
        right.kind === "dimension" &&
        left.unit === right.unit &&
        (node.operator === "+" || node.operator === "-")
      ) {
        const result = evaluateBinary(left.value, right.value, node.operator);
        if (result !== null) {
          return { kind: "dimension", value: result, unit: left.unit };
        }
      }

      // 2. Dimension scaling (dimension * number, dimension / number, number * dimension)
      if (
        left.kind === "dimension" &&
        right.kind === "number" &&
        (node.operator === "*" || node.operator === "/")
      ) {
        const result = evaluateBinary(left.value, right.value, node.operator);
        if (result !== null) {
          return { kind: "dimension", value: result, unit: left.unit };
        }
      }
      if (
        left.kind === "number" &&
        right.kind === "dimension" &&
        node.operator === "*"
      ) {
        return {
          kind: "dimension",
          value: left.value * right.value,
          unit: right.unit,
        };
      }

      // 3. Constant numbers folding
      if (left.kind === "number" && right.kind === "number") {
        const result = evaluateBinary(left.value, right.value, node.operator);
        if (result !== null) {
          return { kind: "number", value: result };
        }
      }

      // 4. Percentage folding
      if (
        left.kind === "percentage" &&
        right.kind === "percentage" &&
        (node.operator === "+" || node.operator === "-")
      ) {
        const result = evaluateBinary(left.value, right.value, node.operator);
        if (result !== null) {
          return { kind: "percentage", value: result };
        }
      }

      // 5. Identity operations: x + 0 = x, x - 0 = x, x * 1 = x, x / 1 = x
      if (
        (right.kind === "number" || right.kind === "dimension") &&
        right.value === 0 &&
        (node.operator === "+" || node.operator === "-")
      ) {
        return left;
      }
      if (
        right.kind === "number" &&
        right.value === 1 &&
        (node.operator === "*" || node.operator === "/")
      ) {
        return left;
      }
      if (
        left.kind === "number" &&
        left.value === 0 &&
        node.operator === "+"
      ) {
        return right;
      }
      if (
        left.kind === "number" &&
        left.value === 1 &&
        node.operator === "*"
      ) {
        return right;
      }

      // 6. Zero multiplication/division
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
      const optimizedArgs = node.args.map(optimizeAST);

      // Unwrap redundant calc() containing a single scalar constant
      if (node.name === "calc" && optimizedArgs.length === 1) {
        const single = optimizedArgs[0];
        if (
          single.kind === "dimension" ||
          single.kind === "number" ||
          single.kind === "percentage"
        ) {
          return single;
        }
      }

      return { ...node, args: optimizedArgs };
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
      return `${printAST(node.left)} ${node.operator} ${printAST(node.right)}`;
    case "unary":
      return `${node.operator}${printAST(node.argument)}`;
    case "variable":
      return node.fallback
        ? `var(${node.name}, ${printAST(node.fallback)})`
        : `var(${node.name})`;
    case "list":
      return node.items
        .map(printAST)
        .join(node.separator === " " ? " " : ", ");
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if two AST nodes are structural equivalents.
 */
export function astEqual(a: CSSValueNode, b: CSSValueNode): boolean {
  return printAST(a) === printAST(b);
}

/**
 * Check if the node is fully constant (no dynamic var() parameters).
 */
export function isConstant(node: CSSValueNode): boolean {
  switch (node.kind) {
    case "variable":
      return false;
    case "binary":
      return isConstant(node.left) && isConstant(node.right);
    case "unary":
      return isConstant(node.argument);
    case "function":
      return node.args.every(isConstant);
    case "list":
      return node.items.every(isConstant);
    default:
      return true;
  }
}

/**
 * Convert legacy ParsedValue objects to the AST node format.
 */
export function fromParsedValue(parsed: unknown): CSSValueNode {
  if (!parsed || typeof parsed !== "object") {
    return { kind: "keyword", value: String(parsed ?? "") };
  }

  const record = parsed as Record<string, unknown>;

  switch (record.kind) {
    case "dimension":
      return {
        kind: "dimension",
        value: Number(record.value) || 0,
        unit: String(record.unit || "px"),
      };
    case "number":
      return { kind: "number", value: Number(record.value) || 0 };
    case "percentage":
      return { kind: "percentage", value: Number(record.value) || 0 };
    case "keyword":
      return { kind: "keyword", value: String(record.value || "") };
    case "color":
      return { kind: "color", hex: String(record.hex || "") };
    case "function":
      return {
        kind: "function",
        name: String(record.name || ""),
        args: Array.isArray(record.args)
          ? record.args.map(fromParsedValue)
          : [],
      };
    case "list":
      return {
        kind: "list",
        items: Array.isArray(record.items)
          ? record.items.map(fromParsedValue)
          : [],
        separator: " ",
      };
    case "raw":
      return parseCSSValue(String(record.value || ""));
    default:
      return { kind: "keyword", value: String(record.value || "") };
  }
}
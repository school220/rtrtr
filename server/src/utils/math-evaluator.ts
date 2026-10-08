/**
 * Safe Mathematical Expression Parser and Equivalence Checker.
 * STRICT REQUIREMENT: NEVER use eval() or Function() constructor.
 * Supports:
 * - Integers, decimals (with comma or dot: 0.5, 0,5)
 * - Fractions (1/2, 2/4, -3/4)
 * - Mathematical equivalence (e.g. 1/2 == 0.5 == 2/4)
 * - Safe arithmetic operations (+, -, *, /, ^, parentheses)
 * - Text normalization (whitespace, Russian 'ё' -> 'е', case insensitivity)
 * - Alternate acceptable answers (e.g. array of answers or '|' separated)
 */

export interface MathComparisonOptions {
  caseSensitive?: boolean;
  allowEquivalence?: boolean; // default true
  tolerance?: number; // default 1e-7
}

export class MathEvaluator {
  /**
   * Greatest Common Divisor using Euclidean algorithm
   */
  public static gcd(a: number, b: number): number {
    a = Math.abs(Math.round(a));
    b = Math.abs(Math.round(b));
    while (b) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a || 1;
  }

  /**
   * Cleans and normalizes text string
   */
  public static normalizeText(input: string, caseSensitive: boolean = false): string {
    if (!input) return '';
    let res = input
      .trim()
      // Replace non-breaking spaces
      .replace(/\u00A0/g, ' ')
      // Normalize various dashes/minuses to standard ASCII hyphen-minus
      .replace(/[−–—]/g, '-')
      // Replace multiple spaces with a single space
      .replace(/\s+/g, ' ');

    // Normalize Russian 'ё' to 'е'
    res = res.replace(/ё/g, 'е').replace(/Ё/g, 'Е');

    if (!caseSensitive) {
      res = res.toLowerCase();
    }
    return res;
  }

  /**
   * Normalizes math expression input:
   * Strips prefixes like "x = ", "x=", "x ≈ ", "ответ: "
   * Normalizes comma decimal separators when adjacent to digits
   */
  public static normalizeMath(input: string): string {
    let clean = this.normalizeText(input, false);
    // Remove common prefixes
    clean = clean.replace(/^(ответ|ans|answer)\s*[:=]\s*/i, '');
    clean = clean.replace(/^[a-z]\s*=\s*/i, '');

    // Replace comma with dot only between digits: e.g. "0,5" -> "0.5"
    clean = clean.replace(/(\d+),(\d+)/g, '$1.$2');

    // Remove trailing dots or semicolons
    clean = clean.replace(/[.;]+$/, '');

    // Remove internal spaces around operators
    clean = clean.replace(/\s*([+\-*/^()=])\s*/g, '$1');

    return clean.trim();
  }

  /**
   * Parses simple fraction "a/b" or "-a/b"
   */
  public static parseFraction(str: string): { numerator: number; denominator: number; value: number } | null {
    const fractionRegex = /^[+-]?\d+\/[+-]?\d+$/;
    if (!fractionRegex.test(str)) return null;

    const parts = str.split('/');
    if (parts.length !== 2) return null;

    const num = parseInt(parts[0], 10);
    const den = parseInt(parts[1], 10);

    if (isNaN(num) || isNaN(den) || den === 0) return null;

    return {
      numerator: num,
      denominator: den,
      value: num / den,
    };
  }

  /**
   * Safe Arithmetic Expression Evaluator (Recursive Descent Parser).
   * Grammar:
   *   Expression -> Term (( '+' | '-' ) Term)*
   *   Term       -> Factor (( '*' | '/' ) Factor)*
   *   Factor     -> Power ('^' Power)*
   *   Power      -> ('+' | '-')? Primary
   *   Primary    -> Number | '(' Expression ')'
   */
  public static safeEvaluateExpression(expr: string): number | null {
    const clean = this.normalizeMath(expr);
    if (!clean) return null;

    // Tokens validation: only allow digits, '.', '+', '-', '*', '/', '^', '(', ')'
    if (!/^[\d.+\-*/^()]+$/.test(clean)) {
      return null;
    }

    let pos = 0;

    const peek = () => clean[pos] || '';
    const get = () => clean[pos++];

    const parseNumber = (): number | null => {
      let numStr = '';
      while (pos < clean.length && ((clean[pos] >= '0' && clean[pos] <= '9') || clean[pos] === '.')) {
        numStr += get();
      }
      if (numStr === '' || numStr === '.') return null;
      const val = parseFloat(numStr);
      return isNaN(val) ? null : val;
    };

    const parsePrimary = (): number | null => {
      if (peek() === '(') {
        get(); // consume '('
        const val = parseExpression();
        if (val === null || peek() !== ')') return null;
        get(); // consume ')'
        return val;
      }
      return parseNumber();
    };

    const parsePower = (): number | null => {
      let sign = 1;
      if (peek() === '+') {
        get();
      } else if (peek() === '-') {
        get();
        sign = -1;
      }
      const val = parsePrimary();
      return val === null ? null : sign * val;
    };

    const parseFactor = (): number | null => {
      let left = parsePower();
      if (left === null) return null;

      while (peek() === '^') {
        get(); // consume '^'
        const right = parsePower();
        if (right === null) return null;
        left = Math.pow(left, right);
      }
      return left;
    };

    const parseTerm = (): number | null => {
      let left = parseFactor();
      if (left === null) return null;

      while (peek() === '*' || peek() === '/') {
        const op = get();
        const right = parseFactor();
        if (right === null) return null;
        if (op === '*') {
          left = left * right;
        } else {
          if (Math.abs(right) < 1e-12) return null; // Division by zero
          left = left / right;
        }
      }
      return left;
    };

    const parseExpression = (): number | null => {
      let left = parseTerm();
      if (left === null) return null;

      while (peek() === '+' || peek() === '-') {
        const op = get();
        const right = parseTerm();
        if (right === null) return null;
        if (op === '+') {
          left = left + right;
        } else {
          left = left - right;
        }
      }
      return left;
    };

    try {
      const result = parseExpression();
      if (pos < clean.length) return null; // Unparsed trailing characters
      if (result === null || !isFinite(result)) return null;
      return result;
    } catch {
      return null;
    }
  }

  /**
   * Parses candidate answer into numeric value if possible
   */
  public static parseNumeric(input: string): number | null {
    const clean = this.normalizeMath(input);
    if (!clean) return null;

    // Check fraction first
    const frac = this.parseFraction(clean);
    if (frac !== null) return frac.value;

    // Check decimal/integer
    if (/^[+-]?\d+(\.\d+)?$/.test(clean)) {
      const n = parseFloat(clean);
      return isNaN(n) ? null : n;
    }

    // Try evaluating expression safely
    return this.safeEvaluateExpression(clean);
  }

  /**
   * Compares student answer to the expected correct answer(s)
   */
  public static isEquivalent(
    studentAnswer: string,
    expectedAnswer: string,
    acceptedAlternates: string[] = [],
    options: MathComparisonOptions = {}
  ): boolean {
    const { caseSensitive = false, allowEquivalence = true, tolerance = 1e-7 } = options;

    if (!studentAnswer || !expectedAnswer) return false;

    // Collect all expected candidates
    const candidates = [expectedAnswer, ...acceptedAlternates];
    // Also support piped candidates "1/2|0.5|0,5"
    const allExpected: string[] = [];
    for (const cand of candidates) {
      if (cand.includes('|')) {
        cand.split('|').forEach(c => allExpected.push(c.trim()));
      } else {
        allExpected.push(cand.trim());
      }
    }

    const normStudent = this.normalizeText(studentAnswer, caseSensitive);
    const mathStudent = this.normalizeMath(studentAnswer);

    // 1. Exact string match after normalization
    for (const exp of allExpected) {
      const normExp = this.normalizeText(exp, caseSensitive);
      if (normStudent === normExp) return true;
      if (mathStudent && mathStudent === this.normalizeMath(exp)) return true;
    }

    // 2. Mathematical equivalence
    if (allowEquivalence) {
      const studentNum = this.parseNumeric(studentAnswer);
      if (studentNum !== null) {
        for (const exp of allExpected) {
          const expNum = this.parseNumeric(exp);
          if (expNum !== null) {
            if (Math.abs(studentNum - expNum) <= tolerance) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }
}

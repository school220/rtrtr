import React from 'react';
import katex from 'katex';

interface MathRendererProps {
  content: string;
  className?: string;
  displayMode?: boolean;
}

/**
 * Normalizes text to ensure all mathematical notation (Desmos-style, raw LaTeX, unicode math)
 * renders smoothly and correctly with KaTeX.
 */
export function normalizeMathText(raw: string): string {
  if (!raw) return '';

  let text = String(raw);

  // Helper to replace unicode math symbols with standard LaTeX equivalents
  const replaceUnicodeSymbols = (s: string) => {
    return s
      .replace(/≤/g, '\\le ')
      .replace(/≥/g, '\\ge ')
      .replace(/≠/g, '\\neq ')
      .replace(/±/g, '\\pm ')
      .replace(/∓/g, '\\mp ')
      .replace(/·/g, '\\cdot ')
      .replace(/×/g, '\\times ')
      .replace(/÷/g, '\\div ')
      .replace(/²/g, '^{2}')
      .replace(/³/g, '^{3}')
      .replace(/⁴/g, '^{4}')
      .replace(/°/g, '^{\\circ}')
      .replace(/π/g, '\\pi ')
      .replace(/∞/g, '\\infty ')
      .replace(/≈/g, '\\approx ')
      .replace(/≡/g, '\\equiv ')
      .replace(/α/g, '\\alpha ')
      .replace(/β/g, '\\beta ')
      .replace(/γ/g, '\\gamma ')
      .replace(/Δ/g, '\\Delta ')
      .replace(/∑/g, '\\sum ')
      .replace(/∫/g, '\\int ')
      .replace(/³√([0-9a-zA-Z]+)/g, '\\sqrt[3]{$1}')
      .replace(/³√\{([^}]+)\}/g, '\\sqrt[3]{$1}')
      .replace(/³√\(([^)]+)\)/g, '\\sqrt[3]{$1}')
      .replace(/√([0-9a-zA-Z]+)/g, '\\sqrt{$1}')
      .replace(/√\{([^}]+)\}/g, '\\sqrt{$1}')
      .replace(/√\(([^)]+)\)/g, '\\sqrt{$1}');
  };

  const hasDelimiters = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/.test(text);

  // 1. If text already has math delimiters, normalize unicode inside them
  if (hasDelimiters) {
    text = text.replace(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g, (match) => {
      let m = replaceUnicodeSymbols(match);
      // Auto-fix decimal comma in math mode (e.g. $28,5$ -> $28{,}5$)
      m = m.replace(/(\d+),(\d+)/g, '$1{,}$2');
      // Thin space for mixed numbers inside math delimiters
      m = m.replace(/(\d+)\s*\\(d?frac)/g, '$1\\,\\$2');
      return m;
    });

    // Also: if outside delimiters there are unwrapped LaTeX expressions like \frac{...}{...} or \sqrt{...}, wrap them
    const latexOutsideRegex = /(?<!\$|\\\[|\\\()(\\(?:frac|dfrac|sqrt|left|begin)\{[^{}]*\}(?:\{[^{}]*\})?)(?!\$|\\\]|\\\))/g;
    text = text.replace(latexOutsideRegex, '$$1$');

    return text;
  }

  // 2. Text has NO delimiters.
  // Replace unicode math symbols first:
  text = replaceUnicodeSymbols(text);

  // Check for mixed numbers like "4 81/100" or "7 6/10"
  text = text.replace(/(\b\d+)\s+(\d+)\/(\d+\b)/g, '$\\displaystyle $1\\,\\frac{$2}{$3}$');

  // Check for standalone simple fractions like "3/4" or "23/17"
  const singleFrac = text.trim().match(/^([0-9a-zA-Z]+)\/([0-9a-zA-Z]+)$/);
  if (singleFrac) {
    return `$\\displaystyle \\frac{${singleFrac[1]}}{${singleFrac[2]}}$`;
  }

  // Simple decimals like "28,5" or "0,75" or "4.81"
  const singleDecimal = text.trim().match(/^(\d+)[,.](\d+)$/);
  if (singleDecimal) {
    return `$${singleDecimal[1]}{,}${singleDecimal[2]}$`;
  }

  const hasLatex = /\\(?:frac|dfrac|sqrt|cdot|times|div|pm|mp|le|ge|neq|approx|equiv|pi|alpha|beta|gamma|delta|theta|lambda|sigma|omega|Delta|Sigma|sin|cos|tan|cot|sec|csc|tg|ctg|arctg|arcctg|log|ln|lg|left|right|begin|end|int|sum|prod|lim|infty|circ|degree)\b/.test(text);
  const hasCyrillic = /[а-яА-ЯёЁўқғҳЎҚҒҲ]/.test(text);

  // Case A: Standalone math expression without Cyrillic (e.g. "\frac{1}{2}", "x^2 + 5x + 6 = 0", "y = 2x - 1", "\sqrt{16}")
  if (!hasCyrillic && (hasLatex || /[\^_\\]/.test(text) || /^[0-9xXyYzZaAbBcCnN\s+\-*/=()[\].:,]+$/.test(text.trim()))) {
    const trimmed = text.trim();
    if (hasLatex || /[\^_\\]/.test(trimmed) || /[+\-*=]/.test(trimmed) || /^\d+\/\d+$/.test(trimmed)) {
      return `$${trimmed}$`;
    }
  }

  // Case B: Text has natural language words (Russian/Uzbek) mixed with LaTeX commands
  // e.g. "Вычислите значение выражения \frac{a+b}{2} при a=2"
  if (hasLatex) {
    const latexExprRegex = /(\\(?:frac|dfrac|sqrt|pm|mp|cdot|times|div|le|ge|neq|approx|equiv|pi|alpha|beta|gamma|delta|theta|lambda|sigma|omega|Delta|sin|cos|tan|cot|tg|ctg|arctg|arcctg|log|ln|lg|left|right|begin|end|int|sum|prod|lim|infty|circ)(?:\{[^{}]*\}|\[[^[\]]*\]|[a-zA-Z0-9+\-*=^_()\\/\s.,])*?)(?=(?:\s+[а-яА-ЯёЁўқғҳЎҚҒҲ]|\s*$|[.,;?!](?:\s|$)))/g;
    
    let wrapped = text.replace(latexExprRegex, (m) => {
      const clean = m.trim();
      return `$${clean}$`;
    });

    // Also wrap standalone exponents like x^2 or (x+1)^3 if not already in $
    wrapped = wrapped.replace(/(?<!\$)([a-zA-Z0-9()]+(?:\^\{?[0-9a-zA-Z+-]+\}?|_\{?[0-9a-zA-Z+-]+\}?)+)(?!\$)/g, '$$1$');

    return wrapped;
  }

  // Case C: Exponent expression like x^2 or 2^5
  if (/^[a-zA-Z0-9()]+\^[0-9a-zA-Z]+$/.test(text.trim())) {
    return `$${text.trim()}$`;
  }

  return text;
}

/**
 * Helper to render non-math text segments with basic markdown formatting
 * (bold **text**, italic *text*, linebreaks \n) so questions read cleanly.
 */
function renderFormattedText(text: string): React.ReactNode {
  if (!text) return null;

  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    const segments: React.ReactNode[] = [];
    const mdRegex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
    let last = 0;
    let m: RegExpExecArray | null;

    while ((m = mdRegex.exec(line)) !== null) {
      if (m.index > last) {
        segments.push(line.substring(last, m.index));
      }
      const tok = m[0];
      if (tok.startsWith('**') && tok.endsWith('**')) {
        segments.push(
          <strong key={`${lineIdx}-${m.index}`} className="font-bold text-gray-950">
            {tok.slice(2, -2)}
          </strong>
        );
      } else if (tok.startsWith('*') && tok.endsWith('*')) {
        segments.push(
          <em key={`${lineIdx}-${m.index}`} className="italic">
            {tok.slice(1, -1)}
          </em>
        );
      }
      last = mdRegex.lastIndex;
    }

    if (last < line.length) {
      segments.push(line.substring(last));
    }

    return (
      <React.Fragment key={lineIdx}>
        {lineIdx > 0 && <br />}
        {segments}
      </React.Fragment>
    );
  });
}

// Global in-memory HTML cache for parsed KaTeX formulas to guarantee zero rendering lag
const katexHtmlCache = new Map<string, string>();
const MAX_CACHE_SIZE = 1500;

function getCachedKatex(cleanLatex: string, isBlock: boolean): string {
  const cacheKey = `${isBlock ? 'B:' : 'I:'}${cleanLatex}`;
  const hit = katexHtmlCache.get(cacheKey);
  if (hit !== undefined) return hit;

  try {
    const rendered = katex.renderToString(cleanLatex, {
      displayMode: isBlock,
      throwOnError: false,
      output: 'html',
    });
    if (katexHtmlCache.size >= MAX_CACHE_SIZE) {
      const keys = Array.from(katexHtmlCache.keys()).slice(0, 400);
      keys.forEach((k) => katexHtmlCache.delete(k));
    }
    katexHtmlCache.set(cacheKey, rendered);
    return rendered;
  } catch {
    return `<span class="text-rose-700 font-mono font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">${cleanLatex}</span>`;
  }
}

/**
 * Parses and renders text containing LaTeX math formulas using KaTeX.
 * Supports:
 * - $...$ or \(...\) for inline math (rendered large & clear with \displaystyle for fractions)
 * - $$...$$ or \[...\] for block math
 * - Desmos-style raw math expressions without delimiters (auto-detected and normalized)
 * - Automatic comma decimals (28{,}5) to avoid LaTeX spacing gaps
 * - Markdown formatting in text segments
 * - Instant in-memory caching to eliminate CPU rendering lag on phones
 */
const MathRendererBase: React.FC<MathRendererProps> = ({ content, className = '', displayMode = false }) => {
  if (!content) return null;

  let normalized = normalizeMathText(content);

  // Clean up any bold wrappers around math delimiters e.g. **$formula$** -> $formula$
  normalized = normalized.replace(/\*\*\s*(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))\s*\*\*/g, '$1');

  // Helper to safely render KaTeX
  const renderFormula = (latex: string, isBlock: boolean): string => {
    let clean = latex.trim();

    // Auto-fix decimal comma in math mode (e.g. 28,5 -> 28{,}5) so it doesn't leave an awkward space
    clean = clean.replace(/(\d+),(\d+)/g, '$1{,}$2');

    // Mixed numbers: 7\frac{6}{10} -> 7\,\frac{6}{10}
    clean = clean.replace(/(\d+)\s*\\(d?frac)/g, '$1\\,\\$2');

    // Desmos-style display: If not in block mode, ensure fractions, roots, and operators render in \displaystyle
    if (!isBlock && !clean.startsWith('\\text')) {
      if (
        clean.includes('\\frac') ||
        clean.includes('\\dfrac') ||
        clean.includes('\\sqrt') ||
        clean.includes('\\sum') ||
        clean.includes('\\int') ||
        clean.includes('\\prod') ||
        clean.includes('\\lim') ||
        clean.includes('\\binom') ||
        clean.includes('\\begin')
      ) {
        if (!clean.startsWith('\\displaystyle')) {
          clean = `\\displaystyle ${clean}`;
        }
      }
    }

    return getCachedKatex(clean, isBlock);
  };

  // If displayMode is forced and content doesn't have delimiters
  if (displayMode && !normalized.includes('$')) {
    return (
      <div
        className={`overflow-x-auto max-w-full my-1 py-1 text-center ${className}`}
        dangerouslySetInnerHTML={{ __html: renderFormula(normalized, true) }}
      />
    );
  }

  // Tokenize string by math delimiters ($$...$$ or $...$)
  const parts: React.ReactNode[] = [];
  const regex = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(normalized)) !== null) {
    // Plain text before match
    if (match.index > lastIndex) {
      parts.push(renderFormattedText(normalized.substring(lastIndex, match.index)));
    }

    const token = match[0];
    let isBlock = false;
    let formula = '';

    if (token.startsWith('$$') && token.endsWith('$$')) {
      isBlock = true;
      formula = token.slice(2, -2);
    } else if (token.startsWith('\\[') && token.endsWith('\\]')) {
      isBlock = true;
      formula = token.slice(2, -2);
    } else if (token.startsWith('$') && token.endsWith('$')) {
      isBlock = false;
      formula = token.slice(1, -1);
    } else if (token.startsWith('\\(') && token.endsWith('\\)')) {
      isBlock = false;
      formula = token.slice(2, -2);
    }

    parts.push(
      <span
        key={match.index}
        className={
          isBlock
            ? 'block overflow-x-auto max-w-full my-2 text-center'
            : 'inline-block align-middle max-w-full overflow-x-auto mx-1 py-0.5'
        }
        dangerouslySetInnerHTML={{ __html: renderFormula(formula, isBlock) }}
      />
    );

    lastIndex = regex.lastIndex;
  }

  // Remaining plain text
  if (lastIndex < normalized.length) {
    parts.push(renderFormattedText(normalized.substring(lastIndex)));
  }

  return (
    <span className={`inline-block max-w-full break-words leading-relaxed ${className}`}>
      {parts}
    </span>
  );
};

export const MathRenderer = React.memo(MathRendererBase);

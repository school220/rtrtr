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
      .replace(/°/g, '^{\\circ}')
      .replace(/π/g, '\\pi ')
      .replace(/∞/g, '\\infty ')
      .replace(/√([0-9a-zA-Z]+)/g, '\\sqrt{$1}')
      .replace(/√\{([^}]+)\}/g, '\\sqrt{$1}')
      .replace(/√\(([^)]+)\)/g, '\\sqrt{$1}');
  };

  const hasDelimiters = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/.test(text);

  // 1. If text already has math delimiters, normalize unicode inside them
  if (hasDelimiters) {
    text = text.replace(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g, (match) => {
      return replaceUnicodeSymbols(match);
    });

    // Also: if outside delimiters there are unwrapped LaTeX expressions like \frac{...}{...} or \sqrt{...}, wrap them
    const latexOutsideRegex = /(?<!\$|\\\[|\\\()(\\(?:frac|sqrt|left|begin)\{[^{}]*\}(?:\{[^{}]*\})?)(?!\$|\\\]|\\\))/g;
    text = text.replace(latexOutsideRegex, '$$1$');

    return text;
  }

  // 2. Text has NO delimiters.
  // Replace unicode math symbols first:
  text = replaceUnicodeSymbols(text);

  const hasLatex = /\\(?:frac|sqrt|cdot|times|div|pm|mp|le|ge|neq|approx|equiv|pi|alpha|beta|gamma|delta|theta|lambda|sigma|omega|Delta|Sigma|sin|cos|tan|cot|sec|csc|log|ln|lg|left|right|begin|end|int|sum|prod|lim|infty|circ|degree)\b/.test(text);
  const hasCyrillic = /[а-яА-ЯёЁўқғҳЎҚҒҲ]/.test(text);

  // Case A: Standalone math expression without Cyrillic (e.g. "\frac{1}{2}", "x^2 + 5x + 6 = 0", "y = 2x - 1", "3/4", "\sqrt{16}")
  if (!hasCyrillic && (hasLatex || /[\^_\\]/.test(text) || /^[0-9xXyYzZaAbBcCnN\s+\-*/=()[\].:]+$/.test(text.trim()))) {
    const trimmed = text.trim();
    if (hasLatex || /[\^_\\]/.test(trimmed) || /[+\-*=]/.test(trimmed) || /^\d+\/\d+$/.test(trimmed)) {
      const fracMatch = trimmed.match(/^(\d+)\/(\d+)$/);
      if (fracMatch) {
        return `$\\frac{${fracMatch[1]}}{${fracMatch[2]}}$`;
      }
      return `$${trimmed}$`;
    }
  }

  // Case B: Text has natural language words (Russian/Uzbek) mixed with LaTeX commands
  // e.g. "Вычислите значение выражения \frac{a+b}{2} при a=2"
  if (hasLatex) {
    const latexExprRegex = /(\\(?:frac|sqrt|pm|mp|cdot|times|div|le|ge|neq|approx|equiv|pi|alpha|beta|gamma|delta|theta|lambda|sigma|omega|Delta|sin|cos|tan|cot|log|ln|lg|left|right|begin|end|int|sum|prod|lim|infty|circ)(?:\{[^{}]*\}|\[[^[\]]*\]|[a-zA-Z0-9+\-*=^_()\\/\s.,])*?)(?=(?:\s+[а-яА-ЯёЁўқғҳЎҚҒҲ]|\s*$|[.,;?!](?:\s|$)))/g;
    
    let wrapped = text.replace(latexExprRegex, (m) => {
      const clean = m.trim();
      return `$${clean}$`;
    });

    // Also wrap standalone exponents like x^2 or (x+1)^3 if not already in $
    wrapped = wrapped.replace(/(?<!\$)([a-zA-Z0-9()]+(?:\^\{?[0-9a-zA-Z+-]+\}?|_\{?[0-9a-zA-Z+-]+\}?)+)(?!\$)/g, '$$1$');

    return wrapped;
  }

  // Case C: Simple numerical or variable fractions like "3/4" or "a/b"
  const singleFrac = text.trim().match(/^([0-9a-zA-Z]+)\/([0-9a-zA-Z]+)$/);
  if (singleFrac) {
    return `$\\frac{${singleFrac[1]}}{${singleFrac[2]}}$`;
  }

  // Case D: Exponent expression like x^2 or 2^5
  if (/^[a-zA-Z0-9()]+\^[0-9a-zA-Z]+$/.test(text.trim())) {
    return `$${text.trim()}$`;
  }

  return text;
}

/**
 * Parses and renders text containing LaTeX math formulas using KaTeX.
 * Supports:
 * - $...$ or \(...\) for inline math
 * - $$...$$ or \[...\] for block math
 * - Desmos-style raw math expressions without delimiters (auto-detected and normalized)
 */
export const MathRenderer: React.FC<MathRendererProps> = ({ content, className = '', displayMode = false }) => {
  if (!content) return null;

  const normalized = normalizeMathText(content);

  // Helper to safely render KaTeX
  const renderFormula = (latex: string, isBlock: boolean): string => {
    try {
      return katex.renderToString(latex.trim(), {
        displayMode: isBlock,
        throwOnError: false,
        output: 'html',
      });
    } catch {
      return `<span class="text-rose-400 font-mono">${latex}</span>`;
    }
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
      parts.push(normalized.substring(lastIndex, match.index));
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
        className={isBlock ? 'block overflow-x-auto max-w-full my-2 text-center' : 'inline-block align-middle max-w-full overflow-x-auto mx-0.5'}
        dangerouslySetInnerHTML={{ __html: renderFormula(formula, isBlock) }}
      />
    );

    lastIndex = regex.lastIndex;
  }

  // Remaining plain text
  if (lastIndex < normalized.length) {
    parts.push(normalized.substring(lastIndex));
  }

  return <span className={`inline-block max-w-full break-words leading-relaxed ${className}`}>{parts}</span>;
};

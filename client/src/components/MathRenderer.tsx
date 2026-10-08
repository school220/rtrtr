import React from 'react';
import katex from 'katex';

interface MathRendererProps {
  content: string;
  className?: string;
  displayMode?: boolean;
}

/**
 * Parses and renders text containing LaTeX math formulas using KaTeX.
 * Formulas can be enclosed in:
 * - $...$ or \(...\) for inline math
 * - $$...$$ or \[...\] for block math
 * If whole content is a formula without delimiters, attempts direct KaTeX render.
 */
export const MathRenderer: React.FC<MathRendererProps> = ({ content, className = '', displayMode = false }) => {
  if (!content) return null;

  // Helper to safely render KaTeX
  const renderFormula = (latex: string, isBlock: boolean): string => {
    try {
      return katex.renderToString(latex.trim(), {
        displayMode: isBlock,
        throwOnError: false,
        output: 'htmlAndMathml',
      });
    } catch {
      return `<span class="text-rose-400 font-mono">${latex}</span>`;
    }
  };

  // If displayMode is forced and content doesn't have delimiters
  if (displayMode && !content.includes('$')) {
    return (
      <div
        className={`overflow-x-auto max-w-full my-1 py-1 text-center ${className}`}
        dangerouslySetInnerHTML={{ __html: renderFormula(content, true) }}
      />
    );
  }

  // Tokenize string by math delimiters ($$...$$ or $...$)
  const parts: React.ReactNode[] = [];
  const regex = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    // Plain text before match
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
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
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return <span className={`inline-block max-w-full break-words leading-relaxed ${className}`}>{parts}</span>;
};

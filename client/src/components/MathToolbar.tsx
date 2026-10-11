import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { MathRenderer } from './MathRenderer.js';

export interface MathToolbarProps {
  onInsert: (snippet: string, cursorOffset?: number) => void;
  className?: string;
  compact?: boolean;
}

interface MathBtnItem {
  display: string;
  snippet: string;
  title: string;
  isKatex?: boolean;
}

export const MathToolbar: React.FC<MathToolbarProps> = ({
  onInsert,
  className = '',
  compact = false,
}) => {
  const [activeTab, setActiveTab] = useState<'main' | 'trig' | 'functions' | 'greek' | 'systems'>('main');
  const [isExpanded, setIsExpanded] = useState<boolean>(!compact);

  // Quick primary buttons (always visible in toolbar)
  const quickButtons: MathBtnItem[] = [
    { display: '\\frac{a}{b}', snippet: '\\frac{a}{b}', title: 'Дробь (Desmos)', isKatex: true },
    { display: 'x^2', snippet: '^{2}', title: 'Квадрат (степень 2)', isKatex: true },
    { display: 'x^n', snippet: '^{n}', title: 'Степень n', isKatex: true },
    { display: '\\sqrt{x}', snippet: '\\sqrt{x}', title: 'Квадратный корень', isKatex: true },
    { display: '\\sqrt[3]{x}', snippet: '\\sqrt[3]{x}', title: 'Кубический корень', isKatex: true },
    { display: '|x|', snippet: '|x|', title: 'Модуль', isKatex: true },
    { display: '(x)', snippet: '\\left( x \\right)', title: 'Круглые скобки', isKatex: true },
    { display: '\\cdot', snippet: '\\cdot ', title: 'Умножение (точка)', isKatex: true },
    { display: '\\times', snippet: '\\times ', title: 'Умножение (крестик)', isKatex: true },
    { display: '\\div', snippet: '\\div ', title: 'Деление', isKatex: true },
    { display: '\\pm', snippet: '\\pm ', title: 'Плюс-минус', isKatex: true },
    { display: '\\neq', snippet: '\\neq ', title: 'Не равно', isKatex: true },
    { display: '\\le', snippet: '\\le ', title: 'Меньше или равно (<=)', isKatex: true },
    { display: '\\ge', snippet: '\\ge ', title: 'Больше или равно (>=)', isKatex: true },
    { display: '\\pi', snippet: '\\pi ', title: 'Число Пи', isKatex: true },
    { display: '^{\\circ}', snippet: '^{\\circ}', title: 'Градусы (°)', isKatex: true },
    { display: '$x$', snippet: '$', title: 'Обернуть в формулу ($...$)', isKatex: false },
  ];

  // Trigonometry
  const trigButtons: MathBtnItem[] = [
    { display: '\\sin(x)', snippet: '\\sin(x)', title: 'Синус', isKatex: true },
    { display: '\\cos(x)', snippet: '\\cos(x)', title: 'Косинус', isKatex: true },
    { display: '\\tan(x)', snippet: '\\tan(x)', title: 'Тангенс', isKatex: true },
    { display: '\\cot(x)', snippet: '\\cot(x)', title: 'Котангенс', isKatex: true },
    { display: '\\arcsin(x)', snippet: '\\arcsin(x)', title: 'Арксинус', isKatex: true },
    { display: '\\arccos(x)', snippet: '\\arccos(x)', title: 'Арккосинус', isKatex: true },
    { display: '\\arctan(x)', snippet: '\\arctan(x)', title: 'Арктангенс', isKatex: true },
  ];

  // Functions & Analysis
  const funcButtons: MathBtnItem[] = [
    { display: '\\log(x)', snippet: '\\log(x)', title: 'Десятичный логарифм', isKatex: true },
    { display: '\\ln(x)', snippet: '\\ln(x)', title: 'Натуральный логарифм', isKatex: true },
    { display: '\\log_{a}(b)', snippet: '\\log_{a}(b)', title: 'Логарифм по основанию', isKatex: true },
    { display: '\\lim_{x \\to 0}', snippet: '\\lim_{x \\to 0}', title: 'Предел', isKatex: true },
    { display: '\\sum_{i=1}^{n}', snippet: '\\sum_{i=1}^{n}', title: 'Сумма', isKatex: true },
    { display: '\\int_{a}^{b}', snippet: '\\int_{a}^{b}', title: 'Определенный интеграл', isKatex: true },
    { display: '\\infty', snippet: '\\infty ', title: 'Бесконечность', isKatex: true },
    { display: '\\approx', snippet: '\\approx ', title: 'Приблизительно равно', isKatex: true },
  ];

  // Greek Letters
  const greekButtons: MathBtnItem[] = [
    { display: '\\alpha', snippet: '\\alpha ', title: 'Альфа (α)', isKatex: true },
    { display: '\\beta', snippet: '\\beta ', title: 'Бета (β)', isKatex: true },
    { display: '\\gamma', snippet: '\\gamma ', title: 'Гамма (γ)', isKatex: true },
    { display: '\\theta', snippet: '\\theta ', title: 'Тета (θ)', isKatex: true },
    { display: '\\lambda', snippet: '\\lambda ', title: 'Лямбда (λ)', isKatex: true },
    { display: '\\Delta', snippet: '\\Delta ', title: 'Дельта (Δ)', isKatex: true },
    { display: '\\omega', snippet: '\\omega ', title: 'Омега (ω)', isKatex: true },
  ];

  // Systems & Complex structures
  const systemButtons: MathBtnItem[] = [
    {
      display: '\\begin{cases} x+y=1 \\\\ x-y=0 \\end{cases}',
      snippet: '\\begin{cases} 2x + y = 5 \\\\ x - y = 1 \\end{cases}',
      title: 'Система уравнений',
      isKatex: true,
    },
    {
      display: '[a, b]',
      snippet: '\\left[ a, b \\right]',
      title: 'Отрезок (квадратные скобки)',
      isKatex: true,
    },
    {
      display: '(a, b)',
      snippet: '\\left( a, b \\right)',
      title: 'Интервал (круглые скобки)',
      isKatex: true,
    },
    {
      display: '\\{ x \\}',
      snippet: '\\{ x \\}',
      title: 'Фигурные скобки',
      isKatex: true,
    },
  ];

  const handleButtonClick = (btn: MathBtnItem) => {
    onInsert(btn.snippet);
  };

  return (
    <div className={`bg-gray-50 border border-gray-200 rounded-lg p-2.5 space-y-2 select-none shadow-xs ${className}`}>
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-2 border-b border-gray-200/80 pb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded bg-[#25718f] text-white flex items-center justify-center text-xs font-mono font-bold">
            ∑
          </span>
          <span className="text-xs font-mono font-bold text-gray-800 flex items-center gap-1">
            <span>Математическая клавиатура Desmos</span>
            <span className="text-[10px] text-[#25718f] bg-cyan-50 border border-cyan-200 px-1.5 py-0.2 rounded font-semibold uppercase">
              KaTeX
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[11px] font-mono text-[#25718f] hover:text-[#1f5f79] flex items-center gap-0.5 transition-colors font-semibold"
          >
            <span>{isExpanded ? 'Свернуть' : 'Все символы (Desmos)'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Row 1: Primary Quick-Access Math Buttons */}
      <div className="flex flex-wrap items-center gap-1.5">
        {quickButtons.map((btn, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleButtonClick(btn)}
            className="h-8 min-w-[34px] px-2 py-0.5 rounded bg-white hover:bg-cyan-50 border border-gray-300 hover:border-[#25718f] text-gray-800 font-mono text-xs font-semibold shadow-2xs hover:shadow-xs transition-all active:scale-95 flex items-center justify-center"
            title={btn.title}
          >
            {btn.isKatex ? (
              <MathRenderer content={`$${btn.display}$`} />
            ) : (
              <span>{btn.display}</span>
            )}
          </button>
        ))}
      </div>

      {/* Expandable Advanced Palette */}
      {isExpanded && (
        <div className="pt-2 border-t border-gray-200/80 space-y-2">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 bg-gray-200/70 p-1 rounded-md text-[11px] font-mono font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('main')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeTab === 'main' ? 'bg-white text-[#25718f] font-bold shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Сравнения и знаки
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('trig')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeTab === 'trig' ? 'bg-white text-[#25718f] font-bold shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Тригонометрия
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('functions')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeTab === 'functions' ? 'bg-white text-[#25718f] font-bold shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Логарифмы и функции
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('greek')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeTab === 'greek' ? 'bg-white text-[#25718f] font-bold shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Греческие буквы
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('systems')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeTab === 'systems' ? 'bg-white text-[#25718f] font-bold shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Системы и скобки
            </button>
          </div>

          {/* Tab Content Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white rounded border border-gray-200 min-h-[40px]">
            {activeTab === 'main' && (
              <>
                {[
                  { display: '+', snippet: ' + ', title: 'Плюс' },
                  { display: '-', snippet: ' - ', title: 'Минус' },
                  { display: '=', snippet: ' = ', title: 'Равно' },
                  { display: '<', snippet: ' < ', title: 'Меньше' },
                  { display: '>', snippet: ' > ', title: 'Больше' },
                  { display: '\\le', snippet: '\\le ', title: 'Меньше или равно', isKatex: true },
                  { display: '\\ge', snippet: '\\ge ', title: 'Больше или равно', isKatex: true },
                  { display: '\\neq', snippet: '\\neq ', title: 'Не равно', isKatex: true },
                  { display: '\\approx', snippet: '\\approx ', title: 'Приблизительно', isKatex: true },
                  { display: '\\cdot', snippet: '\\cdot ', title: 'Точка умножения', isKatex: true },
                  { display: '\\times', snippet: '\\times ', title: 'Крестик умножения', isKatex: true },
                  { display: '\\div', snippet: '\\div ', title: 'Деление', isKatex: true },
                  { display: '\\pm', snippet: '\\pm ', title: 'Плюс-минус', isKatex: true },
                  { display: '\\%', snippet: '\\% ', title: 'Процент' },
                  { display: '^{\\circ}', snippet: '^{\\circ}', title: 'Градус', isKatex: true },
                ].map((btn, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onInsert(btn.snippet)}
                    className="h-8 min-w-[36px] px-2 py-0.5 rounded bg-gray-50 hover:bg-cyan-50 border border-gray-200 hover:border-[#25718f] text-gray-800 font-mono text-xs font-semibold shadow-2xs transition-all active:scale-95 flex items-center justify-center"
                    title={btn.title}
                  >
                    {btn.isKatex ? <MathRenderer content={`$${btn.display}$`} /> : <span>{btn.display}</span>}
                  </button>
                ))}
              </>
            )}

            {activeTab === 'trig' &&
              trigButtons.map((btn, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onInsert(btn.snippet)}
                  className="h-8 px-2.5 py-0.5 rounded bg-gray-50 hover:bg-cyan-50 border border-gray-200 hover:border-[#25718f] text-gray-800 font-mono text-xs font-semibold shadow-2xs transition-all active:scale-95 flex items-center justify-center"
                  title={btn.title}
                >
                  <MathRenderer content={`$${btn.display}$`} />
                </button>
              ))}

            {activeTab === 'functions' &&
              funcButtons.map((btn, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onInsert(btn.snippet)}
                  className="h-8 px-2.5 py-0.5 rounded bg-gray-50 hover:bg-cyan-50 border border-gray-200 hover:border-[#25718f] text-gray-800 font-mono text-xs font-semibold shadow-2xs transition-all active:scale-95 flex items-center justify-center"
                  title={btn.title}
                >
                  <MathRenderer content={`$${btn.display}$`} />
                </button>
              ))}

            {activeTab === 'greek' &&
              greekButtons.map((btn, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onInsert(btn.snippet)}
                  className="h-8 min-w-[36px] px-2.5 py-0.5 rounded bg-gray-50 hover:bg-cyan-50 border border-gray-200 hover:border-[#25718f] text-gray-800 font-mono text-xs font-semibold shadow-2xs transition-all active:scale-95 flex items-center justify-center"
                  title={btn.title}
                >
                  <MathRenderer content={`$${btn.display}$`} />
                </button>
              ))}

            {activeTab === 'systems' &&
              systemButtons.map((btn, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onInsert(btn.snippet)}
                  className="h-9 px-3 py-1 rounded bg-gray-50 hover:bg-cyan-50 border border-gray-200 hover:border-[#25718f] text-gray-800 font-mono text-xs font-semibold shadow-2xs transition-all active:scale-95 flex items-center justify-center"
                  title={btn.title}
                >
                  <MathRenderer content={`$${btn.display}$`} />
                </button>
              ))}
          </div>

          <div className="text-[11px] font-mono text-gray-500 flex items-center gap-1.5 pt-0.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>
              Подсказка: формула может быть как в формате Desmos/KaTeX (<code>\frac{'{a}'}{'{b}'}</code>, <code>x^2</code>), так и заключённой в знаки <code>$ ... $</code>.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

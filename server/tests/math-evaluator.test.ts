import { describe, it, expect } from 'vitest';
import { MathEvaluator } from '../src/utils/math-evaluator.js';

describe('MathEvaluator', () => {
  describe('Fraction and Decimal Equivalence', () => {
    it('evaluates 1/2 and 0.5 as mathematically equivalent', () => {
      expect(MathEvaluator.isEquivalent('1/2', '0.5')).toBe(true);
      expect(MathEvaluator.isEquivalent('0.5', '1/2')).toBe(true);
    });

    it('evaluates comma decimal 0,5 as equivalent to 1/2', () => {
      expect(MathEvaluator.isEquivalent('0,5', '1/2')).toBe(true);
      expect(MathEvaluator.isEquivalent('1/2', '0,5')).toBe(true);
    });

    it('evaluates unreduced fraction 2/4 as equivalent to 1/2', () => {
      expect(MathEvaluator.isEquivalent('2/4', '1/2')).toBe(true);
      expect(MathEvaluator.isEquivalent('3/6', '0.5')).toBe(true);
      expect(MathEvaluator.isEquivalent('5/10', '1/2')).toBe(true);
    });

    it('evaluates negative fractions and decimals', () => {
      expect(MathEvaluator.isEquivalent('-3/4', '-0.75')).toBe(true);
      expect(MathEvaluator.isEquivalent('-0,75', '-3/4')).toBe(true);
      expect(MathEvaluator.isEquivalent('-6/8', '-0.75')).toBe(true);
    });

    it('evaluates integers and decimal zeros', () => {
      expect(MathEvaluator.isEquivalent('4', '4.0')).toBe(true);
      expect(MathEvaluator.isEquivalent('4,0', '4')).toBe(true);
      expect(MathEvaluator.isEquivalent('8/2', '4')).toBe(true);
    });
  });

  describe('Safe Arithmetic Expression Evaluation (NO eval)', () => {
    it('evaluates safe addition of fractions 1/4 + 1/4 = 0.5', () => {
      expect(MathEvaluator.safeEvaluateExpression('1/4 + 1/4')).toBe(0.5);
      expect(MathEvaluator.isEquivalent('1/4 + 1/4', '1/2')).toBe(true);
    });

    it('evaluates order of operations safely', () => {
      expect(MathEvaluator.safeEvaluateExpression('2 + 3 * 4')).toBe(14);
      expect(MathEvaluator.safeEvaluateExpression('(2 + 3) * 4')).toBe(20);
    });

    it('handles division by zero gracefully without throwing', () => {
      expect(MathEvaluator.safeEvaluateExpression('5 / 0')).toBe(null);
    });

    it('rejects malicious or non-math expressions without executing them', () => {
      expect(MathEvaluator.safeEvaluateExpression('alert(1)')).toBe(null);
      expect(MathEvaluator.safeEvaluateExpression('console.log(process)')).toBe(null);
      expect(MathEvaluator.safeEvaluateExpression('__proto__')).toBe(null);
    });
  });

  describe('Prefix Stripping and Normalization', () => {
    it('strips variable prefixes like "x = 4" or "ответ: 4"', () => {
      expect(MathEvaluator.isEquivalent('x = 4', '4')).toBe(true);
      expect(MathEvaluator.isEquivalent('x=4', '4')).toBe(true);
      expect(MathEvaluator.isEquivalent('ответ: 4', '4')).toBe(true);
    });

    it('normalizes Russian letter ё to е and collapses extra spaces', () => {
      expect(MathEvaluator.normalizeText('  Тёмный   лес  ')).toBe('темный лес');
      expect(MathEvaluator.isEquivalent('  равнобедренный  ', 'равнобедренный')).toBe(true);
    });

    it('supports alternate answers specified via pipe or array', () => {
      expect(MathEvaluator.isEquivalent('0.5', '1/2', ['0.5', '0,5', '2/4'])).toBe(true);
      expect(MathEvaluator.isEquivalent('0,5', '1/2|0.5|0,5')).toBe(true);
    });
  });
});

import { describe, expect, it } from 'vitest';
import { generateProblem, validateAnswer } from './mathgen';

describe('generateProblem', () => {
  it('deterministic — same inputs produce same problem', () => {
    const a = generateProblem({
      seed: 'seed_a',
      weekNum: 3,
      grade: 5,
      recentProblemTypes: [],
    });
    const b = generateProblem({
      seed: 'seed_a',
      weekNum: 3,
      grade: 5,
      recentProblemTypes: [],
    });
    expect(a).toEqual(b);
  });

  it('avoids 3 same types in a row', () => {
    const result = generateProblem({
      seed: 'seed_x',
      weekNum: 4,
      grade: 6,
      recentProblemTypes: ['general', 'general'],
    });
    expect(result.type).toBe('finance');
  });

  it('difficulty scales monotonically with weekNum', () => {
    const w1 = generateProblem({ seed: 's', weekNum: 1, grade: 5, recentProblemTypes: [] });
    const w8 = generateProblem({ seed: 's', weekNum: 8, grade: 5, recentProblemTypes: [] });
    expect(w8.difficulty).toBeGreaterThanOrEqual(w1.difficulty);
  });

  it('grade 6 is harder than grade 5 same week', () => {
    const g5 = generateProblem({ seed: 's', weekNum: 4, grade: 5, recentProblemTypes: [] });
    const g6 = generateProblem({ seed: 's', weekNum: 4, grade: 6, recentProblemTypes: [] });
    expect(g6.difficulty).toBeGreaterThanOrEqual(g5.difficulty);
  });
});

describe('validateAnswer', () => {
  it('matches exact answer', () => {
    const problem = {
      id: 'p1',
      type: 'general' as const,
      question: 'Q',
      expectedAnswer: '42',
      difficulty: 1,
    };
    expect(validateAnswer(problem, '42')).toBe(true);
  });

  it('trims whitespace', () => {
    const problem = {
      id: 'p1',
      type: 'general' as const,
      question: 'Q',
      expectedAnswer: '42',
      difficulty: 1,
    };
    expect(validateAnswer(problem, '  42  ')).toBe(true);
  });

  it('strips commas (10,000 == 10000)', () => {
    const problem = {
      id: 'p1',
      type: 'finance' as const,
      question: 'Q',
      expectedAnswer: '10000',
      difficulty: 1,
    };
    expect(validateAnswer(problem, '10,000')).toBe(true);
  });

  it('rejects wrong answer', () => {
    const problem = {
      id: 'p1',
      type: 'general' as const,
      question: 'Q',
      expectedAnswer: '42',
      difficulty: 1,
    };
    expect(validateAnswer(problem, '43')).toBe(false);
  });
});

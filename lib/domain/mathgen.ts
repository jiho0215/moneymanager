import type { Problem, ProblemType } from './types';

export type GenerateProblemInput = {
  seed: string;
  weekNum: number;
  grade: 5 | 6;
  recentProblemTypes: ProblemType[];
  accountBalance?: number;
};

const FINANCE_RATIO = 0.3;

function seededRandom(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickType(rng: () => number, recent: ProblemType[]): ProblemType {
  if (recent.length >= 2 && recent[0] === recent[1]) {
    return recent[0] === 'general' ? 'finance' : 'general';
  }
  return rng() < FINANCE_RATIO ? 'finance' : 'general';
}

function difficulty(weekNum: number, grade: 5 | 6): number {
  const base = weekNum + (grade - 5) * 2;
  if (base < 1) return 1;
  if (base > 10) return 10;
  return base;
}

function generateGeneralProblem(
  rng: () => number,
  weekNum: number,
  grade: 5 | 6,
  problemId: string
): Problem {
  const diff = difficulty(weekNum, grade);
  if (diff <= 3) {
    const a = 10 + Math.floor(rng() * 90);
    const b = 1 + Math.floor(rng() * 9);
    return {
      id: problemId,
      type: 'general',
      question: `${a} × ${b} = ?`,
      expectedAnswer: String(a * b),
      difficulty: diff,
    };
  }
  if (diff <= 6) {
    const total = 100 + Math.floor(rng() * 900);
    const pct = [10, 20, 25, 50][Math.floor(rng() * 4)] ?? 10;
    return {
      id: problemId,
      type: 'general',
      question: `${total}의 ${pct}%는?`,
      expectedAnswer: String(Math.floor((total * pct) / 100)),
      difficulty: diff,
    };
  }
  const a = 10 + Math.floor(rng() * 50);
  const b = 5 + Math.floor(rng() * 20);
  return {
    id: problemId,
    type: 'general',
    question: `x + ${a} = ${a + b}, x = ?`,
    expectedAnswer: String(b),
    difficulty: diff,
  };
}

function generateFinanceProblem(
  rng: () => number,
  weekNum: number,
  grade: 5 | 6,
  problemId: string,
  accountBalance: number | undefined
): Problem {
  const diff = difficulty(weekNum, grade);
  const balance = accountBalance ?? 10000 + Math.floor(rng() * 90000);

  if (diff <= 4) {
    return {
      id: problemId,
      type: 'finance',
      question: `${balance.toLocaleString()}원의 10%는 얼마인가요?`,
      expectedAnswer: String(Math.floor(balance * 0.1)),
      difficulty: diff,
    };
  }
  return {
    id: problemId,
    type: 'finance',
    question: `${balance.toLocaleString()}원에 10% 이자가 1주 동안 붙으면 얼마가 되나요?`,
    expectedAnswer: String(balance + Math.floor(balance * 0.1)),
    difficulty: diff,
  };
}

export function generateProblem(input: GenerateProblemInput): Problem {
  const { seed, weekNum, grade, recentProblemTypes, accountBalance } = input;
  const rng = seededRandom(seed);
  const type = pickType(rng, recentProblemTypes);
  const problemId = `prob_${seed.slice(0, 8)}_w${weekNum}`;

  if (type === 'finance') {
    return generateFinanceProblem(rng, weekNum, grade, problemId, accountBalance);
  }
  return generateGeneralProblem(rng, weekNum, grade, problemId);
}

export function validateAnswer(problem: Problem, userAnswer: string): boolean {
  const normalized = userAnswer.trim().replace(/,/g, '').replace(/\s+/g, '');
  return normalized === problem.expectedAnswer.trim().replace(/,/g, '');
}

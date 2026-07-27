// Ported from services/fuzzy_logic.py
// Weighted final score + traditional 2-5 grade conversion.

const WEIGHTS = {
  Relevance: 0.05,
  'Study of the problem': 0.05,
  'Main part': 0.1,
  'Mathematical model': 0.2,
  'Solution algorithm': 0.15,
  Flowchart: 0.1,
  'Result of the created program': 0.2,
  Conclusion: 0.1,
  'List of references': 0.05,
};

export function calculateFinalScore(scoresDict) {
  let totalWeighted = 0;
  let totalWeight = 0;
  for (const [section, weight] of Object.entries(WEIGHTS)) {
    const score = scoresDict[section] ?? 0;
    totalWeighted += score * weight;
    totalWeight += weight;
  }
  if (totalWeight === 0) return 0;
  return Math.round((totalWeighted / totalWeight) * 100) / 100;
}

export function getTraditionalGrade(score) {
  if (score >= 85) return 5;
  if (score >= 70) return 4;
  if (score >= 50) return 3;
  return 2;
}

export const SECTION_WEIGHTS = WEIGHTS;

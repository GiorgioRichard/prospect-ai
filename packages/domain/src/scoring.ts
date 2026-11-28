/**
 * Score por serviço conforme docs/SCORING.md (versão inicial proposta, ainda não calibrada).
 * Não é probabilidade de compra. Fatores desconhecidos (null) não pontuam e reduzem a cobertura.
 */
export const SCORE_METHODOLOGY_VERSION = "score-v0-proposed";

export const SCORE_FACTOR_WEIGHTS = {
  technicalNeed: 30,
  serviceFit: 25,
  commercialSignals: 20,
  commercialCapacity: 15,
  dataQuality: 10,
} as const;

export type ScoreFactor = keyof typeof SCORE_FACTOR_WEIGHTS;

/** Cada fator normalizado em 0–1; null significa dado desconhecido. */
export type ScoreFactors = Readonly<Record<ScoreFactor, number | null>>;

export type ScoreClass = "A" | "B" | "C";

export interface ServiceScore {
  /** Soma ponderada arredondada, 0–100. */
  readonly points: number;
  readonly scoreClass: ScoreClass;
  /** Fração (0–1) do peso total cujos fatores são conhecidos. Base da confiança, que é exibida separada. */
  readonly coverage: number;
  readonly methodologyVersion: string;
}

const SCORE_FACTORS = Object.keys(SCORE_FACTOR_WEIGHTS) as ScoreFactor[];
const TOTAL_WEIGHT = SCORE_FACTORS.reduce((sum, factor) => sum + SCORE_FACTOR_WEIGHTS[factor], 0);

export function computeServiceScore(factors: ScoreFactors): ServiceScore {
  let weightedSum = 0;
  let knownWeight = 0;

  for (const factor of SCORE_FACTORS) {
    const value = factors[factor];
    if (value === null) continue;
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError(`Fator ${factor} deve estar entre 0 e 1; recebido ${value}`);
    }
    const weight = SCORE_FACTOR_WEIGHTS[factor];
    weightedSum += weight * value;
    knownWeight += weight;
  }

  const points = Math.round(weightedSum);
  return {
    points,
    scoreClass: classify(points),
    coverage: knownWeight / TOTAL_WEIGHT,
    methodologyVersion: SCORE_METHODOLOGY_VERSION,
  };
}

function classify(points: number): ScoreClass {
  if (points >= 80) return "A";
  if (points >= 60) return "B";
  return "C";
}

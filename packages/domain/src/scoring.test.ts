import { describe, expect, it } from "vitest";
import { SCORE_METHODOLOGY_VERSION, computeServiceScore, type ScoreFactors } from "./scoring.js";

const allKnown = (values: [number, number, number, number, number]): ScoreFactors => ({
  technicalNeed: values[0],
  serviceFit: values[1],
  commercialSignals: values[2],
  commercialCapacity: values[3],
  dataQuality: values[4],
});

describe("computeServiceScore", () => {
  it("reproduz o exemplo de docs/SCORING.md (1, .8, .5, 0, .8 => 68)", () => {
    const score = computeServiceScore(allKnown([1, 0.8, 0.5, 0, 0.8]));
    expect(score).toEqual({
      points: 68,
      scoreClass: "B",
      coverage: 1,
      methodologyVersion: SCORE_METHODOLOGY_VERSION,
    });
  });

  it("classifica nos limites A >= 80, B >= 60, C abaixo", () => {
    expect(computeServiceScore(allKnown([1, 1, 1, 0, 0.5])).scoreClass).toBe("A"); // 80
    expect(computeServiceScore(allKnown([1, 1, 0.25, 0, 0])).scoreClass).toBe("B"); // 60
    expect(computeServiceScore(allKnown([1, 1, 0.2, 0, 0])).scoreClass).toBe("C"); // 59
  });

  it("não pontua fatores desconhecidos e reduz a cobertura", () => {
    const score = computeServiceScore({
      technicalNeed: 1,
      serviceFit: null,
      commercialSignals: null,
      commercialCapacity: null,
      dataQuality: 1,
    });
    expect(score.points).toBe(40);
    expect(score.coverage).toBeCloseTo(0.4);
  });

  it("rejeita fatores fora de 0–1", () => {
    expect(() => computeServiceScore(allKnown([1.1, 0, 0, 0, 0]))).toThrow(RangeError);
    expect(() => computeServiceScore(allKnown([Number.NaN, 0, 0, 0, 0]))).toThrow(RangeError);
  });
});

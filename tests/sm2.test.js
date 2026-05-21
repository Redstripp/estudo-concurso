import { describe, expect, it } from 'vitest';

import { calcularProximaRevisaoSM2 } from '../src/utils/sm2.ts';

describe('calcularProximaRevisaoSM2', () => {
  it('gera intervalo de 1 dia e 1 repeticao para novo card com quality 5', () => {
    const resultado = calcularProximaRevisaoSM2({
      quality: 5,
      repetitions: 0,
      intervalDays: 0,
      easeFactor: 2.5
    });

    expect(resultado).toMatchObject({
      quality: 5,
      repetitions: 1,
      intervalDays: 1,
      dueAgainToday: false,
      wasCorrect: true
    });
  });

  it('gera intervalo de 6 dias e 2 repeticoes no segundo acerto com quality 5', () => {
    const resultado = calcularProximaRevisaoSM2({
      quality: 5,
      repetitions: 1,
      intervalDays: 1,
      easeFactor: 2.5
    });

    expect(resultado.repetitions).toBe(2);
    expect(resultado.intervalDays).toBe(6);
  });

  it('usa o intervalo anterior multiplicado pelo EF atual a partir da terceira repeticao', () => {
    const resultado = calcularProximaRevisaoSM2({
      quality: 5,
      repetitions: 2,
      intervalDays: 6,
      easeFactor: 2.5
    });

    expect(resultado.repetitions).toBe(3);
    expect(resultado.intervalDays).toBe(15);
  });

  it('atualiza o EF pela formula classica do SM-2', () => {
    const resultadoQuality5 = calcularProximaRevisaoSM2({
      quality: 5,
      repetitions: 0,
      intervalDays: 0,
      easeFactor: 2.5
    });

    const resultadoQuality3 = calcularProximaRevisaoSM2({
      quality: 3,
      repetitions: 0,
      intervalDays: 0,
      easeFactor: 2.5
    });

    expect(resultadoQuality5.easeFactor).toBeCloseTo(2.6, 10);
    expect(resultadoQuality3.easeFactor).toBeCloseTo(2.36, 10);
  });

  it('nunca deixa o EF abaixo de 1.3', () => {
    const resultado = calcularProximaRevisaoSM2({
      quality: 0,
      repetitions: 5,
      intervalDays: 30,
      easeFactor: 1.3
    });

    expect(resultado.easeFactor).toBe(1.3);
  });

  it.each([0, 1, 2])(
    'reseta repeticoes e marca revisao na mesma sessao para quality %s',
    (quality) => {
      const resultado = calcularProximaRevisaoSM2({
        quality,
        repetitions: 4,
        intervalDays: 20,
        easeFactor: 2.5
      });

      expect(resultado.repetitions).toBe(0);
      expect(resultado.intervalDays).toBe(1);
      expect(resultado.dueAgainToday).toBe(true);
      expect(resultado.wasCorrect).toBe(false);
    }
  );

  it.each([3, 4, 5])('nao marca revisao na mesma sessao para quality %s', (quality) => {
    const resultado = calcularProximaRevisaoSM2({
      quality,
      repetitions: 0,
      intervalDays: 0,
      easeFactor: 2.5
    });

    expect(resultado.dueAgainToday).toBe(false);
    expect(resultado.wasCorrect).toBe(true);
  });

  it.each([-1, 6, 2.5, Number.NaN])(
    'lanca erro claro para quality fora da escala: %s',
    (quality) => {
      expect(() =>
        calcularProximaRevisaoSM2({
          quality,
          repetitions: 0,
          intervalDays: 0,
          easeFactor: 2.5
        })
      ).toThrow('quality deve ser um numero inteiro entre 0 e 5.');
    }
  );

  it('lanca erro claro para repetitions negativo', () => {
    expect(() =>
      calcularProximaRevisaoSM2({
        quality: 5,
        repetitions: -1,
        intervalDays: 0,
        easeFactor: 2.5
      })
    ).toThrow('repetitions deve ser um numero inteiro maior ou igual a 0.');
  });

  it('lanca erro claro para intervalDays negativo', () => {
    expect(() =>
      calcularProximaRevisaoSM2({
        quality: 5,
        repetitions: 0,
        intervalDays: -1,
        easeFactor: 2.5
      })
    ).toThrow('intervalDays deve ser um numero inteiro maior ou igual a 0.');
  });

  it('usa EF padrao 2.5 quando o EF esta ausente ou invalido', () => {
    const semEaseFactor = calcularProximaRevisaoSM2({
      quality: 5,
      repetitions: 2,
      intervalDays: 6
    });

    const easeFactorInvalido = calcularProximaRevisaoSM2({
      quality: 5,
      repetitions: 2,
      intervalDays: 6,
      easeFactor: Number.NaN
    });

    expect(semEaseFactor.intervalDays).toBe(15);
    expect(semEaseFactor.easeFactor).toBeCloseTo(2.6, 10);
    expect(easeFactorInvalido.intervalDays).toBe(15);
    expect(easeFactorInvalido.easeFactor).toBeCloseTo(2.6, 10);
  });

  it('respeita EF minimo 1.3 quando o EF informado e menor que o minimo', () => {
    const resultado = calcularProximaRevisaoSM2({
      quality: 5,
      repetitions: 2,
      intervalDays: 6,
      easeFactor: 1
    });

    expect(resultado.intervalDays).toBe(8);
    expect(resultado.easeFactor).toBeCloseTo(1.4, 10);
  });
});

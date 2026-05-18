import { describe, expect, it } from 'vitest';

import { calcularPorcentagem } from '../src/utils/percentuais.ts';

describe('calcularPorcentagem em TypeScript', () => {
  it('mantem o comportamento da funcao global atual para percentuais inteiros', () => {
    expect(calcularPorcentagem(1, 1)).toBe(100);
    expect(calcularPorcentagem(35, 50)).toBe(70);
  });

  it('mantem arredondamento com duas casas decimais', () => {
    expect(calcularPorcentagem(1, 3)).toBe(33.33);
    expect(calcularPorcentagem(2, 3)).toBe(66.67);
  });

  it('retorna zero quando o total e zero', () => {
    expect(calcularPorcentagem(0, 0)).toBe(0);
    expect(calcularPorcentagem(5, 0)).toBe(0);
  });
});

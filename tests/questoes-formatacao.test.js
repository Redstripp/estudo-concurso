import { describe, expect, it } from 'vitest';

import { formatarQuantidadeQuestoes } from '../src/utils/questoes.ts';

describe('formatarQuantidadeQuestoes em TypeScript', () => {
  it('formata zero questoes', () => {
    expect(formatarQuantidadeQuestoes(0)).toBe('0 questões');
  });

  it('formata uma questao no singular', () => {
    expect(formatarQuantidadeQuestoes(1)).toBe('1 questão');
  });

  it('formata multiplas questoes no plural', () => {
    expect(formatarQuantidadeQuestoes(2)).toBe('2 questões');
    expect(formatarQuantidadeQuestoes(10)).toBe('10 questões');
  });

  it('mantem o comportamento legado para valores string', () => {
    expect(formatarQuantidadeQuestoes('1')).toBe('1 questão');
    expect(formatarQuantidadeQuestoes('2')).toBe('2 questões');
    expect(formatarQuantidadeQuestoes('texto')).toBe('0 questões');
    expect(formatarQuantidadeQuestoes('')).toBe('0 questões');
  });

  it('mantem o comportamento legado para null e undefined', () => {
    expect(formatarQuantidadeQuestoes(null)).toBe('0 questões');
    expect(formatarQuantidadeQuestoes(undefined)).toBe('0 questões');
  });

  it('mantem o comportamento legado para numero negativo', () => {
    expect(formatarQuantidadeQuestoes(-1)).toBe('-1 questões');
  });

  it('mantem o comportamento legado para decimal', () => {
    expect(formatarQuantidadeQuestoes(1.5)).toBe('1.5 questões');
  });
});

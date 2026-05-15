import { describe, expect, it } from 'vitest';

import { diaAnterior, formatarData } from '../src/utils/datas.ts';

describe('formatarData em TypeScript', () => {
  it('formata Date valido no padrao brasileiro', () => {
    expect(formatarData(new Date('2026-05-15T12:00:00'))).toBe('15/05/2026');
  });

  it('preenche dia e mes com zero a esquerda', () => {
    expect(formatarData(new Date('2026-01-05T12:00:00'))).toBe('05/01/2026');
  });

  it('retorna string vazia para Date invalido', () => {
    expect(formatarData(new Date('invalida'))).toBe('');
  });

  it('mantem o comportamento antigo para valores que nao sao Date', () => {
    expect(formatarData('2026-05-15')).toBe('');
    expect(formatarData(null)).toBe('');
    expect(formatarData(undefined)).toBe('');
  });
});

describe('diaAnterior em TypeScript', () => {
  it('mantem formato ISO para string ISO valida', () => {
    expect(diaAnterior('2026-05-15')).toBe('2026-05-14');
  });

  it('mantem o comportamento antigo para string vazia e valor ausente', () => {
    expect(diaAnterior('')).toBe('NaN-NaN-NaN');
    expect(diaAnterior()).toBe('NaN-NaN-NaN');
  });

  it('mantem o comportamento antigo quando recebe Date', () => {
    expect(diaAnterior(new Date('2026-05-15T12:00:00'))).toBe('NaN-NaN-NaN');
  });

  it('calcula virada de mes', () => {
    expect(diaAnterior('2026-03-01')).toBe('2026-02-28');
  });

  it('calcula virada de ano', () => {
    expect(diaAnterior('2026-01-01')).toBe('2025-12-31');
  });
});

import { describe, expect, it } from 'vitest';

import { formatarData } from '../src/utils/datas.ts';

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

import { describe, expect, it } from 'vitest';

import { contarOcorrenciasValores } from '../src/utils/colecoes.ts';

describe('contarOcorrenciasValores em TypeScript', () => {
  it('retorna lista vazia para array vazio', () => {
    expect(contarOcorrenciasValores([])).toEqual([]);
  });

  it('retorna lista vazia para valores nulos ou ausentes', () => {
    expect(contarOcorrenciasValores(null)).toEqual([]);
    expect(contarOcorrenciasValores(undefined)).toEqual([]);
  });

  it('conta strings repetidas e ordena por total e nome', () => {
    expect(contarOcorrenciasValores(['B', 'A', 'B', 'C', 'A', 'B'])).toEqual([
      { nome: 'B', total: 3 },
      { nome: 'A', total: 2 },
      { nome: 'C', total: 1 }
    ]);
  });

  it('conta numeros repetidos convertendo chaves para string', () => {
    expect(contarOcorrenciasValores([2, 1, 2, 3, 1, 2])).toEqual([
      { nome: '2', total: 3 },
      { nome: '1', total: 2 },
      { nome: '3', total: 1 }
    ]);
  });

  it('ignora null, undefined e strings vazias quando nao ha fallback', () => {
    expect(contarOcorrenciasValores(['A', null, undefined, '', '  ', 'A'])).toEqual([
      { nome: 'A', total: 2 }
    ]);
  });

  it('usa fallback para null, undefined e strings vazias quando configurado', () => {
    expect(contarOcorrenciasValores(['A', null, undefined, '', '  ', 'A'], { fallback: 'Sem valor' })).toEqual([
      { nome: 'Sem valor', total: 4 },
      { nome: 'A', total: 2 }
    ]);
  });

  it('aceita valores misturados mantendo o comportamento legado', () => {
    expect(contarOcorrenciasValores(['1', 1, true, 'true', false, 'A', ' A '])).toEqual([
      { nome: '1', total: 2 },
      { nome: 'A', total: 2 },
      { nome: 'true', total: 2 },
      { nome: 'false', total: 1 }
    ]);
  });
});

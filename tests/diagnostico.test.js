import { describe, expect, it } from 'vitest';

import {
  campoDiagnosticoPreenchido,
  criarResumoQualidadeDiagnostico,
  valorDiagnostico
} from '../src/utils/diagnostico.ts';

describe('valorDiagnostico em TypeScript', () => {
  it('retorna o campo snake_case quando preenchido', () => {
    expect(valorDiagnostico({ motivo_erro: 'Conteudo', motivoErro: 'Atencao' }, 'motivo_erro', 'motivoErro')).toBe('Conteudo');
  });

  it('retorna o campo camelCase quando snake_case e null ou undefined', () => {
    expect(valorDiagnostico({ motivo_erro: null, motivoErro: 'Atencao' }, 'motivo_erro', 'motivoErro')).toBe('Atencao');
    expect(valorDiagnostico({ motivoErro: 'Atencao' }, 'motivo_erro', 'motivoErro')).toBe('Atencao');
  });

  it('retorna string vazia quando objeto ou campos nao existem', () => {
    expect(valorDiagnostico({}, 'motivo_erro', 'motivoErro')).toBe('');
    expect(valorDiagnostico(null, 'motivo_erro', 'motivoErro')).toBe('');
    expect(valorDiagnostico(undefined, 'motivo_erro', 'motivoErro')).toBe('');
  });

  it('preserva valores falsy nao nulos da versao antiga', () => {
    expect(valorDiagnostico({ campo: '' }, 'campo', 'campoCamel')).toBe('');
    expect(valorDiagnostico({ campo: 0 }, 'campo', 'campoCamel')).toBe(0);
    expect(valorDiagnostico({ campo: false }, 'campo', 'campoCamel')).toBe(false);
  });

  it('aceita objetos e arrays como valores', () => {
    const objeto = { valor: 'x' };
    const array = ['a', 'b'];

    expect(valorDiagnostico({ campo: objeto }, 'campo', 'campoCamel')).toBe(objeto);
    expect(valorDiagnostico({ campo: array }, 'campo', 'campoCamel')).toBe(array);
  });
});

describe('campoDiagnosticoPreenchido em TypeScript', () => {
  it('retorna true para string preenchida', () => {
    expect(campoDiagnosticoPreenchido('Conteudo')).toBe(true);
  });

  it('retorna false para string vazia ou somente espacos', () => {
    expect(campoDiagnosticoPreenchido('')).toBe(false);
    expect(campoDiagnosticoPreenchido('   ')).toBe(false);
  });

  it('retorna false para null e undefined', () => {
    expect(campoDiagnosticoPreenchido(null)).toBe(false);
    expect(campoDiagnosticoPreenchido(undefined)).toBe(false);
  });

  it('mantem os valores sentinela como nao preenchidos', () => {
    expect(campoDiagnosticoPreenchido('A diagnosticar')).toBe(false);
    expect(campoDiagnosticoPreenchido('NÃ£o informado')).toBe(false);
  });

  it('converte numeros e booleanos com String antes de validar', () => {
    expect(campoDiagnosticoPreenchido(0)).toBe(true);
    expect(campoDiagnosticoPreenchido(123)).toBe(true);
    expect(campoDiagnosticoPreenchido(false)).toBe(true);
    expect(campoDiagnosticoPreenchido(true)).toBe(true);
  });

  it('converte objetos e arrays com String antes de validar', () => {
    expect(campoDiagnosticoPreenchido({})).toBe(true);
    expect(campoDiagnosticoPreenchido([])).toBe(false);
    expect(campoDiagnosticoPreenchido(['a'])).toBe(true);
  });

  it('respeita tamanhoMinimo depois do trim', () => {
    expect(campoDiagnosticoPreenchido(' abc ', 3)).toBe(true);
    expect(campoDiagnosticoPreenchido(' abc ', 4)).toBe(false);
  });
});

describe('criarResumoQualidadeDiagnostico em TypeScript', () => {
  it('retorna o resumo quando o diagnostico esta completo', () => {
    expect(criarResumoQualidadeDiagnostico({
      ausentes: [],
      avisos: [],
      resumo: 'Tem dados suficientes para alimentar bem a revisao inteligente.'
    })).toBe('Tem dados suficientes para alimentar bem a revisao inteligente.');
  });

  it('retorna string vazia para diagnostico vazio ou ausente', () => {
    expect(criarResumoQualidadeDiagnostico({})).toBe('');
    expect(criarResumoQualidadeDiagnostico(null)).toBe('');
    expect(criarResumoQualidadeDiagnostico(undefined)).toBe('');
  });

  it('combina ausentes e avisos em diagnostico parcialmente preenchido', () => {
    expect(criarResumoQualidadeDiagnostico({
      ausentes: ['conceito'],
      avisos: ['comentario']
    })).toBe('Falta conceito, comentario.');
  });

  it('respeita o limite legado de quatro itens e adiciona reticencias', () => {
    expect(criarResumoQualidadeDiagnostico({
      ausentes: ['causa do erro', 'confianca', 'conceito'],
      avisos: ['assunto', 'comentario']
    })).toBe('Falta causa do erro, confianca, conceito, assunto....');
  });

  it('respeita limite customizado', () => {
    expect(criarResumoQualidadeDiagnostico({
      ausentes: ['causa do erro', 'confianca'],
      avisos: ['assunto']
    }, 2)).toBe('Falta causa do erro, confianca....');
  });

  it('preserva campos com string vazia', () => {
    expect(criarResumoQualidadeDiagnostico({
      ausentes: [''],
      avisos: []
    })).toBe('Falta .');
  });

  it('preserva campos com espacos', () => {
    expect(criarResumoQualidadeDiagnostico({
      ausentes: ['   '],
      avisos: []
    })).toBe('Falta    .');
  });

  it('trata ausentes e avisos null ou undefined como listas vazias', () => {
    expect(criarResumoQualidadeDiagnostico({
      ausentes: null,
      avisos: undefined,
      resumo: 'Resumo padrao'
    })).toBe('Resumo padrao');
  });

  it('retorna string vazia para objeto sem os campos esperados', () => {
    expect(criarResumoQualidadeDiagnostico({
      status: 'fraco',
      classe: 'diagnostico-qualidade--fraco'
    })).toBe('');
  });
});

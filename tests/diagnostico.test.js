import { describe, expect, it } from 'vitest';

import {
  avaliarQualidadeDiagnosticoQuestao,
  campoDiagnosticoPreenchido,
  criarAlertaCadastroFracoQuestao,
  criarResumoQualidadeDiagnostico,
  valorDiagnostico
} from '../src/utils/diagnostico.ts';

const { criarAlertaCadastroFracoQuestao: criarAlertaCadastroFracoQuestaoLegado } = globalThis;

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

describe('criarAlertaCadastroFracoQuestao em TypeScript', () => {
  it('retorna string vazia para qualidade undefined', () => {
    expect(criarAlertaCadastroFracoQuestao(undefined)).toBe('');
    expect(criarAlertaCadastroFracoQuestao(undefined)).toBe(criarAlertaCadastroFracoQuestaoLegado(undefined));
  });

  it('retorna string vazia para qualidade null', () => {
    expect(criarAlertaCadastroFracoQuestao(null)).toBe('');
    expect(criarAlertaCadastroFracoQuestao(null)).toBe(criarAlertaCadastroFracoQuestaoLegado(null));
  });

  it('retorna string vazia para status completo', () => {
    const qualidade = {
      status: 'completo',
      classe: 'diagnostico-qualidade--forte',
      resumo: 'Resumo forte',
      ausentes: [],
      avisos: []
    };

    expect(criarAlertaCadastroFracoQuestao(qualidade)).toBe('');
    expect(criarAlertaCadastroFracoQuestao(qualidade)).toBe(criarAlertaCadastroFracoQuestaoLegado(qualidade));
  });

  it('preserva alerta para status incompleto', () => {
    const qualidade = {
      status: 'incompleto',
      classe: 'diagnostico-qualidade--incompleto',
      ausentes: ['causa do erro'],
      avisos: ['sem assunto do edital']
    };
    const resultado = criarAlertaCadastroFracoQuestao(qualidade);

    expect(resultado).toBe(criarAlertaCadastroFracoQuestaoLegado(qualidade));
    expect(resultado).toContain('cadastro-fraco-alerta diagnostico-qualidade--incompleto');
    expect(resultado).toContain('<strong>Pouco útil para revisão</strong>');
    expect(resultado).toContain('<span>Falta causa do erro, sem assunto do edital.</span>');
  });

  it('preserva alerta para status fraco', () => {
    const qualidade = {
      status: 'fraco',
      classe: 'diagnostico-qualidade--fraco',
      ausentes: ['conceito'],
      avisos: ['comentario']
    };
    const resultado = criarAlertaCadastroFracoQuestao(qualidade);

    expect(resultado).toBe(criarAlertaCadastroFracoQuestaoLegado(qualidade));
    expect(resultado).toContain('cadastro-fraco-alerta diagnostico-qualidade--fraco');
    expect(resultado).toContain('<strong>Cadastro pode melhorar</strong>');
    expect(resultado).toContain('<span>Falta conceito, comentario.</span>');
  });

  it('usa Cadastro pode melhorar para outro status nao completo', () => {
    const qualidade = {
      status: 'pendente',
      classe: 'diagnostico-qualidade--fraco',
      resumo: 'Resumo pendente',
      ausentes: [],
      avisos: []
    };
    const resultado = criarAlertaCadastroFracoQuestao(qualidade);

    expect(resultado).toBe(criarAlertaCadastroFracoQuestaoLegado(qualidade));
    expect(resultado).toContain('<strong>Cadastro pode melhorar</strong>');
    expect(resultado).toContain('<span>Resumo pendente</span>');
  });

  it('escapa HTML perigoso no resumo dentro do span', () => {
    const qualidade = {
      status: 'fraco',
      classe: 'diagnostico-qualidade--fraco',
      resumo: '<script>alert("x")</script>',
      ausentes: [],
      avisos: []
    };
    const resultado = criarAlertaCadastroFracoQuestao(qualidade);

    expect(resultado).toBe(criarAlertaCadastroFracoQuestaoLegado(qualidade));
    expect(resultado).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(resultado).not.toContain('<script>');
  });

  it('preserva exatamente a string HTML legada', () => {
    expect(criarAlertaCadastroFracoQuestao({
      status: 'fraco',
      classe: 'diagnostico-qualidade--fraco',
      ausentes: ['conceito'],
      avisos: ['comentario']
    })).toBe(`
    <div class="cadastro-fraco-alerta diagnostico-qualidade--fraco">
      <strong>Cadastro pode melhorar</strong>
      <span>Falta conceito, comentario.</span>
    </div>
  `);
  });
});

describe('avaliarQualidadeDiagnosticoQuestao em TypeScript', () => {
  it('retorna diagnostico forte para questao com diagnostico completo', () => {
    expect(avaliarQualidadeDiagnosticoQuestao({
      motivo_erro: 'Falha ao interpretar o enunciado',
      nivel_confianca: 'Baixa confianca',
      conceito_chave: 'Aplicacao correta da regra de competencia',
      como_reconhecer: 'Observar os termos do comando da questao',
      acao_corretiva: 'Revisar o resumo e refazer questoes do tema',
      pegadinha_banca: 'A banca troca o sujeito da pergunta',
      edital_topico_id: 'topico-1',
      comentario: 'Comentario com detalhes suficientes'
    })).toEqual({
      status: 'completo',
      rotulo: 'Diagnóstico forte',
      classe: 'diagnostico-qualidade--forte',
      resumo: 'Tem dados suficientes para alimentar bem a revisão inteligente.',
      ausentes: [],
      avisos: [],
      pontos: 8
    });
  });

  it('retorna diagnostico fraco para questao parcialmente preenchida', () => {
    expect(avaliarQualidadeDiagnosticoQuestao({
      motivo_erro: 'Falta de atencao',
      nivel_confianca: 'Media confianca',
      conceito_chave: 'Regra principal do assunto',
      como_reconhecer: 'Comparar o texto com a regra',
      acao_corretiva: 'Refazer questoes semelhantes'
    })).toEqual({
      status: 'fraco',
      rotulo: 'Diagnóstico fraco',
      classe: 'diagnostico-qualidade--fraco',
      resumo: 'Dá para revisar, mas faltam detalhes para o sistema entender melhor o padrão.',
      ausentes: [],
      avisos: ['sem assunto do edital', 'sem comentário ou pegadinha'],
      pontos: 5
    });
  });

  it('retorna diagnostico incompleto para questao sem diagnostico', () => {
    expect(avaliarQualidadeDiagnosticoQuestao()).toEqual({
      status: 'incompleto',
      rotulo: 'Diagnóstico incompleto',
      classe: 'diagnostico-qualidade--incompleto',
      resumo: 'Complete os campos essenciais para a questão entrar melhor na inteligência do sistema.',
      ausentes: ['causa do erro', 'confiança', 'conceito ou regra', 'como reconhecer', 'ação corretiva'],
      avisos: ['sem assunto do edital', 'sem comentário ou pegadinha'],
      pontos: 0
    });
  });

  it('mantem o retorno de objeto vazio igual ao legado', () => {
    expect(avaliarQualidadeDiagnosticoQuestao({})).toEqual({
      status: 'incompleto',
      rotulo: 'Diagnóstico incompleto',
      classe: 'diagnostico-qualidade--incompleto',
      resumo: 'Complete os campos essenciais para a questão entrar melhor na inteligência do sistema.',
      ausentes: ['causa do erro', 'confiança', 'conceito ou regra', 'como reconhecer', 'ação corretiva'],
      avisos: ['sem assunto do edital', 'sem comentário ou pegadinha'],
      pontos: 0
    });
  });

  it('preserva campos com string vazia', () => {
    expect(avaliarQualidadeDiagnosticoQuestao({
      motivo_erro: '',
      nivel_confianca: '',
      conceito_chave: '',
      como_reconhecer: '',
      acao_corretiva: '',
      pegadinha_banca: '',
      edital_topico_id: '',
      comentario: ''
    })).toEqual({
      status: 'incompleto',
      rotulo: 'Diagnóstico incompleto',
      classe: 'diagnostico-qualidade--incompleto',
      resumo: 'Complete os campos essenciais para a questão entrar melhor na inteligência do sistema.',
      ausentes: ['causa do erro', 'confiança', 'conceito ou regra', 'como reconhecer', 'ação corretiva'],
      avisos: ['sem assunto do edital', 'sem comentário ou pegadinha'],
      pontos: 0
    });
  });

  it('preserva campos com espacos', () => {
    expect(avaliarQualidadeDiagnosticoQuestao({
      motivo_erro: '   ',
      nivel_confianca: '   ',
      conceito_chave: '   ',
      como_reconhecer: '   ',
      acao_corretiva: '   ',
      pegadinha_banca: '   ',
      edital_topico_id: '   ',
      comentario: '   '
    })).toEqual({
      status: 'incompleto',
      rotulo: 'Diagnóstico incompleto',
      classe: 'diagnostico-qualidade--incompleto',
      resumo: 'Complete os campos essenciais para a questão entrar melhor na inteligência do sistema.',
      ausentes: ['causa do erro', 'confiança', 'conceito ou regra', 'como reconhecer', 'ação corretiva'],
      avisos: ['sem assunto do edital', 'sem comentário ou pegadinha'],
      pontos: 0
    });
  });

  it('preserva o uso de edital_topicos.titulo quando nao ha edital_topico_id', () => {
    const resultado = avaliarQualidadeDiagnosticoQuestao({
      motivo_erro: 'Falta de atencao',
      nivel_confianca: 'Media confianca',
      conceito_chave: 'Regra principal do assunto',
      como_reconhecer: 'Comparar o texto com a regra',
      acao_corretiva: 'Refazer questoes semelhantes',
      edital_topicos: { titulo: 'Direito Constitucional' }
    });

    expect(resultado.avisos).toEqual(['sem comentário ou pegadinha']);
    expect(resultado.pontos).toBe(6);
    expect(resultado.status).toBe('fraco');
  });

  it('preserva a exigencia de pegadinha quando o motivo parece pegadinha', () => {
    const resultado = avaliarQualidadeDiagnosticoQuestao({
      motivo_erro: 'Caiu em pegadinha da banca',
      nivel_confianca: 'Media',
      conceito_chave: 'Regra principal do assunto',
      como_reconhecer: 'Comparar o texto com a regra',
      acao_corretiva: 'Refazer questoes semelhantes',
      edital_topico_id: 'topico-1',
      comentario: 'Comentario com detalhes suficientes'
    });

    expect(resultado.ausentes).toEqual(['pegadinha da questão']);
    expect(resultado.status).toBe('fraco');
  });

  it('preserva o erro legado para questao null', () => {
    expect(() => avaliarQualidadeDiagnosticoQuestao(null)).toThrow();
  });
});

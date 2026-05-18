export function valorDiagnostico(
  q: Record<string, unknown> | null | undefined,
  snake: string,
  camel: string
): unknown {
  return q?.[snake] ?? q?.[camel] ?? '';
}

export function campoDiagnosticoPreenchido(valor: unknown, tamanhoMinimo = 1): boolean {
  const texto = String(valor ?? '').trim();
  if (['A diagnosticar', 'NÃ£o informado'].includes(texto)) return false;
  return texto.length >= tamanhoMinimo;
}

export interface QualidadeDiagnosticoResumo {
  ausentes?: unknown[] | null;
  avisos?: unknown[] | null;
  resumo?: string | null;
}

export function criarResumoQualidadeDiagnostico(
  qualidade: QualidadeDiagnosticoResumo | null | undefined,
  limite = 4
): string {
  const faltando = [...(qualidade?.ausentes || []), ...(qualidade?.avisos || [])];
  if (faltando.length === 0) return qualidade?.resumo || '';
  return `Falta ${faltando.slice(0, limite).join(', ')}${faltando.length > limite ? '...' : ''}.`;
}

export type QualidadeDiagnosticoStatus = 'completo' | 'fraco' | 'incompleto';

export interface QuestaoDiagnostico {
  [campo: string]: unknown;
  edital_topicos?: {
    titulo?: unknown;
  } | null;
}

export interface QualidadeDiagnosticoQuestao {
  status: QualidadeDiagnosticoStatus;
  rotulo: string;
  classe: string;
  resumo: string;
  ausentes: string[];
  avisos: string[];
  pontos: number;
}

export function avaliarQualidadeDiagnosticoQuestao(
  q: QuestaoDiagnostico = {}
): QualidadeDiagnosticoQuestao {
  const motivo = valorDiagnostico(q, 'motivo_erro', 'motivoErro');
  const confianca = valorDiagnostico(q, 'nivel_confianca', 'nivelConfianca');
  const conceito = valorDiagnostico(q, 'conceito_chave', 'conceitoChave');
  const reconhecer = valorDiagnostico(q, 'como_reconhecer', 'comoReconhecer');
  const acao = valorDiagnostico(q, 'acao_corretiva', 'acaoCorretiva');
  const pegadinha = valorDiagnostico(q, 'pegadinha_banca', 'pegadinhaBanca');
  const topico = valorDiagnostico(q, 'edital_topico_id', 'editalTopicoId') || q.edital_topicos?.titulo;
  const comentario = valorDiagnostico(q, 'comentario', 'comentario');
  const ausentes: string[] = [];
  const avisos: string[] = [];

  if (!campoDiagnosticoPreenchido(motivo)) ausentes.push('causa do erro');
  if (!campoDiagnosticoPreenchido(confianca)) ausentes.push('confiança');
  if (!campoDiagnosticoPreenchido(conceito, 8)) ausentes.push('conceito ou regra');
  if (!campoDiagnosticoPreenchido(reconhecer, 8)) ausentes.push('como reconhecer');
  if (!campoDiagnosticoPreenchido(acao, 8)) ausentes.push('ação corretiva');

  const motivoTexto = String(motivo || '').toLowerCase();
  const parecePegadinha = motivoTexto.includes('pegadinha') || motivoTexto.includes('interpreta') || String(pegadinha || '').trim();
  if (parecePegadinha && !campoDiagnosticoPreenchido(pegadinha, 8)) ausentes.push('pegadinha da questão');

  if (!campoDiagnosticoPreenchido(topico)) avisos.push('sem assunto do edital');
  if (!campoDiagnosticoPreenchido(comentario, 8) && !campoDiagnosticoPreenchido(pegadinha, 8)) {
    avisos.push('sem comentário ou pegadinha');
  }

  const pontos = [
    motivo,
    confianca,
    conceito,
    reconhecer,
    acao,
    pegadinha,
    topico,
    comentario
  ].reduce<number>((total, valor) => total + (campoDiagnosticoPreenchido(valor, 8) ? 1 : 0), 0);

  let status: QualidadeDiagnosticoStatus = 'completo';
  if (ausentes.includes('causa do erro') || ausentes.includes('confiança') || ausentes.length >= 3) {
    status = 'incompleto';
  } else if (ausentes.length > 0 || avisos.length > 0 || pontos < 6) {
    status = 'fraco';
  }

  const config = {
    completo: {
      rotulo: 'Diagnóstico forte',
      classe: 'diagnostico-qualidade--forte',
      resumo: 'Tem dados suficientes para alimentar bem a revisão inteligente.'
    },
    fraco: {
      rotulo: 'Diagnóstico fraco',
      classe: 'diagnostico-qualidade--fraco',
      resumo: 'Dá para revisar, mas faltam detalhes para o sistema entender melhor o padrão.'
    },
    incompleto: {
      rotulo: 'Diagnóstico incompleto',
      classe: 'diagnostico-qualidade--incompleto',
      resumo: 'Complete os campos essenciais para a questão entrar melhor na inteligência do sistema.'
    }
  };

  return {
    status,
    rotulo: config[status].rotulo,
    classe: config[status].classe,
    resumo: config[status].resumo,
    ausentes,
    avisos,
    pontos
  };
}

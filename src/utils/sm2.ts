export type QualidadeSM2 = 0 | 1 | 2 | 3 | 4 | 5;

export interface CalcularProximaRevisaoSM2Params {
  quality: number;
  repetitions: number;
  intervalDays: number;
  easeFactor?: number;
}

export interface ResultadoSM2 {
  quality: QualidadeSM2;
  repetitions: number;
  intervalDays: number;
  easeFactor: number;
  dueAgainToday: boolean;
  wasCorrect: boolean;
}

const EASE_FACTOR_PADRAO = 2.5;
const EASE_FACTOR_MINIMO = 1.3;

function validarQualidade(quality: number): QualidadeSM2 {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
    throw new Error('quality deve ser um numero inteiro entre 0 e 5.');
  }

  return quality as QualidadeSM2;
}

function validarContador(nome: string, valor: number): number {
  if (!Number.isInteger(valor) || valor < 0) {
    throw new Error(`${nome} deve ser um numero inteiro maior ou igual a 0.`);
  }

  return valor;
}

function normalizarEaseFactor(easeFactor: number | undefined): number {
  if (typeof easeFactor !== 'number' || !Number.isFinite(easeFactor)) {
    return EASE_FACTOR_PADRAO;
  }

  return Math.max(easeFactor, EASE_FACTOR_MINIMO);
}

function atualizarEaseFactor(easeFactor: number, quality: QualidadeSM2): number {
  const diferencaQualidade = 5 - quality;
  const novoEaseFactor =
    easeFactor + (0.1 - diferencaQualidade * (0.08 + diferencaQualidade * 0.02));

  return Math.max(novoEaseFactor, EASE_FACTOR_MINIMO);
}

export function calcularProximaRevisaoSM2(
  params: CalcularProximaRevisaoSM2Params
): ResultadoSM2 {
  const quality = validarQualidade(params.quality);
  const repetitions = validarContador('repetitions', params.repetitions);
  const intervalDays = validarContador('intervalDays', params.intervalDays);
  const easeFactorAtual = normalizarEaseFactor(params.easeFactor);
  const easeFactor = atualizarEaseFactor(easeFactorAtual, quality);
  const wasCorrect = quality >= 3;

  if (!wasCorrect) {
    return {
      quality,
      repetitions: 0,
      intervalDays: 1,
      easeFactor,
      dueAgainToday: true,
      wasCorrect: false
    };
  }

  const proximasRepeticoes = repetitions + 1;
  let proximoIntervalo = 1;

  if (proximasRepeticoes === 2) {
    proximoIntervalo = 6;
  } else if (proximasRepeticoes > 2) {
    proximoIntervalo = Math.ceil(intervalDays * easeFactorAtual);
  }

  return {
    quality,
    repetitions: proximasRepeticoes,
    intervalDays: proximoIntervalo,
    easeFactor,
    dueAgainToday: false,
    wasCorrect: true
  };
}

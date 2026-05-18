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

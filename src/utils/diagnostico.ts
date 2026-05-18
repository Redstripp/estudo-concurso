export function valorDiagnostico(
  q: Record<string, unknown> | null | undefined,
  snake: string,
  camel: string
): unknown {
  return q?.[snake] ?? q?.[camel] ?? '';
}

export function campoDiagnosticoPreenchido(valor: unknown, tamanhoMinimo = 1): boolean {
  const texto = String(valor ?? '').trim();
  if (['A diagnosticar', 'Não informado'].includes(texto)) return false;
  return texto.length >= tamanhoMinimo;
}

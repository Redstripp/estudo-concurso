export interface OpcoesContagemValores {
  fallback?: string;
}

export interface OcorrenciaValor {
  nome: string;
  total: number;
}

export function contarOcorrenciasValores(
  valores?: unknown[] | null,
  opcoes: OpcoesContagemValores = {}
): OcorrenciaValor[] {
  const fallback = opcoes.fallback || '';
  const contagem: Record<string, number> = {};

  (valores || []).forEach((valor) => {
    const chave = String(valor ?? '').trim() || fallback;
    if (!chave) return;
    contagem[chave] = (contagem[chave] || 0) + 1;
  });

  return Object.entries(contagem)
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
}

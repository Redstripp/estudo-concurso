export function formatarData(data: Date | string | null | undefined): string {
  if (!(data instanceof Date) || Number.isNaN(data.getTime())) return '';

  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();

  return `${dia}/${mes}/${ano}`;
}

/**
 * Formata data ISO para formato curto brasileiro (DD/MM/YYYY)
 * Replica exatamente o comportamento de js/utils.js::formatarDataCurta
 */
export function formatarDataCurta(data: string | Date | null | undefined): string {
  // Comportamento original: se !dataISO, retorna '-'
  if (!data) return '-';

  // Se for Date, converte para string ISO primeiro
  let dataStr: string;
  if (data instanceof Date) {
    if (Number.isNaN(data.getTime())) {
      // Date inválido - comportamento similar ao original (vai quebrar ou retornar estranho)
      // No original, dataISO.substring chamaria substring em Date, o que causaria erro
      // Para segurança, retornamos '-' para Date inválido
      return '-';
    }
    dataStr = data.toISOString();
  } else {
    dataStr = data;
  }

  // Comportamento original: substring(0, 10).split('-')
  const parteData = dataStr.substring(0, 10);
  const [ano, mes, dia] = parteData.split('-');

  // Se não conseguir extrair partes válidas, retorna '-' (similar ao comportamento original que retornaria algo quebrado)
  if (!ano || !mes || !dia) {
    return '-';
  }

  return `${dia}/${mes}/${ano}`;
}

function dataISO(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

export function diaAnterior(data?: Date | string): string {
  const d = new Date(String(data) + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return dataISO(d);
}

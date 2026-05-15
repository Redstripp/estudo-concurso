export function formatarData(data: Date | string | null | undefined): string {
  if (!(data instanceof Date) || Number.isNaN(data.getTime())) return '';

  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();

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

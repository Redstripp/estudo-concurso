export function calcularPorcentagem(parte: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((parte / total) * 100 * 100) / 100;
}

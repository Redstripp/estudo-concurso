export function formatarQuantidadeQuestoes(quantidade: unknown): string {
  const total = Number(quantidade) || 0;
  return total === 1 ? '1 questão' : `${total} questões`;
}

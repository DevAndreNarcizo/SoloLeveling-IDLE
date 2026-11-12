/**
 * PRNG determinístico (mulberry32) cujo estado vive dentro do GameState.
 * Evita Math.random no motor: a mesma seed + mesmos inputs produzem o
 * mesmo resultado, o que viabiliza testes reprodutíveis e validação
 * server-side no futuro.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface RngHolder {
  rng: number;
}

/** Retorna um float em [0, 1) e avança o estado do gerador. */
export function nextFloat(holder: RngHolder): number {
  holder.rng = (holder.rng + 0x6d2b79f5) >>> 0;
  let t = holder.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Retorna true com a probabilidade informada (0..1). */
export function chance(holder: RngHolder, probability: number): boolean {
  return nextFloat(holder) < probability;
}

/** Sorteia um elemento de uma lista não vazia. */
export function pick<T>(holder: RngHolder, list: readonly T[]): T {
  if (list.length === 0) throw new Error('pick: lista vazia');
  return list[Math.floor(nextFloat(holder) * list.length)] as T;
}

/**
 * Sorteio ponderado. Os pesos não precisam somar 1; entradas com peso
 * zero nunca são escolhidas.
 */
export function pickWeighted<T extends string>(holder: RngHolder, weights: Readonly<Record<T, number>>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  if (total <= 0) throw new Error('pickWeighted: soma de pesos inválida');
  let roll = nextFloat(holder) * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll < 0) return key;
  }
  // Salvaguarda contra erro de ponto flutuante: devolve a última entrada com peso.
  return (entries.filter(([, w]) => w > 0).at(-1) as [T, number])[0];
}

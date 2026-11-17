/** Humor do memoji pela conversão em relação à meta: baixa (< 50%), na metade (< 80%), quase lá (< 100%) e meta batida. */
export type LeadMood = { key: 'dislike' | 'sad' | 'almost' | 'like'; img: string; color: string; label: string; alt: string }
export function leadMood(pct: number, goal: number): LeadMood {
  const ratio = goal > 0 ? pct / goal : 0
  if (ratio >= 1) return { key: 'like', img: '/mascote.png', color: '#34C759', label: 'Meta batida', alt: 'Memoji com o polegar para cima' }
  if (ratio >= 0.8) return { key: 'almost', img: '/memoji-quase.png', color: '#A3D635', label: 'Quase lá', alt: 'Memoji sorrindo com uma gota de suor' }
  if (ratio >= 0.5) return { key: 'sad', img: '/memoji-triste.png', color: '#FF9F0A', label: 'Abaixo da meta', alt: 'Memoji triste' }
  return { key: 'dislike', img: '/memoji-deslike.png', color: '#FF453A', label: 'Conversão baixa', alt: 'Memoji com o polegar para baixo' }
}

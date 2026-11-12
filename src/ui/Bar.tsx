interface BarProps {
  value: number;
  max: number;
  tone: 'hp' | 'enemy' | 'xp' | 'boss';
  label?: string;
}

/** Barra de progresso genérica (HP, XP, contagem para o guardião). */
export function Bar({ value, max, tone, label }: BarProps) {
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  return (
    <div className={`bar bar--${tone}`} role="progressbar" aria-valuemin={0} aria-valuemax={Math.round(max)} aria-valuenow={Math.round(Math.max(value, 0))}>
      <div className="bar__fill" style={{ width: `${ratio * 100}%` }} />
      {label !== undefined && <span className="bar__label">{label}</span>}
    </div>
  );
}

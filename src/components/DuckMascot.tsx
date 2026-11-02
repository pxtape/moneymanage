import type { CSSProperties } from 'react';
import sprites from '../assets/duck-mascots.webp';

export type DuckPose = 'wave' | 'journal' | 'save' | 'chart' | 'tea' | 'tail';
const positions: Record<DuckPose, string> = {
  wave: '0% 0%', journal: '50% 0%', save: '100% 0%',
  chart: '0% 100%', tea: '50% 100%', tail: '100% 100%',
};
export function DuckMascot({ pose = 'wave', className = '', label }: {
  pose?: DuckPose; className?: string; label?: string;
}) {
  return <span className={`duck-mascot ${className}`} data-duck-pose={pose}
    role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
    style={{ '--duck-position': positions[pose], backgroundImage: `url(${sprites})` } as CSSProperties} />;
}

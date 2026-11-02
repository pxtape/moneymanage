import type { CSSProperties } from 'react';
import sprites from '../assets/duck-mascots.webp';
import everyday from '../assets/duck-everyday.webp';

export type DuckPose = 'wave' | 'journal' | 'save' | 'chart' | 'tea' | 'tail' | 'breakfast' | 'sleep' | 'blanket' | 'food' | 'drink' | 'travel';
const positions: Record<DuckPose, string> = {
  breakfast:'0% 0%',sleep:'50% 0%',blanket:'100% 0%',food:'0% 100%',drink:'50% 100%',travel:'100% 100%',
  wave: '0% 0%', journal: '50% 0%', save: '100% 0%',
  chart: '0% 100%', tea: '50% 100%', tail: '100% 100%',
};
export function DuckMascot({ pose = 'wave', className = '', label }: {
  pose?: DuckPose; className?: string; label?: string;
}) {
  return <span className={`duck-mascot ${className}`} data-duck-pose={pose}
    role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
    style={{ '--duck-position': positions[pose], backgroundImage: `url(${["breakfast","sleep","blanket","food","drink","travel"].includes(pose)?everyday:sprites})` } as CSSProperties} />;
}

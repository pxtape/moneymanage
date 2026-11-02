import type { CSSProperties } from 'react';
import sprites from '../assets/duck-mascots.webp';
import everyday from '../assets/duck-everyday.webp';
import moneyScenes from '../assets/duck-money-scenes.webp';
import lifeScenes from '../assets/duck-life-scenes.webp';

export type DuckPose = 'wave' | 'journal' | 'save' | 'chart' | 'tea' | 'tail' | 'breakfast' | 'sleep' | 'blanket' | 'food' | 'drink' | 'travel' | 'record' | 'receive' | 'deposit' | 'organize' | 'meter' | 'calendar' | 'grow' | 'commute' | 'noodles' | 'rest' | 'celebrate' | 'search';
const positions: Record<DuckPose, string> = {
  record:'0% 0%',receive:'50% 0%',deposit:'100% 0%',organize:'0% 100%',meter:'50% 100%',calendar:'100% 100%',
  grow:'0% 0%',commute:'50% 0%',noodles:'100% 0%',rest:'0% 100%',celebrate:'50% 100%',search:'100% 100%',
  breakfast:'0% 0%',sleep:'50% 0%',blanket:'100% 0%',food:'0% 100%',drink:'50% 100%',travel:'100% 100%',
  wave: '0% 0%', journal: '50% 0%', save: '100% 0%',
  chart: '0% 100%', tea: '50% 100%', tail: '100% 100%',
};
export function DuckMascot({ pose = 'wave', className = '', label }: {
  pose?: DuckPose; className?: string; label?: string;
}) {
  const sheet = ['record','receive','deposit','organize','meter','calendar'].includes(pose) ? moneyScenes : ['grow','commute','noodles','rest','celebrate','search'].includes(pose) ? lifeScenes : ['breakfast','sleep','blanket','food','drink','travel'].includes(pose) ? everyday : sprites;
  return <span className={`duck-mascot ${className}`} data-duck-pose={pose}
    role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
    style={{ '--duck-position': positions[pose], backgroundImage: `url(${sheet})` } as CSSProperties} />;
}

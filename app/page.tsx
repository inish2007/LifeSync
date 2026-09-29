'use client';

import dynamic from 'next/dynamic';

const LifeLoop = dynamic(() => import('./lifeloop'), { ssr: false });

export default function Home() {
  return <LifeLoop />;
}


'use client';

import dynamic from 'next/dynamic';

const LifeLoop = dynamic(() => import('../components/account-gate'), { ssr: false });

export default function Home() {
  return <LifeLoop />;
}


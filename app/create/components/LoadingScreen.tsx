'use client';

import { useEffect, useState } from 'react';

export default function LoadingScreen({ onDone }: { onDone: () => void }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 2400);
    const doneTimer = setTimeout(onDone, 3000);
    return () => { clearTimeout(fadeTimer); clearTimeout(doneTimer); };
  }, [onDone]);

  return (
    <>
      <style>{`
        @keyframes wave-fill {
          0%   { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>

      <div
        className="absolute inset-0 z-20 flex items-center justify-center rounded-xl"
        style={{
          background: '#0a1628',
          transition: 'opacity 0.6s ease',
          opacity: fading ? 0 : 1,
          pointerEvents: fading ? 'none' : 'auto',
        }}
      >
        {/* Circle with wave animation */}
        <div style={{ position: 'relative', width: 72, height: 72 }}>
          {/* Circle border */}
          <div style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            border: '2px solid rgba(34,211,238,0.25)',
          }} />

          {/* Clipping mask — circle shape */}
          <div style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            overflow: 'hidden',
          }}>
            {/* Wave strip — slides right-to-left */}
            <div style={{
              position: 'absolute',
              top: 0, bottom: 0,
              width: '200%',
              left: 0,
              background: 'linear-gradient(90deg, transparent 0%, #22d3ee 40%, #0ea5e9 60%, transparent 100%)',
              opacity: 0.55,
              animation: 'wave-fill 1.4s linear infinite',
            }} />
          </div>
        </div>
      </div>
    </>
  );
}

import { useEffect, useRef } from 'react';

interface Props {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: Props) {
  const completed = useRef(false);

  useEffect(() => {
    // Dismiss splash as soon as possible — no minimum timer.
    // Just wait for the logo animation frame to show (~800ms) then dismiss.
    const timer = setTimeout(() => {
      if (!completed.current) {
        completed.current = true;
        onComplete();
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#060a0f',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <iframe
        src="/splash.html"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
          position: 'absolute',
          inset: 0,
        }}
        title="Loading"
      />
    </div>
  );
}

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  hue: number;
  alpha: number;
  twinkle: number;
}

const HUES = [265, 205, 42]; // arcane purple · mystic blue · gold

/**
 * Lightweight canvas starfield with linked "constellations". Pauses when the tab is hidden,
 * renders a static frame for prefers-reduced-motion, and scales density with viewport size.
 */
export function ParticleField({ className, density = 1 }: { className?: string; density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let particles: Particle[] = [];
    let frame = 0;
    let width = 0;
    let height = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(140, Math.round(((width * height) / 14000) * density));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.6 + 0.3,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18 - 0.05,
        hue: HUES[Math.floor(Math.random() * HUES.length)]!,
        alpha: Math.random() * 0.6 + 0.25,
        twinkle: Math.random() * Math.PI * 2,
      }));
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;
        if (!reduced) {
          p.x = (p.x + p.vx + width) % width;
          p.y = (p.y + p.vy + height) % height;
        }
        const a = p.alpha * (0.65 + 0.35 * Math.sin(t / 900 + p.twinkle));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 90%, 75%, ${a})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = `hsla(${p.hue}, 90%, 65%, ${a})`;
        ctx.fill();
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j]!;
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 9000) {
            ctx.shadowBlur = 0;
            ctx.strokeStyle = `hsla(${p.hue}, 80%, 70%, ${0.08 * (1 - d2 / 9000)})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
      }
      if (!reduced && !document.hidden) frame = requestAnimationFrame(draw);
    };

    const onVisibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) frame = requestAnimationFrame(draw);
    };

    resize();
    frame = requestAnimationFrame(draw);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [density]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}

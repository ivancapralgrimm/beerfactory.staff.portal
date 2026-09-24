import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

const COLORS = [
  "var(--bf-gold)",
  "var(--bf-copper-hi)",
  "var(--bf-cream)",
  "var(--bf-green)"
];

const PARTICLES = Array.from({ length: 52 }, (_, index) => {
  const side = index % 2 === 0 ? -1 : 1;
  const distance = 62 + ((index * 19) % 83);
  const height = 5 + ((index * 13) % 22);

  return {
    side,
    distance,
    height,
    drift: side * (10 + (index % 5) * 6),
    delay: (index % 8) * 0.045,
    duration: 3.25 + (index % 6) * 0.12,
    rotation: (index % 2 ? -1 : 1) * (190 + index * 13),
    color: COLORS[index % COLORS.length],
    width: index % 4 === 0 ? 5 : 8,
    pieceHeight: index % 4 === 0 ? 12 : 6
  };
});

export function PassedScoreConfetti() {
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (reducedMotion || !containerRef.current) return;

    const container = containerRef.current;
    const observer = new ResizeObserver(() => {
      setHeight(container.getBoundingClientRect().height);
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [reducedMotion]);

  if (reducedMotion) return null;

  return (
    <div ref={containerRef} className="bf-result-confetti pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {height > 0 && PARTICLES.map((particle, index) => (
        <motion.span
          key={index}
          className="absolute rounded-[2px]"
          style={{
            left: particle.side < 0 ? "29%" : "71%",
            top: "42%",
            width: particle.width,
            height: particle.pieceHeight,
            backgroundColor: particle.color
          }}
          initial={{ x: 0, y: 0, rotate: 0, scale: 0, opacity: 0 }}
          animate={{
            x: [0, particle.side * particle.distance, particle.side * particle.distance + particle.drift, particle.side * particle.distance + particle.drift * 1.5],
            y: [0, -height * (0.42 - particle.height / 100), -height * (0.34 - particle.height / 100), height * 0.55],
            rotate: particle.rotation,
            scale: [0, 1, 1, 0.8],
            opacity: [0, 1, 1, 0.85]
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            times: [0, 0.18, 0.34, 1],
            ease: ["easeOut", "easeOut", "easeIn"]
          }}
        />
      ))}
    </div>
  );
}

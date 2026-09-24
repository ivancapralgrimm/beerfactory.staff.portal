import { motion, useReducedMotion } from "motion/react";

const COLORS = [
  "var(--bf-gold)",
  "var(--bf-copper-hi)",
  "var(--bf-cream)",
  "var(--bf-green)"
];

const PARTICLES = Array.from({ length: 44 }, (_, index) => {
  const angle = (index * 137.508 * Math.PI) / 180;
  const spread = 65 + ((index * 47) % 120);

  return {
    x: Math.cos(angle) * spread,
    y: Math.sin(angle) * spread - 24,
    delay: (index % 9) * 0.035,
    duration: 1.4 + (index % 6) * 0.13,
    rotation: (index % 2 ? -1 : 1) * (190 + index * 13),
    color: COLORS[index % COLORS.length],
    width: index % 4 === 0 ? 5 : 8,
    height: index % 4 === 0 ? 12 : 6
  };
});

export function PassedScoreConfetti() {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) return null;

  return (
    <div className="bf-result-confetti pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {PARTICLES.map((particle, index) => (
        <motion.span
          key={index}
          className="absolute left-1/2 top-[38%] rounded-[2px]"
          style={{
            width: particle.width,
            height: particle.height,
            backgroundColor: particle.color
          }}
          initial={{ x: 0, y: 0, rotate: 0, scale: 0, opacity: 0 }}
          animate={{
            x: particle.x,
            y: particle.y + 75,
            rotate: particle.rotation,
            scale: [0, 1, 1, 0.7],
            opacity: [0, 1, 1, 0]
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            times: [0, 0.15, 0.68, 1],
            ease: "easeOut"
          }}
        />
      ))}
    </div>
  );
}

import { motion, useReducedMotion } from "motion/react";

type CategoryMotionIconProps = {
  categoryId: string;
  selected: boolean;
};

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.3,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const
};

function WineIcon({ active, reduced }: { active: boolean; reduced: boolean }) {
  const move = active && !reduced;

  return (
    <svg viewBox="0 0 64 64" className="size-12" aria-hidden>
      <motion.g
        {...strokeProps}
        animate={
          move
            ? { x: [0, 3.2, 1.2], rotate: [0, 7, 0] }
            : { x: 0, rotate: 0 }
        }
        transition={{ duration: 0.46, ease: [0.2, 0, 0, 1] }}
        style={{ transformOrigin: "22px 45px" }}
      >
        <path d="M13 13h17l-2.2 15.2a7.4 7.4 0 0 1-14.6 0L13 13Z" />
        <path d="M15 22h13" />
        <path d="M21.5 35v11" />
        <path d="M16.5 49h10" />
      </motion.g>

      <motion.g
        {...strokeProps}
        animate={
          move
            ? { x: [0, -3.2, -1.2], rotate: [0, -7, 0] }
            : { x: 0, rotate: 0 }
        }
        transition={{ duration: 0.46, ease: [0.2, 0, 0, 1] }}
        style={{ transformOrigin: "42px 45px" }}
      >
        <path d="M34 13h17l-.2 15.2a7.4 7.4 0 0 1-14.6 0L34 13Z" />
        <path d="M36 22h13" />
        <path d="M42.5 35v11" />
        <path d="M37.5 49h10" />
      </motion.g>

      <motion.path
        d="M32 12v5M28.5 14.5l3.5 2.5 3.5-2.5"
        {...strokeProps}
        stroke="var(--bf-gold)"
        initial={false}
        animate={
          move
            ? {
                opacity: [0, 0, 1, 0],
                scale: [0.65, 0.65, 1.15, 0.9]
              }
            : { opacity: 0, scale: 0.9 }
        }
        transition={{
          duration: 0.46,
          times: [0, 0.38, 0.62, 1],
          ease: "easeOut"
        }}
        style={{ transformOrigin: "32px 16px" }}
      />
    </svg>
  );
}

function BarIcon({ active, reduced }: { active: boolean; reduced: boolean }) {
  const move = active && !reduced;

  return (
    <svg viewBox="0 0 64 64" className="size-12" aria-hidden>
      <motion.g
        {...strokeProps}
        animate={
          move
            ? {
                x: [0, 5, 9, 9, 0],
                y: [0, -1, -4, -4, 0],
                rotate: [0, -8, -27, -27, 0]
              }
            : { x: 0, y: 0, rotate: 0 }
        }
        transition={{
          duration: 0.62,
          times: [0, 0.2, 0.42, 0.66, 1],
          ease: [0.2, 0, 0, 1]
        }}
        style={{ transformOrigin: "23px 33px" }}
      >
        <path d="M14 18h17" />
        <path d="M17 14h11l2 4H15l2-4Z" />
        <path d="M15 18h15l-2 25H17l-2-25Z" />
        <path d="M18 25h10" />
      </motion.g>

      <g {...strokeProps}>
        <path d="M39 27h15l-2 10a7 7 0 0 1-11 0l-2-10Z" />
        <path d="M46.5 41v7" />
        <path d="M42 51h9" />
        <path d="M41.5 34h10" stroke="var(--bf-gold)" />
      </g>

      <motion.path
        d="M35 25c3 2 5 4 7 7"
        {...strokeProps}
        stroke="var(--bf-copper-hi)"
        initial={false}
        animate={
          move
            ? { pathLength: [0, 0, 1, 1, 0], opacity: [0, 0, 1, 1, 0] }
            : { pathLength: 0, opacity: 0 }
        }
        transition={{
          duration: 0.62,
          times: [0, 0.38, 0.5, 0.68, 1],
          ease: "easeOut"
        }}
      />
    </svg>
  );
}

function KitchenIcon({
  active,
  reduced
}: {
  active: boolean;
  reduced: boolean;
}) {
  const move = active && !reduced;

  return (
    <svg viewBox="0 0 64 64" className="size-12" aria-hidden>
      <g {...strokeProps}>
        <path d="M13 44h38" />
        <path d="M17 47h30" />
      </g>

      <motion.g
        {...strokeProps}
        animate={
          move
            ? { y: [0, -8, -8, 0], rotate: [0, -4, -4, 0] }
            : { y: 0, rotate: 0 }
        }
        transition={{
          duration: 0.58,
          times: [0, 0.26, 0.68, 1],
          ease: [0.2, 0, 0, 1]
        }}
        style={{ transformOrigin: "32px 42px" }}
      >
        <path d="M18 42c1-12 6-19 14-19s13 7 14 19H18Z" />
        <path d="M28 22c0-3 1.8-5 4-5s4 2 4 5" />
      </motion.g>

      {[25, 32, 39].map((x, index) => (
        <motion.path
          key={x}
          d={`M${x} 30c-2-3 2-4 0-7`}
          {...strokeProps}
          stroke="var(--bf-gold)"
          initial={false}
          animate={
            move
              ? {
                  y: [4, 0, -3],
                  opacity: [0, 0.9, 0]
                }
              : { y: 0, opacity: 0 }
          }
          transition={{
            duration: 0.44,
            delay: 0.12 + index * 0.035,
            ease: "easeOut"
          }}
        />
      ))}
    </svg>
  );
}

function ServiceIcon({
  active,
  reduced
}: {
  active: boolean;
  reduced: boolean;
}) {
  const move = active && !reduced;

  return (
    <svg viewBox="0 0 64 64" className="size-12" aria-hidden>
      <g {...strokeProps}>
        <path d="M16 44h32" />
        <path d="M19 41c1-11 6-17 13-17s12 6 13 17H19Z" />
        <motion.path
          d="M29 24v-3h6v3"
          animate={move ? { y: [0, 2, 0] } : { y: 0 }}
          transition={{
            duration: 0.46,
            times: [0, 0.54, 1],
            ease: [0.2, 0, 0, 1]
          }}
        />
      </g>

      <motion.g
        {...strokeProps}
        animate={
          move
            ? { x: [5, 0, 0, 5], y: [-8, 0, 0, -8] }
            : { x: 5, y: -8 }
        }
        transition={{
          duration: 0.56,
          times: [0, 0.36, 0.58, 1],
          ease: [0.2, 0, 0, 1]
        }}
      >
        <path d="M41 10c4 0 7 2 7 5v2h-8" />
        <path d="M40 17h-8c-2 0-3 1-3 3v2" />
      </motion.g>

      <motion.g
        {...strokeProps}
        stroke="var(--bf-gold)"
        initial={false}
        animate={
          move
            ? { opacity: [0, 0, 1, 0], scale: [0.8, 0.8, 1, 1.08] }
            : { opacity: 0, scale: 0.8 }
        }
        transition={{
          duration: 0.56,
          times: [0, 0.46, 0.7, 1],
          ease: "easeOut"
        }}
        style={{ transformOrigin: "32px 29px" }}
      >
        <path d="M12 28h-4" />
        <path d="M52 28h4" />
        <path d="M17 18l-3-3" />
        <path d="M47 18l3-3" />
      </motion.g>
    </svg>
  );
}

export function CategoryMotionIcon({
  categoryId,
  selected
}: CategoryMotionIconProps) {
  const reduced = Boolean(useReducedMotion());

  return (
    <motion.span
      aria-hidden
      className="grid size-14 place-items-center text-[var(--bf-copper-hi)]"
      initial={false}
      animate={{
        opacity: selected ? 1 : 0,
        scale: selected ? 1 : 0.88
      }}
      transition={{ duration: reduced ? 0.1 : 0.16, ease: "easeOut" }}
    >
      {categoryId === "wine" ? (
        <WineIcon active={selected} reduced={reduced} />
      ) : categoryId === "kitchen" ? (
        <KitchenIcon active={selected} reduced={reduced} />
      ) : categoryId === "service" ? (
        <ServiceIcon active={selected} reduced={reduced} />
      ) : (
        <BarIcon active={selected} reduced={reduced} />
      )}
    </motion.span>
  );
}

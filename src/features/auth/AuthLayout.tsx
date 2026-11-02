import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import "./auth-design.css";

export function AuthLayout({ title, description, children, variant = "login" }: {
  title: string;
  description?: string;
  children: ReactNode;
  variant?: "login" | "register" | "recovery" | "setup";
}) {
  const reduced = useReducedMotion();
  const [imageFailed, setImageFailed] = useState(false);
  return <div className={`bfstaff-app bf-auth-scene auth-design--${variant}`} lang="ru">
    <div className="bf-shell warm-auth-shell">
      <main className="auth-screen">
        <a className="bf-skip-link" href="#mainContent">К основному содержимому</a>
        <section id="mainContent" tabIndex={-1} aria-labelledby="auth-title" className="auth-panel">
          <motion.div className="auth-concept-heading" initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }} transition={{ duration: .24, ease: [.16, 1, .3, 1] }}>
            {!imageFailed ? <div className="auth-concept-emblem"><img src="/assets/auth/portal-emblem.webp" alt="" width={896} height={896} fetchPriority="high" onError={() => setImageFailed(true)} /></div> : null}
            <p className="auth-concept-brand">BeerFactory · BeerBistro</p>
            <h1 id="auth-title" tabIndex={-1}>{title}</h1>
          </motion.div>
          <div className="auth-concept-card">
            {description ? <p className="auth-concept-description">{description}</p> : null}
            {children}
          </div>
        </section>
      </main>
    </div>
  </div>;
}

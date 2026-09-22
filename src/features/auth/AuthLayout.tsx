import type { ReactNode } from "react";
import { Brand } from "@/components/Brand";

export function AuthLayout({
  eyebrow,
  title,
  description,
  children
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-screen">
      <a className="bf-skip-link" href="#mainContent">
        К основному содержимому
      </a>
      <section
        id="mainContent"
        tabIndex={-1}
        aria-labelledby="auth-title"
        className="auth-panel"
      >
        <div className="mb-5">
          <Brand />
        </div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="auth-title" className="text-balance text-[30px] font-black leading-[1.04] tracking-[-0.03em]">
          {title}
        </h1>
        <p className="mt-2 text-pretty text-[15px] leading-6 text-[var(--bf-muted)]">
          {description}
        </p>
        <div className="mt-5">{children}</div>
      </section>
    </main>
  );
}

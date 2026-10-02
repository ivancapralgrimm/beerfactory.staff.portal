import { useState, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Material wrappers only. Data, actions, permissions and route state stay in pages. */
export function craftScreen(path: string) {
  if (path === "/") return "dashboard";
  if (path === "/shift/editor") return "checklist-editor";
  if (path.startsWith("/shift")) return "shift";
  if (path === "/knowledge/new" || path.endsWith("/edit"))
    return "article-editor";
  if (path === "/knowledge/manage") return "knowledge-manage";
  if (path === "/knowledge") return "knowledge";
  if (path.startsWith("/knowledge/")) return "article";
  if (path === "/menu") return "menu";
  if (path.startsWith("/menu/")) return "recipe";
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/profile")) return "profile";
  if (path.startsWith("/attestation")) return "attestation";
  return "feed";
}

export function CraftPage({
  screen,
  children,
}: {
  screen: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("craft-context craft-page", `craft-page--${screen}`)}
      data-craft-screen={screen}
    >
      {children}
    </div>
  );
}

export function PaperCard({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("craft-paper-card", className)} {...props} />;
}

export function PhotoMount({
  src,
  fallback,
}: {
  src: string;
  fallback: ReactNode;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return (
    <div className="craft-recipe-thumb">
      {src && src !== failedSource ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          width="320"
          height="240"
          onError={() => setFailedSource(src)}
        />
      ) : (
        fallback
      )}
    </div>
  );
}

export function ClipboardSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("craft-clipboard", className)}>
      <span className="craft-clipboard-clip" aria-hidden="true" />
      <div className="craft-clipboard-paper">{children}</div>
      <span className="craft-pen" aria-hidden="true">
        <i />
        <b />
      </span>
    </div>
  );
}

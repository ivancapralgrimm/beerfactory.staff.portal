import { useEffect } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation
} from "react-router-dom";
import {
  BookOpen,
  ClipboardCheck,
  Home,
  Menu,
  PencilRuler,
  StickyNote
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/auth-context";
import { canManageChecklistsClient } from "@/types/auth";
import { clearPushBadge } from "@/features/notifications/notification-api";

const navItems = [
  {
    to: "/",
    label: "Главная",
    icon: Home,
    end: true
  },
  {
    to: "/menu",
    label: "Меню",
    icon: Menu
  },
  {
    to: "/knowledge",
    label: "Знания",
    icon: BookOpen
  },
  {
    to: "/shift",
    label: "Смена",
    icon: ClipboardCheck
  },
  {
    to: "/feed",
    label: "Лента",
    icon: StickyNote
  }
];

export function AppShell() {
  const { state } = useAuth();
  const location = useLocation();
  const isDashboard = location.pathname === "/";
  const isShiftArea = location.pathname.startsWith("/shift");
  const isChecklistEditor = location.pathname === "/shift/editor";
  const canManageChecklists =
    state.status === "authenticated" &&
    canManageChecklistsClient(state.user);

  useEffect(() => {
    const clear = () => {
      void clearPushBadge();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        clear();
      }
    };

    clear();
    window.addEventListener("focus", clear);
    document.addEventListener(
      "visibilitychange",
      onVisibilityChange
    );

    return () => {
      window.removeEventListener("focus", clear);
      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange
      );
    };
  }, []);

  return (
    <div className={cn("bf-app-shell min-h-dvh", isDashboard ? "pb-[env(safe-area-inset-bottom)]" : "pb-[calc(76px+env(safe-area-inset-bottom))]")}>
      <a
        className="bf-skip-link"
        href="#mainContent"
      >
        К основному содержимому
      </a>

      <main
        id="mainContent"
        tabIndex={-1}
        className="bf-main mx-auto max-w-5xl px-4 pt-[calc(20px+env(safe-area-inset-top))] pb-5 outline-none"
      >
        {isShiftArea && (isChecklistEditor || canManageChecklists) ? (
          <div className="mb-3 flex justify-end">
            <Link
              to={isChecklistEditor ? "/shift" : "/shift/editor"}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-3 text-xs font-black text-[var(--bf-cream)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
            >
              {isChecklistEditor ? (
                <ClipboardCheck className="size-4" aria-hidden />
              ) : (
                <PencilRuler className="size-4" aria-hidden />
              )}
              {isChecklistEditor ? "К смене" : "Редактор чек-листов"}
            </Link>
          </div>
        ) : null}

        <Outlet />
      </main>

      {!isDashboard && <nav
        aria-label="Основная навигация"
        className="bf-bottom-nav fixed inset-x-0 bottom-0 z-50 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto grid min-h-[62px] max-w-xl grid-cols-5 px-2">
          {navItems.map(
            ({
              to,
              label,
              icon: Icon,
              end
            }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-[60px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-medium text-[var(--bf-muted)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]",
                    isActive &&
                      "text-[var(--bf-copper-hi)]"
                  )
                }
              >
                <Icon
                  className="size-[19px]"
                  aria-hidden
                />
                <span>{label}</span>
              </NavLink>
            )
          )}
        </div>
      </nav>}
    </div>
  );
}

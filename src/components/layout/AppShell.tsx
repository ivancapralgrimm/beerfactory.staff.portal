import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation
} from "react-router-dom";
import {
  ArrowUp,
  BookOpen,
  ClipboardCheck,
  Home,
  Menu,
  PencilRuler,
  StickyNote
} from "lucide-react";
import { CraftPage, craftScreen } from "@/components/craft/CraftPage";
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

function ScrollToTopButton({ withBottomNav }: { withBottomNav: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => {
      const threshold = Math.max(420, window.innerHeight * 0.7);
      setVisible(window.scrollY > threshold);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="bf-scroll-top"
      data-with-bottom-nav={withBottomNav ? "true" : "false"}
      aria-label="Вернуться наверх"
      onClick={() => {
        const reduceMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches;
        window.scrollTo({
          top: 0,
          left: 0,
          behavior: reduceMotion ? "auto" : "smooth"
        });
      }}
    >
      <ArrowUp className="size-5" aria-hidden />
    </button>
  );
}

export function AppShell() {
  const { state } = useAuth();
  const location = useLocation();
  const screen = craftScreen(location.pathname);
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

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const previousRootBackground = root.style.backgroundColor;
    const previousBodyBackground = body.style.backgroundColor;
    const previousColorScheme = root.style.colorScheme;

    root.style.backgroundColor = "#f4e5c9";
    body.style.backgroundColor = "#f4e5c9";
    root.style.colorScheme = "light";

    return () => {
      root.style.backgroundColor = previousRootBackground;
      body.style.backgroundColor = previousBodyBackground;
      root.style.colorScheme = previousColorScheme;
    };
  }, []);

  const shiftTool = isShiftArea && (isChecklistEditor || canManageChecklists) ? (
    <div className="bf-page-tools" aria-label="Инструменты смены">
      <Link
        to={isChecklistEditor ? "/shift" : "/shift/editor"}
        className="bf-page-tool-link"
      >
        {isChecklistEditor ? (
          <ClipboardCheck className="size-4" aria-hidden />
        ) : (
          <PencilRuler className="size-4" aria-hidden />
        )}
        {isChecklistEditor ? "К смене" : "Редактор чек-листов"}
      </Link>
    </div>
  ) : null;

  return (
    <div className={cn("bf-app-shell min-h-dvh", `bf-app-shell--${screen}`, isDashboard ? "pb-[env(safe-area-inset-bottom)]" : "pb-[calc(64px+env(safe-area-inset-bottom))]")}>
      <a
        className="bf-skip-link"
        href="#mainContent"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("mainContent")?.focus();
        }}
      >
        К основному содержимому
      </a>

      <main
        id="mainContent"
        tabIndex={-1}
        className="bf-main mx-auto max-w-5xl px-4 pt-[calc(20px+env(safe-area-inset-top))] pb-5 outline-none"
      >
        <CraftPage screen={screen}>
          {shiftTool}
          <Outlet />
        </CraftPage>
      </main>

      <ScrollToTopButton withBottomNav={!isDashboard} />

      {!isDashboard && <nav
        aria-label="Основная навигация"
        className="bf-bottom-dock"
      >
        <div className="bf-bottom-nav">
        <div className="mx-auto grid min-h-[52px] max-w-xl grid-cols-5 px-2">
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
                    "flex min-h-[50px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-medium text-[var(--bf-muted)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]",
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
        </div>
      </nav>}
    </div>
  );
}

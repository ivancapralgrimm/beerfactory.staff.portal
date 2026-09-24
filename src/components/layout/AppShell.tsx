import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BookOpen,
  ClipboardCheck,
  Home,
  Menu,
  StickyNote
} from "lucide-react";
import { cn } from "@/lib/utils";
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
    to: "/handover",
    label: "Передача",
    icon: StickyNote
  }
];

export function AppShell() {
  const isDashboard = useLocation().pathname === "/";
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

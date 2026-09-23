import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  BookOpen,
  ClipboardCheck,
  Home,
  Menu,
  StickyNote
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/auth-context";
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

function HeaderBrand() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <img
        src="/assets/icons/icon-192.png"
        alt=""
        width="44"
        height="44"
        className="size-11 shrink-0 object-contain"
        aria-hidden
      />

      <div className="min-w-0 leading-none">
        <div className="truncate text-[13px] font-extrabold tracking-[0.13em] text-[var(--bf-cream)] sm:text-[14px]">
          BEERFACTORY
        </div>
        <div className="mt-1 truncate text-[10px] font-semibold tracking-[0.18em] text-[var(--bf-dim)] sm:text-[11px]">
          STAFF PORTAL
        </div>
      </div>
    </div>
  );
}

export function AppShell() {
  const { state } = useAuth();

  const firstName =
    state.status === "authenticated"
      ? state.user.first_name || ""
      : "";

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
    <div className="min-h-dvh bg-[var(--bf-bg)] pb-[calc(78px+env(safe-area-inset-bottom))]">
      <a
        className="bf-skip-link"
        href="#mainContent"
      >
        К основному содержимому
      </a>

      <header className="sticky top-0 z-40 border-b border-[var(--bf-line)] bg-[color:color-mix(in_srgb,var(--bf-bg),transparent_5%)] pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-3 px-4">
          <HeaderBrand />

          <NavLink
            to="/profile"
            aria-label="Открыть профиль"
            className={({ isActive }) =>
              cn(
                "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border bg-[var(--bf-surface)] py-1.5 pl-1.5 pr-3 text-[var(--bf-cream)] outline-none transition-[background-color,border-color,color] focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]",
                isActive
                  ? "border-[var(--bf-copper-hi)] bg-[color:color-mix(in_srgb,var(--bf-copper),transparent_84%)]"
                  : "border-[var(--bf-line)]"
              )
            }
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full border border-[var(--bf-line)] bg-[var(--bf-surface-2)] p-0.5">
              <img
                src="/assets/icons/profile-avatar.png"
                alt=""
                width="34"
                height="34"
                className="size-full object-contain"
                aria-hidden
              />
            </span>

            <span className="text-xs font-black tracking-[0.01em]">
              Профиль
            </span>
          </NavLink>
        </div>
      </header>

      <main
        id="mainContent"
        tabIndex={-1}
        className="mx-auto max-w-5xl px-4 py-5 outline-none"
      >
        {firstName ? (
          <p className="mb-3 text-sm text-[var(--bf-dim)]">
            Смена для {firstName}
          </p>
        ) : null}
        <Outlet />
      </main>

      <nav
        aria-label="Основная навигация"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--bf-line)] bg-[color:color-mix(in_srgb,var(--bf-bg),transparent_3%)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
      >
        <div className="mx-auto grid min-h-[68px] max-w-xl grid-cols-5 px-2">
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
                    "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold text-[var(--bf-dim)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]",
                    isActive &&
                      "text-[var(--bf-copper-hi)]"
                  )
                }
              >
                <Icon
                  className="size-5"
                  aria-hidden
                />
                <span>{label}</span>
              </NavLink>
            )
          )}
        </div>
      </nav>
    </div>
  );
}

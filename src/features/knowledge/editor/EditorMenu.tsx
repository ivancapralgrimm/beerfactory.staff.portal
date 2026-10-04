import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

// Native auto-popover supplies light-dismiss and keeps fieldset disable semantics.
// Menu actions remain buttons/links with a 44px target and explicit keyboard support.
export function EditorMenu({
  label,
  trigger,
  children,
  disabled = false,
  className = "",
  iconOnly = false,
}: {
  label: string;
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
  disabled?: boolean;
  className?: string;
  iconOnly?: boolean;
}) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const pressedOpen = useRef(false);
  const [open, setOpen] = useState(false);
  const nativePopover =
    typeof HTMLElement !== "undefined" &&
    typeof HTMLElement.prototype.showPopover === "function";
  function close(restoreFocus = true) {
    if (nativePopover) panel.current?.hidePopover();
    else if (panel.current) {
      panel.current.hidden = true;
      setOpen(false);
    }
    if (restoreFocus) button.current?.focus();
  }
  function show() {
    if (nativePopover) panel.current?.showPopover();
    else if (panel.current) {
      window.document.dispatchEvent(
        new CustomEvent("bf-editor-menu-open", { detail: id }),
      );
      panel.current.hidden = false;
      setOpen(true);
    }
    position();
    panel.current
      ?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')
      ?.focus();
  }
  useEffect(() => {
    if (!open || nativePopover) return;
    const outside = (event: PointerEvent) => {
      if (
        !panel.current?.contains(event.target as Node) &&
        !button.current?.contains(event.target as Node)
      )
        close(false);
    };
    const another = (event: Event) => {
      if ((event as CustomEvent).detail !== id) close(false);
    };
    window.document.addEventListener("pointerdown", outside);
    window.document.addEventListener("bf-editor-menu-open", another);
    return () => {
      window.document.removeEventListener("pointerdown", outside);
      window.document.removeEventListener("bf-editor-menu-open", another);
    };
  }, [open, nativePopover, id]);
  function position() {
    if (!panel.current || !button.current) return;
    const rect = button.current.getBoundingClientRect();
    if (window.innerWidth >= 640) {
      const height = panel.current.getBoundingClientRect().height;
      panel.current.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - 276))}px`;
      panel.current.style.top = `${Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - height - 12))}px`;
    } else {
      panel.current.style.removeProperty("left");
      panel.current.style.removeProperty("top");
    }
  }
  return (
    <>
      <Button
        ref={button}
        type="button"
        variant="ghost"
        size={iconOnly ? "icon" : "default"}
        className={className}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        popoverTarget={id}
        disabled={disabled}
        onPointerDownCapture={() => {
          pressedOpen.current = nativePopover
            ? !!panel.current?.matches(":popover-open")
            : open;
        }}
        onClick={(event) => {
          event.preventDefault();
          if (
            pressedOpen.current ||
            (nativePopover ? panel.current?.matches(":popover-open") : open)
          )
            close();
          else show();
          pressedOpen.current = false;
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            show();
          }
        }}
      >
        {trigger}
      </Button>
      <div
        ref={panel}
        id={id}
        popover={nativePopover ? "auto" : undefined}
        hidden={!nativePopover && !open}
        role="menu"
        aria-label={label}
        className="bf-editor-menu-panel"
        onToggle={(event) => {
          const opened = event.newState === "open";
          setOpen(opened);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            close();
            return;
          }
          const items = Array.from(
            panel.current?.querySelectorAll<HTMLElement>(
              '[role="menuitem"]:not(:disabled)',
            ) || [],
          );
          const index = items.indexOf(
            window.document.activeElement as HTMLElement,
          );
          const next =
            event.key === "ArrowDown"
              ? (index + 1) % items.length
              : event.key === "ArrowUp"
                ? (index - 1 + items.length) % items.length
                : event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? items.length - 1
                    : -1;
          if (next >= 0) {
            event.preventDefault();
            items[next]?.focus();
          }
          if (event.key === "Tab") {
            close();
          }
        }}
      >
        {children(close)}
      </div>
    </>
  );
}

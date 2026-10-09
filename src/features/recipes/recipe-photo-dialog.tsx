import { useEffect, useRef } from "react";

type ScrollLockSnapshot = {
  scrollY: number;
  rootOverflow: string;
  rootOverscrollBehavior: string;
  bodyPosition: string;
  bodyTop: string;
  bodyLeft: string;
  bodyRight: string;
  bodyWidth: string;
  bodyOverflow: string;
};

function lockPageScroll(): () => void {
  const root = document.documentElement;
  const body = document.body;
  const snapshot: ScrollLockSnapshot = {
    scrollY: window.scrollY,
    rootOverflow: root.style.overflow,
    rootOverscrollBehavior: root.style.overscrollBehavior,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyLeft: body.style.left,
    bodyRight: body.style.right,
    bodyWidth: body.style.width,
    bodyOverflow: body.style.overflow
  };

  root.style.overflow = "hidden";
  root.style.overscrollBehavior = "none";
  body.style.position = "fixed";
  body.style.top = `-${snapshot.scrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";

  return () => {
    root.style.overflow = snapshot.rootOverflow;
    root.style.overscrollBehavior = snapshot.rootOverscrollBehavior;
    body.style.position = snapshot.bodyPosition;
    body.style.top = snapshot.bodyTop;
    body.style.left = snapshot.bodyLeft;
    body.style.right = snapshot.bodyRight;
    body.style.width = snapshot.bodyWidth;
    body.style.overflow = snapshot.bodyOverflow;

    window.scrollTo({
      top: snapshot.scrollY,
      left: 0,
      behavior: "auto"
    });
  };
}

export function RecipePhotoDialog({
  open,
  src,
  alt,
  onClose
}: {
  open: boolean;
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;

    triggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    if (!dialog.open) {
      dialog.showModal();
    }

    const unlock = lockPageScroll();

    return () => {
      unlock();

      if (dialog.open) {
        dialog.close();
      }

      const trigger = triggerRef.current;
      if (trigger?.isConnected) {
        trigger.focus({ preventScroll: true });
      }
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      tabIndex={-1}
      className="recipe-photo-dialog fixed inset-0 m-0 h-dvh w-screen max-h-none max-w-none overflow-hidden border-0 bg-transparent p-0"
      aria-label={`Фото рецепта ${alt}`}
      aria-describedby="recipe-photo-dialog-help"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={onClose}
    >
      <p id="recipe-photo-dialog-help" className="sr-only">
        Нажмите за пределами фотографии или клавишу Escape, чтобы закрыть просмотр.
      </p>

      <div className="grid h-full w-full place-items-center overflow-hidden p-3">
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="block max-h-[calc(100dvh-24px)] max-w-[calc(100vw-24px)] select-none object-contain"
          onClick={(event) => event.stopPropagation()}
        />
      </div>
    </dialog>
  );
}

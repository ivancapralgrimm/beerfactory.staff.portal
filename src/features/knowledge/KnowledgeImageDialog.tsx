import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export function KnowledgeImageDialog({
  open,
  src,
  alt,
  onClose,
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
    if (!dialog) return;

    if (open && !dialog.open) {
      triggerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
    return () => {
      const trigger = triggerRef.current;
      if (open && trigger?.isConnected) {
        trigger.focus({ preventScroll: true });
      }
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="knowledge-image-dialog m-auto max-h-[94dvh] w-fit max-w-[94vw] overflow-hidden rounded-2xl border border-[var(--bf-line)] bg-[var(--bf-bg)] p-0 text-[var(--bf-cream)]"
      aria-label={alt ? `Изображение: ${alt}` : "Изображение статьи"}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="grid place-items-center bg-black/30 p-2">
        <div className="relative inline-flex max-h-[90dvh] max-w-full">
          <img
            src={src}
            alt={alt}
            className="block max-h-[90dvh] max-w-[90vw] object-contain"
          />
          <Button
            type="button"
            size="icon"
            aria-label="Закрыть изображение"
            className="absolute right-2 top-2 z-10 size-10 min-h-10 rounded-full border border-black/20 bg-[color:color-mix(in_srgb,var(--bf-surface),transparent_8%)] p-0 shadow-lg backdrop-blur-sm"
            onClick={onClose}
          >
            <X className="size-5" aria-hidden />
          </Button>
        </div>
      </div>
    </dialog>
  );
}

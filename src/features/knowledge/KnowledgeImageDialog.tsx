import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export function KnowledgeImageDialog({
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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="knowledge-image-dialog m-auto max-h-[92dvh] w-[min(94vw,1100px)] overflow-hidden rounded-2xl border border-[var(--bf-line)] bg-[var(--bf-bg)] p-0 text-[var(--bf-cream)]"
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
      <div className="relative grid min-h-[50dvh] place-items-center bg-black/30 p-3">
        <img
          src={src}
          alt={alt}
          className="max-h-[86dvh] max-w-full object-contain"
        />
        <Button
          type="button"
          size="icon"
          aria-label="Закрыть изображение"
          className="absolute right-3 top-3"
          onClick={onClose}
        >
          <X className="size-5" aria-hidden />
        </Button>
      </div>
    </dialog>
  );
}

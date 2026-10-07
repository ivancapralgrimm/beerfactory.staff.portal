import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="recipe-photo-dialog m-auto max-h-[94dvh] w-fit max-w-[94vw] overflow-hidden rounded-2xl border border-[var(--bf-line)] bg-[var(--bf-bg)] p-0 text-[var(--bf-cream)]"
      aria-label={`Фото рецепта ${alt}`}
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
            aria-label="Закрыть фото"
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

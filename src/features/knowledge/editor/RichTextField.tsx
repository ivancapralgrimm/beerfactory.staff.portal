import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Bold, Italic, Highlighter, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RichText } from "./article-model";
import { KNOWLEDGE_LIMITS } from "./article-model";
import { editRichText, toggleRichMark } from "./rich-text";

export function RichTextField({
  id,
  label,
  value,
  onChange,
  leading,
  actions,
  deferredFormatting = false,
  textClassName = "",
}: {
  id: string;
  label: string;
  value: RichText;
  onChange: (value: RichText) => void;
  leading?: ReactNode;
  actions?: ReactNode;
  deferredFormatting?: boolean;
  textClassName?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const selection = useRef<[number, number]>([0, 0]);
  const [formatOpen, setFormatOpen] = useState(false);
  function resize() {
    const field = ref.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.max(deferredFormatting ? 52 : 80, Math.min(480, field.scrollHeight))}px`;
  }
  useLayoutEffect(resize, [value.text, deferredFormatting]);
  useEffect(() => {
    if (!ref.current) return;
    let width = 0;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next !== width) {
        width = next;
        resize();
      }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [deferredFormatting]);
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="bf-editor-text-tools">
        {leading}
        {deferredFormatting && (
          <Button
            type="button"
            variant="ghost"
            aria-label={`Формат: ${label}`}
            aria-expanded={formatOpen}
            aria-controls={`${id}-format`}
            onClick={() => setFormatOpen((v) => !v)}
          >
            <Type aria-hidden className="size-4" />
            Формат
          </Button>
        )}
        {(!deferredFormatting || formatOpen) && (
          <div
            id={`${id}-format`}
            role="group"
            aria-label={`Форматирование: ${label}`}
            className="flex"
          >
            {(
              [
                ["bold", "Жирный", Bold],
                ["italic", "Курсив", Italic],
                ["highlight", "Выделение", Highlighter],
              ] as const
            ).map(([type, name, Icon]) => (
              <Button
                key={type}
                type="button"
                variant="ghost"
                size="icon"
                aria-label={name}
                title={name}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  const [from, to] = selection.current;
                  onChange(toggleRichMark(value, type, from, to));
                  ref.current?.focus();
                  ref.current?.setSelectionRange(from, to);
                }}
              >
                <Icon aria-hidden className="size-4" />
              </Button>
            ))}
          </div>
        )}
        <div className="ml-auto flex shrink-0">{actions}</div>
      </div>
      <textarea
        ref={ref}
        id={id}
        value={value.text}
        maxLength={KNOWLEDGE_LIMITS.textPerBlock}
        rows={deferredFormatting ? 2 : 3}
        className={`bf-editor-input bf-editor-writing ${textClassName}`}
        placeholder={deferredFormatting ? "Текст пункта…" : "Начните писать…"}
        onSelect={(event) => {
          selection.current = [
            event.currentTarget.selectionStart,
            event.currentTarget.selectionEnd,
          ];
        }}
        onChange={(event) => onChange(editRichText(value, event.target.value))}
      />
    </div>
  );
}

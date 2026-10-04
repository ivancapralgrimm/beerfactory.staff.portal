import {
  ArrowDown,
  ArrowUp,
  Trash2,
  MoreHorizontal,
  Type,
  ImagePlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { KnowledgeBlock } from "./article-model";
import { createRichText } from "./article-model";
import { RichTextField } from "./RichTextField";
import { EditorMenu } from "./EditorMenu";

export function EditorBlock({
  block,
  index,
  count,
  onChange,
  onMove,
  onRemove,
  onReplace,
  preview,
  disabled = false,
}: {
  block: KnowledgeBlock;
  index: number;
  count: number;
  onChange: (block: KnowledgeBlock) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  onReplace: () => void;
  preview?: string;
  disabled?: boolean;
}) {
  const id = `block-${block.id}`;
  const text =
    block.type === "paragraph" ||
    block.type === "heading" ||
    block.type === "quote";
  const overflow = (
    <EditorMenu
      label={`Действия с содержимым ${index + 1}`}
      iconOnly
      trigger={<MoreHorizontal aria-hidden className="size-5" />}
      disabled={disabled}
    >
      {(close) => (
        <>
          <Button
            role="menuitem"
            variant="ghost"
            disabled={index === 0}
            onClick={() => {
              close();
              onMove(-1);
            }}
          >
            <ArrowUp aria-hidden className="size-4" />
            Переместить выше
          </Button>
          <Button
            role="menuitem"
            variant="ghost"
            disabled={index === count - 1}
            onClick={() => {
              close();
              onMove(1);
            }}
          >
            <ArrowDown aria-hidden className="size-4" />
            Переместить ниже
          </Button>
          <Button
            role="menuitem"
            variant="ghost"
            className="text-[var(--bf-red)]"
            disabled={count === 1}
            onClick={() => {
              close();
              onRemove();
            }}
          >
            <Trash2 aria-hidden className="size-4" />
            Удалить
          </Button>
        </>
      )}
    </EditorMenu>
  );
  return (
    <section
      className={`bf-editor-element ${block.type === "quote" ? "bf-editor-note" : ""}`}
      aria-label={`Содержимое ${index + 1}`}
      data-block-id={block.id}
    >
      {text && (
        <RichTextField
          id={`${id}-text`}
          label={`Текст ${index + 1}`}
          value={block.content}
          onChange={(content) => onChange({ ...block, content })}
          textClassName={
            block.type === "heading"
              ? block.level === 3
                ? "bf-editor-subheading"
                : "bf-editor-heading"
              : ""
          }
          actions={overflow}
          leading={
            <EditorMenu
              label={`Тип текста ${index + 1}`}
              iconOnly
              trigger={<Type aria-hidden className="size-5" />}
              disabled={disabled}
            >
              {(close) =>
                (
                  [
                    ["paragraph", "Обычный текст", null],
                    ["heading", "Подзаголовок", 2],
                    ["heading", "Вложенный подзаголовок", 3],
                    ["quote", "Заметка", null],
                  ] as const
                ).map(([type, label, level]) => (
                  <Button
                    key={label}
                    role="menuitem"
                    variant="ghost"
                    onClick={() => {
                      close();
                      onChange({
                        ...block,
                        type,
                        ...(type === "heading"
                          ? { level: level as 2 | 3 }
                          : {}),
                      });
                    }}
                  >
                    {label}
                  </Button>
                ))
              }
            </EditorMenu>
          }
        />
      )}
      {!text && (
        <div
          className={
            block.type === "image"
              ? "bf-editor-photo-tools"
              : "flex min-h-11 items-center justify-between"
          }
        >
          {block.type === "list" ? (
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <span className="sr-only">Вид списка</span>
              <select
                aria-label="Вид списка"
                className="bf-editor-list-kind"
                value={block.ordered ? "ordered" : "unordered"}
                onChange={(event) =>
                  onChange({
                    ...block,
                    ordered: event.target.value === "ordered",
                  })
                }
              >
                <option value="unordered">Маркированный</option>
                <option value="ordered">Нумерованный</option>
              </select>
            </label>
          ) : (
            <span className="sr-only">
              {block.type === "image" ? "Фото" : "Разделитель"}
            </span>
          )}
          {overflow}
        </div>
      )}
      {block.type === "list" && (
        <>
          <div className="space-y-2">
            {block.items.map((item, itemIndex) => (
              <div key={itemIndex} className="bf-editor-list-item">
                <span className="pt-3 text-[var(--bf-muted)]" aria-hidden>
                  {block.ordered ? `${itemIndex + 1}.` : "•"}
                </span>
                <RichTextField
                  id={`${id}-item-${itemIndex}`}
                  label={`Пункт ${itemIndex + 1}`}
                  value={item}
                  deferredFormatting
                  onChange={(value) =>
                    onChange({
                      ...block,
                      items: block.items.map((old, i) =>
                        i === itemIndex ? value : old,
                      ),
                    })
                  }
                  actions={
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Удалить пункт ${itemIndex + 1}`}
                      disabled={block.items.length === 1}
                      onClick={() =>
                        onChange({
                          ...block,
                          items: block.items.filter((_, i) => i !== itemIndex),
                        })
                      }
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </Button>
                  }
                />
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="mt-2"
            disabled={block.items.length >= 100}
            onClick={() =>
              onChange({ ...block, items: [...block.items, createRichText()] })
            }
          >
            Добавить пункт
          </Button>
        </>
      )}
      {block.type === "separator" && (
        <hr className="my-4 border-[var(--bf-line)]" />
      )}
      {block.type === "image" && (
        <>
          {preview ? (
            <img
              src={preview}
              alt={block.alt}
              width={block.width ?? undefined}
              height={block.height ?? undefined}
              className="bf-editor-photo"
            />
          ) : (
            <div className="bf-editor-photo-placeholder">
              <ImagePlus aria-hidden className="size-6" />
              <span>Предпросмотр фото недоступен</span>
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            className="my-1"
            onClick={onReplace}
          >
            <ImagePlus aria-hidden className="size-4" />
            Заменить фото
          </Button>
          <label
            htmlFor={`${id}-caption`}
            className="mb-1 block text-sm text-[var(--bf-muted)]"
          >
            Подпись
          </label>
          <Input
            id={`${id}-caption`}
            value={block.caption}
            maxLength={1000}
            placeholder="Подпись к фотографии…"
            onChange={(event) =>
              onChange({ ...block, caption: event.target.value })
            }
          />
          <details className="bf-editor-details mt-2">
            <summary>Дополнительно</summary>
            <label htmlFor={`${id}-alt`} className="mt-2 mb-2 block text-sm">
              Описание для экранных дикторов
            </label>
            <Input
              id={`${id}-alt`}
              value={block.alt}
              maxLength={1000}
              aria-describedby={`${id}-alt-help`}
              onChange={(event) =>
                onChange({ ...block, alt: event.target.value })
              }
            />
            <p
              id={`${id}-alt-help`}
              className="mt-2 text-xs text-[var(--bf-muted)]"
            >
              Коротко опишите, что важно на изображении.
            </p>
          </details>
        </>
      )}
    </section>
  );
}

import {
  Plus,
  Type,
  ImagePlus,
  List,
  Heading2,
  Quote,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { KnowledgeBlock } from "./article-model";
import { EditorMenu } from "./EditorMenu";

export function AddContentMenu({
  onAdd,
  onPhoto,
  disabled,
}: {
  onAdd: (type: KnowledgeBlock["type"]) => void;
  onPhoto: () => void;
  disabled: boolean;
}) {
  return (
    <div className="bf-editor-insertion">
      <EditorMenu
        label="Добавить"
        trigger={
          <>
            <Plus className="size-4" aria-hidden />
            Добавить
          </>
        }
        disabled={disabled}
      >
        {(close) => (
          <>
            <div className="bf-editor-menu-primary">
              <Button
                role="menuitem"
                variant="ghost"
                onClick={() => {
                  close();
                  onAdd("paragraph");
                }}
              >
                <Type aria-hidden className="size-5" />
                Текст
              </Button>
              <Button
                role="menuitem"
                variant="ghost"
                onClick={() => {
                  close();
                  onPhoto();
                }}
              >
                <ImagePlus aria-hidden className="size-5" />
                Фото
              </Button>
            </div>
            <p className="bf-editor-menu-caption">Дополнительно</p>
            {(
              [
                ["list", "Список", List],
                ["heading", "Подзаголовок", Heading2],
                ["quote", "Заметка", Quote],
                ["separator", "Разделитель", Minus],
              ] as const
            ).map(([type, label, Icon]) => (
              <Button
                key={type}
                role="menuitem"
                variant="ghost"
                onClick={() => {
                  close();
                  onAdd(type);
                }}
              >
                <Icon aria-hidden className="size-4" />
                {label}
              </Button>
            ))}
          </>
        )}
      </EditorMenu>
    </div>
  );
}

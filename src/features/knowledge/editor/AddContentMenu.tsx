import { Button } from "@/components/ui/button";
import { WarmIcon } from "@/components/warm/WarmIcon";
import type { KnowledgeBlock } from "./article-model";

export function AddContentMenu({onAdd, onPhoto, disabled, mediaAvailable = false}: {
  onAdd: (type: KnowledgeBlock["type"], level?: 2 | 3) => void; onPhoto: () => void; disabled: boolean; mediaAvailable?: boolean;
}) {
  return <div className="bf-bank-actions bf-block-add" aria-label="Добавить блок">
    <Button type="button" disabled={disabled} onClick={() => onAdd("paragraph")}><WarmIcon name="plus" size={17} />Текст</Button>
    <Button type="button" disabled={disabled || !mediaAvailable} onClick={onPhoto}><WarmIcon name="plus" size={17} />Картинка</Button>
    <Button type="button" disabled={disabled} onClick={() => onAdd("heading", 2)}><WarmIcon name="plus" size={17} />Заголовок</Button>
    <Button type="button" disabled={disabled} onClick={() => onAdd("heading", 3)}><WarmIcon name="plus" size={17} />Подзаголовок</Button>
  </div>;
}

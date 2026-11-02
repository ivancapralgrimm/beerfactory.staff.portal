import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WarmIcon } from "@/components/warm/WarmIcon";
import type { KnowledgeBlock } from "./article-model";
import { createRichText } from "./article-model";
import { RichTextField } from "./RichTextField";

export function EditorBlock({block, index, count, onChange, onMove, onRemove, onReplace, preview, disabled = false, mediaAvailable = false, underlineAvailable = true}: {
  block: KnowledgeBlock; index: number; count: number; onChange: (block: KnowledgeBlock) => void;
  onMove: (delta: -1 | 1) => void; onRemove: () => void; onReplace: () => void; preview?: string; disabled?: boolean; mediaAvailable?: boolean; underlineAvailable?: boolean;
}) {
  const id = `block-${block.id}`;
  const text = block.type === "paragraph" || block.type === "heading" || block.type === "quote";
  const label = block.type === "image" ? "Картинка" : block.type === "heading" ? block.level === 3 ? "Подзаголовок" : "Заголовок" : block.type === "list" ? "Список" : block.type === "separator" ? "Разделитель" : block.type === "quote" ? "Заметка" : "Текст";
  const actions = <div className="bf-editor-tools">
    <Button type="button" variant="ghost" size="icon" className="bf-block-control bf-move-up" aria-label={`Блок ${index + 1} выше`} title="Выше" disabled={disabled || index === 0} onClick={() => onMove(-1)}><WarmIcon name="chevron" size={14} /></Button>
    <Button type="button" variant="ghost" size="icon" className="bf-block-control bf-move-down" aria-label={`Блок ${index + 1} ниже`} title="Ниже" disabled={disabled || index === count - 1} onClick={() => onMove(1)}><WarmIcon name="chevron" size={14} /></Button>
    <Button type="button" variant="ghost" size="icon" className="bf-block-control" aria-label={`Убрать блок ${index + 1}`} title="Убрать блок" disabled={disabled || count === 1 || block.type === "image" && !mediaAvailable} onClick={onRemove}><WarmIcon name="close" size={14} /></Button>
  </div>;
  return <section className="bf-article-block" data-block-id={block.id} aria-label={`${label} ${index + 1}`}>
    <div className="bf-article-block-heading"><span className="bf-article-block-label">{label}</span>{!text && actions}</div>
    {text && <RichTextField id={`${id}-text`} label={`${label} ${index + 1}`} value={block.content} disabled={disabled} underlineAvailable={underlineAvailable} onChange={content => onChange({...block, content})} textClassName={block.type === "heading" ? `bf-live-heading ${block.level === 3 ? "bf-editor-subheading" : "bf-editor-heading"}` : ""} actions={actions} />}
    {block.type === "list" && <>
      <label className="bf-field">Вид списка<select disabled={disabled} value={block.ordered ? "ordered" : "unordered"} onChange={e => onChange({...block, ordered: e.target.value === "ordered"})}><option value="unordered">Маркированный</option><option value="ordered">Нумерованный</option></select></label>
      {block.items.map((item, i) => <div className="bf-editor-list-item" key={i}><RichTextField id={`${id}-item-${i}`} label={`Пункт ${i + 1}`} value={item} disabled={disabled} underlineAvailable={underlineAvailable} onChange={value => onChange({...block, items: block.items.map((old, n) => n === i ? value : old)})} actions={<Button type="button" variant="ghost" size="icon" aria-label={`Удалить пункт ${i + 1}`} disabled={disabled || block.items.length === 1} onClick={() => onChange({...block, items: block.items.filter((_, n) => n !== i)})}><WarmIcon name="close" size={14} /></Button>} /></div>)}
      <Button type="button" disabled={disabled || block.items.length >= 100} onClick={() => onChange({...block, items: [...block.items, createRichText()]})}>Добавить пункт</Button>
    </>}
    {block.type === "separator" && <hr />}
    {block.type === "image" && <>
      {preview ? <img src={preview} alt={block.alt} width={block.width ?? undefined} height={block.height ?? undefined} className="bf-block-preview" /> : <p role="status">Предпросмотр фото недоступен</p>}
      <Button type="button" onClick={onReplace} disabled={disabled || !mediaAvailable}><WarmIcon name="edit" size={17} />Заменить фото</Button>
      <label className="bf-field" htmlFor={`${id}-caption`}>Подпись<Input id={`${id}-caption`} value={block.caption} maxLength={1000} onChange={e => onChange({...block, caption: e.target.value})} /></label>
      <details className="bf-editor-details"><summary>Описание изображения</summary><label className="bf-field" htmlFor={`${id}-alt`}>Описание для экранных дикторов<Input id={`${id}-alt`} value={block.alt} maxLength={1000} onChange={e => onChange({...block, alt: e.target.value})} /></label></details>
    </>}
  </section>;
}

import { WarmDialog } from "@/components/warm/WarmDialog";

export function KnowledgeImageDialog({open, src, alt, onClose}: {open: boolean; src: string; alt: string; onClose: () => void}) {
  if (!open) return null;
  return <WarmDialog title="Изображение статьи" onClose={onClose}><img className="bf-knowledge-expanded-image" src={src} alt={alt} /></WarmDialog>;
}

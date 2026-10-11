import { BookOpen, Lightbulb, PenLine } from "lucide-react";
import { Link } from "react-router-dom";
import { getPulseForWorkday, getPulseWorkdayKey } from "@/features/feed/feed-pulse";
import "@/features/feed/feed-pulse.css";

type FeedPulseCardProps = {
  compact?: boolean;
  onCompose?: () => void;
};

/**
 * A quiet, non-notifying empty-state suggestion, not a real FeedPost.
 * Never gets reactions, priority, read receipts, or a made-up author.
 */
export function FeedPulseCard({ compact = false, onCompose }: FeedPulseCardProps) {
  const prompt = getPulseForWorkday(getPulseWorkdayKey());
  const knowledgeAction = prompt.action === "knowledge";
  const actionLabel = knowledgeAction ? "Заглянуть в знания" : "Оставить заметку";
  const ActionIcon = knowledgeAction ? BookOpen : PenLine;
  const actionChildren = <><ActionIcon aria-hidden="true" size={16} strokeWidth={2} />{actionLabel}</>;

  return (
    <aside className={`bf-feed-pulse${compact ? " bf-feed-pulse--compact" : ""}`} aria-label="Пульс команды BFStaff">
      <div className="bf-feed-pulse__accent" aria-hidden="true" />
      <div className="bf-feed-pulse__inner">
        <div className="bf-feed-pulse__topline">
          <span className="bf-feed-pulse__mark" aria-hidden="true"><Lightbulb size={17} strokeWidth={2} /></span>
          <span className="bf-feed-pulse__eyebrow">BFSTAFF · ПУЛЬС КОМАНДЫ</span>
        </div>
        <span className="bf-feed-pulse__kind">{prompt.kind}</span>
        <h2 className="bf-feed-pulse__title">{prompt.title}</h2>
        <p className="bf-feed-pulse__body">{prompt.body}</p>
        <div className="bf-feed-pulse__bottom">
          {knowledgeAction ? (
            <Link className="bf-feed-pulse__action" to="/knowledge">{actionChildren}</Link>
          ) : onCompose ? (
            <button className="bf-feed-pulse__action" type="button" onClick={onCompose}>{actionChildren}</button>
          ) : (
            <Link className="bf-feed-pulse__action" to="/feed?compose=1">{actionChildren}</Link>
          )}
          <span className="bf-feed-pulse__footnote">Идея от BFStaff, не запись сотрудника</span>
        </div>
      </div>
    </aside>
  );
}

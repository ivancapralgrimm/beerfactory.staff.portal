import { Link } from "react-router-dom";
import { MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { FeedPostCard } from "@/features/feed/FeedPostCard";
import { useFeed } from "@/features/feed/use-feed";

export function DashboardFeedSection() {
  const { posts, loading, error } = useFeed();
  const active = posts
    .filter((post) => post.status !== "resolved")
    .slice(0, 6);

  if (!loading && !error && active.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">КОМАНДА · ЛЕНТА</p>
          <h2 className="mt-1 text-2xl font-black">Лента</h2>
        </div>
        <Button asChild variant="secondary">
          <Link to="/feed">
            <MessageSquareText className="size-4" aria-hidden />
            Открыть
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="mt-3 grid gap-2">
          {[0, 1].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-[20px] bg-[var(--bf-surface)]"
            />
          ))}
        </div>
      ) : error ? (
        <Surface className="mt-3 p-4">
          <p className="text-sm leading-6 text-[var(--bf-muted)]">
            Лента сейчас не загрузилась. Остальной Dashboard продолжает работать.
          </p>
        </Surface>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-2 text-xs text-[var(--bf-dim)]">
            <span className="rounded-full border border-[var(--bf-line)] bg-[var(--bf-surface)] px-2.5 py-1.5 font-black text-[var(--bf-cream)]">
              {active.length} из 6
            </span>
            <span>Прокрутка по вертикали</span>
          </div>
          <div className="bf-scrollbar-none mt-3 grid max-h-[250px] snap-y snap-mandatory gap-2 overflow-y-auto pr-0.5">
            {active.map((post) => (
              <div key={post.id} className="snap-start">
                <FeedPostCard post={post} compact />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

import {
  Archive,
  ArrowLeft,
  ExternalLink,
  Share2
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState
} from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams
} from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  categoryLabel,
  isArchive,
  resolveRecipe
} from "@/features/recipes/recipe-data";
import {
  isCalculable,
  RecipeCalculator
} from "@/features/recipes/recipe-calculator";
import { RecipePhotoDialog } from "@/features/recipes/recipe-photo-dialog";
import { useRecipes } from "@/features/recipes/use-recipes";

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function MetaLine({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-3 border-b border-[var(--bf-line)] py-2.5 text-sm last:border-b-0">
      <span className="text-[var(--bf-dim)]">{label}</span>
      <strong className="text-right font-bold text-[var(--bf-cream)]">
        {value}
      </strong>
    </div>
  );
}

export function RecipeDetailPage() {
  const { recipeId = "" } = useParams();
  const requestedId = safeDecode(recipeId);
  const { state, reload } = useRecipes();
  const location = useLocation();
  const navigate = useNavigate();
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [shareStatus, setShareStatus] = useState("");

  const data = state.status === "ready" ? state.data : null;
  const recipe = useMemo(
    () => (data ? resolveRecipe(data.recipes, requestedId) : undefined),
    [data, requestedId]
  );

  useEffect(() => {
    if (!recipe || recipe.id === requestedId) return;

    navigate(`/menu/${encodeURIComponent(recipe.id)}`, {
      replace: true,
      state: location.state
    });
  }, [location.state, navigate, recipe, requestedId]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [requestedId]);

  const backTarget =
    location.state &&
    typeof location.state === "object" &&
    "from" in location.state &&
    typeof location.state.from === "string"
      ? location.state.from
      : "/menu";

  async function shareRecipe() {
    if (!recipe) return;

    const url = window.location.href;
    const title = `${recipe.name} · BeerFactory`;
    const text = `${recipe.name} · техкарта BeerFactory`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setShareStatus("Ссылка скопирована");
    } catch {
      setShareStatus("Не удалось скопировать ссылку");
    }

    window.setTimeout(() => setShareStatus(""), 2200);
  }

  if (state.status === "loading") {
    return (
      <section className="py-3">
        <div className="h-11 w-28 animate-pulse rounded-xl bg-[var(--bf-surface)]" />
        <div className="mt-6 h-14 w-3/4 animate-pulse rounded-xl bg-[var(--bf-surface)]" />
        <div className="mt-4 h-48 animate-pulse rounded-2xl bg-[var(--bf-surface)]" />
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="py-3">
        <Button asChild>
          <Link to="/menu">
            <ArrowLeft className="size-4" aria-hidden />
            Рецепты
          </Link>
        </Button>
        <div className="mt-6 border-y border-[var(--bf-line)] py-6">
          <h1 className="text-2xl font-black">
            Не удалось загрузить рецепт
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--bf-muted)]">
            Сервер недоступен, а локальной копии на этом устройстве нет.
          </p>
          <Button className="mt-4" onClick={reload}>
            Повторить
          </Button>
        </div>
      </section>
    );
  }

  if (!recipe) {
    return (
      <section className="py-3">
        <Button asChild>
          <Link to="/menu">
            <ArrowLeft className="size-4" aria-hidden />
            Рецепты
          </Link>
        </Button>
        <div className="mt-6 border-y border-[var(--bf-line)] py-6">
          <h1 className="text-2xl font-black">Рецепт не найден</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--bf-muted)]">
            Возможно, позиция была переименована или удалена.
          </p>
        </div>
      </section>
    );
  }

  const archived = isArchive(recipe);
  const methodLines = recipe.method.split(/\r?\n/);
  const inlineComposition =
    recipe.ingredients.length === 0
      ? methodLines[0]?.match(/^\s*Состав\s*:\s*(.+)\s*$/iu)
      : null;
  const displayIngredients = inlineComposition
    ? inlineComposition[1]
        .split(/[,;]+/u)
        .map((part) => part.trim())
        .filter(Boolean)
    : recipe.ingredients;
  const displayMethod = inlineComposition
    ? methodLines.slice(1).join("\n").trim()
    : recipe.method;
  const metadata = [
    ["Категория", categoryLabel(recipe.category) || "Меню"],
    recipe.subcategory
      ? ["Подкатегория", recipe.subcategory]
      : null,
    recipe.version ? ["Версия", recipe.version] : null,
    recipe.updatedAt ? ["Обновлено", recipe.updatedAt] : null,
    recipe.updatedBy ? ["Изменил", recipe.updatedBy] : null
  ].filter(Boolean) as string[][];

  return (
    <article className="pb-6">
      <div className="flex min-h-11 items-center justify-between gap-2">
        <Button asChild variant="ghost" className="-ml-3">
          <Link to={backTarget}>
            <ArrowLeft className="size-4" aria-hidden />
            Рецепты
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-[var(--bf-line)] px-3 py-2 text-xs font-bold text-[var(--bf-muted)] sm:inline-flex">
            {categoryLabel(recipe.category)}
          </span>
          <Button
            type="button"
            size="icon"
            aria-label="Поделиться рецептом"
            onClick={shareRecipe}
          >
            <Share2 className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div role="status" aria-live="polite" className="text-right text-xs text-[var(--bf-muted)] empty:hidden">
        {shareStatus}
      </div>

      {archived ? (
        <div
          role="note"
          className="mt-2 flex items-start gap-3 border-y border-[color:color-mix(in_srgb,var(--bf-red),transparent_70%)] py-3"
        >
          <Archive
            className="mt-0.5 size-4 shrink-0 text-[#e99990]"
            aria-hidden
          />
          <div>
            <strong className="text-xs font-black uppercase tracking-[0.12em] text-[#e99990]">
              Архив
            </strong>
            <p className="mt-1 text-sm leading-5 text-[var(--bf-muted)]">
              Позиции уже нет в текущем меню. Техкарта сохранена для истории
              и справки.
            </p>
          </div>
        </div>
      ) : null}

      <header className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1.08fr)_minmax(280px,.92fr)] md:items-start">
        <div className="border-b border-[var(--bf-line)] pb-5">
          <p className="eyebrow">
            {categoryLabel(recipe.category).toUpperCase() || "МЕНЮ"}
            {recipe.subcategory ? ` / ${recipe.subcategory.toUpperCase()}` : ""}
          </p>
          <h1 className="mt-3 text-balance text-[clamp(27px,7.2vw,38px)] font-black leading-[1.12] tracking-[-0.035em]">
            {recipe.name}
          </h1>

          {recipe.tags.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {recipe.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[var(--bf-line)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--bf-muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {recipe.photo && !photoFailed ? (
          <button
            type="button"
            className="group relative grid aspect-[16/9] place-items-center overflow-hidden rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)] md:aspect-[4/3]"
            aria-label={`Открыть фото ${recipe.name}`}
            onClick={() => setPhotoOpen(true)}
          >
            <img
              src={recipe.photo}
              alt={recipe.name}
              className="h-full max-h-[430px] w-full object-contain transition-transform duration-200 group-hover:scale-[1.01]"
              loading="eager"
              fetchPriority="high"
              onError={() => setPhotoFailed(true)}
            />
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/55 px-2.5 py-1.5 text-xs font-bold text-white backdrop-blur">
              <ExternalLink className="size-3.5" aria-hidden />
              Фото
            </span>
          </button>
        ) : null}
      </header>

      <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1.35fr)_minmax(240px,.65fr)] md:items-start">
        <div className="space-y-6">
          {displayIngredients.length > 0 ? (
            <section aria-labelledby="ingredients-title">
              <h2 id="ingredients-title" className="eyebrow">СОСТАВ</h2>
              <div className="mt-3 divide-y divide-[var(--bf-line)] overflow-hidden rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface)] px-4">
                {displayIngredients.map((ingredient, index) => (
                  <div
                    key={`${ingredient}-${index}`}
                    className="py-3 text-[14px] leading-[1.5] text-[var(--bf-cream)]"
                  >
                    {ingredient}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {isCalculable(recipe) ? (
            <RecipeCalculator recipe={recipe} />
          ) : null}

          {displayMethod ? (
            <section
              aria-labelledby="method-title"
              className="border-t border-[var(--bf-line)] pt-4"
            >
              <h2 id="method-title" className="eyebrow">ПРИГОТОВЛЕНИЕ</h2>
              <p className="mt-3 whitespace-pre-wrap text-[14px] leading-[1.65] text-[var(--bf-muted)]">
                {displayMethod}
              </p>
            </section>
          ) : null}

          {recipe.serving ? (
            <section
              aria-labelledby="serving-title"
              className="border-t border-[var(--bf-line)] pt-4"
            >
              <h2 id="serving-title" className="eyebrow">ПОДАЧА / ВЫХОД</h2>
              <p className="mt-3 whitespace-pre-wrap text-[14px] leading-[1.65] text-[var(--bf-muted)]">
                {recipe.serving}
              </p>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 md:sticky md:top-6">
          <details className="border-t border-[var(--bf-line)] pt-3">
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-bold text-[var(--bf-cream)] focus-visible:outline-2 focus-visible:outline-[var(--bf-copper-hi)]">Данные рецепта</summary>
            <div className="pb-3">
              {metadata.map(([label, value]) => (
                <MetaLine key={label} label={label} value={value} />
              ))}
            </div>
          </details>

          {recipe.changeNote ? (
            <section className="border-t border-[var(--bf-line)] pt-4">
              <p className="eyebrow">ЧТО ИЗМЕНИЛОСЬ</p>
              <p className="mt-2 text-sm leading-6 text-[var(--bf-muted)]">
                {recipe.changeNote}
              </p>
            </section>
          ) : null}

          {data?.source === "cache-offline" ||
          data?.source === "legacy-cache" ? (
            <p className="text-xs leading-5 text-[var(--bf-dim)]">
              Показана последняя сохранённая версия рецепта.
            </p>
          ) : null}
        </aside>
      </div>

      {recipe.photo && !photoFailed ? (
        <RecipePhotoDialog
          open={photoOpen}
          src={recipe.photo}
          alt={recipe.name}
          onClose={() => setPhotoOpen(false)}
        />
      ) : null}
    </article>
  );
}

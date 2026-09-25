import {
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UtensilsCrossed,
  X
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode
} from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import {
  AdminRecipeApiError,
  createAdminRecipe,
  loadAdminRecipes,
  updateAdminRecipe,
  type AdminRecipeInput,
  type AdminRecipeSource,
  type AdminRecipeStatus
} from "@/features/admin/recipe-admin-api";
import {
  categoryLabel,
  recipeStatusKind
} from "@/features/recipes/recipe-data";
import type { Recipe } from "@/features/recipes/types";
import { cn } from "@/lib/utils";

const MAX_PHOTO_BYTES = 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png"]);

const DEFAULT_BAR_CATEGORIES = [
  "Лимонад",
  "Заготовка",
  "Коктейль",
  "Настойка"
];

const STATUS_OPTIONS: AdminRecipeStatus[] = [
  "Актуальный",
  "Архив",
  "Черновик"
];

type EditorState = AdminRecipeInput;

type EditorMode =
  | { kind: "create" }
  | { kind: "edit"; recipe: Recipe }
  | null;

function emptyEditor(): EditorState {
  return {
    source: "bar",
    name: "",
    category: "Лимонад",
    status: "Актуальный",
    description: "",
    ingredients: "",
    method: "",
    serving: "",
    tags: "",
    changeNote: "",
    removePhoto: false
  };
}

function statusValue(value: string): AdminRecipeStatus {
  const kind = recipeStatusKind(value);
  if (kind === "archive") return "Архив";
  if (kind === "draft") return "Черновик";
  return "Актуальный";
}

function editorFromRecipe(recipe: Recipe): EditorState {
  const source: AdminRecipeSource =
    recipe.source === "kitchen" ? "kitchen" : "bar";

  return {
    source,
    name: recipe.name,
    category:
      source === "bar"
        ? recipe.category.trim() || "Лимонад"
        : "Кухня",
    status: statusValue(recipe.status),
    description:
      source === "kitchen"
        ? recipe.method || recipe.desc || ""
        : "",
    ingredients: recipe.ingredients.join("\n"),
    method: source === "bar" ? recipe.method : "",
    serving: recipe.serving,
    tags: recipe.tags.join(" "),
    changeNote: "",
    removePhoto: false
  };
}

function sourceLabel(source: string) {
  return source === "kitchen" ? "Кухня" : "Бар";
}

function recipeErrorText(error: unknown) {
  if (!(error instanceof AdminRecipeApiError)) {
    return "Не удалось сохранить рецепт.";
  }

  switch (error.code) {
    case "unauthorized":
    case "admin_required":
      return "Недостаточно прав для изменения рецептов.";
    case "recipe_admin_write_unavailable":
      return "Запись рецептов на сервере сейчас недоступна.";
    case "worker_recipe_editor_unavailable":
      return "Редактор уже установлен в портале, но Worker ещё не обновлён.";
    case "invalid_source":
      return "Выбран неизвестный раздел рецептов.";
    case "invalid_name":
      return "Укажите название рецепта.";
    case "invalid_category":
      return "Выберите категорию.";
    case "ingredients_required":
      return "Для бара обязательно заполните состав.";
    case "description_required":
      return "Для кухни обязательно заполните описание.";
    case "invalid_status":
      return "Выбран неизвестный статус.";
    case "photo_too_large":
      return "Фото больше 1 МБ.";
    case "photo_type_not_allowed":
      return "Фото должно быть JPEG или PNG.";
    case "nocodb_photo_upload_failed":
      return "NocoDB не принял фотографию.";
    case "nocodb_write_failed":
      return "NocoDB не сохранил рецепт.";
    default:
      return "Изменение не применено. Проверьте поля и повторите.";
  }
}

function fieldClass(invalid = false) {
  return cn(
    "min-h-11 w-full rounded-xl border bg-[var(--bf-surface-2)] px-3 text-sm text-[var(--bf-cream)] outline-none placeholder:text-[var(--bf-dim)] focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]",
    invalid
      ? "border-[var(--bf-red)]"
      : "border-[var(--bf-line)]"
  );
}

function FieldLabel({
  children,
  required = false
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <span className="mb-1.5 block text-xs font-black text-[var(--bf-cream)]">
      {children}
      {required ? (
        <span className="ml-1 text-[var(--bf-copper-hi)]" aria-hidden>*</span>
      ) : null}
    </span>
  );
}

export function AdminRecipesPanel({
  accessToken
}: {
  accessToken: string;
}) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [editor, setEditor] = useState<EditorState>(() => emptyEditor());
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setLoadError(null);

    try {
      const data = await loadAdminRecipes(accessToken);
      setRecipes(data.recipes);
    } catch (error) {
      setLoadError(recipeErrorText(error));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    return () => {
      if (photoPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const barCategories = useMemo(() => {
    const fromData = recipes
      .filter((recipe) => recipe.source === "bar")
      .map((recipe) => recipe.category.trim())
      .filter(Boolean)
      .map((value) => /^лимонад$/i.test(value) ? "Лимонад" : value);

    return Array.from(
      new Set([...DEFAULT_BAR_CATEGORIES, ...fromData])
    ).sort((a, b) => a.localeCompare(b, "ru"));
  }, [recipes]);

  const filteredRecipes = useMemo(() => {
    const query = search.trim().toLowerCase();

    return recipes
      .filter((recipe) => {
        if (!query) return true;
        return [
          recipe.name,
          recipe.category,
          sourceLabel(recipe.source),
          recipe.status,
          recipe.ingredients.join(" ")
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [recipes, search]);

  const activePhoto =
    photoPreview ||
    (
      editorMode?.kind === "edit" &&
      !editor.removePhoto
        ? editorMode.recipe.photo
        : ""
    ) ||
    null;

  function resetPhoto() {
    setPhoto(null);
    setPhotoError(null);
    setPhotoPreview((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return null;
    });
  }

  function openCreate() {
    resetPhoto();
    setEditor(emptyEditor());
    setEditorMode({ kind: "create" });
    setFormError(null);
    setMessage(null);
    setLastSavedId(null);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function openEdit(recipe: Recipe) {
    resetPhoto();
    setEditor(editorFromRecipe(recipe));
    setEditorMode({ kind: "edit", recipe });
    setFormError(null);
    setMessage(null);
    setLastSavedId(null);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function closeEditor() {
    resetPhoto();
    setEditorMode(null);
    setFormError(null);
  }

  function updateEditor<K extends keyof EditorState>(
    key: K,
    value: EditorState[K]
  ) {
    setEditor((current) => ({ ...current, [key]: value }));
    setFormError(null);
  }

  function changeSource(source: AdminRecipeSource) {
    if (editorMode?.kind === "edit") return;

    setEditor((current) => ({
      ...current,
      source,
      category:
        source === "bar"
          ? barCategories[0] || "Лимонад"
          : "Кухня"
    }));
    setFormError(null);
  }

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    event.target.value = "";

    if (!file) return;

    if (!PHOTO_TYPES.has(file.type)) {
      setPhotoError("Только JPEG или PNG.");
      return;
    }

    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("Фото должно быть не больше 1 МБ.");
      return;
    }

    resetPhoto();
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoError(null);
    updateEditor("removePhoto", false);
  }

  function removeCurrentPhoto() {
    resetPhoto();
    updateEditor("removePhoto", true);
  }

  function validate() {
    if (!editor.name.trim()) return "Укажите название.";
    if (!editor.category.trim()) return "Выберите категорию.";
    if (editor.source === "bar" && !editor.ingredients.trim()) {
      return "Для бара обязательно заполните состав.";
    }
    if (editor.source === "kitchen" && !editor.description.trim()) {
      return "Для кухни обязательно заполните описание.";
    }
    return null;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editorMode || saving) return;

    const validation = validate();
    if (validation) {
      setFormError(validation);
      return;
    }

    setSaving(true);
    setFormError(null);
    setMessage(null);
    setLastSavedId(null);

    try {
      const result = editorMode.kind === "create"
        ? await createAdminRecipe(accessToken, editor, photo)
        : await updateAdminRecipe(
            accessToken,
            editorMode.recipe.recordId,
            editor,
            photo
          );

      await load(true);
      setMessage(
        editorMode.kind === "create"
          ? "Рецепт создан."
          : "Рецепт обновлён."
      );
      setLastSavedId(result.id);
      resetPhoto();
      setEditorMode(null);
    } catch (error) {
      setFormError(recipeErrorText(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4">
      <Surface className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">РЕЦЕПТЫ · NOCODB</p>
            <h2 className="mt-1 text-xl font-black">Редактор техкарт</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--bf-muted)]">
              Создание и редактирование BAR / KITCHEN. Запись подтверждает сервер.
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={openCreate}
          >
            <Plus className="size-4" aria-hidden />
            Создать
          </Button>
        </div>
      </Surface>

      {message ? (
        <Surface className="border-[#45694b] bg-[#23302580] p-3 text-sm font-bold text-[#9dd0a0]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{message}</span>
            {lastSavedId ? (
              <Link
                to={`/menu/${encodeURIComponent(lastSavedId)}`}
                className="underline underline-offset-4"
              >
                Открыть карточку
              </Link>
            ) : null}
          </div>
        </Surface>
      ) : null}

      {editorMode ? (
        <div ref={formRef}>
          <Surface className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">
                  {editorMode.kind === "create" ? "НОВЫЙ РЕЦЕПТ" : "РЕДАКТИРОВАНИЕ"}
                </p>
                <h3 className="mt-1 text-lg font-black">
                  {editorMode.kind === "create"
                    ? "Создать техкарту"
                    : editorMode.recipe.name}
                </h3>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Закрыть редактор"
                disabled={saving}
                onClick={closeEditor}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>

            <form className="mt-4 grid gap-4" onSubmit={submit}>
              <fieldset disabled={saving} className="grid gap-4 disabled:opacity-70">
                <div>
                  <FieldLabel required>Раздел</FieldLabel>
                  <div
                    className="grid grid-cols-2 gap-2"
                    role="group"
                    aria-label="Раздел рецепта"
                  >
                    {(["bar", "kitchen"] as AdminRecipeSource[]).map((source) => (
                      <button
                        key={source}
                        type="button"
                        disabled={editorMode.kind === "edit"}
                        aria-pressed={editor.source === source}
                        onClick={() => changeSource(source)}
                        className={cn(
                          "min-h-11 rounded-xl border px-3 text-sm font-black",
                          editor.source === source
                            ? "border-[var(--bf-copper-hi)] bg-[var(--bf-surface-2)] text-[var(--bf-cream)]"
                            : "border-[var(--bf-line)] bg-[var(--bf-surface)] text-[var(--bf-muted)]",
                          editorMode.kind === "edit" && "cursor-not-allowed opacity-70"
                        )}
                      >
                        {sourceLabel(source)}
                      </button>
                    ))}
                  </div>
                </div>

                <label>
                  <FieldLabel required>Название</FieldLabel>
                  <input
                    value={editor.name}
                    maxLength={180}
                    onChange={(event) => updateEditor("name", event.target.value)}
                    className={fieldClass()}
                    placeholder="Название позиции"
                    required
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label>
                    <FieldLabel required>Категория</FieldLabel>
                    <select
                      value={editor.category}
                      onChange={(event) => updateEditor("category", event.target.value)}
                      className={fieldClass()}
                      required
                    >
                      {editor.source === "bar" ? (
                        barCategories.map((category) => (
                          <option key={category} value={category}>
                            {categoryLabel(category)}
                          </option>
                        ))
                      ) : (
                        <option value="Кухня">Кухня</option>
                      )}
                    </select>
                  </label>

                  <label>
                    <FieldLabel>Статус</FieldLabel>
                    <select
                      value={editor.status}
                      onChange={(event) => updateEditor(
                        "status",
                        event.target.value as AdminRecipeStatus
                      )}
                      className={fieldClass()}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div>
                  <FieldLabel>Фото</FieldLabel>
                  <div className="overflow-hidden rounded-2xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)]">
                    {activePhoto ? (
                      <div className="relative aspect-[16/9] overflow-hidden border-b border-[var(--bf-line)]">
                        <img
                          src={activePhoto}
                          alt="Предпросмотр фото рецепта"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="grid min-h-28 place-items-center text-[var(--bf-dim)]">
                        <ImagePlus className="size-7" aria-hidden />
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                      <div>
                        <p className="text-xs font-black text-[var(--bf-cream)]">
                          JPEG или PNG · до 1 МБ
                        </p>
                        {photo ? (
                          <p className="mt-1 max-w-[210px] truncate text-[10px] text-[var(--bf-dim)]">
                            {photo.name}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex gap-2">
                        {activePhoto ? (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={removeCurrentPhoto}
                          >
                            <Trash2 className="size-4" aria-hidden />
                            Убрать
                          </Button>
                        ) : null}

                        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-[var(--bf-line-strong)] bg-[var(--bf-surface)] px-3 text-xs font-black text-[var(--bf-cream)]">
                          <ImagePlus className="size-4" aria-hidden />
                          {activePhoto ? "Заменить" : "Добавить"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                            className="sr-only"
                            onChange={choosePhoto}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                  {photoError ? (
                    <p className="mt-1.5 text-xs font-bold text-[#e99990]" role="alert">
                      {photoError}
                    </p>
                  ) : null}
                </div>

                {editor.source === "bar" ? (
                  <>
                    <label>
                      <FieldLabel required>Состав</FieldLabel>
                      <textarea
                        value={editor.ingredients}
                        rows={7}
                        onChange={(event) => updateEditor("ingredients", event.target.value)}
                        className={cn(fieldClass(), "resize-y py-3 leading-5")}
                        placeholder={'Каждый ингредиент с новой строки\nНапример: Джин 40 мл'}
                        required
                      />
                    </label>

                    <label>
                      <FieldLabel>Приготовление / метод</FieldLabel>
                      <textarea
                        value={editor.method}
                        rows={5}
                        onChange={(event) => updateEditor("method", event.target.value)}
                        className={cn(fieldClass(), "resize-y py-3 leading-5")}
                        placeholder="Как приготовить"
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      <FieldLabel required>Описание</FieldLabel>
                      <textarea
                        value={editor.description}
                        rows={6}
                        onChange={(event) => updateEditor("description", event.target.value)}
                        className={cn(fieldClass(), "resize-y py-3 leading-5")}
                        placeholder="Описание блюда / технология"
                        required
                      />
                    </label>

                    <label>
                      <FieldLabel>Состав</FieldLabel>
                      <textarea
                        value={editor.ingredients}
                        rows={5}
                        onChange={(event) => updateEditor("ingredients", event.target.value)}
                        className={cn(fieldClass(), "resize-y py-3 leading-5")}
                        placeholder="Состав блюда"
                      />
                    </label>
                  </>
                )}

                <label>
                  <FieldLabel>
                    {editor.source === "kitchen" ? "Граммовка / выход" : "Подача / выход"}
                  </FieldLabel>
                  <input
                    value={editor.serving}
                    onChange={(event) => updateEditor("serving", event.target.value)}
                    className={fieldClass()}
                    placeholder={editor.source === "kitchen" ? "Например: 250 г" : "Например: 350 мл"}
                  />
                </label>

                <label>
                  <FieldLabel>Теги</FieldLabel>
                  <input
                    value={editor.tags}
                    onChange={(event) => updateEditor("tags", event.target.value)}
                    className={fieldClass()}
                    placeholder="Через пробел или запятую"
                  />
                </label>

                {editorMode.kind === "edit" ? (
                  <label>
                    <FieldLabel>Что изменилось</FieldLabel>
                    <input
                      value={editor.changeNote}
                      onChange={(event) => updateEditor("changeNote", event.target.value)}
                      className={fieldClass()}
                      placeholder="Коротко, необязательно"
                    />
                  </label>
                ) : null}
              </fieldset>

              {formError ? (
                <div
                  className="rounded-xl border border-[#75443d] bg-[#36231f80] px-3 py-2 text-xs font-bold leading-5 text-[#e99990]"
                  role="alert"
                >
                  {formError}
                </div>
              ) : null}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={saving || Boolean(photoError)}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : editorMode.kind === "create" ? (
                  <Plus className="size-4" aria-hidden />
                ) : (
                  <Pencil className="size-4" aria-hidden />
                )}
                {saving
                  ? "Сохраняем…"
                  : editorMode.kind === "create"
                    ? "Создать рецепт"
                    : "Сохранить изменения"}
              </Button>
            </form>
          </Surface>
        </div>
      ) : null}

      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--bf-dim)]"
            aria-hidden
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Название, категория, состав"
            className="min-h-11 w-full rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface)] pl-10 pr-3 text-sm text-[var(--bf-cream)] outline-none placeholder:text-[var(--bf-dim)] focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
          />
        </label>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Обновить рецепты"
          disabled={loading}
          onClick={() => void load(false)}
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-2">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-24 animate-pulse rounded-2xl bg-[var(--bf-surface)]"
            />
          ))}
        </div>
      ) : loadError ? (
        <Surface className="p-4 text-sm text-[#e99990]">
          {loadError}
        </Surface>
      ) : filteredRecipes.length ? (
        <div className="grid gap-2">
          {filteredRecipes.map((recipe) => (
            <Surface key={recipe.id} className="p-3.5">
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)]">
                  <UtensilsCrossed className="size-4 text-[var(--bf-copper-hi)]" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.08em]">
                    <span className="text-[var(--bf-copper-hi)]">
                      {sourceLabel(recipe.source)}
                    </span>
                    <span className="text-[var(--bf-dim)]">·</span>
                    <span className="text-[var(--bf-dim)]">
                      {categoryLabel(recipe.category || sourceLabel(recipe.source))}
                    </span>
                    {recipeStatusKind(recipe.status) !== "current" ? (
                      <span className="rounded-full border border-[var(--bf-line)] px-1.5 py-0.5 text-[var(--bf-gold)]">
                        {statusValue(recipe.status)}
                      </span>
                    ) : null}
                  </div>
                  <strong className="mt-1 block text-sm leading-5 text-[var(--bf-cream)]">
                    {recipe.name}
                  </strong>
                  <span className="mt-1 block text-[10px] text-[var(--bf-dim)]">
                    {recipe.id}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  aria-label={`Редактировать ${recipe.name}`}
                  onClick={() => openEdit(recipe)}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
              </div>
            </Surface>
          ))}
        </div>
      ) : (
        <Surface className="p-5 text-center text-sm text-[var(--bf-muted)]">
          Рецепты по этому запросу не найдены.
        </Surface>
      )}
    </div>
  );
}

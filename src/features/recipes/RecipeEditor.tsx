import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { WarmIcon } from "@/components/warm/WarmIcon";
import { WarmNotice, WarmTitle } from "@/components/warm/WarmPage";
import { AdminRecipeApiError, createAdminRecipe, updateAdminRecipe, type AdminRecipeInput, type AdminRecipeSource, type AdminRecipeStatus, type RecipeMaterialLifecycleRequest } from "@/features/admin/recipe-admin-api";
import { categoryLabel, recipeStatusKind } from "./recipe-data";
import { RecipeLifecycleConfirm, RECIPE_LIFECYCLE_UNAVAILABLE, recipeMutationError } from "./RecipeMaterialActions";
import type { Recipe } from "./types";
import "./recipes.css";

const MAX_PHOTO_BYTES = 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png"]);
const DEFAULT_BAR_CATEGORIES = ["Лимонад", "Заготовка", "Коктейль", "Настойка"];

type RecipeEditorProps = {
  accessToken: string;
  mode: "create" | "edit";
  recipe?: Recipe;
  recipes: Recipe[];
  lifecycleAvailable?: boolean;
  photoCleanupAvailable?: boolean;
  onCancel: () => void;
  onSaved: (recipeId: string) => void | Promise<void>;
};

export function emptyRecipeEditor(): AdminRecipeInput {
  return { source: "bar", name: "", category: "Лимонад", status: "Актуальный", venue: "BF", description: "", ingredients: "", method: "", serving: "", tags: "", changeNote: "", removePhoto: false };
}

export function editorFromRecipe(recipe: Recipe): AdminRecipeInput {
  const source = recipe.source === "kitchen" ? "kitchen" : "bar";
  return { source, name: recipe.name, category: source === "bar" ? recipe.category.trim() || "Лимонад" : "Кухня",
    status: recipeStatusKind(recipe.status) === "archive" ? "Архив" : "Актуальный", venue: recipe.venue || "BF",
    description: source === "kitchen" ? recipe.method || recipe.desc || "" : "",
    ingredients: recipe.ingredients.join("\n"), method: source === "bar" ? recipe.method : "", serving: recipe.serving,
    tags: recipe.tags.join(" "), changeNote: "", removePhoto: false };
}

function recipeErrorText(error: unknown) {
  if (!(error instanceof AdminRecipeApiError)) return "Не удалось сохранить рецепт. Проверь подключение и повтори.";
  const errors: Record<string, string> = {
    invalid_source: "Выбран неизвестный раздел рецептов.", invalid_name: "Укажите название рецепта.",
    invalid_category: "Выберите категорию.", ingredients_required: "Для бара обязательно заполните состав.",
    description_required: "Для кухни обязательно заполните описание.", invalid_status: "Выбран неизвестный статус.",
    invalid_venue: "Выберите BF, BB или общую позицию.", photo_too_large: "Фото больше 1 МБ.",
    photo_type_not_allowed: "Фото должно быть JPEG или PNG.", nocodb_photo_upload_failed: "Не удалось загрузить фотографию."
  };
  return errors[error.code] || recipeMutationError(error);
}

function FieldLabel({ children, required = false }: { children: ReactNode; required?: boolean }) {
  return <span className="warm-recipe-label">{children}{required ? <span aria-hidden> *</span> : null}</span>;
}

export function RecipeEditor({ accessToken, mode, recipe, recipes, lifecycleAvailable = false, photoCleanupAvailable = false, onCancel, onSaved }: RecipeEditorProps) {
  const [editor, setEditor] = useState<AdminRecipeInput>(() => mode === "edit" && recipe ? editorFromRecipe(recipe) : emptyRecipeEditor());
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const lifecycleRequest = useRef<RecipeMaterialLifecycleRequest | null>(null);

  useEffect(() => {
    setEditor(mode === "edit" && recipe ? editorFromRecipe(recipe) : emptyRecipeEditor());
    setPhoto(null); setPhotoPreview(null); setPhotoError(""); setFormError(""); setArchiveConfirm(false); lifecycleRequest.current = null;
  }, [mode, recipe]);
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  const barCategories = useMemo(() => Array.from(new Set([...DEFAULT_BAR_CATEGORIES,
    ...recipes.filter((item) => item.source === "bar").map((item) => item.category.trim()).filter(Boolean)]))
    .sort((a, b) => a.localeCompare(b, "ru")), [recipes]);
  const activePhoto = photoPreview || (mode === "edit" && recipe && !editor.removePhoto ? recipe.photo : "") || null;
  const archiving = mode === "edit" && recipe && recipeStatusKind(recipe.status) !== "archive" && editor.status === "Архив";

  function updateEditor<K extends keyof AdminRecipeInput>(key: K, value: AdminRecipeInput[K]) {
    setEditor((current) => ({ ...current, [key]: value })); setFormError(""); lifecycleRequest.current = null;
  }
  function changeSource(source: AdminRecipeSource) {
    if (mode === "edit") return;
    setEditor((current) => ({ ...current, source, category: source === "bar" ? "Лимонад" : "Кухня" }));
    setFormError(""); lifecycleRequest.current = null;
  }
  function resetPhoto() { setPhoto(null); setPhotoPreview(null); setPhotoError(""); lifecycleRequest.current = null; }
  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file || !photoCleanupAvailable) return;
    if (!PHOTO_TYPES.has(file.type)) { setPhotoError("Только JPEG или PNG."); return; }
    if (file.size > MAX_PHOTO_BYTES) { setPhotoError("Фото должно быть не больше 1 МБ."); return; }
    resetPhoto(); setPhoto(file); setPhotoPreview(URL.createObjectURL(file)); updateEditor("removePhoto", false);
  }
  function removeCurrentPhoto() { if (!photoCleanupAvailable) return; resetPhoto(); updateEditor("removePhoto", true); }
  function validate() {
    if (!editor.name.trim()) return "Укажите название.";
    if (!editor.category.trim()) return "Выберите категорию.";
    if (editor.source === "bar" && !editor.ingredients.trim()) return "Для бара обязательно заполните состав.";
    if (editor.source === "kitchen" && !editor.description.trim()) return "Для кухни обязательно заполните описание.";
    if (archiving && !lifecycleAvailable) return RECIPE_LIFECYCLE_UNAVAILABLE;
    if ((photo || editor.removePhoto) && !photoCleanupAvailable) return "Для изменения фото требуется обновление сервера хранения файлов.";
    return null;
  }
  async function save() {
    if (saving) return;
    const validation = validate(); if (validation) { setFormError(validation); return; }
    if (archiving && !lifecycleRequest.current) lifecycleRequest.current = { expectedVersion: recipe!.version, operationId: crypto.randomUUID() };
    setSaving(true); setFormError("");
    try {
      const result = mode === "create" ? await createAdminRecipe(accessToken, editor, photo)
        : await updateAdminRecipe(accessToken, recipe?.recordId || "", editor, photo, archiving ? lifecycleRequest.current! : undefined);
      setArchiveConfirm(false);
      await onSaved(result.id);
    } catch (cause) { setFormError(recipeErrorText(cause)); }
    finally { setSaving(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validate(); if (validation) { setFormError(validation); return; }
    if (archiving) setArchiveConfirm(true); else void save();
  }

  return <section className="warm-recipe-editor bf-editor-page">
    <WarmTitle title={mode === "create" ? "Новый рецепт" : "Редактор рецепта"} />
    <form className="bf-compact-form bf-material-editor" onSubmit={submit}>
      <fieldset disabled={saving}>
        <label><FieldLabel required>Название</FieldLabel><input value={editor.name} maxLength={180} onChange={(event) => updateEditor("name", event.target.value)} placeholder="Название позиции" required /></label>
        <div className="warm-recipe-editor-pair">
          <label><FieldLabel required>Раздел</FieldLabel><select value={editor.source} disabled={mode === "edit"} onChange={(event) => changeSource(event.target.value as AdminRecipeSource)}><option value="bar">Бар</option><option value="kitchen">Кухня</option></select></label>
          <label><FieldLabel>Статус актуальности</FieldLabel><select value={editor.status} onChange={(event) => updateEditor("status", event.target.value as AdminRecipeStatus)}><option>Актуальный</option><option disabled={mode === "edit" && recipeStatusKind(recipe?.status || "") !== "archive" && !lifecycleAvailable}>Архив</option></select></label>
        </div>
        <div className="warm-recipe-editor-pair">
          <label><FieldLabel required>Категория</FieldLabel>{editor.source === "bar" ? <><input list="recipe-bar-categories" value={editor.category} onChange={(event) => updateEditor("category", event.target.value)} required /><datalist id="recipe-bar-categories">{barCategories.map((category) => <option key={category} value={category}>{categoryLabel(category)}</option>)}</datalist></> : <input value="Кухня" readOnly />}</label>
          <label><FieldLabel>Выход</FieldLabel><input value={editor.serving} onChange={(event) => updateEditor("serving", event.target.value)} placeholder={editor.source === "kitchen" ? "250 г" : "380 мл"} /></label>
        </div>
        <label><FieldLabel required>Заведение</FieldLabel><select value={editor.venue} onChange={(event) => updateEditor("venue", event.target.value === "BB" ? "BB" : event.target.value === "BF/BB" ? "BF/BB" : "BF")}><option value="BF">BeerFactory · BF</option><option value="BB">BeerBistro · BB</option><option value="BF/BB">Оба заведения · BF/BB</option></select></label>
        <label><FieldLabel required={editor.source === "bar"}>Состав</FieldLabel><textarea value={editor.ingredients} rows={5} onChange={(event) => updateEditor("ingredients", event.target.value)} placeholder={'Джин 40 мл\nТоник 100 мл'} required={editor.source === "bar"} /><span className="warm-recipe-editor-note">Каждый ингредиент с новой строки, количество укажи рядом.</span></label>
        {editor.source === "bar" ? <label><FieldLabel>Приготовление / метод</FieldLabel><textarea value={editor.method} rows={4} onChange={(event) => updateEditor("method", event.target.value)} /></label> : <label><FieldLabel required>Описание / технология</FieldLabel><textarea value={editor.description} rows={4} onChange={(event) => updateEditor("description", event.target.value)} required /></label>}
        <label><FieldLabel>Теги через запятую или пробел</FieldLabel><input value={editor.tags} onChange={(event) => updateEditor("tags", event.target.value)} /></label>
        {mode === "edit" ? <label><FieldLabel>Что изменилось</FieldLabel><input value={editor.changeNote} onChange={(event) => updateEditor("changeNote", event.target.value)} placeholder="Коротко, необязательно" /></label> : null}
        <label><FieldLabel>Фото</FieldLabel><input type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" disabled={!photoCleanupAvailable} onChange={choosePhoto} /><span className="warm-recipe-editor-note">JPEG или PNG · до 1 МБ{!photoCleanupAvailable ? ". Загрузка станет доступна после обновления сервера хранения файлов." : ""}</span></label>
        {activePhoto ? <img src={activePhoto} className="warm-recipe-photo-preview" alt="Предпросмотр фото рецепта" /> : null}
        {photo ? <p className="small muted">{photo.name}</p> : null}
        {activePhoto ? <Button type="button" variant="ghost" disabled={!photoCleanupAvailable} onClick={removeCurrentPhoto}><WarmIcon name="trash" size={18} />Убрать фото</Button> : null}
        {photoError ? <WarmNotice error>{photoError}</WarmNotice> : null}
        {mode === "edit" && recipeStatusKind(recipe?.status || "") === "archive" && editor.status === "Актуальный" ? <p className="small muted">При возврате рецепта связанные вопросы останутся в архиве.</p> : null}
      </fieldset>
      {formError && !archiveConfirm ? <WarmNotice error>{formError}</WarmNotice> : null}
      <div className="warm-recipe-editor-actions"><Button type="button" disabled={saving} onClick={onCancel}>Отмена</Button><Button type="submit" variant="primary" disabled={saving || Boolean(photoError)}>{saving ? "Сохраняем…" : "Сохранить рецепт"}</Button></div>
    </form>
    {archiveConfirm && recipe ? <RecipeLifecycleConfirm recipe={recipe} pending={saving} error={formError} onCancel={() => setArchiveConfirm(false)} onConfirm={() => void save()} /> : null}
  </section>;
}

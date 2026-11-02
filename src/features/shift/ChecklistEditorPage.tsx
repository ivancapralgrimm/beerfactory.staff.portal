import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { WarmBack } from "@/components/warm/WarmBack";
import { WarmIcon } from "@/components/warm/WarmIcon";
import { WarmDialog } from "@/components/warm/WarmDialog";
import { WarmEmpty, WarmNotice, WarmTitle } from "@/components/warm/WarmPage";
import { useAuth } from "@/features/auth/auth-context";
import { checklistEditorError, deleteChecklistDefinition, loadChecklistEditorSnapshot, reorderChecklistDefinitions, saveChecklistDefinition, type ChecklistEditorCheckType, type ChecklistEditorRow, type ChecklistEditorSnapshot } from "./checklist-editor-api";
import { canManageChecklistsClient, type StaffPosition } from "@/types/auth";
import "./shift.css";

const TYPE_OPTIONS: {value: ChecklistEditorCheckType; label: string}[] = [{value:"opening",label:"Открытие"},{value:"closing",label:"Закрытие"},{value:"general_cleaning",label:"Генуборка"}];
const WEEKDAYS = [{value:1,label:"Пн",name:"Понедельник"},{value:2,label:"Вт",name:"Вторник"},{value:3,label:"Ср",name:"Среда"},{value:4,label:"Чт",name:"Четверг"},{value:5,label:"Пт",name:"Пятница"},{value:6,label:"Сб",name:"Суббота"},{value:7,label:"Вс",name:"Воскресенье"}];
type EditorDraft = {itemKey:string|null;label:string;checkType:ChecklistEditorCheckType;critical:boolean;isActive:boolean;activeIsoWeekdays:number[];groupKey:string;revision:number|null};
function blankDraft(type:ChecklistEditorCheckType):EditorDraft {return {itemKey:null,label:"",checkType:type,critical:false,isActive:true,activeIsoWeekdays:type === "general_cleaning" ? [7] : [1,2,3,4,5,6,7],groupKey:"",revision:null};}
function rowDraft(row:ChecklistEditorRow):EditorDraft {return {itemKey:row.item_key,label:row.label,checkType:row.check_type,critical:row.critical,isActive:row.is_active,activeIsoWeekdays:[...row.active_iso_weekdays],groupKey:row.group_key||"",revision:row.revision};}
function weekdayLabel(row:ChecklistEditorRow) {return row.active_iso_weekdays.length === 7 ? "Ежедневно" : WEEKDAYS.filter(day => row.active_iso_weekdays.includes(day.value)).map(day => day.label).join(", ");}
function ChecklistDraftEditor({ draft, setDraft, selectedPosition, saving, onCancel, onSave }: {draft:EditorDraft;setDraft:Dispatch<SetStateAction<EditorDraft|null>>;selectedPosition:StaffPosition|null;saving:boolean;onCancel:()=>void;onSave:()=>void}) {
  function change(patch:Partial<EditorDraft>) {setDraft(current => current ? {...current,...patch} : current);}
  return <form className="bf-checklist-item-form bf-compact-form" onSubmit={event => {event.preventDefault();onSave();}}>
    <h2 className="bf-checklist-item-title">{draft.itemKey ? "Редактирование пункта" : "Новый пункт"}</h2>
    <label className="bf-field"><span className="bf-field-label">Текст пункта</span><textarea autoFocus required rows={3} maxLength={500} value={draft.label} disabled={saving} onChange={event => change({label:event.target.value})}/></label>
    <label className="bf-field"><span className="bf-field-label">Раздел</span><select value={draft.checkType} disabled={saving} onChange={event => {const checkType=event.target.value as ChecklistEditorCheckType;change({checkType,...(checkType === "general_cleaning" && !draft.itemKey ? {activeIsoWeekdays:[7]} : {})});}}>{TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    {selectedPosition === "manager" ? <label className="bf-field"><span className="bf-field-label">Группа задач</span><select value={draft.groupKey} disabled={saving} onChange={event => change({groupKey:event.target.value})}><option value="">Без группы</option><option value="bf">BF</option><option value="bb">BB</option></select></label> : null}
    <div className="bf-field"><span className="bf-field-label">Дни недели</span><div className="bf-weekdays" role="group" aria-label="Дни недели пункта">{WEEKDAYS.map(day => <Button type="button" key={day.value} aria-label={day.name} aria-pressed={draft.activeIsoWeekdays.includes(day.value)} variant={draft.activeIsoWeekdays.includes(day.value)?"primary":"ghost"} disabled={saving} onClick={() => change({activeIsoWeekdays:draft.activeIsoWeekdays.includes(day.value)?draft.activeIsoWeekdays.filter(value=>value!==day.value):[...draft.activeIsoWeekdays,day.value].sort((a,b)=>a-b)})}>{day.label}</Button>)}</div></div>
    <label className="bf-shift-critical"><input type="checkbox" checked={draft.critical} disabled={saving} onChange={event => change({critical:event.target.checked})}/><span>Критичный пункт</span></label>
    <div className="bf-material-action-buttons"><Button type="button" disabled={saving} onClick={onCancel}>Отмена</Button><Button type="submit" variant="primary" disabled={saving||!draft.label.trim()||!draft.activeIsoWeekdays.length}>{saving?"Сохраняем…":"Сохранить пункт"}</Button></div>
  </form>;
}

export function ChecklistEditorPage() {
  const { state } = useAuth();
  const canManageChecklists =
    state.status === "authenticated" &&
    canManageChecklistsClient(state.user);
  const currentPosition =
    state.status === "authenticated"
      ? state.user.position_code || null
      : null;

  const [deleteTarget, setDeleteTarget] = useState<ChecklistEditorRow | null>(null);
  const [snapshot, setSnapshot] =
    useState<ChecklistEditorSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPosition, setSelectedPosition] =
    useState<StaffPosition | null>(null);
  const [selectedType, setSelectedType] =
    useState<ChecklistEditorCheckType>("opening");
  const [showArchived, setShowArchived] = useState(false);
  const [draft, setDraft] = useState<EditorDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await loadChecklistEditorSnapshot();
      setSnapshot(data);
      setSelectedPosition((current) => {
        if (
          current &&
          data.positions.some((item) => item.code === current)
        ) {
          return current;
        }
        if (
          currentPosition &&
          data.positions.some((item) => item.code === currentPosition)
        ) {
          return currentPosition;
        }
        return data.positions[0]?.code || null;
      });
      if (!quiet) setMessage(null);
    } catch (error) {
      setMessage({
        tone: "error",
        text: checklistEditorError(error)
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentPosition]);

  useEffect(() => {
    if (!canManageChecklists) return;
    void load(false);
  }, [canManageChecklists, load]);

  const positionLabel = useMemo(
    () =>
      snapshot?.positions.find(
        (item) => item.code === selectedPosition
      )?.label || "Должность",
    [snapshot?.positions, selectedPosition]
  );

  const rows = useMemo(() => {
    if (!snapshot || !selectedPosition) return [];
    return snapshot.rows
      .filter(
        (row) =>
          row.position_code === selectedPosition &&
          row.check_type === selectedType &&
          (showArchived || row.is_active)
      )
      .sort((a, b) => {
        if (a.is_active !== b.is_active) {
          return a.is_active ? -1 : 1;
        }
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order;
        }
        return a.item_key.localeCompare(b.item_key);
      });
  }, [snapshot, selectedPosition, selectedType, showArchived]);

  const activeRows = useMemo(
    () => rows.filter((row) => row.is_active),
    [rows]
  );

  const archivedCount = useMemo(() => {
    if (!snapshot || !selectedPosition) return 0;
    return snapshot.rows.filter(
      (row) =>
        row.position_code === selectedPosition &&
        row.check_type === selectedType &&
        !row.is_active
    ).length;
  }, [snapshot, selectedPosition, selectedType]);

  function openNew() {
    setDraft(blankDraft(selectedType));
    setMessage(null);
  }

  function openEdit(row: ChecklistEditorRow) {
    setDraft((current) =>
      current?.itemKey === row.item_key ? null : rowDraft(row)
    );
    setMessage(null);
  }

  async function saveDraft() {
    if (!draft || !selectedPosition || saving) return;
    if (!draft.label.trim()) {
      setMessage({ tone: "error", text: "Введите текст пункта." });
      return;
    }
    if (!draft.activeIsoWeekdays.length) {
      setMessage({
        tone: "error",
        text: "Выберите хотя бы один день недели."
      });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await saveChecklistDefinition({
        positionCode: selectedPosition,
        itemKey: draft.itemKey,
        checkType: draft.checkType,
        label: draft.label,
        critical: draft.critical,
        isActive: draft.isActive,
        activeIsoWeekdays: draft.activeIsoWeekdays,
        groupKey: selectedPosition === "manager" ? draft.groupKey : null,
        groupLabel: null,
        expectedRevision: draft.revision
      });
      setSelectedType(draft.checkType);
      setDraft(null);
      setMessage({
        tone: "success",
        text: draft.itemKey
          ? "Пункт обновлён."
          : "Пункт добавлен."
      });
      await load(true);
    } catch (error) {
      setMessage({
        tone: "error",
        text: checklistEditorError(error)
      });
      if (String(error).includes("checklist_revision_conflict")) {
        await load(true);
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: ChecklistEditorRow) {
    if (pendingKey) return;
    setPendingKey(row.item_key);
    setMessage(null);
    try {
      await saveChecklistDefinition({
        positionCode: row.position_code,
        itemKey: row.item_key,
        checkType: row.check_type,
        label: row.label,
        critical: row.critical,
        isActive: !row.is_active,
        activeIsoWeekdays: row.active_iso_weekdays,
        groupKey: row.group_key,
        groupLabel: row.group_label,
        expectedRevision: row.revision
      });
      setMessage({
        tone: "success",
        text: row.is_active
          ? "Пункт отправлен в архив."
          : "Пункт восстановлен."
      });
      await load(true);
    } catch (error) {
      setMessage({
        tone: "error",
        text: checklistEditorError(error)
      });
      await load(true);
    } finally {
      setPendingKey(null);
    }
  }

  async function deleteRow(row: ChecklistEditorRow) {
    if (pendingKey) return;

    setPendingKey(row.item_key);
    setMessage(null);

    try {
      await deleteChecklistDefinition({
        positionCode: row.position_code,
        itemKey: row.item_key,
        expectedRevision: row.revision
      });
      if (draft?.itemKey === row.item_key) {
        setDraft(null);
      }
      setMessage({ tone: "success", text: "Пункт удалён." });
      setDeleteTarget(null);
      await load(true);
    } catch (error) {
      setMessage({
        tone: "error",
        text: checklistEditorError(error)
      });
      await load(true);
    } finally {
      setPendingKey(null);
    }
  }

  async function moveRow(row: ChecklistEditorRow, delta: -1 | 1) {
    if (!selectedPosition || pendingKey) return;
    const index = activeRows.findIndex(
      (item) => item.item_key === row.item_key
    );
    const target = index + delta;
    if (index < 0 || target < 0 || target >= activeRows.length) return;

    const next = [...activeRows];
    [next[index], next[target]] = [next[target], next[index]];

    setPendingKey(row.item_key);
    setMessage(null);
    try {
      await reorderChecklistDefinitions({
        positionCode: selectedPosition,
        checkType: selectedType,
        itemKeys: next.map((item) => item.item_key)
      });
      setMessage({ tone: "success", text: "Порядок сохранён." });
      await load(true);
    } catch (error) {
      setMessage({
        tone: "error",
        text: checklistEditorError(error)
      });
      await load(true);
    } finally {
      setPendingKey(null);
    }
  }

  const busy = refreshing || saving || Boolean(pendingKey);
  const hasAccess = canManageChecklists && (snapshot?.can_edit ?? true);
  const editor = draft ? <ChecklistDraftEditor draft={draft} setDraft={setDraft} selectedPosition={selectedPosition} saving={saving} onCancel={() => setDraft(null)} onSave={() => void saveDraft()}/> : null;
  return <section className="bf-checklist-flat bf-checklist-editor bf-editor-page">
    <WarmBack to="/settings" label="В настройки"/>
    <WarmTitle title="Редактор чек-листов" description={positionLabel} action={hasAccess ? <Button variant="ghost" disabled={busy || Boolean(draft)} onClick={() => void load(true)}>{refreshing?"Обновляем…":"Обновить"}</Button> : undefined}/>
    {!hasAccess ? <WarmEmpty title="Недостаточно прав" body="Редактор чек-листов недоступен."/> : loading && !snapshot ? <p role="status" aria-busy="true">Загружаем чек-листы…</p> : <>
      <label className="bf-field"><span className="bf-field-label">Рабочая должность</span><select aria-label="Рабочая должность" value={selectedPosition || ""} disabled={busy || Boolean(draft)} onChange={event => {setSelectedPosition(event.target.value as StaffPosition);setDraft(null);setShowArchived(false);setMessage(null);}}>{snapshot?.positions.map(position => <option key={position.code} value={position.code}>{position.label}</option>)}</select></label>
      <div className="bf-checklist-selection"><label className="bf-field"><span className="bf-field-label">Чек-лист</span><select aria-label="Тип чек-листа" value={selectedType} disabled={busy || Boolean(draft)} onChange={event => {setSelectedType(event.target.value as ChecklistEditorCheckType);setDraft(null);setShowArchived(false);setMessage(null);}}>{TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>
      <div className="bf-checklist-count"><p className="small muted">Пунктов: {activeRows.length}{archivedCount ? ` · в архиве: ${archivedCount}` : ""}</p><Button disabled={busy || Boolean(draft)||!selectedPosition} onClick={openNew}><WarmIcon name="plus" size={18}/>Добавить</Button></div>
      {draft?.itemKey === null ? <section className="bf-checklist-item">{editor}</section> : null}
      {message ? <WarmNotice error={message.tone === "error"}>{message.text}</WarmNotice> : null}
      {!snapshot && !loading ? <Button onClick={() => void load(false)}>Повторить загрузку</Button> : null}
      {!rows.length && !draft && snapshot ? <WarmEmpty title="Пунктов пока нет"/> : rows.map(row => {
        const activeIndex = activeRows.findIndex(item=>item.item_key===row.item_key);
        const editing = draft?.itemKey === row.item_key;
        return <section className={`bf-checklist-item${!row.is_active?" bf-checklist-archived":""}`} key={`${row.position_code}:${row.item_key}`}>{editing ? editor : <>
          <p className="bf-checklist-item-title">{row.label}</p><p className="small muted">{weekdayLabel(row)}{row.group_label?` · ${row.group_label}`:""}{row.critical?" · Критичный":""}{!row.is_active?" · В архиве":""}</p>
          <div className="bf-editor-tools"><Button className="bf-move-up" size="icon" variant="ghost" aria-label={`Пункт выше: ${row.label}`} disabled={busy || Boolean(draft)||!row.is_active||activeIndex<=0} onClick={() => void moveRow(row,-1)}><WarmIcon name="chevron" size={17}/></Button><Button className="bf-move-down" size="icon" variant="ghost" aria-label={`Пункт ниже: ${row.label}`} disabled={busy || Boolean(draft)||!row.is_active||activeIndex>=activeRows.length-1} onClick={() => void moveRow(row,1)}><WarmIcon name="chevron" size={17}/></Button><Button size="icon" aria-label={`Изменить пункт: ${row.label}`} disabled={busy || Boolean(draft)} onClick={() => openEdit(row)}><WarmIcon name="edit" size={17}/></Button><Button size="icon" variant="ghost" aria-label={`${row.is_active?"Архивировать":"Восстановить"} пункт: ${row.label}`} disabled={busy || Boolean(draft)} onClick={() => void toggleActive(row)}><WarmIcon name={row.is_active?"archive":"plus"} size={17}/></Button><Button size="icon" variant="ghost" aria-label={`Удалить пункт: ${row.label}`} disabled={busy || Boolean(draft)} onClick={() => setDeleteTarget(row)}><WarmIcon name="trash" size={17}/></Button></div>
        </>}</section>;
      })}
      {archivedCount ? <Button variant="ghost" aria-expanded={showArchived} disabled={busy || Boolean(draft)} onClick={() => setShowArchived(current=>!current)}>{showArchived?"Скрыть архив":`Показать архив (${archivedCount})`}</Button> : null}
    </>}
    {deleteTarget ? <WarmDialog title="Удалить пункт?" confirm onClose={() => {if(!pendingKey)setDeleteTarget(null);}}><p>«{deleteTarget.label}» исчезнет из текущего шаблона и открытых смен этой должности. Завершённая история сохранится.</p><div className="bf-material-action-buttons"><Button disabled={Boolean(pendingKey)} onClick={() => setDeleteTarget(null)}>Отмена</Button><Button variant="danger" disabled={Boolean(pendingKey)} onClick={() => void deleteRow(deleteTarget)}>{pendingKey?"Удаляем…":"Удалить"}</Button></div></WarmDialog> : null}
  </section>;
}

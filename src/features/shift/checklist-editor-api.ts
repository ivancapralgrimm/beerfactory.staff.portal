import { supabase } from "@/lib/supabase";
import type { StaffPosition } from "@/types/auth";

export type ChecklistEditorCheckType =
  | "general_cleaning"
  | "opening"
  | "closing";

export type ChecklistEditorPosition = {
  code: StaffPosition;
  label: string;
};

export type ChecklistEditorRow = {
  position_code: StaffPosition;
  position_label: string;
  item_key: string;
  check_type: ChecklistEditorCheckType;
  label: string;
  sort_order: number;
  critical: boolean;
  is_active: boolean;
  active_iso_weekdays: number[];
  group_key: string | null;
  group_label: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
  revision: number;
};

export type ChecklistEditorSnapshot = {
  can_edit: boolean;
  positions: ChecklistEditorPosition[];
  rows: ChecklistEditorRow[];
};

export type ChecklistEditorSaveInput = {
  positionCode: StaffPosition;
  itemKey?: string | null;
  checkType: ChecklistEditorCheckType;
  label: string;
  critical: boolean;
  isActive: boolean;
  activeIsoWeekdays: number[];
  groupKey?: string | null;
  groupLabel?: string | null;
  expectedRevision?: number | null;
};

function errorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return String(error || "");
}

export function checklistEditorError(error: unknown) {
  const message = errorMessage(error);

  if (message.includes("checklist_revision_conflict")) {
    return "Этот пункт уже изменил другой сотрудник. Обновите список и повторите правку.";
  }
  if (message.includes("checklist_order_stale")) {
    return "Порядок уже изменился на другом устройстве. Обновите список и повторите.";
  }
  if (message.includes("group_label_required")) {
    return "Для группы нужно указать её название.";
  }
  if (message.includes("invalid_weekdays")) {
    return "Выберите хотя бы один день недели.";
  }
  if (message.includes("invalid_label")) {
    return "Текст пункта должен быть от 1 до 500 символов.";
  }
  if (message.includes("forbidden")) {
    return "У этого профиля нет права редактировать выбранный чек-лист.";
  }
  return "Не удалось сохранить изменения. Обновите данные и повторите.";
}

export async function loadChecklistEditorSnapshot() {
  const { data, error } = await supabase.rpc(
    "get_checklist_editor_snapshot"
  );

  if (error || !data) {
    throw error || new Error("checklist_editor_unavailable");
  }

  return data as ChecklistEditorSnapshot;
}

export async function saveChecklistDefinition(
  input: ChecklistEditorSaveInput
) {
  const { data, error } = await supabase.rpc(
    "save_checklist_definition",
    {
      p_position_code: input.positionCode,
      p_item_key: input.itemKey || null,
      p_check_type: input.checkType,
      p_label: input.label.trim(),
      p_critical: input.critical,
      p_is_active: input.isActive,
      p_active_iso_weekdays: input.activeIsoWeekdays,
      p_group_key: input.groupKey?.trim() || null,
      p_group_label: input.groupLabel?.trim() || null,
      p_expected_revision: input.expectedRevision ?? null
    }
  );

  if (error || !data) {
    throw error || new Error("checklist_editor_save_failed");
  }

  return data as ChecklistEditorRow;
}

export async function reorderChecklistDefinitions(input: {
  positionCode: StaffPosition;
  checkType: ChecklistEditorCheckType;
  itemKeys: string[];
}) {
  const { data, error } = await supabase.rpc(
    "reorder_checklist_definitions",
    {
      p_position_code: input.positionCode,
      p_check_type: input.checkType,
      p_item_keys: input.itemKeys
    }
  );

  if (error || !data) {
    throw error || new Error("checklist_editor_reorder_failed");
  }

  return data;
}

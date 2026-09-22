import { supabase } from "@/lib/supabase";
import type {
  PositionShiftCheck,
  PositionShiftWorkflow,
  ShiftCheckType
} from "@/features/shift/types";

function errorText(error: unknown) {
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

export function shiftErrorMessage(error: unknown) {
  const message = errorText(error);

  if (message.includes("position_required")) {
    return "Сначала выберите рабочую должность в личном профиле.";
  }
  if (message.includes("shift_window_locked")) {
    return "Операционное окно смены закрыто. Новая смена станет доступна в 11:00.";
  }
  if (message.includes("checklist_not_configured")) {
    return "Для этой должности чек-лист пока не настроен.";
  }
  if (message.includes("opening_incomplete")) {
    return "Сначала отметьте все пункты открытия.";
  }
  if (message.includes("closing_incomplete")) {
    return "Сначала отметьте все пункты закрытия.";
  }
  if (message.includes("shift_not_open")) {
    return "Смена ещё не открыта.";
  }
  if (message.includes("shift_closed")) {
    return "Эта смена уже закрыта.";
  }
  if (message.includes("opening_locked")) {
    return "Открытие уже зафиксировано.";
  }
  if (message.includes("closing_locked")) {
    return "Закрытие доступно только после открытия смены.";
  }
  if (message.includes("invalid_check")) {
    return "Этот пункт чек-листа больше не активен. Обновите страницу.";
  }
  if (message.includes("forbidden")) {
    return "Недостаточно прав для работы со сменой.";
  }

  return "Не удалось синхронизировать смену. Проверьте соединение и повторите.";
}

export async function loadPositionShiftWorkflow() {
  const { data, error } = await supabase.rpc(
    "get_position_shift_workflow"
  );

  if (error || !data) {
    throw error || new Error("shift_unavailable");
  }

  return data as PositionShiftWorkflow;
}

export async function setPositionShiftCheck(input: {
  checkType: ShiftCheckType;
  itemKey: string;
  completed: boolean;
}) {
  const { data, error } = await supabase.rpc(
    "set_position_shift_check",
    {
      p_check_type: input.checkType,
      p_item_key: input.itemKey,
      p_completed: input.completed
    }
  );

  if (error || !data) {
    throw error || new Error("shift_check_unavailable");
  }

  return data as PositionShiftCheck;
}

export async function confirmPositionShift(
  action: "open" | "close"
) {
  const { data, error } = await supabase.rpc(
    "confirm_position_shift",
    { p_action: action }
  );

  if (error || !data) {
    throw error || new Error("shift_confirmation_unavailable");
  }

  return data;
}

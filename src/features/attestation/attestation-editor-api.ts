import { supabase } from "@/lib/supabase";

export type AttestationEditorAnswer = {
  text: string;
  correct: boolean;
};

export type AttestationEditorQuestion = {
  id: string;
  categoryId: string;
  q: string;
  answers: AttestationEditorAnswer[];
  topic: string;
  subcategory?: string | null;
  group: string;
  source?: string | null;
  sourceRef?: string | null;
  reviewUrl?: string | null;
  reviewLabel?: string | null;
  reviewNote?: string | null;
  status: "active" | "archive" | "deleted";
  sortOrder: number;
  revision: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
};

export type AttestationTicketPlanItem = {
  topic: string;
  count: number;
  sortOrder: number;
};

export type AttestationEditorCategory = {
  id: string;
  label: string;
  sortOrder: number;
  active: boolean;
  questionsPerTest: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  ticketPlan: AttestationTicketPlanItem[];
};

export type AttestationEditorBank = {
  settings: {
    passPercent: number;
    questionsPerTest: number;
    revision: number;
  };
  categories: AttestationEditorCategory[];
  questions: AttestationEditorQuestion[];
};

function apiError(error: unknown, fallback: string) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : "";

  for (const code of [
    "attestation_revision_conflict",
    "attestation_settings_revision_conflict",
    "attestation_category_revision_conflict",
    "attestation_ticket_capacity",
    "attestation_ticket_total_invalid",
    "attestation_ticket_plan_invalid",
    "attestation_ticket_plan_duplicate",
    "attestation_settings_invalid",
    "attestation_category_settings_duplicate",
    "attestation_category_settings_incomplete",
    "attestation_answers_invalid",
    "attestation_category_invalid",
    "attestation_category_label_invalid",
    "attestation_category_label_duplicate",
    "attestation_category_sort_invalid",
    "attestation_category_not_found",
    "attestation_category_not_ready",
    "attestation_last_category",
    "attestation_topic_invalid",
    "attestation_subcategory_invalid",
    "attestation_pass_percent_invalid",
    "attestation_question_count_invalid",
    "forbidden"
  ]) {
    if (message.includes(code)) return new Error(code);
  }

  return new Error(fallback);
}

export async function loadAttestationEditorBank(
  includeDeleted = false
): Promise<AttestationEditorBank> {
  const { data, error } = await supabase.rpc(
    "get_attestation_editor_bank",
    { p_include_deleted: includeDeleted }
  );

  if (error || !data || typeof data !== "object") {
    throw apiError(error, "attestation_editor_load_failed");
  }

  const value = data as AttestationEditorBank;
  if (
    !value.settings ||
    !Array.isArray(value.categories) ||
    !Array.isArray(value.questions)
  ) {
    throw new Error("attestation_editor_response_invalid");
  }

  return value;
}

export async function saveAttestationQuestion(
  document: {
    id?: string;
    categoryId: string;
    q: string;
    answers: AttestationEditorAnswer[];
    topic: string;
    subcategory?: string | null;
    group: string;
    source?: string | null;
    sourceRef?: string | null;
    reviewUrl?: string | null;
    reviewLabel?: string | null;
    reviewNote?: string | null;
  },
  expectedRevision?: number | null
) {
  const { data, error } = await supabase.rpc(
    "save_attestation_question",
    {
      p_document: document,
      p_expected_revision: expectedRevision ?? null
    }
  );

  if (error || !data || typeof data !== "object") {
    throw apiError(error, "attestation_question_save_failed");
  }

  return data as AttestationEditorQuestion;
}

export async function setAttestationQuestionStatus(
  questionId: string,
  status: "active" | "archive" | "deleted",
  expectedRevision: number
) {
  const { data, error } = await supabase.rpc(
    "set_attestation_question_status",
    {
      p_question_id: questionId,
      p_status: status,
      p_expected_revision: expectedRevision
    }
  );

  if (error || !data || typeof data !== "object") {
    throw apiError(error, "attestation_question_status_failed");
  }

  return data as AttestationEditorQuestion;
}

export async function saveAttestationEditorSettings(input: {
  passPercent: number;
  expectedRevision: number;
  categories: Array<{
    categoryId: string;
    label: string;
    questionsPerTest: number;
  }>;
  ticketPlan: Array<{
    categoryId: string;
    topic: string;
    count: number;
    sortOrder: number;
  }>;
}) {
  const { data, error } = await supabase.rpc(
    "save_attestation_editor_settings_v2",
    {
      p_pass_percent: input.passPercent,
      p_category_settings: input.categories,
      p_ticket_plan: input.ticketPlan,
      p_expected_revision: input.expectedRevision
    }
  );

  if (error || !data || typeof data !== "object") {
    throw apiError(error, "attestation_settings_save_failed");
  }

  return data as Pick<AttestationEditorBank["settings"], "passPercent" | "revision">;
}

export async function saveAttestationCategory(
  document: {
    id?: string;
    label: string;
    sortOrder?: number | null;
  },
  expectedUpdatedAt?: string | null
) {
  const { data, error } = await supabase.rpc(
    "save_attestation_category",
    {
      p_document: document,
      p_expected_updated_at: expectedUpdatedAt ?? null
    }
  );

  if (error || !data || typeof data !== "object") {
    throw apiError(error, "attestation_category_save_failed");
  }

  return data as AttestationEditorCategory;
}

export async function setAttestationCategoryStatus(
  categoryId: string,
  active: boolean,
  expectedUpdatedAt: string
) {
  const { data, error } = await supabase.rpc(
    "set_attestation_category_status",
    {
      p_category_id: categoryId,
      p_is_active: active,
      p_expected_updated_at: expectedUpdatedAt
    }
  );

  if (error || !data || typeof data !== "object") {
    throw apiError(error, "attestation_category_status_failed");
  }

  return data as AttestationEditorCategory;
}

import { supabase } from "@/lib/supabase";
import { invalidateQuestionBank } from "@/features/attestation/attestation-data";

/** Only the server may decide whether a ticket can be deleted. */
export async function deleteAttestationTicket(ticketId: string, expectedUpdatedAt: string) {
  const { data, error } = await supabase.rpc("delete_attestation_category_v3", {
    p_category_id: ticketId,
    p_expected_updated_at: expectedUpdatedAt
  });
  if (error) {
    const message = String(error.message || "");
    for (const code of [
      "attestation_ticket_delete_questions_exist",
      "attestation_ticket_last_active",
      "attestation_ticket_delete_revision_conflict",
      "attestation_category_not_found",
      "forbidden"
    ]) {
      if (message.includes(code)) throw new Error(code);
    }
    if (error.code === "PGRST202") {
      throw new Error("attestation_ticket_delete_function_missing");
    }
    throw new Error("attestation_ticket_delete_failed");
  }
  if (!data || typeof data !== "object" || (data as { deleted?: boolean }).deleted !== true ||
      (data as { id?: string }).id !== ticketId) {
    throw new Error("attestation_ticket_delete_failed");
  }
  invalidateQuestionBank();
  return data as { id: string; label: string; deleted: true; preservedResults: number; revision: number };
}

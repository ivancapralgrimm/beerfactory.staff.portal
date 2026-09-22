import { useCallback, useEffect, useState } from "react";
import { loadQuestionBank } from "@/features/attestation/attestation-data";
import type { QuestionBank } from "@/features/attestation/types";

type BankState =
  | { status: "loading"; bank: null; error: null }
  | { status: "ready"; bank: QuestionBank; error: null }
  | { status: "error"; bank: null; error: Error };

export function useAttestationBank() {
  const [state, setState] = useState<BankState>({
    status: "loading",
    bank: null,
    error: null
  });

  const load = useCallback(async (force = false) => {
    setState({ status: "loading", bank: null, error: null });

    try {
      const bank = await loadQuestionBank({ force });
      setState({ status: "ready", bank, error: null });
    } catch (error) {
      setState({
        status: "error",
        bank: null,
        error:
          error instanceof Error
            ? error
            : new Error("question_bank_unavailable")
      });
    }
  }, []);

  useEffect(() => {
    let active = true;

    void loadQuestionBank()
      .then((bank) => {
        if (active) setState({ status: "ready", bank, error: null });
      })
      .catch((error) => {
        if (!active) return;

        setState({
          status: "error",
          bank: null,
          error:
            error instanceof Error
              ? error
              : new Error("question_bank_unavailable")
        });
      });

    return () => {
      active = false;
    };
  }, []);

  return {
    state,
    reload: () => load(true)
  };
}

import { useCallback, useEffect, useState } from "react";
import { loadRecipes } from "@/features/recipes/recipe-data";
import type { RecipeLoadResult } from "@/features/recipes/types";

type RecipesState =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: RecipeLoadResult; error: null }
  | { status: "error"; data: null; error: Error };

export function useRecipes() {
  const [state, setState] = useState<RecipesState>({
    status: "loading",
    data: null,
    error: null
  });

  const load = useCallback(async (force = false) => {
    setState((current) =>
      current.status === "ready"
        ? current
        : { status: "loading", data: null, error: null }
    );

    try {
      const data = await loadRecipes({ force });
      setState({ status: "ready", data, error: null });
    } catch (error) {
      setState({
        status: "error",
        data: null,
        error:
          error instanceof Error
            ? error
            : new Error("recipe_load_failed")
      });
    }
  }, []);

  useEffect(() => {
    let active = true;

    void loadRecipes()
      .then((data) => {
        if (active) setState({ status: "ready", data, error: null });
      })
      .catch((error) => {
        if (!active) return;
        setState({
          status: "error",
          data: null,
          error:
            error instanceof Error
              ? error
              : new Error("recipe_load_failed")
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

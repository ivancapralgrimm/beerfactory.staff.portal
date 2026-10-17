import { useCallback, useEffect, useRef, useState } from "react";
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
  // The component can trigger an initial GET and a post-save forced reload.
  // A slower old GET must never replace the result of the newer request.
  const requestVersion = useRef(0);

  const load = useCallback(async (force = false) => {
    const version = ++requestVersion.current;
    setState((current) =>
      current.status === "ready"
        ? current
        : { status: "loading", data: null, error: null }
    );

    try {
      const data = await loadRecipes({ force });
      if (version === requestVersion.current) {
        setState({ status: "ready", data, error: null });
      }
    } catch (error) {
      if (version === requestVersion.current) {
        setState({
          status: "error",
          data: null,
          error:
            error instanceof Error
              ? error
              : new Error("recipe_load_failed")
        });
      }
    }
  }, []);

  useEffect(() => {
    const version = ++requestVersion.current;
    void loadRecipes()
      .then((data) => {
        if (version === requestVersion.current) {
          setState({ status: "ready", data, error: null });
        }
      })
      .catch((error) => {
        if (version !== requestVersion.current) return;
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
      ++requestVersion.current;
    };
  }, []);

  return {
    state,
    reload: () => load(true)
  };
}

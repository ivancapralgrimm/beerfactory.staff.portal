export type RecipeVenue = "BF" | "BB" | "BF/BB";

export type Recipe = {
  id: string;
  legacyId: string;
  recordId: string;
  source: string;
  venue: RecipeVenue;
  name: string;
  category: string;
  subcategory: string;
  desc: string;
  ingredients: string[];
  method: string;
  serving: string;
  photo: string;
  tags: string[];
  status: string;
  version: string;
  updatedAt: string;
  updatedBy: string;
  changeNote: string;
};

export type RecipeCapabilities = {
  governance: boolean;
  recipeAdminWrite: boolean;
  sourceAwareIds: boolean;
};

export type RecipeDataSource =
  | "api"
  | "cache-fresh"
  | "cache-offline"
  | "legacy-cache";

export type RecipeLoadResult = {
  recipes: Recipe[];
  source: RecipeDataSource;
  syncedAt: number | null;
  capabilities: RecipeCapabilities;
};

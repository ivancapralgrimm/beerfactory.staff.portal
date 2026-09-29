/**
 * Deprecated compatibility shim.
 *
 * Recipe management moved out of Admin and now lives in:
 * - /menu for recipe creation
 * - recipe detail pages for inline editing / archive / restore / delete
 *
 * This file intentionally remains as a no-op because GitHub web ZIP upload
 * cannot delete an existing repository file. It can be removed later when
 * repository cleanup is performed.
 */
export function AdminRecipesPanel() {
  return null;
}

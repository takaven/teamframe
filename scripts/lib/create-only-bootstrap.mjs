/** Prevent the disposable one-shot bootstrap from adopting existing identity. */
export function createOnlyRefusal(createOnly, existingCompany, existingUser) {
  if (!createOnly) return null;
  if (existingCompany) return "Create-only bootstrap refuses an existing company.";
  if (existingUser) return "Create-only bootstrap refuses an existing auth user; no account was updated.";
  return null;
}

// Facts the Terms and Privacy Policy depend on. Change them here, never inline in the pages,
// and bump `updated` whenever the meaning of either document changes.
export const LEGAL = {
  /** Who runs the service: a person's name or a business name. */
  operator: "Ayomide Ogunyemi",
  /** Where players send privacy and account requests. Fill in before launch. */
  contactEmail: null as string | null,
  /** Country or state whose law governs the Terms. Null leaves the clause out. */
  governingLaw: "Nigeria" as string | null,
  /** Players must be at least this old to create an account. */
  minimumAge: 13,
  updated: "2026-11-02",
} as const;

export function legalUpdatedLabel() {
  return new Date(`${LEGAL.updated}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

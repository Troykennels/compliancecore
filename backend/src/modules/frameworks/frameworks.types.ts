export interface Framework {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  version: string | null;
  jurisdiction: string | null;
  issuingBody: string | null;
  description: string | null;
  isActive: boolean;
  effectiveDate: Date | null;
  categoryCount: number;
  adoptedControlCount: number;
  // How many controls the published library holds for this framework. Drives the
  // "adopting this creates N controls" affordance, and distinguishes a framework
  // that is fully modelled from one that is still catalogue-only.
  libraryControlCount: number;
}

export interface FrameworkCategory {
  id: string;
  frameworkId: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
}

export interface FrameworkLibraryControl {
  controlRef: string;
  title: string;
  description: string | null;
  guidance: string | null;
  sortOrder: number;
  categoryCode: string | null;
  categoryName: string | null;
}

export interface FrameworkDetail extends Framework {
  categories: FrameworkCategory[];
  controls: FrameworkLibraryControl[];
}

export interface AdoptResult {
  created: number;
  // Already present in the tenant and therefore skipped, so re-adopting reports
  // "nothing new" instead of looking like a failure.
  skipped: number;
  source: 'library' | 'categories';
}

/**
 * What removing a framework would actually cost this tenant.
 *
 * Adoption copies a control library into the tenant, and from that moment the
 * controls are where the real work accumulates — statuses, owners, notes,
 * review dates, linked evidence. Removal has to be able to tell the difference
 * between "adopted by accident five minutes ago" and "eight months of audit
 * preparation", because those deserve very different amounts of friction.
 *
 * `touched` is the count that matters: controls somebody has actually done
 * something to. When it is zero the removal is genuinely free.
 */
export interface UnadoptImpact {
  frameworkId: string;
  frameworkName: string;
  /** Live controls this framework put in the tenant. */
  controls: number;
  /** Of those, how many show any sign of work. */
  touched: number;
  /** The specific signals, so the confirmation can say what is at stake. */
  implemented: number;
  withOwner: number;
  withNotes: number;
  withEvidence: number;
}

export interface UnadoptResult {
  /** Controls soft-deleted. They keep their rows, so this is reversible. */
  removed: number;
  frameworkName: string;
}

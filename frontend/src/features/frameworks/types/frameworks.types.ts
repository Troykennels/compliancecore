export interface Framework {
  id:                  string;
  code:                string;
  name:                string;
  shortName:           string | null;
  version:             string | null;
  jurisdiction:        string | null;
  issuingBody:         string | null;
  description:         string | null;
  isActive:            boolean;
  effectiveDate:       string | null;
  categoryCount:       number;
  adoptedControlCount: number;
  /** Controls published in the shared library. 0 means the framework is listed
   *  in the catalogue but not yet modelled, so adopting it yields little. */
  libraryControlCount: number;
}

export interface FrameworkLibraryControl {
  controlRef:   string;
  title:        string;
  description:  string | null;
  guidance:     string | null;
  sortOrder:    number;
  categoryCode: string | null;
  categoryName: string | null;
}

export interface FrameworkCategory {
  id:          string;
  frameworkId: string;
  code:        string;
  name:        string;
  description: string | null;
  sortOrder:   number;
}

export interface FrameworkDetail extends Framework {
  categories: FrameworkCategory[];
  controls:   FrameworkLibraryControl[];
}

export interface AdoptResult {
  created: number;
  /** Already present in the tenant, so a repeat adoption reports "nothing new"
   *  rather than looking like a failure. */
  skipped: number;
  source: 'library' | 'categories';
}

/**
 * What removing a framework would cost.
 *
 * `touched` is the number the confirmation turns on: zero means the framework
 * was adopted and never worked on, which is the "adopted it by mistake" case,
 * and that should cost one click and no lecture.
 */
export interface UnadoptImpact {
  frameworkId:   string;
  frameworkName: string;
  controls:      number;
  touched:       number;
  implemented:   number;
  withOwner:     number;
  withNotes:     number;
  withEvidence:  number;
}

export interface UnadoptResult {
  removed:       number;
  frameworkName: string;
}

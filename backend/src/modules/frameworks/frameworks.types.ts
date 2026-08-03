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

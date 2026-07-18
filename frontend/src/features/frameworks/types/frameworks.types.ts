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
}

export interface AdoptResult {
  created: number;
}

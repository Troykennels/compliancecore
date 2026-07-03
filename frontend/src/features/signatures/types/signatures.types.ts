export interface DigitalSignature {
  id:               string;
  userId:           string;
  signerName:       string | null;
  signerEmail:      string | null;
  documentType:     string;
  documentId:       string;
  documentHash:     string;
  signatureHash:    string;
  signatureImage:   string | null;
  certificateData:  SignatureCertificate | null;
  ipAddress:        string | null;
  userAgent:        string | null;
  signedAt:         string;
  isValid:          boolean;
  revokedAt:        string | null;
  revokedBy:        string | null;
  revocationReason: string | null;
  createdAt:        string;
}

export interface SignatureCertificate {
  signerName:    string;
  signerEmail:   string;
  signedAt:      string;
  algorithm:     string;
  version:       string;
  organization?: string;
}

export interface VerifySignatureResult {
  isValid:    boolean;
  signature:  DigitalSignature;
  message:    string;
}

export interface CreateSignatureDto {
  documentHash:        string;
  signatureImageBase64?: string;
}

export interface SignatureFilters {
  signedBy?:     string;
  documentHash?: string;
  isValid?:      boolean;
  page?:         number;
  limit?:        number;
}

export interface SignaturesListResponse {
  items: DigitalSignature[];
  total: number;
  page:  number;
  limit: number;
}

import type { RegisterKey } from './privacy.api';

export type FieldType = 'text' | 'textarea' | 'select' | 'bool' | 'date' | 'member' | 'activity';
export interface Field {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  help?: string;
  options?: Array<[string, string]>;
  suggestions?: string[];
}
export interface Register {
  key: RegisterKey;
  path: string;
  tab: string;
  title: string;
  purpose: string;
  addLabel: string;
  empty: string;
  columns: Array<{ key: string; label: string; kind?: 'date' | 'label' | 'member' | 'bool' }>;
  fields: Field[];
}

export const LAWFUL_BASIS: Array<[string, string]> = [
  ['consent', 'Consent'],
  ['contract', 'Contract'],
  ['legal_obligation', 'Legal obligation'],
  ['vital_interests', 'Vital interests'],
  ['public_task', 'Public task'],
  ['legitimate_interests', 'Legitimate interests'],
];
export const REQUEST_TYPE: Array<[string, string]> = [
  ['access', 'Access'],
  ['rectification', 'Correction'],
  ['erasure', 'Erasure'],
  ['restriction', 'Restriction'],
  ['portability', 'Portability'],
  ['objection', 'Objection'],
  ['other', 'Other'],
];
export const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  retired: 'Retired',
  received: 'Received',
  verifying: 'Verifying identity',
  in_progress: 'In progress',
  completed: 'Completed',
  refused: 'Refused',
  in_review: 'In review',
  approved: 'Approved',
  rejected: 'Rejected',
};
export const RISK_LABEL: Record<string, string> = {
  not_assessed: 'Not yet assessed',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export const REGISTERS: Register[] = [
  {
    key: 'activities',
    path: '/privacy/ropa',
    tab: 'Records of processing',
    title: 'Records of processing',
    purpose:
      'One record for each activity that uses personal data: why it is used, the lawful basis, who it is about, who receives it, where it goes and how long it is kept.',
    addLabel: 'Add processing activity',
    empty:
      'No processing activities recorded yet. Start with the main uses of personal data, such as payroll, customer accounts and marketing.',
    columns: [
      { key: 'name', label: 'Activity' },
      { key: 'lawfulBasis', label: 'Lawful basis', kind: 'label' },
      { key: 'dataSubjects', label: 'About' },
      { key: 'retention', label: 'Kept for' },
      { key: 'ownerId', label: 'Owner', kind: 'member' },
      { key: 'reviewDate', label: 'Next review', kind: 'date' },
    ],
    fields: [
      {
        key: 'name',
        label: 'Processing activity',
        type: 'text',
        required: true,
        suggestions: [
          'Payroll and staff records',
          'Customer accounts and billing',
          'Marketing emails',
          'Recruitment',
          'Website analytics',
          'CCTV',
        ],
      },
      {
        key: 'purpose',
        label: 'Purpose',
        type: 'textarea',
        required: true,
        help: 'Why the personal data is used, in plain words.',
      },
      {
        key: 'lawfulBasis',
        label: 'Lawful basis',
        type: 'select',
        required: true,
        options: LAWFUL_BASIS,
      },
      {
        key: 'dataSubjects',
        label: 'Whose data',
        type: 'text',
        required: true,
        suggestions: [
          'Employees',
          'Customers',
          'Job applicants',
          "Suppliers' contacts",
          'Website visitors',
        ],
      },
      {
        key: 'dataCategories',
        label: 'Types of personal data',
        type: 'textarea',
        required: true,
        help: 'For example names, contact details, bank details, identification numbers.',
      },
      {
        key: 'specialCategories',
        label:
          'Includes special category or sensitive data (health, biometrics, religion and similar)',
        type: 'bool',
      },
      {
        key: 'recipients',
        label: 'Who receives it',
        type: 'textarea',
        help: 'Internal teams and outside organisations, such as payroll providers or regulators.',
      },
      {
        key: 'transfers',
        label: 'Transfers outside the country',
        type: 'text',
        help: 'Leave empty if the data stays in the country.',
      },
      {
        key: 'transferSafeguard',
        label: 'Transfer safeguard',
        type: 'text',
        help: 'Required when there is a transfer.',
        suggestions: [
          'Adequacy decision',
          'Standard contractual clauses',
          'Binding corporate rules',
          'Explicit consent',
        ],
      },
      {
        key: 'retention',
        label: 'How long it is kept',
        type: 'text',
        required: true,
        suggestions: [
          '6 years after employment ends',
          'Duration of contract plus 6 years',
          'Until consent is withdrawn',
          '12 months',
        ],
      },
      {
        key: 'securityMeasures',
        label: 'Security measures',
        type: 'textarea',
        help: 'The main safeguards, for example access control and encryption.',
      },
      {
        key: 'ownerId',
        label: 'Accountable owner',
        type: 'member',
        help: 'Required before the record is marked active.',
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        required: true,
        options: [
          ['draft', 'Draft'],
          ['active', 'Active'],
          ['retired', 'Retired'],
        ],
      },
      { key: 'reviewDate', label: 'Next review', type: 'date' },
    ],
  },
  {
    key: 'requests',
    path: '/privacy/dsar',
    tab: 'Data subject requests',
    title: 'Data subject requests',
    purpose:
      'Requests from people to see, correct, delete or move their personal data. The response is due 30 days after receipt unless the period is extended with a reason.',
    addLabel: 'Log request',
    empty:
      'No requests logged. Log each request on the day it arrives, even before identity is confirmed.',
    columns: [
      { key: 'reference', label: 'Reference' },
      { key: 'requester', label: 'Requester' },
      { key: 'requestType', label: 'Type', kind: 'label' },
      { key: 'receivedOn', label: 'Received', kind: 'date' },
      { key: 'dueDate', label: 'Due', kind: 'date' },
      { key: 'ownerId', label: 'Owner', kind: 'member' },
    ],
    fields: [
      {
        key: 'requester',
        label: 'Requester',
        type: 'text',
        required: true,
        help: 'Name, or a reference if the request is anonymous.',
      },
      {
        key: 'requestType',
        label: 'Type of request',
        type: 'select',
        required: true,
        options: REQUEST_TYPE,
      },
      { key: 'receivedOn', label: 'Received on', type: 'date', required: true },
      {
        key: 'dueDate',
        label: 'Response due',
        type: 'date',
        help: 'Leave empty to use 30 days after receipt.',
      },
      {
        key: 'extensionReason',
        label: 'Reason for extending the response period',
        type: 'textarea',
        help: 'Required when the due date is more than 30 days after receipt.',
      },
      { key: 'identityVerified', label: 'Identity has been verified', type: 'bool' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        required: true,
        options: [
          ['received', 'Received'],
          ['verifying', 'Verifying identity'],
          ['in_progress', 'In progress'],
          ['completed', 'Completed'],
          ['refused', 'Refused'],
        ],
      },
      { key: 'outcome', label: 'Outcome or reason for refusal', type: 'textarea' },
      { key: 'respondedOn', label: 'Responded on', type: 'date' },
      { key: 'ownerId', label: 'Handled by', type: 'member' },
    ],
  },
  {
    key: 'assessments',
    path: '/privacy/dpia',
    tab: 'Impact assessments',
    title: 'Impact assessments',
    purpose:
      'Assess new or changed processing that is likely to be high risk to people before it starts. A different authorised person reviews and approves each assessment.',
    addLabel: 'Start impact assessment',
    empty:
      'No impact assessments yet. Start one before launching high-risk processing, such as large-scale monitoring or sensitive data.',
    columns: [
      { key: 'title', label: 'Assessment' },
      { key: 'activityId', label: 'Processing activity', kind: 'label' },
      { key: 'residualRisk', label: 'Remaining risk', kind: 'label' },
      { key: 'consultationRequired', label: 'Regulator consultation', kind: 'bool' },
      { key: 'ownerId', label: 'Owner', kind: 'member' },
      { key: 'reviewDate', label: 'Next review', kind: 'date' },
    ],
    fields: [
      { key: 'title', label: 'Assessment title', type: 'text', required: true },
      { key: 'activityId', label: 'Processing activity', type: 'activity' },
      {
        key: 'description',
        label: 'Description of the processing',
        type: 'textarea',
        required: true,
      },
      { key: 'necessity', label: 'Why it is necessary and proportionate', type: 'textarea' },
      { key: 'risks', label: 'Risks to people', type: 'textarea' },
      { key: 'mitigations', label: 'Measures to reduce the risks', type: 'textarea' },
      {
        key: 'residualRisk',
        label: 'Remaining risk',
        type: 'select',
        required: true,
        options: [
          ['not_assessed', 'Not yet assessed'],
          ['low', 'Low'],
          ['medium', 'Medium'],
          ['high', 'High'],
        ],
      },
      {
        key: 'consultationRequired',
        label: 'High remaining risk: the regulator must be consulted before processing starts',
        type: 'bool',
      },
      { key: 'dpoAdvice', label: 'Data protection officer advice', type: 'textarea' },
      { key: 'ownerId', label: 'Owner', type: 'member' },
      { key: 'reviewDate', label: 'Next review', type: 'date' },
    ],
  },
];

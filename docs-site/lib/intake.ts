// Intake demo specs. Each real use case (resume, loan) is one config; IntakeDemo
// is the engine. The "engine + configs" thesis, applied to structured intake.

export interface FieldDef {
  key: string;
  label: string;
  type?: 'text' | 'textarea';
  full?: boolean;
}
export interface SectionDef {
  key: string;
  title: string;
  kind: 'fields' | 'list';
  fields: FieldDef[];
  addLabel?: string;
}
export interface IntakeData {
  fields: Record<string, string>;
  lists: Record<string, Array<Record<string, string>>>;
}
export interface IntakeSpec {
  slug: string;
  eyebrow: string;
  name: string;
  tagline: string;
  inputTitle: string;
  inputHint: string;
  placeholder: string;
  aiSystem: string;
  sample: IntakeData;
  sections: SectionDef[];
  submitLabel: string;
  doneSummary: (d: IntakeData) => string;
}

export const RESUME_SPEC: IntakeSpec = {
  slug: 'resume',
  eyebrow: 'flowgent demo · job application',
  name: 'Resume → application',
  tagline:
    'Paste a resume; the AI fills out a structured application. Every field is yours to correct before it submits — nothing is auto-accepted. The form lives in a @flowgent/core store, so your edits undo.',
  inputTitle: 'Paste a resume',
  inputHint: 'Any format — the AI pulls out the structured application.',
  placeholder: 'Jordan Rivera — jordan@email.com\nSenior Engineer at Northwind (2022–present)…',
  aiSystem:
    'You extract a job application from a resume. Return ONLY JSON, no prose and no code fences, matching exactly: {"name":"","email":"","phone":"","skills":"comma-separated","summary":"","experience":[{"company":"","role":"","dates":"","highlights":""}],"education":[{"school":"","degree":"","year":""}]}',
  submitLabel: 'Submit application',
  sections: [
    {
      key: 'applicant',
      title: 'Applicant',
      kind: 'fields',
      fields: [
        { key: 'name', label: 'Full name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'skills', label: 'Skills' },
        { key: 'summary', label: 'Summary', type: 'textarea', full: true },
      ],
    },
    {
      key: 'experience',
      title: 'Experience',
      kind: 'list',
      addLabel: 'Add role',
      fields: [
        { key: 'company', label: 'Company' },
        { key: 'role', label: 'Role' },
        { key: 'dates', label: 'Dates', full: true },
        { key: 'highlights', label: 'Highlights', type: 'textarea', full: true },
      ],
    },
    {
      key: 'education',
      title: 'Education',
      kind: 'list',
      addLabel: 'Add school',
      fields: [
        { key: 'school', label: 'School' },
        { key: 'degree', label: 'Degree' },
        { key: 'year', label: 'Year' },
      ],
    },
  ],
  doneSummary: (d) =>
    `${d.fields.name || 'Applicant'} · ${d.lists.experience?.length ?? 0} roles · ${d.lists.education?.length ?? 0} schools`,
  sample: {
    fields: {
      name: 'Jordan Rivera',
      email: 'jordan.rivera@email.com',
      phone: '(415) 555-0148',
      skills: 'TypeScript, React, Node.js, PostgreSQL, AWS, GraphQL',
      summary:
        'Full-stack engineer with 6 years building customer-facing web apps. Strong in TypeScript and React; led two billing rewrites.',
    },
    lists: {
      experience: [
        {
          company: 'Northwind Trading',
          role: 'Senior Software Engineer',
          dates: '2022 – present',
          highlights: 'Led the billing rewrite; cut checkout errors 40% and shaved 300ms off p95 latency.',
        },
        {
          company: 'Acme Cloud',
          role: 'Software Engineer',
          dates: '2019 – 2022',
          highlights: 'Built the customer dashboard used by 30k teams; owned the notifications service.',
        },
      ],
      education: [{ school: 'UC Berkeley', degree: 'B.S. Computer Science', year: '2019' }],
    },
  },
};

export const LOAN_SPEC: IntakeSpec = {
  slug: 'loan',
  eyebrow: 'flowgent demo · mortgage application',
  name: 'Mortgage application',
  tagline:
    'Describe your situation and the home you want — the AI drafts a structured mortgage application. Confirm every number before it submits; the form is store-backed, so edits undo.',
  inputTitle: 'Describe your situation',
  inputHint: 'Your income and job, the property, and how much you need to borrow.',
  placeholder:
    'I make $145k/yr as a nurse at Mercy Hospital, 5 years there. Buying a $620k condo in Austin, putting 15% down. Need a 30-year fixed for the rest. I have a car loan at $380/mo.',
  aiSystem:
    'You extract a mortgage application. Return ONLY JSON, no prose and no code fences, matching exactly: {"fullName":"","email":"","annualIncome":"","employer":"","jobTitle":"","yearsEmployed":"","address":"","propertyType":"","purchasePrice":"","downPayment":"","loanAmount":"","loanType":"","termYears":"","debts":[{"name":"","monthly":""}]}. Keep the user\'s currency formatting.',
  submitLabel: 'Submit application',
  sections: [
    {
      key: 'borrower',
      title: 'Borrower & income',
      kind: 'fields',
      fields: [
        { key: 'fullName', label: 'Full name' },
        { key: 'email', label: 'Email' },
        { key: 'annualIncome', label: 'Annual income' },
        { key: 'employer', label: 'Employer' },
        { key: 'jobTitle', label: 'Job title' },
        { key: 'yearsEmployed', label: 'Years employed' },
      ],
    },
    {
      key: 'property',
      title: 'Property',
      kind: 'fields',
      fields: [
        { key: 'address', label: 'Property (address / area)', full: true },
        { key: 'propertyType', label: 'Type' },
        { key: 'purchasePrice', label: 'Purchase price' },
        { key: 'downPayment', label: 'Down payment' },
      ],
    },
    {
      key: 'loan',
      title: 'Loan',
      kind: 'fields',
      fields: [
        { key: 'loanAmount', label: 'Loan amount' },
        { key: 'loanType', label: 'Loan type' },
        { key: 'termYears', label: 'Term (years)' },
      ],
    },
    {
      key: 'debts',
      title: 'Other monthly debts',
      kind: 'list',
      addLabel: 'Add debt',
      fields: [
        { key: 'name', label: 'Debt' },
        { key: 'monthly', label: 'Monthly payment' },
      ],
    },
  ],
  doneSummary: (d) =>
    `${d.fields.fullName || 'Applicant'} · ${d.fields.loanType || 'loan'} · ${d.fields.loanAmount || ''}`,
  sample: {
    fields: {
      fullName: 'Sam Okafor',
      email: 'sam.okafor@email.com',
      annualIncome: '$145,000',
      employer: 'Mercy Hospital',
      jobTitle: 'Registered Nurse',
      yearsEmployed: '5',
      address: 'Austin, TX — 2BR condo',
      propertyType: 'Condo',
      purchasePrice: '$620,000',
      downPayment: '$93,000 (15%)',
      loanAmount: '$527,000',
      loanType: '30-year fixed',
      termYears: '30',
    },
    lists: { debts: [{ name: 'Auto loan', monthly: '$380' }] },
  },
};

export const INTAKE_SPECS: IntakeSpec[] = [RESUME_SPEC, LOAN_SPEC];
export function intakeSpecBySlug(slug: string): IntakeSpec {
  return INTAKE_SPECS.find((s) => s.slug === slug) ?? RESUME_SPEC;
}

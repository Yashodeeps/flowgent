// Wizard intake specs — the MOAT: guided, multi-step, structured Q&A that
// maintains state. One focused question per step; the user answers naturally;
// AI structures THAT step's answer into fields the user confirms; the confirmed
// record accumulates across steps. NOT one-shot extraction.

export interface WField {
  key: string;
  label: string;
  type?: 'text' | 'textarea';
  full?: boolean;
}
export interface WStep {
  key: string;
  groupLabel: string; // shown in the running "your application" panel
  question: string;
  hint: string;
  placeholder: string;
  kind: 'fields' | 'list';
  fields: WField[]; // 'fields': fields to extract; 'list': sub-fields per item
  addLabel?: string; // 'list' only
  aiSystem: string; // extraction prompt for THIS step (returns JSON)
  sample: Record<string, string> | Array<Record<string, string>>; // mock extraction
}
export interface WizardSpec {
  slug: string;
  eyebrow: string;
  name: string;
  tagline: string;
  steps: WStep[];
  submitLabel: string;
  doneTitle: string;
}

export const MORTGAGE_WIZARD: WizardSpec = {
  slug: 'loan',
  eyebrow: 'flowgent demo · mortgage application',
  name: 'Mortgage application',
  tagline:
    'A guided application. Answer each question in plain language; the AI structures your answer into fields you confirm before moving on. The application builds up step by step — and the whole thing is store-backed, so you can go back and undo.',
  submitLabel: 'Submit application',
  doneTitle: 'Application submitted',
  steps: [
    {
      key: 'income',
      groupLabel: 'Income & employment',
      question: "What's your annual income, and where do you work?",
      hint: 'Include your role and how long you’ve been there.',
      placeholder: 'I make $145k/yr as a nurse at Mercy Hospital, been there 5 years.',
      kind: 'fields',
      fields: [
        { key: 'annualIncome', label: 'Annual income' },
        { key: 'employer', label: 'Employer' },
        { key: 'jobTitle', label: 'Job title' },
        { key: 'yearsEmployed', label: 'Years employed' },
      ],
      aiSystem:
        'Extract the borrower\'s income and employment from their answer. Return ONLY JSON, no prose or fences: {"annualIncome":"","employer":"","jobTitle":"","yearsEmployed":""}. Keep the user\'s currency formatting.',
      sample: { annualIncome: '$145,000', employer: 'Mercy Hospital', jobTitle: 'Registered Nurse', yearsEmployed: '5' },
    },
    {
      key: 'property',
      groupLabel: 'Property',
      question: 'What home are you buying?',
      hint: 'Price, type, and where it is.',
      placeholder: 'A $620k 2-bedroom condo in Austin, TX.',
      kind: 'fields',
      fields: [
        { key: 'purchasePrice', label: 'Purchase price' },
        { key: 'propertyType', label: 'Property type' },
        { key: 'address', label: 'Location', full: true },
      ],
      aiSystem:
        'Extract the property details from their answer. Return ONLY JSON: {"purchasePrice":"","propertyType":"","address":""}. Keep currency formatting.',
      sample: { purchasePrice: '$620,000', propertyType: 'Condo (2BR)', address: 'Austin, TX' },
    },
    {
      key: 'loan',
      groupLabel: 'Loan',
      question: 'How much are you putting down, and what loan do you want?',
      hint: 'Down payment and the loan type/term.',
      placeholder: 'Putting 15% down, want a 30-year fixed for the rest.',
      kind: 'fields',
      fields: [
        { key: 'downPayment', label: 'Down payment' },
        { key: 'loanType', label: 'Loan type' },
        { key: 'termYears', label: 'Term (years)' },
        { key: 'loanAmount', label: 'Loan amount' },
      ],
      aiSystem:
        'Extract the loan terms from their answer. Return ONLY JSON: {"downPayment":"","loanType":"","termYears":"","loanAmount":""}. If the loan amount is implied (price minus down payment), compute it. Keep currency formatting.',
      sample: { downPayment: '$93,000 (15%)', loanType: '30-year fixed', termYears: '30', loanAmount: '$527,000' },
    },
    {
      key: 'debts',
      groupLabel: 'Other monthly debts',
      question: 'Any other monthly debts?',
      hint: 'List each — the AI separates them into individual entries.',
      placeholder: 'Car loan $380/mo and a student loan around $210 a month.',
      kind: 'list',
      addLabel: 'Add a debt',
      fields: [
        { key: 'name', label: 'Debt' },
        { key: 'monthly', label: 'Monthly payment' },
      ],
      aiSystem:
        'Extract each monthly debt from their answer. Return ONLY JSON: {"debts":[{"name":"","monthly":""}]}. Keep currency formatting.',
      sample: [
        { name: 'Auto loan', monthly: '$380' },
        { name: 'Student loan', monthly: '$210' },
      ],
    },
  ],
};

export const RESUME_WIZARD: WizardSpec = {
  slug: 'resume',
  eyebrow: 'flowgent demo · job application',
  name: 'Job application',
  tagline:
    'A guided application. Answer each question in plain language; the AI structures your answer into entries you confirm before moving on. Your profile builds up step by step — store-backed, so you can go back and undo.',
  submitLabel: 'Submit application',
  doneTitle: 'Application submitted',
  steps: [
    {
      key: 'contact',
      groupLabel: 'Contact',
      question: "Let's start with the basics — who are you?",
      hint: 'Name, email, phone, and where you’re based.',
      placeholder: 'Maya Chen, maya.chen@gmail.com, 415-555-0188, San Francisco CA',
      kind: 'fields',
      fields: [
        { key: 'fullName', label: 'Full name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'location', label: 'Location', full: true },
      ],
      aiSystem:
        'Extract the applicant\'s contact details from their answer. Return ONLY JSON, no prose or fences: {"fullName":"","email":"","phone":"","location":""}.',
      sample: { fullName: 'Maya Chen', email: 'maya.chen@gmail.com', phone: '(415) 555-0188', location: 'San Francisco, CA' },
    },
    {
      key: 'experience',
      groupLabel: 'Work experience',
      question: 'Walk me through your recent roles.',
      hint: 'Each job — title, company, dates. The AI separates them into entries.',
      placeholder: 'Senior designer at Lumen 2021–now; before that, product designer at Orbit 2018–2021.',
      kind: 'list',
      addLabel: 'Add a role',
      fields: [
        { key: 'role', label: 'Title' },
        { key: 'company', label: 'Company' },
        { key: 'dates', label: 'Dates' },
      ],
      aiSystem:
        'Extract each job from their answer, most recent first. Return ONLY JSON: {"experience":[{"role":"","company":"","dates":""}]}.',
      sample: [
        { role: 'Senior Product Designer', company: 'Lumen', dates: '2021–Present' },
        { role: 'Product Designer', company: 'Orbit', dates: '2018–2021' },
      ],
    },
    {
      key: 'skills',
      groupLabel: 'Skills',
      question: 'What are your top skills?',
      hint: 'List them — the AI separates them into individual tags.',
      placeholder: 'Figma, design systems, user research, prototyping, a bit of React.',
      kind: 'list',
      addLabel: 'Add a skill',
      fields: [{ key: 'name', label: 'Skill' }],
      aiSystem: 'Extract each distinct skill from their answer. Return ONLY JSON: {"skills":[{"name":""}]}.',
      sample: [
        { name: 'Figma' },
        { name: 'Design systems' },
        { name: 'User research' },
        { name: 'Prototyping' },
        { name: 'React' },
      ],
    },
    {
      key: 'education',
      groupLabel: 'Education',
      question: 'And your education?',
      hint: 'Each degree or credential — the AI separates them into entries.',
      placeholder: 'BFA in Graphic Design from RISD, 2016. Plus a UX certificate from Google.',
      kind: 'list',
      addLabel: 'Add education',
      fields: [
        { key: 'credential', label: 'Degree / credential' },
        { key: 'school', label: 'School' },
        { key: 'year', label: 'Year' },
      ],
      aiSystem:
        'Extract each education entry from their answer. Return ONLY JSON: {"education":[{"credential":"","school":"","year":""}]}.',
      sample: [
        { credential: 'BFA, Graphic Design', school: 'RISD', year: '2016' },
        { credential: 'UX Design Certificate', school: 'Google', year: '2020' },
      ],
    },
  ],
};

export const WIZARD_SPECS: WizardSpec[] = [MORTGAGE_WIZARD, RESUME_WIZARD];
export function wizardSpecBySlug(slug: string): WizardSpec {
  return WIZARD_SPECS.find((s) => s.slug === slug) ?? MORTGAGE_WIZARD;
}

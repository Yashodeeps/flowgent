import WizardIntake from '../../components/WizardIntake';

export default async function ResumePage({
  searchParams,
}: {
  searchParams: Promise<{ mock?: string }>;
}) {
  const sp = await searchParams;
  return <WizardIntake slug="resume" mock={sp.mock !== undefined} />;
}

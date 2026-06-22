import WizardIntake from '../../components/WizardIntake';

export default async function LoanPage({
  searchParams,
}: {
  searchParams: Promise<{ mock?: string }>;
}) {
  const sp = await searchParams;
  return <WizardIntake slug="loan" mock={sp.mock !== undefined} />;
}

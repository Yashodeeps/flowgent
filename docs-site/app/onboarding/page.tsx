import WizardDemo from '../../components/WizardDemo';

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ mock?: string }>;
}) {
  const sp = await searchParams;
  return <WizardDemo slug="onboarding" mock={sp.mock !== undefined} />;
}

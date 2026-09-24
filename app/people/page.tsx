import { PeopleExperience } from "@/components/PeopleExperience";

export const dynamic = "force-dynamic";

export default function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string; q?: string; filter?: string }>;
}) {
  return <PeopleExperience view="directory" searchParams={searchParams} />;
}

import { PeopleExperience } from "@/components/PeopleExperience";

export const dynamic = "force-dynamic";

export default function AddPersonPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  return <PeopleExperience view="create" searchParams={searchParams} />;
}

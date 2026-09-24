import { PeopleExperience } from "@/components/PeopleExperience";

export const dynamic = "force-dynamic";

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; error?: string; activation_link?: string; tab?: string }>;
}) {
  const { id } = await params;
  return <PeopleExperience view="record" employeeId={id} searchParams={searchParams} />;
}

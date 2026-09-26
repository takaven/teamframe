import { redirect } from "next/navigation";

export default async function EmployeesCompatibilityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { employee, tab, ...rest } = params;
  const query = new URLSearchParams(
    Object.entries(rest).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  ).toString();
  const tabMap: Record<string, string> = {
    employment: "employment", personal: "personal", emergency: "personal",
    documents: "documents", compensation: "compensation-payment", payment: "compensation-payment",
    account: "onboarding-offboarding",
  };
  const hash = tab ? `#${tabMap[tab] ?? "overview"}` : "";
  const destination = employee ? `/people/${encodeURIComponent(employee)}` : "/people";
  redirect(`${destination}${query ? `?${query}` : ""}${hash}`);
}

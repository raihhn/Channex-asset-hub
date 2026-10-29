import { notFound, redirect } from "next/navigation";
import { AdminScreen } from "@/features/admin/admin-screen";
import { administrationData } from "@/lib/fixtures/administration-data";
export default async function AdminSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (section === "user-mapping") redirect("/admin/users");
  if (!administrationData[section] && section !== "users" && section !== "audit") notFound();
  return <AdminScreen section={section} />;
}

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { AppShell } from "@/components/layout/app-shell";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login");
  }
  return <AppShell session={session}>{children}</AppShell>;
}

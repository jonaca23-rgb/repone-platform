import { requireModule } from "@/lib/auth/userModules";
import { OperatorShell } from "@/components/shells/OperatorShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireModule("producer");

  return (
    <OperatorShell module="producer" moduleLabel="Production">
      {children}
    </OperatorShell>
  );
}

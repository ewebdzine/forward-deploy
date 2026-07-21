import Link from "next/link";
import { requireRole } from "@/lib/access";

export const metadata = { title: "Admin - Forward Deploy" };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("developer", "admin");

  return (
    <main>
      <h1>Admin</h1>
      <p className="muted">
        <Link href="/admin/departments">Departments</Link>
        {" - "}
        <Link href="/admin/users">Users</Link>
        {" - "}
        <Link href="/admin/billing">Billing</Link>
      </p>
      {children}
    </main>
  );
}

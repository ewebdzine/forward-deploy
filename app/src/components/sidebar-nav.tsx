"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const WORKSPACE = [
  { href: "/", label: "Dashboard", exact: true },
  { href: "/sops", label: "SOPs" },
  { href: "/plans", label: "Plans" },
  { href: "/software", label: "Software" },
  { href: "/repo", label: "Repository" },
];

const ADMIN = [
  { href: "/admin/departments", label: "Departments" },
  { href: "/admin/users", label: "Users" },
];

export default function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  function cls(href: string, exact?: boolean) {
    const active = exact ? pathname === href : pathname.startsWith(href);
    return active ? "active" : undefined;
  }

  return (
    <nav>
      <span className="nav-label">Workspace</span>
      {WORKSPACE.map((l) => (
        <Link key={l.href} href={l.href} className={cls(l.href, l.exact)}>
          {l.label}
        </Link>
      ))}
      {isAdmin && (
        <>
          <span className="nav-label">Manage</span>
          {ADMIN.map((l) => (
            <Link key={l.href} href={l.href} className={cls(l.href)}>
              {l.label}
            </Link>
          ))}
        </>
      )}
    </nav>
  );
}

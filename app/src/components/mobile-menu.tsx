"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_LINKS, WORKSPACE_LINKS } from "./sidebar-nav";

/**
 * Mobile navigation: a hamburger in the top bar that opens a full-screen
 * overlay with large, scrollable menu items. Hidden on desktop via CSS.
 */
export default function MobileMenu({
  isAdmin,
  children,
}: {
  isAdmin: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const cls = (href: string, exact?: boolean) => {
    const active = exact ? pathname === href : pathname.startsWith(href);
    return active ? "active" : undefined;
  };

  return (
    <>
      <button
        type="button"
        className="hamburger"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>

      {open && (
        <div className="mobile-overlay">
          <div className="mobile-overlay-head">
            <span className="brand">Forward Deploy</span>
            <button
              type="button"
              className="hamburger"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>
          <nav>
            <span className="nav-label">Workspace</span>
            {WORKSPACE_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cls(l.href, l.exact)}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            {isAdmin && (
              <>
                <span className="nav-label">Manage</span>
                {ADMIN_LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={cls(l.href)}
                    onClick={() => setOpen(false)}
                  >
                    {l.label}
                  </Link>
                ))}
              </>
            )}
          </nav>
          {children && <div className="mobile-overlay-user">{children}</div>}
        </div>
      )}
    </>
  );
}

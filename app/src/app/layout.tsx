import type { Metadata } from "next";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Forward Deploy",
  description:
    "Forward-deployed planning for every department - the developer's context, in the manager's hands.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/signin" });
  }

  return (
    <html lang="en">
      <body>
        {session?.user ? (
          <header className="topbar">
            <Link href="/" className="brand">
              Forward Deploy
            </Link>
            <nav>
              <Link href="/sops">SOPs</Link>
              <Link href="/repo">Repo</Link>
              {session.user.role === "admin" && <Link href="/admin">Admin</Link>}
            </nav>
            <div className="topbar-user">
              <span className="muted">
                {session.user.name ?? session.user.email}{" "}
                <span className="role-chip">{session.user.role}</span>
              </span>
              <form action={doSignOut}>
                <button type="submit" className="link-button">
                  Sign out
                </button>
              </form>
            </div>
          </header>
        ) : null}
        {children}
      </body>
    </html>
  );
}

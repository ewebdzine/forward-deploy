import type { Metadata } from "next";
import { auth, isDeveloperRole, signOut } from "@/auth";
import SidebarNav from "@/components/sidebar-nav";
import MobileMenu from "@/components/mobile-menu";
import ThemeToggle from "@/components/theme-toggle";
import "./globals.css";

// Applies a stored explicit theme before first paint (no flash).
const THEME_SCRIPT = `try{var t=localStorage.getItem("fd-theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

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

  if (!session?.user) {
    return (
      <html lang="en">
        <head>
          <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        </head>
        <body>{children}</body>
      </html>
    );
  }

  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <div className="shell">
          <aside className="sidebar">
            <a className="brand" href="/">
              Forward Deploy
            </a>
            <MobileMenu isAdmin={isDeveloperRole(session.user.role)}>
              <span>
                {session.user.name ?? session.user.email}{" "}
                <span className="role-chip">{session.user.role}</span>
              </span>
              <ThemeToggle />
              <form action={doSignOut}>
                <button type="submit" className="link-button">
                  Sign out
                </button>
              </form>
            </MobileMenu>
            <SidebarNav isAdmin={isDeveloperRole(session.user.role)} />
            <div className="sidebar-user">
              <span>
                {session.user.name ?? session.user.email}{" "}
                <span className="role-chip">{session.user.role}</span>
              </span>
              <ThemeToggle />
              <form action={doSignOut}>
                <button type="submit" className="link-button">
                  Sign out
                </button>
              </form>
            </div>
          </aside>
          <div className="content">{children}</div>
        </div>
      </body>
    </html>
  );
}

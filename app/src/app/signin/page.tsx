import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export const metadata = { title: "Sign in - Forward Deploy" };

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  async function sendMagicLink(formData: FormData) {
    "use server";
    await signIn("nodemailer", {
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      redirectTo: "/",
    });
  }

  return (
    <main className="auth-shell">
      <div className="card auth-card">
        <h1>Forward Deploy</h1>
        <p className="muted">
          Enter your work email and we&apos;ll send you a sign-in link. Access is
          by invitation - ask your admin if your email isn&apos;t recognized.
        </p>
        <form action={sendMagicLink} className="stack">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
          />
          <button type="submit">Send magic link</button>
        </form>
      </div>
    </main>
  );
}

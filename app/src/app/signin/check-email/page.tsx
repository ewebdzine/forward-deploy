export const metadata = { title: "Check your email - Forward Deploy" };

export default function CheckEmailPage() {
  return (
    <main className="auth-shell">
      <div className="card auth-card">
        <h1>Check your email</h1>
        <p className="muted">
          If that address is invited, a sign-in link is on its way. It expires
          in 24 hours - open it on this device.
        </p>
      </div>
    </main>
  );
}

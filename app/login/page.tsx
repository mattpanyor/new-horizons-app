import LoginScreen from "@/components/LoginScreen";

// Deliberately not force-dynamic. This page reads nothing per-request — the
// planet behind the form is mounted once in the root layout so it survives the
// navigation to /sectors — and it was the app's cold-entry page, prerendered on
// main until a `force-dynamic` added here made it render per request. The
// layout's settings read is cached and tagged, so a prerender picks up an
// admin's theme change through revalidation rather than needing a deploy.

export default function LoginPage() {
  return <LoginScreen />;
}

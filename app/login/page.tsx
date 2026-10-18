import LoginScreen from "@/components/LoginScreen";

// Rendered per request so the planet behind the form follows the admin's theme.
// Prerendered, it never did: saving a theme calls revalidateTag, which refreshes
// the cached settings read but did not replace the prerender on Vercel — /login
// kept serving the build-time theme until the next deploy. The read is still
// cached, so this costs a render, not a database round trip.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginScreen />;
}

import LoginScreen from "@/components/LoginScreen";

// The planet behind the form is mounted once in the root layout, so it survives
// the navigation to /sectors instead of being rebuilt there.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginScreen />;
}

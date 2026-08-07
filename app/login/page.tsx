import { getHomeScreenArt } from "@/lib/settings/service";
import LoginScreen from "@/components/LoginScreen";

// The form itself is a client component; this exists so the home screen art
// setting can be read on the server and be present in the first paint.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  return <LoginScreen homeArt={await getHomeScreenArt()} />;
}

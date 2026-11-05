import App from "@/components/App";
import AuthScreen from "@/components/AuthScreen";
import { currentUser, hasUnclaimedData, signupOpen, userCount } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** No accounts yet → create the admin. Signed out → sign in. Otherwise the app. */
export default async function Home() {
  if (userCount() === 0) return <AuthScreen mode="setup" hasData={hasUnclaimedData()} />;
  const me = await currentUser();
  if (!me) return <AuthScreen mode="login" signupOpen={signupOpen()} />;
  return <App />;
}

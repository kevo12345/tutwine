import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

const SUPABASE_HOST = "erhmkxbcubdopxbryetm.supabase.co";

const isCustomDomain = () =>
  !window.location.hostname.includes("lovable.app") &&
  !window.location.hostname.includes("lovableproject.com") &&
  !window.location.hostname.includes("localhost");

const ALLOWED_OAUTH_HOSTS = [
  "accounts.google.com",
  "appleid.apple.com",
  SUPABASE_HOST,
];

export async function signInWithProvider(provider: "google" | "apple") {
  if (isCustomDomain()) {
    // Bypass Lovable auth-bridge on custom domains
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
        skipBrowserRedirect: true,
      },
    });

    if (error) return { error };

    if (data?.url) {
      const oauthUrl = new URL(data.url);
      if (!ALLOWED_OAUTH_HOSTS.some((h) => oauthUrl.hostname.includes(h))) {
        return { error: new Error("Invalid OAuth redirect URL") };
      }
      window.location.href = data.url;
    }

    return { error: null };
  }

  // Standard Lovable auth-bridge flow
  const { error } = await lovable.auth.signInWithOAuth(provider, {
    redirect_uri: window.location.origin,
  });
  return { error: error ?? null };
}

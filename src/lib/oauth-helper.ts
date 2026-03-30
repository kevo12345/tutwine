import { lovable } from "@/integrations/lovable/index";

export async function signInWithProvider(provider: "google" | "apple") {
  const { error } = await lovable.auth.signInWithOAuth(provider, {
    redirect_uri: window.location.origin,
  });
  return { error: error ?? null };
}

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useLocationPrompt() {
  const { user, refreshProfile } = useAuth();
  const [prompted, setPrompted] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);

  const updateLocation = useCallback(async (lat: number, lng: number) => {
    if (!user) return;
    // Round to 1 decimal for privacy (~11km precision)
    const latitude = Math.round(lat * 10) / 10;
    const longitude = Math.round(lng * 10) / 10;
    await supabase
      .from("profiles")
      .update({ latitude, longitude })
      .eq("user_id", user.id);
    setHasLocation(true);
    await refreshProfile();
    toast.success("Location updated — distances are now live!");
  }, [user]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => updateLocation(pos.coords.latitude, pos.coords.longitude),
      () => {}, // silently fail
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, [updateLocation]);

  useEffect(() => {
    if (!user || prompted) return;
    setPrompted(true);

    // Check if user already has location
    const check = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("latitude, longitude")
        .eq("user_id", user.id)
        .single();
      
      if (data?.latitude && data?.longitude) {
        setHasLocation(true);
        // Silently refresh location in background
        requestLocation();
      } else {
        // Will trigger browser permission prompt
        requestLocation();
      }
    };
    check();
  }, [user, prompted, requestLocation]);

  return { hasLocation, requestLocation };
}

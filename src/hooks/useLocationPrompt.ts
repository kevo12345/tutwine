import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { reverseGeocode } from "@/lib/reverseGeocode";


type LocationStatus = "idle" | "requesting" | "granted" | "denied" | "unavailable";

export function useLocationPrompt() {
  const { user, refreshProfile } = useAuth();
  const [prompted, setPrompted] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");

  const updateLocation = useCallback(async (lat: number, lng: number) => {
    if (!user) return;
    const latitude = Math.round(lat * 10) / 10;
    const longitude = Math.round(lng * 10) / 10;
    const place = await reverseGeocode(lat, lng);
    const update: Record<string, unknown> = { latitude, longitude };
    if (place) {
      if (place.country) update.country = place.country;
      if (place.state) update.state = place.state;
      if (place.city) update.city = place.city;
    }
    await supabase
      .from("profiles")
      .update(update as any)
      .eq("user_id", user.id);
    setHasLocation(true);
    setLocationStatus("granted");
    await refreshProfile();
    
  }, [user, refreshProfile]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus("unavailable");
      return;
      return;
    }

    setLocationStatus("requesting");

    // Check permission state first if available
    if (navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        if (result.state === "denied") {
          setLocationStatus("denied");
          return;
        }
        // prompt or granted — proceed
        navigator.geolocation.getCurrentPosition(
          (pos) => updateLocation(pos.coords.latitude, pos.coords.longitude),
          (err) => {
            if (err.code === err.PERMISSION_DENIED) {
              setLocationStatus("denied");
            } else {
              setLocationStatus("idle");
              setLocationStatus("idle");
            }
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
      }).catch(() => {
        // Fallback if permissions API fails
        navigator.geolocation.getCurrentPosition(
          (pos) => updateLocation(pos.coords.latitude, pos.coords.longitude),
          (err) => {
            if (err.code === err.PERMISSION_DENIED) {
              setLocationStatus("denied");
            } else {
              setLocationStatus("idle");
              setLocationStatus("idle");
            }
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
      });
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => updateLocation(pos.coords.latitude, pos.coords.longitude),
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setLocationStatus("denied");
          } else {
            setLocationStatus("idle");
            setLocationStatus("idle");
          }
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    }
  }, [updateLocation]);

  useEffect(() => {
    if (!user || prompted) return;
    setPrompted(true);

    const check = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("latitude, longitude")
        .eq("user_id", user.id)
        .single();
      
      if (data?.latitude && data?.longitude) {
        setHasLocation(true);
        setLocationStatus("granted");
        // Silently refresh in background
        navigator.geolocation?.getCurrentPosition(
          (pos) => updateLocation(pos.coords.latitude, pos.coords.longitude),
          () => {},
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
      }
    };
    check();
  }, [user, prompted, updateLocation]);

  return { hasLocation, requestLocation, locationStatus };
}
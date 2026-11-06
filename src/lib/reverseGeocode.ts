export type DetectedPlace = { country: string; state: string; city: string };

/** Turn device coordinates into country / region / city (free, no API key). */
export async function reverseGeocode(lat: number, lng: number): Promise<DetectedPlace | null> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
    );
    if (!res.ok) return null;
    const d = await res.json();
    return {
      country: d.countryName || d.countryCode || "",
      state: d.principalSubdivision || "",
      city: d.city || d.locality || "",
    };
  } catch {
    return null;
  }
}

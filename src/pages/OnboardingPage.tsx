import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Heart, Camera, MapPin, ArrowRight, ArrowLeft, Plus, X, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { GENDER_OPTIONS, INTEREST_TAGS } from "@/lib/constants";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const STEPS = ["Profile", "Photos", "Interests", "Location"];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, profile: existingProfile, refreshProfile } = useAuth();
  const isEditing = existingProfile?.onboarding_complete === true;
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute age from date_of_birth
  const existingAge = existingProfile?.date_of_birth
    ? String(Math.floor((Date.now() - new Date(existingProfile.date_of_birth).getTime()) / 31557600000))
    : "";

  const genderDisplayMap: Record<string, string> = { man: "Man", woman: "Woman", "non-binary": "Non-binary", other: "Other" };
  const existingGender = existingProfile?.gender ? genderDisplayMap[existingProfile.gender] ?? "" : "";
  const existingInterestedIn = existingProfile?.interested_in
    ? existingProfile.interested_in.length >= 4 ? "Everyone" : genderDisplayMap[existingProfile.interested_in[0]] ?? ""
    : "";

  const [profile, setProfile] = useState({
    displayName: existingProfile?.display_name ?? "",
    age: existingAge,
    gender: existingGender,
    interestedIn: existingInterestedIn,
    bio: existingProfile?.bio ?? "",
    phone: existingProfile?.phone ?? "",
    photos: (existingProfile?.photos as string[]) ?? [],
    interests: (existingProfile?.interests as string[]) ?? [],
    state: existingProfile?.state ?? "",
    city: existingProfile?.city ?? "",
  });

  const nextStep = async () => {
    if (step === 0 && (!profile.displayName || !profile.age || !profile.gender || !profile.phone)) {
      toast.error("Please fill in all required fields"); return;
    }
    if (step === 1 && profile.photos.length < 3) {
      toast.error("Please upload at least 3 photos"); return;
    }
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      // Save profile to database
      if (!user) return;
      setSaving(true);

      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - parseInt(profile.age));

      const genderMap: Record<string, string> = { "Man": "man", "Woman": "woman", "Non-binary": "non-binary", "Other": "other" };

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: profile.displayName,
          date_of_birth: dob.toISOString().split("T")[0],
          gender: genderMap[profile.gender] as any,
          interested_in: profile.interestedIn === "Everyone"
            ? ["man", "woman", "non-binary", "other"]
            : [genderMap[profile.interestedIn]].filter(Boolean) as any,
          bio: profile.bio,
          photos: profile.photos,
          phone: profile.phone,
          interests: profile.interests,
          state: profile.state,
          city: profile.city,
          onboarding_complete: true,
        })
        .eq("user_id", user.id);

      setSaving(false);
      if (error) { toast.error("Failed to save profile"); return; }
      await refreshProfile();
      toast.success(isEditing ? "Profile updated!" : "Profile complete! Start discovering.");
      navigate(isEditing ? "/profile" : "/discover");
    }
  };

  const toggleInterest = (tag: string) => {
    setProfile((p) => ({
      ...p,
      interests: p.interests.includes(tag)
        ? p.interests.filter((t) => t !== tag)
        : p.interests.length < 8 ? [...p.interests, tag] : p.interests,
    }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || profile.photos.length >= 6) return;

    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from("photos").upload(path, file);
    if (error) { toast.error("Upload failed"); return; }

    const { data: { publicUrl } } = supabase.storage.from("photos").getPublicUrl(path);
    setProfile((p) => ({ ...p, photos: [...p.photos, publicUrl] }));
    toast.success("Photo uploaded!");
  };

  const removePhoto = async (index: number) => {
    setProfile((p) => ({ ...p, photos: p.photos.filter((_, j) => j !== index) }));
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        // Round coordinates for privacy
        const lat = Math.round(pos.coords.latitude * 10) / 10;
        const lng = Math.round(pos.coords.longitude * 10) / 10;

        if (user) {
          await supabase.from("profiles").update({
            latitude: lat, longitude: lng,
          }).eq("user_id", user.id);
        }
        toast.success("Approximate location detected");
        setProfile((p) => ({ ...p, state: "Detected", city: "Detected" }));
      },
      () => toast.error("Location denied. Enter manually below.")
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-background p-4">
      <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handlePhotoUpload} />
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <button onClick={() => step > 0 ? setStep(step - 1) : navigate(isEditing ? "/profile" : "/signup")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex items-center gap-2">
            <img src="/logo.jpeg" alt="Tutwine" className="h-8 w-8 rounded-lg object-cover" />
            <span className="font-display font-bold">Tutwine</span>
          </div>
          <span className="text-sm text-muted-foreground">{step + 1}/{STEPS.length}</span>
        </div>

        {/* Progress */}
        <div className="mb-8 flex gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? "gradient-warm" : "bg-border"}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
            {step === 0 && (
              <div className="space-y-5">
                <div>
                  <h1 className="font-display text-2xl font-bold">About you</h1>
                  <p className="text-sm text-muted-foreground">Tell us the basics so we can find great matches.</p>
                </div>
                <div className="space-y-2">
                  <Label>Display name *</Label>
                  <Input placeholder="How others will see you" value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Age *</Label>
                  <Input type="number" min={18} max={80} placeholder="18+" value={profile.age} onChange={(e) => setProfile({ ...profile, age: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>I am *</Label>
                  <Select value={profile.gender} onValueChange={(v) => setProfile({ ...profile, gender: v })}>
                    <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Interested in</Label>
                  <Select value={profile.interestedIn} onValueChange={(v) => setProfile({ ...profile, interestedIn: v })}>
                    <SelectTrigger><SelectValue placeholder="Select preference" /></SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      <SelectItem value="Everyone">Everyone</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Bio</Label>
                  <Textarea placeholder="A few words about you..." value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} maxLength={300} rows={3} />
                  <p className="text-xs text-muted-foreground text-right">{profile.bio.length}/300</p>
                </div>
                <div className="space-y-2">
                  <Label>Phone number *</Label>
                  <Input type="tel" placeholder="+254 700 000000" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h1 className="font-display text-2xl font-bold">Add photos</h1>
                  <p className="text-sm text-muted-foreground">Add at least 3 photos (up to 6). First one is your main photo.</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="relative aspect-[3/4] overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted">
                      {profile.photos[i] ? (
                        <>
                          <img src={profile.photos[i]} alt="" className="h-full w-full object-cover" />
                          <button
                            onClick={() => removePhoto(i)}
                            className="absolute right-1 top-1 rounded-full bg-destructive p-1 text-destructive-foreground"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          {i === 0 && <Badge className="absolute bottom-1 left-1 text-[10px] gradient-warm border-0 text-primary-foreground">Main</Badge>}
                        </>
                      ) : (
                        <button onClick={() => fileInputRef.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground">
                          <Plus className="h-6 w-6" />
                          <span className="text-xs">Add</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h1 className="font-display text-2xl font-bold">Your interests</h1>
                  <p className="text-sm text-muted-foreground">Pick up to 8 interests to help us match you better.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_TAGS.map((tag) => {
                    const selected = profile.interests.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleInterest(tag)}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                          selected
                            ? "gradient-warm text-primary-foreground shadow-glow"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
                <p className="text-sm text-muted-foreground">{profile.interests.length}/8 selected</p>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h1 className="font-display text-2xl font-bold">Your location</h1>
                  <p className="text-sm text-muted-foreground">We'll show approximate distance to keep you safe.</p>
                </div>
                <Button variant="outline" className="w-full gap-2" onClick={requestLocation}>
                  <MapPin className="h-4 w-4" /> Use my approximate location
                </Button>
                <div className="relative flex items-center gap-4">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">or enter manually</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="space-y-2">
                  <Label>State / Region</Label>
                  <Input placeholder="e.g., Texas" value={profile.state} onChange={(e) => setProfile({ ...profile, state: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>City (optional)</Label>
                  <Input placeholder="e.g., Austin" value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} />
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <Button onClick={nextStep} className="mt-8 w-full gradient-warm border-0 text-primary-foreground shadow-glow" size="lg" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : step < STEPS.length - 1 ? <>Continue <ArrowRight className="ml-1 h-4 w-4" /></> : isEditing ? <>Save Changes <ArrowRight className="ml-1 h-4 w-4" /></> : <>Start Discovering <ArrowRight className="ml-1 h-4 w-4" /></>}
        </Button>
      </div>
    </div>
  );
}

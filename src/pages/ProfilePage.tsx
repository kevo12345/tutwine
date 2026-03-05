import { AppLayout } from "@/components/AppLayout";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Settings, Edit3, BadgeCheck, MapPin, Camera } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MOCK_PROFILES } from "@/lib/mock-data";

const myProfile = {
  ...MOCK_PROFILES[3],
  displayName: "You",
  bio: "Tech nerd who loves the outdoors 🏕️ Weekend warrior.",
  photos: [MOCK_PROFILES[3].photos[0]],
};

export default function ProfilePage() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="px-4 pt-4">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">Profile</h1>
          <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
            <Settings className="h-5 w-5" />
          </Button>
        </div>

        {/* Profile header */}
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <div className="rounded-full p-1 gradient-warm">
              <Avatar className="h-28 w-28 border-4 border-card">
                <AvatarImage src={myProfile.photos[0]} />
                <AvatarFallback>ME</AvatarFallback>
              </Avatar>
            </div>
            <button className="absolute bottom-0 right-0 rounded-full gradient-warm p-2 text-primary-foreground shadow-glow">
              <Camera className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <h2 className="font-display text-2xl font-bold">{myProfile.displayName}, {myProfile.age}</h2>
            <BadgeCheck className="h-5 w-5 text-info" />
          </div>
          <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span>{myProfile.city}, {myProfile.state}</span>
          </div>
          <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => navigate("/profile/edit")}>
            <Edit3 className="h-3.5 w-3.5" /> Edit Profile
          </Button>
        </div>

        {/* Bio */}
        <Card className="mt-6 border-0 shadow-card">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">About me</h3>
            <p className="text-sm">{myProfile.bio}</p>
          </CardContent>
        </Card>

        {/* Interests */}
        <Card className="mt-3 border-0 shadow-card">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Interests</h3>
            <div className="flex flex-wrap gap-1.5">
              {myProfile.interests.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Photos */}
        <Card className="mt-3 border-0 shadow-card">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Photos</h3>
            <div className="grid grid-cols-3 gap-2">
              {myProfile.photos.map((p, i) => (
                <div key={i} className="aspect-square overflow-hidden rounded-xl">
                  <img src={p} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
              <button className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-border text-muted-foreground hover:text-foreground">
                <Camera className="h-6 w-6" />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Subscription status */}
        <Card className="mt-3 border-0 shadow-card gradient-warm text-primary-foreground">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium opacity-90">Free Plan</p>
              <p className="text-xs opacity-70">Upgrade for more features</p>
            </div>
            <Button size="sm" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90" onClick={() => navigate("/pricing")}>
              Upgrade
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

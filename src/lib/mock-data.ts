export interface MockProfile {
  id: string;
  displayName: string;
  age: number;
  gender: string;
  bio: string;
  interests: string[];
  photos: string[];
  distance: number | null;
  city: string;
  state: string;
  verified: boolean;
  tier?: string;
  likesCount?: number;
}

export const MOCK_PROFILES: MockProfile[] = [
  {
    id: "1", displayName: "Sophia", age: 26, gender: "Woman",
    bio: "Adventurer at heart 🌍 Love hiking, good coffee, and deep conversations.",
    interests: ["Travel", "Hiking", "Coffee", "Photography"],
    photos: ["https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=600&fit=crop"],
    distance: 3, city: "Austin", state: "TX", verified: true,
  },
  {
    id: "2", displayName: "Marcus", age: 29, gender: "Man",
    bio: "Chef by day, musician by night 🎸 Let me cook you dinner.",
    interests: ["Cooking", "Music", "Wine", "Art"],
    photos: ["https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop"],
    distance: 8, city: "Austin", state: "TX", verified: false,
  },
  {
    id: "3", displayName: "Aisha", age: 24, gender: "Woman",
    bio: "Bookworm & yoga enthusiast 📚🧘‍♀️ Looking for someone to share quiet mornings.",
    interests: ["Reading", "Yoga", "Meditation", "Nature"],
    photos: ["https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=600&fit=crop"],
    distance: 12, city: "Round Rock", state: "TX", verified: true,
  },
  {
    id: "4", displayName: "Jake", age: 31, gender: "Man",
    bio: "Tech nerd who loves the outdoors 🏕️ Weekend warrior.",
    interests: ["Tech", "Hiking", "Gaming", "Fitness"],
    photos: ["https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=600&fit=crop"],
    distance: 5, city: "Austin", state: "TX", verified: true,
  },
  {
    id: "5", displayName: "Luna", age: 27, gender: "Non-binary",
    bio: "Artist & dreamer 🎨 Let's explore galleries and talk about the universe.",
    interests: ["Art", "Photography", "Music", "Coffee"],
    photos: ["https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=600&fit=crop"],
    distance: 15, city: "Cedar Park", state: "TX", verified: false,
  },
];

export interface MockMatch {
  id: string;
  profile: MockProfile;
  matchedAt: string;
  lastMessage?: string;
  unread: number;
}

export const MOCK_MATCHES: MockMatch[] = [
  {
    id: "m1", profile: MOCK_PROFILES[0], matchedAt: "2 hours ago",
    lastMessage: "Hey! Love your photos 😊", unread: 2,
  },
  {
    id: "m2", profile: MOCK_PROFILES[2], matchedAt: "1 day ago",
    lastMessage: "That hiking trail looks amazing!", unread: 0,
  },
  {
    id: "m3", profile: MOCK_PROFILES[4], matchedAt: "3 days ago",
    lastMessage: "Have you been to the new gallery downtown?", unread: 1,
  },
];

export interface MockMessage {
  id: string;
  senderId: string;
  content: string;
  type: "text" | "emoji" | "image";
  createdAt: string;
  read: boolean;
}

export const MOCK_MESSAGES: Record<string, MockMessage[]> = {
  m1: [
    { id: "msg1", senderId: "1", content: "Hey! I saw we both love hiking 🥾", type: "text", createdAt: "2:30 PM", read: true },
    { id: "msg2", senderId: "me", content: "Yes! Have you been to Barton Creek?", type: "text", createdAt: "2:32 PM", read: true },
    { id: "msg3", senderId: "1", content: "It's one of my favorites! We should go sometime", type: "text", createdAt: "2:35 PM", read: true },
    { id: "msg4", senderId: "1", content: "Hey! Love your photos 😊", type: "text", createdAt: "3:10 PM", read: false },
  ],
  m2: [
    { id: "msg5", senderId: "me", content: "Hi Aisha! Your book recommendations are great", type: "text", createdAt: "Yesterday", read: true },
    { id: "msg6", senderId: "3", content: "That hiking trail looks amazing!", type: "text", createdAt: "Yesterday", read: true },
  ],
  m3: [
    { id: "msg7", senderId: "5", content: "Have you been to the new gallery downtown?", type: "text", createdAt: "3 days ago", read: false },
  ],
};

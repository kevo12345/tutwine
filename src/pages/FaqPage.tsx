import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    category: "Getting Started",
    items: [
      {
        q: "What is Tutwine?",
        a: "Tutwine is a dating platform designed to help you meet genuine people nearby. Our smart matching algorithm considers compatibility factors like interests, location, and preferences to suggest meaningful connections.",
      },
      {
        q: "Is Tutwine free to use?",
        a: "Yes! You can create a profile, browse, and match for free. We also offer premium plans (Basic, Plus, and Pro) that unlock features like unlimited likes, boosts, read receipts, video chat, and more.",
      },
      {
        q: "How do I create an account?",
        a: "Tap 'Get Started' on the landing page, then sign up with your email or use Google/Apple sign-in. You'll be guided through a quick onboarding to set up your profile with photos, bio, and interests.",
      },
      {
        q: "What age do I need to be?",
        a: "You must be at least 18 years old to use Tutwine. We take this seriously and may request age verification.",
      },
    ],
  },
  {
    category: "Profile & Matching",
    items: [
      {
        q: "How does matching work?",
        a: "When you like someone and they like you back, it's a match! You'll both be notified and can start chatting immediately. Our discovery feed shows you profiles based on your preferences and location.",
      },
      {
        q: "Can I edit my profile later?",
        a: "Absolutely. Go to your Profile page and tap 'Edit Profile' to update your photos, bio, interests, and preferences at any time.",
      },
      {
        q: "What happens when I pass on someone?",
        a: "If you pass, that person won't appear in your discovery feed again (unless profiles are recycled when you've seen everyone). They won't know you passed.",
      },
      {
        q: "Can I see who liked me?",
        a: "Pro subscribers can see who liked them in the 'Likes' tab. Free and Basic users will see that someone liked them but the profile details may be limited.",
      },
      {
        q: "How does 'Go Live' work?",
        a: "Hosting a live is free — from the Live tab, tap Go Live to start streaming. Viewers pay $1/hr (1 token per hour) to join, and if they don't have enough tokens they'll be prompted to top up. Your live ends automatically when the host stops or paid viewer time runs out.",
      },

    ],
  },
  {
    category: "Safety & Privacy",
    items: [
      {
        q: "Is my information safe?",
        a: "We take your privacy seriously. Your data is encrypted, and we never share your personal information with other users without your consent. See our Privacy Policy for full details.",
      },
      {
        q: "How do I report someone?",
        a: "If someone is behaving inappropriately, you can report them directly from their profile or chat. Our trust & safety team reviews all reports and takes action within 24 hours.",
      },
      {
        q: "Can I block a user?",
        a: "Yes. You can block any user from their profile. Blocked users cannot see your profile, send you messages, or interact with you in any way.",
      },
      {
        q: "Does Tutwine share my exact location?",
        a: "No. We only show approximate distance (e.g. '5 km away') to other users. Your exact coordinates are never revealed. You can also hide your distance in Settings.",
      },
      {
        q: "How is photo verification done?",
        a: "Verified profiles have a blue checkmark. Verification helps ensure you're talking to real people. We may use selfie verification to confirm your identity matches your profile photos.",
      },
    ],
  },
  {
    category: "Subscriptions & Payments",
    items: [
      {
        q: "What are the premium plans?",
        a: "We offer three tiers: Basic (enhanced daily limits, ad-free), Plus (unlimited views, weekly boost, advanced filters), and Pro (all features including video chat, read receipts, see who liked you, and Super Like).",
      },
      {
        q: "How do I subscribe?",
        a: "Go to the Pricing page from your profile or the main menu. Choose your preferred plan and complete payment via M-Pesa or other supported methods.",
      },
      {
        q: "Can I cancel my subscription?",
        a: "Yes, you can cancel anytime. Your premium features will remain active until the end of your current billing period. No refunds are given for partial periods.",
      },
      {
        q: "What payment methods are accepted?",
        a: "We currently support M-Pesa (Safaricom) for payments in Kenya. More payment methods may be added in the future.",
      },
    ],
  },
  {
    category: "Chat & Communication",
    items: [
      {
        q: "Who can I message?",
        a: "You can message anyone you've matched with. Premium users (Plus and Pro) have access to messaging features. Free users can upgrade to unlock chat.",
      },
      {
        q: "Are my messages private?",
        a: "Yes. Messages are only visible to you and your match. We do not read or share your conversations. However, we may review reported messages for safety purposes.",
      },
      {
        q: "Is video calling available?",
        a: "Video calling is available for Pro subscribers. It's a great way to get to know someone before meeting in person, all within the safety of the app.",
      },
    ],
  },
  {
    category: "Account Management",
    items: [
      {
        q: "How do I delete my account?",
        a: "Go to Settings and select 'Delete Account'. This will permanently remove your profile, matches, and messages. This action cannot be undone.",
      },
      {
        q: "I forgot my password. What do I do?",
        a: "On the login page, tap 'Forgot Password'. Enter your email and we'll send you a link to reset your password.",
      },
      {
        q: "Can I temporarily hide my profile?",
        a: "This feature is coming soon. In the meantime, you can adjust your discovery preferences in Settings to limit who sees your profile.",
      },
    ],
  },
];

export default function FaqPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-lg font-bold">FAQs</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <p className="text-sm text-muted-foreground">
          Find answers to the most common questions about Tutwine. Can't find what you're looking for?{" "}
          <button onClick={() => navigate("/support")} className="text-primary hover:underline font-medium">
            Contact Support
          </button>
        </p>

        {faqs.map((section) => (
          <div key={section.category}>
            <h2 className="font-display text-base font-semibold text-foreground mb-3">{section.category}</h2>
            <Accordion type="single" collapsible className="space-y-1">
              {section.items.map((item, i) => (
                <AccordionItem key={i} value={`${section.category}-${i}`} className="border rounded-xl px-4 border-border/50">
                  <AccordionTrigger className="text-sm font-medium text-left py-3 hover:no-underline">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground pb-4 leading-relaxed">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ))}
      </main>
    </div>
  );
}

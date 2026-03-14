import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function TermsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-lg font-bold">Terms & Conditions</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8 text-sm text-foreground/80 leading-relaxed">
        <section>
          <p className="text-muted-foreground text-xs mb-6">Last updated: March 14, 2026</p>
          <p>
            Welcome to Tutwine. These Terms and Conditions ("Terms") govern your access to and use of the Tutwine
            dating platform, including our website, mobile application, and all related services (collectively, the "Service").
            By creating an account or using the Service, you agree to be bound by these Terms.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-foreground mb-3">1. Eligibility</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>You must be at least <strong>18 years of age</strong> to create an account and use the Service.</li>
            <li>By using Tutwine, you represent and warrant that you are of legal age to form a binding contract and are not prohibited from using the Service under applicable law.</li>
            <li>We reserve the right to request proof of age and to suspend or terminate accounts that do not meet this requirement.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-foreground mb-3">2. Account Registration</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>You agree to provide accurate, current, and complete information during registration.</li>
            <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
            <li>You may not create more than one account or transfer your account to another person.</li>
            <li>You are solely responsible for all activity that occurs under your account.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-foreground mb-3">3. User Conduct</h2>
          <p className="mb-2">You agree that you will NOT:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Use the Service for any unlawful purpose or in violation of any applicable laws.</li>
            <li>Harass, threaten, stalk, intimidate, or abuse any other user.</li>
            <li>Post or share content that is defamatory, obscene, pornographic, violent, or promotes hate or discrimination.</li>
            <li>Impersonate any person or entity, or misrepresent your identity, age, or affiliation.</li>
            <li>Use the Service for commercial solicitation, spam, or advertising without prior written consent.</li>
            <li>Attempt to gain unauthorized access to other users' accounts or the Service's systems.</li>
            <li>Use bots, scrapers, or automated tools to interact with the Service.</li>
            <li>Share another user's personal information without their explicit consent.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-foreground mb-3">4. Content & Photos</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>You retain ownership of the content you submit but grant Tutwine a non-exclusive, worldwide, royalty-free licence to use, display, and distribute your content in connection with the Service.</li>
            <li>All photos must be of you. Group photos, celebrity images, and misleading photos are prohibited.</li>
            <li>We reserve the right to remove any content that violates these Terms without notice.</li>
            <li>You must not upload content that infringes any third party's intellectual property rights.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-foreground mb-3">5. Safety & Interactions</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Tutwine is not responsible for the conduct of any user, whether online or offline.</li>
            <li>You agree to exercise caution and good judgement when interacting with other users, especially when meeting in person.</li>
            <li>We strongly recommend meeting in public places and informing a trusted person of your plans.</li>
            <li>Report any suspicious, abusive, or harmful behaviour to our support team immediately.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-foreground mb-3">6. Subscriptions & Payments</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Tutwine offers free and premium subscription tiers with varying features.</li>
            <li>Premium subscriptions are billed in advance on a recurring basis (monthly) unless cancelled.</li>
            <li>You may cancel your subscription at any time; cancellation takes effect at the end of the current billing period.</li>
            <li>Refunds are provided at Tutwine's sole discretion and in accordance with applicable law.</li>
            <li>Prices are subject to change with reasonable notice.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-foreground mb-3">7. Privacy</h2>
          <p>
            Your privacy is important to us. Our collection and use of personal information is governed by our Privacy Policy,
            which is incorporated into these Terms by reference. By using the Service, you consent to the collection and use
            of your information as described therein.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-foreground mb-3">8. Termination</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>We may suspend or terminate your account at any time, with or without cause or notice, if we believe you have violated these Terms.</li>
            <li>You may delete your account at any time through the Settings page.</li>
            <li>Upon termination, your right to use the Service ceases immediately, and we may delete your profile and data.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-foreground mb-3">9. Disclaimers</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>The Service is provided "as is" and "as available" without warranties of any kind, express or implied.</li>
            <li>Tutwine does not guarantee matches, compatibility, or the accuracy of user profiles.</li>
            <li>We do not conduct criminal background checks on users.</li>
            <li>We are not responsible for any damages arising from your interactions with other users.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-foreground mb-3">10. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Tutwine and its affiliates, officers, employees, and agents shall not be
            liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, data,
            or goodwill arising from your use of the Service.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-foreground mb-3">11. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of Kenya, without regard to conflict
            of law provisions. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the
            courts of Kenya.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-foreground mb-3">12. Changes to Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. We will notify users of material changes via email or
            in-app notification. Your continued use of the Service after changes take effect constitutes acceptance of the
            revised Terms.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-foreground mb-3">13. Contact Us</h2>
          <p>
            If you have any questions about these Terms, please contact us through the in-app Support page or email us at{" "}
            <a href="mailto:support@tutwine.com" className="text-primary hover:underline">support@tutwine.com</a>.
          </p>
        </section>
      </main>
    </div>
  );
}

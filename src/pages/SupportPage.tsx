import { ArrowLeft, Mail, MessageCircle, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/AppLayout";

const supportOptions = [
  { icon: MessageCircle, title: "Live Chat", description: "Chat with our support team in real-time", action: "Start Chat" },
  { icon: Mail, title: "Email Us", description: "Send us an email at support@tutwine.com", action: "Send Email" },
  { icon: FileText, title: "FAQs", description: "Browse frequently asked questions", action: "View FAQs" },
];

export default function SupportPage() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="mx-auto max-w-lg px-4 pb-24">
        <div className="flex items-center gap-3 py-4">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-2xl font-bold">Support</h1>
        </div>

        <p className="mb-6 text-muted-foreground">
          Need help? We're here for you. Choose how you'd like to reach us.
        </p>

        <div className="space-y-4">
          {supportOptions.map((option) => (
            <Card key={option.title} className="border-0 shadow-card">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-2 text-primary">
                    <option.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="font-display text-lg">{option.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-muted-foreground">{option.description}</p>
                <Button variant="outline" size="sm" className="w-full">
                  {option.action}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

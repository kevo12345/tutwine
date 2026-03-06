
-- =============================================
-- PulseMatch Database Schema
-- =============================================

-- 1. App roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- 2. Gender enum
CREATE TYPE public.gender_type AS ENUM ('man', 'woman', 'non-binary', 'other');

-- 3. Swipe action enum
CREATE TYPE public.swipe_action AS ENUM ('like', 'pass');

-- 4. Subscription tier enum
CREATE TYPE public.subscription_tier AS ENUM ('free', 'basic', 'plus', 'pro');

-- 5. Subscription status enum
CREATE TYPE public.subscription_status AS ENUM ('active', 'canceled', 'expired', 'past_due');

-- 6. Report status enum
CREATE TYPE public.report_status AS ENUM ('pending', 'reviewed', 'resolved', 'dismissed');

-- 7. Message type enum
CREATE TYPE public.message_type AS ENUM ('text', 'emoji', 'image');

-- =============================================
-- Utility function for updated_at
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =============================================
-- User Roles Table
-- =============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- Profiles Table
-- =============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  date_of_birth DATE,
  gender gender_type,
  interested_in gender_type[] DEFAULT '{}',
  bio TEXT,
  interests TEXT[] DEFAULT '{}',
  photos TEXT[] DEFAULT '{}',
  verified BOOLEAN DEFAULT false,
  country TEXT DEFAULT 'US',
  state TEXT,
  city TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  geohash TEXT,
  preferred_distance_km INTEGER DEFAULT 50,
  preferred_age_min INTEGER DEFAULT 18,
  preferred_age_max INTEGER DEFAULT 99,
  hide_state BOOLEAN DEFAULT false,
  hide_distance BOOLEAN DEFAULT false,
  onboarding_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- Swipes Table
-- =============================================
CREATE TABLE public.swipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swiper_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action swipe_action NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (swiper_id, target_id)
);

ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own swipes"
  ON public.swipes FOR SELECT
  TO authenticated
  USING (auth.uid() = swiper_id);

CREATE POLICY "Users can create swipes"
  ON public.swipes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = swiper_id);

CREATE INDEX idx_swipes_target ON public.swipes(target_id);
CREATE INDEX idx_swipes_swiper ON public.swipes(swiper_id);

-- =============================================
-- Matches Table
-- =============================================
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_a, user_b)
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own matches"
  ON public.matches FOR SELECT
  TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE INDEX idx_matches_user_a ON public.matches(user_a);
CREATE INDEX idx_matches_user_b ON public.matches(user_b);

-- Function to auto-create match on mutual like
CREATE OR REPLACE FUNCTION public.check_mutual_like()
RETURNS TRIGGER AS $$
DECLARE
  match_exists BOOLEAN;
BEGIN
  IF NEW.action = 'like' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.swipes
      WHERE swiper_id = NEW.target_id
        AND target_id = NEW.swiper_id
        AND action = 'like'
    ) INTO match_exists;

    IF match_exists THEN
      INSERT INTO public.matches (user_a, user_b)
      VALUES (LEAST(NEW.swiper_id, NEW.target_id), GREATEST(NEW.swiper_id, NEW.target_id))
      ON CONFLICT (user_a, user_b) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_swipe_check_match
  AFTER INSERT ON public.swipes
  FOR EACH ROW EXECUTE FUNCTION public.check_mutual_like();

-- =============================================
-- Messages Table (with Realtime)
-- =============================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type message_type NOT NULL DEFAULT 'text',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their matches"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches
      WHERE id = match_id
        AND (user_a = auth.uid() OR user_b = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in their matches"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.matches
      WHERE id = match_id
        AND (user_a = auth.uid() OR user_b = auth.uid())
    )
  );

CREATE POLICY "Users can update read status"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches
      WHERE id = match_id
        AND (user_a = auth.uid() OR user_b = auth.uid())
    )
  );

CREATE INDEX idx_messages_match ON public.messages(match_id, created_at);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- =============================================
-- Subscriptions Table
-- =============================================
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier subscription_tier NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'active',
  provider TEXT DEFAULT 'stripe',
  provider_sub_id TEXT,
  currency TEXT DEFAULT 'USD',
  price NUMERIC(10,2) DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage subscriptions"
  ON public.subscriptions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Reports Table
-- =============================================
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status report_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create reports"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports"
  ON public.reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can manage all reports"
  ON public.reports FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Region Pricing Table
-- =============================================
CREATE TABLE public.region_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  state TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  basic_price NUMERIC(10,2) NOT NULL DEFAULT 3.00,
  plus_price NUMERIC(10,2) NOT NULL DEFAULT 5.00,
  pro_price NUMERIC(10,2) NOT NULL DEFAULT 10.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country, state)
);

ALTER TABLE public.region_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read region pricing"
  ON public.region_pricing FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage region pricing"
  ON public.region_pricing FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_region_pricing_updated_at
  BEFORE UPDATE ON public.region_pricing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default US pricing
INSERT INTO public.region_pricing (country, currency, basic_price, plus_price, pro_price)
VALUES ('US', 'USD', 3.00, 5.00, 10.00);

-- =============================================
-- Daily Usage Counters Table
-- =============================================
CREATE TABLE public.daily_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  profile_views INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  boosts_count INTEGER DEFAULT 0,
  UNIQUE (user_id, date)
);

ALTER TABLE public.daily_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage"
  ON public.daily_usage FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert their own usage"
  ON public.daily_usage FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own usage"
  ON public.daily_usage FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- =============================================
-- Blocked Users Table
-- =============================================
CREATE TABLE public.blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their blocks"
  ON public.blocked_users FOR ALL
  TO authenticated
  USING (auth.uid() = blocker_id);

-- =============================================
-- Storage: Photos bucket
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true);

CREATE POLICY "Anyone can view photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'photos');

CREATE POLICY "Authenticated users can upload photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1]);

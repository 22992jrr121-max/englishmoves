CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  level text,
  diagnostic_score int,
  job_description text,
  goal text,
  work_topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  onboarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  block text NOT NULL,
  level text NOT NULL,
  topic text NOT NULL,
  title text NOT NULL,
  content jsonb NOT NULL,
  status text NOT NULL DEFAULT 'new',
  progress int NOT NULL DEFAULT 0,
  score int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO authenticated;
GRANT ALL ON public.units TO service_role;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own units" ON public.units FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX units_user_idx ON public.units(user_id, created_at DESC);

CREATE TABLE public.learned_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  block text NOT NULL,
  term text NOT NULL,
  meaning text NOT NULL,
  example text,
  mastery int NOT NULL DEFAULT 0,
  attempts int NOT NULL DEFAULT 0,
  correct int NOT NULL DEFAULT 0,
  last_seen timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learned_items TO authenticated;
GRANT ALL ON public.learned_items TO service_role;
ALTER TABLE public.learned_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own items" ON public.learned_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX items_user_idx ON public.learned_items(user_id, mastery);

CREATE TABLE public.attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.learned_items(id) ON DELETE SET NULL,
  block text,
  exercise_type text NOT NULL,
  prompt text NOT NULL,
  answer text,
  expected text,
  correct boolean NOT NULL DEFAULT false,
  score int NOT NULL DEFAULT 0,
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.attempts TO authenticated;
GRANT ALL ON public.attempts TO service_role;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attempts" ON public.attempts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX attempts_user_idx ON public.attempts(user_id, created_at DESC);
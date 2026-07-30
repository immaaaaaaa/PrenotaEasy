-- 1. Add avatar_url column to public.employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Create public.business_holidays table with range support
CREATE TABLE IF NOT EXISTS public.business_holidays (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  start_date    date NOT NULL,
  end_date      date NOT NULL,
  description   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

-- 3. Enable RLS and add owner policies
ALTER TABLE public.business_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "holidays_owner_all" ON public.business_holidays
  FOR ALL USING (business_id IN (SELECT id FROM public.businesses where owner_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM public.businesses where owner_id = auth.uid()));

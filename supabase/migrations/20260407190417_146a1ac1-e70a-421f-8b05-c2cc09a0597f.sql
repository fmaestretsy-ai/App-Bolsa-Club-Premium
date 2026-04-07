-- Fix 1: Remove overly permissive INSERT policy on fx_rates
DROP POLICY IF EXISTS "Authenticated users can insert fx_rates" ON public.fx_rates;

-- Add service_role-only INSERT policy
CREATE POLICY "Only service role can insert fx_rates"
  ON public.fx_rates FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Fix 2: Add UPDATE policy on storage.objects for excel-uploads bucket
CREATE POLICY "Users can update own excel uploads"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'excel-uploads' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'excel-uploads' AND (auth.uid())::text = (storage.foldername(name))[1]);
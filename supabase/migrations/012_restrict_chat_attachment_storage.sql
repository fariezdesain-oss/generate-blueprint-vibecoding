DROP POLICY IF EXISTS "Users can upload own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own attachments" ON storage.objects;

CREATE POLICY "Users can upload own attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id::text = (storage.foldername(name))[2]
      AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Users can read own attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-attachments'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id::text = (storage.foldername(name))[2]
      AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-attachments'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id::text = (storage.foldername(name))[2]
      AND s.user_id = auth.uid()
  )
);

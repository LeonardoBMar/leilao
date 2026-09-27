-- Bucket e políticas do Supabase Storage para as fotos dos lotes (SPEC RF-07, D-11, D-20).
--
-- Fica fora das migrations do Prisma: o schema `storage` pertence ao Supabase e não existe no shadow database.
-- Idempotente: rode com `npm run db:storage` sempre que este arquivo mudar.

-- Bucket privado; o próprio Storage recusa arquivos acima de 5 MB ou fora de JPEG/PNG/WebP.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lot-images', 'lot-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Caminho dos objetos: <owner_id>/<lot_id>/<uuid>.<ext>. Cada usuário só alcança a própria pasta.
-- Sem política de UPDATE: arquivos não são sobrescritos (sem upsert).
drop policy if exists "lot_images_owner_select" on storage.objects;
create policy "lot_images_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'lot-images' and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'));

drop policy if exists "lot_images_owner_insert" on storage.objects;
create policy "lot_images_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'lot-images' and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'));

drop policy if exists "lot_images_owner_delete" on storage.objects;
create policy "lot_images_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'lot-images' and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'));

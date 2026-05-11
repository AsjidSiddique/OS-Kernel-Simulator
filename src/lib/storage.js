import { supabase } from './supabase'

const BUCKET = 'products_img'

/**
 * Upload a single File object to Supabase Storage → products_img bucket
 * Returns the public URL string on success, throws on error
 */
export async function uploadProductImage(file) {
  const ext      = file.name.split('.').pop()
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const path     = `products/${filename}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false })

  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Delete an image by its full public URL
 */
export async function deleteProductImage(publicUrl) {
  // Extract path after /products_img/
  const marker = `/${BUCKET}/`
  const idx    = publicUrl.indexOf(marker)
  if (idx === -1) return
  const path = publicUrl.slice(idx + marker.length)

  await supabase.storage.from(BUCKET).remove([path])
}

const CAT_BUCKET = 'products_img' // reuse same bucket, different folder

export async function uploadCategoryImage(file) {
  const ext      = file.name.split('.').pop()
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const path     = `categories/${filename}`
  const { error } = await supabase.storage.from(CAT_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from(CAT_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

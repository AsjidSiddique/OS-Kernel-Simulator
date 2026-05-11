// Site settings — read from Supabase, cached in memory
import { supabase } from './supabase'

let cache = {}

export async function getSetting(key) {
  if (cache[key]) return cache[key]
  try {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', key)
      .single()
    if (data) cache[key] = data.value
    return data?.value || null
  } catch { return null }
}

export async function setSetting(key, value) {
  cache[key] = value
  const { error } = await supabase
    .from('site_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function getAllSettings() {
  try {
    const { data } = await supabase.from('site_settings').select('*')
    const result = {}
    data?.forEach(row => { result[row.key] = row.value; cache[row.key] = row.value })
    return result
  } catch { return {} }
}

// Upload image to header_ads_imgs bucket
export async function uploadHeroImage(file) {
  const ext = file.name.split('.').pop()
  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('header_ads_imgs').upload(name, file, { upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from('header_ads_imgs').getPublicUrl(name)
  return { url: data.publicUrl, name }
}

export async function deleteHeroImage(filename) {
  await supabase.storage.from('header_ads_imgs').remove([filename])
}

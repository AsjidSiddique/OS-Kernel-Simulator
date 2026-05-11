// productRatings.js — fetch avg_rating + review_count for products
import { supabase } from './supabase'

let _cache = null
let _cacheTime = 0
const CACHE_MS = 60 * 1000 // 1 minute cache

export async function getProductRatings() {
  if (_cache && Date.now() - _cacheTime < CACHE_MS) return _cache
  try {
    const { data } = await supabase.from('product_ratings').select('*')
    _cache = {}
    ;(data || []).forEach(r => {
      _cache[r.product_id] = {
        avg_rating:   parseFloat(r.avg_rating) || 0,
        review_count: parseInt(r.review_count) || 0,
      }
    })
    _cacheTime = Date.now()
    return _cache
  } catch {
    return {}
  }
}

export function mergeRatings(products, ratings) {
  if (!ratings) return products
  return products.map(p => ({
    ...p,
    avg_rating:   ratings[p.id]?.avg_rating   || 0,
    review_count: ratings[p.id]?.review_count || 0,
  }))
}

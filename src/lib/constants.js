export const OTHER_CITIES_FREE_THRESHOLD = 2500
export const DELIVERY_CHARGE = 150

export function getDeliveryCharge(city, subtotal) {
  const c = (city || '').trim().toLowerCase()
  if (c === 'burewala') {
    return subtotal >= 550 ? 0 : DELIVERY_CHARGE
  }
  return subtotal >= OTHER_CITIES_FREE_THRESHOLD ? 0 : DELIVERY_CHARGE
}

export const CONTACT = {
  phone: '+923277796566',
  whatsapp: '923277796566',
  email: 'support@viro.pk',
  address: 'Mandi Burewala, Punjab, Pakistan',
}

// v46: QUEUE inserted between UNPAID and CONFIRMED
// UNPAID    -> customer placed order, stock NOT touched
// QUEUE     -> admin queued it, stock_queue += qty (soft hold)
// CONFIRMED -> admin confirmed, stock_queue released, stock decremented
// CANCELLED -> reversed based on previous status
export const ORDER_STATUSES = ['UNPAID','QUEUE','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED']

export const ORDER_STATUS_META = {
  UNPAID:     { icon:'⏳', color:'#F97316', label:'Awaiting Review',   desc:"Order placed, awaiting admin review." },
  QUEUE:      { icon:'🕐', color:'#EAB308', label:'In Queue',          desc:"Queued for confirmation. Stock reserved for you." },
  CONFIRMED:  { icon:'✅', color:'#8B5CF6', label:'Confirmed',         desc:"Confirmed! Being prepared for dispatch." },
  PROCESSING: { icon:'⚙️', color:'#00BFFF', label:'Processing',        desc:"Being packed and prepared for shipping." },
  SHIPPED:    { icon:'🚚', color:'#3B82F6', label:'Shipped',           desc:"On the way! Expect delivery very soon." },
  DELIVERED:  { icon:'📦', color:'#10B981', label:'Delivered',         desc:"Delivered! Thank you for shopping with Viro." },
  CANCELLED:  { icon:'❌', color:'#EF4444', label:'Cancelled',         desc:"Cancelled. Contact us for more details." },
}

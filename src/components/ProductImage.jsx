import React, { useState } from 'react'
import { getThumb, parseImages } from '../context/CartContext'

// Reusable image component with fallback chain
// Falls back: real URL → /logo.jpg (shown dimmed)
export default function ProductImage({ images, alt = 'Product', className = '', style = {} }) {
  const thumb = getThumb(images, '')
  const [failed, setFailed] = useState(false)

  if (!thumb || failed) {
    return (
      <img
        src="/logo.jpg"
        alt={alt}
        className={className}
        style={{ ...style, opacity: 0.35, objectFit: 'contain' }}
      />
    )
  }

  return (
    <img
      src={thumb}
      alt={alt}
      className={className}
      style={style}
      onError={() => setFailed(true)}
    />
  )
}

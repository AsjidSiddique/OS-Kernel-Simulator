import React, { createContext, useContext, useState, useEffect } from 'react'

const WishlistContext = createContext()

export function WishlistProvider({ children }) {
  const [wishlist, setWishlist] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('viro_wishlist') || '[]')
    } catch { return [] }
  })

  useEffect(() => {
    localStorage.setItem('viro_wishlist', JSON.stringify(wishlist))
  }, [wishlist])

  const addToWishlist = (product) => {
    setWishlist(prev => {
      if (prev.find(i => i.id === product.id)) return prev
      return [...prev, product]
    })
  }

  const removeFromWishlist = (id) => {
    setWishlist(prev => prev.filter(i => i.id !== id))
  }

  const toggleWishlist = (product) => {
    setWishlist(prev => {
      const exists = prev.find(i => i.id === product.id)
      if (exists) return prev.filter(i => i.id !== product.id)
      return [...prev, product]
    })
  }

  const isInWishlist = (id) => wishlist.some(i => i.id === id)

  const wishlistCount = wishlist.length

  return (
    <WishlistContext.Provider value={{
      wishlist,
      addToWishlist,
      removeFromWishlist,
      toggleWishlist,
      isInWishlist,
      wishlistCount,
    }}>
      {children}
    </WishlistContext.Provider>
  )
}

export const useWishlist = () => useContext(WishlistContext)

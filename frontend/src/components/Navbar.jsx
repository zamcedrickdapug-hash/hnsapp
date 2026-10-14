import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import { motion } from 'framer-motion'

export default function Navbar({ isLanding = false, onNavigate, isAuthenticated = false }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isMenuOpen])

  const scrollToSection = (id) => {
    setIsMenuOpen(false)
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const handleNavigate = (route) => {
    setIsMenuOpen(false)
    if (onNavigate) {
      console.log('[AUTH_DEBUG] Navbar navigation:', { from: 'navbar', to: route, timestamp: new Date().toISOString() })
      onNavigate(route)
    }
  }

  const navItems = [
    { label: 'Features', id: 'features' },
    { label: 'How it Works', id: 'how-it-works' },
    { label: 'Testimonials', id: 'testimonials' },
    { label: 'Pricing', id: 'pricing' },
    { label: 'FAQ', id: 'faq' },
  ]

  return (
    <motion.nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white shadow-md border-b border-gray-100'
          : 'bg-white/80 backdrop-blur-lg border-b border-white/20'
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:h-20">
          {/* Logo */}
          <motion.div
            className="flex-shrink-0 flex items-center gap-2.5 cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          >
            <motion.div
              className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-md flex items-center justify-center shadow-sm"
              whileHover={{ boxShadow: '0 8px 16px rgba(0, 102, 255, 0.2)' }}
            >
              <span className="text-white font-bold text-sm">HS</span>
            </motion.div>
            <span className="hidden sm:inline text-lg font-bold text-gray-900 tracking-tight">
              Hatid-Sundo
            </span>
          </motion.div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-12">
            {isLanding && (
              <div className="flex items-center gap-8">
                {navItems.map((item) => (
                  <motion.button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className="text-gray-600 hover:text-primary-600 font-medium transition-colors text-sm relative group"
                    whileHover="hover"
                    initial="rest"
                    variants={{
                      rest: { color: 'rgb(75, 85, 99)' },
                      hover: { color: 'rgb(0, 102, 255)' },
                    }}
                  >
                    {item.label}
                    <motion.span
                      className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-primary-500 to-primary-600 rounded-full"
                      initial={{ width: 0 }}
                      whileHover={{ width: '100%' }}
                      transition={{ duration: 0.3 }}
                    />
                  </motion.button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 pl-8 border-l border-gray-200">
              {!isAuthenticated && (
                <>
                  <motion.button
                    onClick={() => handleNavigate('login')}
                    className="px-5 py-2 text-primary-600 font-semibold hover:bg-primary-50 rounded-lg transition-colors text-sm"
                    whileHover={{ backgroundColor: 'rgb(240, 247, 255)' }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Log in
                  </motion.button>
                  <motion.button
                    onClick={() => handleNavigate('register')}
                    className="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg font-semibold shadow-sm hover:shadow-md transition-all text-sm"
                    whileHover={{
                      scale: 1.02,
                      boxShadow: '0 12px 24px rgba(0, 102, 255, 0.2)',
                    }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Sign up
                  </motion.button>
                  <motion.button
                    onClick={() => handleNavigate('driver-apply')}
                    className="px-5 py-2.5 border border-primary-200 text-primary-700 bg-primary-50 rounded-lg font-semibold transition-colors text-sm"
                    whileHover={{ backgroundColor: 'rgb(219, 234, 254)' }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Become a Driver
                  </motion.button>
                </>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <motion.button
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isMenuOpen ? (
              <X size={24} className="text-gray-900" />
            ) : (
              <Menu size={24} className="text-gray-900" />
            )}
          </motion.button>
        </div>

        {/* Mobile Menu */}
        <motion.div
          className="md:hidden overflow-hidden"
          initial={{ height: 0, opacity: 0 }}
          animate={isMenuOpen ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          <div className="px-2 pt-3 pb-6 space-y-2 border-t border-gray-100">
            {isLanding && navItems.map((item, idx) => (
              <motion.button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="block w-full text-left px-4 py-3 text-gray-700 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors font-medium text-sm"
                whileHover={{ x: 4, backgroundColor: 'rgb(240, 247, 255)' }}
                initial={{ opacity: 0, x: -10 }}
                animate={isMenuOpen ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
                transition={{ delay: idx * 0.05 }}
              >
                {item.label}
              </motion.button>
            ))}

            {!isAuthenticated && (
              <div className="px-2 py-3 space-y-2 border-t border-gray-100 mt-3 pt-3">
                <motion.button
                  onClick={() => handleNavigate('login')}
                  className="block w-full px-4 py-3 text-center text-primary-600 font-semibold hover:bg-primary-50 rounded-lg transition-colors text-sm"
                  whileHover={{ backgroundColor: 'rgb(240, 247, 255)' }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={isMenuOpen ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                  transition={{ delay: (navItems.length + 1) * 0.05 }}
                >
                  Log in
                </motion.button>
                <motion.button
                  onClick={() => handleNavigate('register')}
                  className="block w-full px-4 py-3 text-center bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg font-semibold shadow-sm hover:shadow-md transition-all text-sm"
                  whileHover={{ scale: 1.02, boxShadow: '0 12px 24px rgba(0, 102, 255, 0.2)' }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={isMenuOpen ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                  transition={{ delay: (navItems.length + 2) * 0.05 }}
                >
                  Sign up
                </motion.button>
                <motion.button
                  onClick={() => handleNavigate('driver-apply')}
                  className="block w-full px-4 py-3 text-center border border-primary-200 text-primary-700 bg-primary-50 rounded-lg font-semibold transition-colors text-sm"
                  whileHover={{ backgroundColor: 'rgb(219, 234, 254)' }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={isMenuOpen ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                  transition={{ delay: (navItems.length + 3) * 0.05 }}
                >
                  Become a Driver
                </motion.button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.nav>
  )
}

import { motion } from 'framer-motion'
import { ArrowRight, Zap, Shield, Clock } from 'lucide-react'

export default function HeroSection({ onNavigate }) {
  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut' },
    },
  }

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-secondary-50 -z-10" />

      {/* Animated background elements */}
      <div className="absolute top-20 right-10 w-72 h-72 bg-primary-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-secondary-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2s" />
      <div className="absolute bottom-20 right-20 w-72 h-72 bg-primary-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4s" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 py-12 md:py-0">
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center"
          variants={container}
          initial="hidden"
          animate="visible"
        >
          {/* Left content */}
          <motion.div className="space-y-8" variants={item}>
            <motion.div className="inline-block" variants={item}>
              <div className="inline-flex items-center gap-2.5 px-4 py-2.5 bg-primary-100 rounded-full border border-primary-200 shadow-sm">
                <Zap size={16} className="text-primary-600" />
                <span className="text-sm font-semibold text-primary-700">New Way to Travel</span>
              </div>
            </motion.div>

            <motion.h1
              className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight text-gray-900 tracking-tight"
              variants={item}
            >
              Trustworthy school transport,
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-secondary-600 block">
                built for families
              </span>
            </motion.h1>

            <motion.p
              className="text-lg md:text-xl text-gray-600 max-w-xl leading-relaxed"
              variants={item}
            >
              Hatid-Sundo helps parents organize school rides with verified drivers, live ride updates, and safer everyday travel for students.
            </motion.p>

            <motion.div className="flex flex-col sm:flex-row gap-3 sm:gap-4" variants={item}>
              <motion.button
                onClick={() => onNavigate?.('register')}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg font-semibold shadow-sm hover:shadow-lg transition-all text-base"
                whileHover={{
                  scale: 1.02,
                  boxShadow: '0 12px 24px rgba(0, 102, 255, 0.2)',
                }}
                whileTap={{ scale: 0.98 }}
              >
                Create Parent Account
                <ArrowRight size={20} />
              </motion.button>
              <motion.button
                onClick={() => onNavigate?.('driver-apply')}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 border-2 border-gray-200 text-gray-900 rounded-lg font-semibold hover:border-primary-300 hover:bg-primary-50 transition-all text-base"
                whileHover={{
                  scale: 1.02,
                  backgroundColor: 'rgb(240, 247, 255)',
                  borderColor: 'rgb(203, 213, 225)',
                }}
                whileTap={{ scale: 0.98 }}
              >
                Become a Driver
              </motion.button>
            </motion.div>

            {/* Stats */}
            <motion.div className="grid grid-cols-3 gap-6 md:gap-8 pt-8 border-t border-gray-200" variants={item}>
              {[
                { value: '5000+', label: 'Active Users' },
                { value: '100%', label: 'Verified Drivers' },
                { value: '24/7', label: 'Support' },
              ].map((stat, idx) => (
                <motion.div key={idx} whileHover={{ y: -2 }} className="space-y-1">
                  <p className="text-3xl font-bold text-primary-600">{stat.value}</p>
                  <p className="text-sm text-gray-600 font-medium">{stat.label}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right - Hero Image */}
          <motion.div
            className="relative hidden lg:block"
            variants={item}
          >
            <motion.div
              className="relative w-full aspect-square"
              animate={{ y: [0, -20, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              {/* Hero illustration placeholder */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary-400 to-secondary-400 rounded-3xl opacity-10" />
              <div className="absolute inset-4 bg-gradient-to-br from-primary-300/30 to-secondary-300/30 rounded-3xl backdrop-blur-sm border border-white/50" />

              {/* Icon cards floating */}
              <motion.div
                className="absolute top-12 right-12 bg-white rounded-2xl shadow-lg hover:shadow-xl p-6 space-y-3 transition-shadow"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                    <Clock className="text-primary-600" size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Real-time Tracking</p>
                    <p className="text-xs text-gray-500">Live GPS updates</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="absolute bottom-12 left-0 bg-white rounded-2xl shadow-lg hover:shadow-xl p-6 space-y-3 transition-shadow"
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, delay: 0.2, ease: 'easeInOut' }}
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Shield className="text-green-600" size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">100% Verified</p>
                    <p className="text-xs text-gray-500">Background checked</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

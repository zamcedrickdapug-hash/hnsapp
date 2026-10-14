import { motion } from 'framer-motion'
import { ArrowRight, Smartphone } from 'lucide-react'

export default function CTASection() {
  return (
    <section className="py-20 md:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left - Image */}
          <motion.div
            className="relative hidden lg:block"
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <div className="relative w-full h-96 bg-gradient-to-br from-primary-100 to-secondary-100 rounded-3xl">
              <div className="absolute inset-0 flex items-center justify-center">
                <Smartphone size={120} className="text-primary-300" />
              </div>
            </div>
          </motion.div>

          {/* Right - Content */}
          <motion.div
            className="space-y-8"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <motion.div
              className="inline-block"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 rounded-full">
                <Smartphone size={16} className="text-primary-600" />
                <span className="text-sm font-medium text-primary-700">Mobile App</span>
              </div>
            </motion.div>

            <motion.h2
              className="text-4xl md:text-5xl font-bold leading-tight text-gray-900"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
            >
              Download the H&S Booking App
            </motion.h2>

            <motion.p
              className="text-xl text-gray-600 leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              viewport={{ once: true }}
            >
              Available on iOS and Android. Get instant access to book rides, track your driver in real-time, and manage all your trips.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-4 pt-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              viewport={{ once: true }}
            >
              <motion.a
                href="#"
                className="inline-flex items-center justify-center gap-3 px-6 py-3 bg-gray-900 text-white rounded-lg font-bold hover:bg-gray-800 transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.05 13.5c-.91 0-1.82-.55-2.55-1.5h-2.9v6.69h1.77v-4.06h2.68c.73.95 1.64 1.5 2.55 1.5 1.95 0 3.5-1.55 3.5-3.5s-1.55-3.13-3.5-3.13zm0 5.25c-1.1 0-2.09-.9-2.09-2 0-1.1.99-2 2.09-2s2 .9 2 2c0 1.1-.9 2-2 2z" />
                </svg>
                App Store
              </motion.a>

              <motion.a
                href="#"
                className="inline-flex items-center justify-center gap-3 px-6 py-3 border-2 border-gray-900 text-gray-900 rounded-lg font-bold hover:bg-gray-50 transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3.5 9.5h17v9H3.5z" />
                </svg>
                Google Play
              </motion.a>
            </motion.div>

            {/* App features */}
            <motion.div
              className="grid grid-cols-2 gap-4 pt-8 border-t border-gray-200"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              viewport={{ once: true }}
            >
              {[
                { emoji: '✨', text: 'Instant Booking' },
                { emoji: '📍', text: 'Live Tracking' },
                { emoji: '🔔', text: 'Push Notifications' },
                { emoji: '💳', text: 'Secure Payments' },
              ].map((feature, idx) => (
                <motion.div
                  key={idx}
                  className="flex items-center gap-2"
                  whileHover={{ x: 4 }}
                >
                  <span className="text-2xl">{feature.emoji}</span>
                  <span className="text-gray-700 font-medium">{feature.text}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

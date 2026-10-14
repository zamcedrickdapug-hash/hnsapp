import { motion } from 'framer-motion'
import {
  MapPin,
  CheckCircle,
  Bell,
  Users,
  Shield,
  Smartphone,
  TrendingUp,
  ArrowUpRight,
} from 'lucide-react'

export default function FeaturesSection() {
  const features = [
    {
      icon: MapPin,
      title: 'Real-time GPS Tracking',
      description: 'Track driver location with live updates and accurate estimated arrival times.',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Shield,
      title: 'Verified & Safe',
      description: 'All drivers undergo thorough background checks and verification.',
      color: 'from-green-500 to-emerald-500',
    },
    {
      icon: Bell,
      title: 'Instant Notifications',
      description: 'Get alerts when driver accepts, arrives, or completes the trip.',
      color: 'from-orange-500 to-red-500',
    },
    {
      icon: Users,
      title: 'Trusted Community',
      description: "Join thousands of parents trusting us with their children's safety.",
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: Smartphone,
      title: 'Easy Booking',
      description: 'Simple and intuitive app for quick booking and trip management.',
      color: 'from-indigo-500 to-blue-500',
    },
    {
      icon: TrendingUp,
      title: 'Affordable Rates',
      description: 'Competitive pricing with transparent costs and no hidden fees.',
      color: 'from-amber-500 to-orange-500',
    },
  ]

  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1,
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
    <section id="features" className="py-20 md:py-32 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          className="text-center mb-16 md:mb-20 space-y-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight">
            Why Choose H&S Booking?
          </h2>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Everything you need for safe, reliable, and convenient school transport
          </p>
        </motion.div>

        {/* Features grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8"
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {features.map((feature, idx) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={idx}
                className="group relative bg-white rounded-2xl p-8 border border-gray-100 hover:border-primary-100 transition-all duration-300 overflow-hidden"
                variants={item}
                whileHover={{
                  y: -8,
                  boxShadow: '0 20px 40px rgba(0, 102, 255, 0.12)',
                }}
              >
                {/* Gradient overlay on hover */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-3 transition-all duration-300`}
                />

                {/* Icon container */}
                <motion.div
                  className={`inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br ${feature.color} rounded-xl mb-6 shadow-sm group-hover:shadow-md transition-all`}
                  whileHover={{ scale: 1.05, rotate: 5 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  <Icon size={28} className="text-white" />
                </motion.div>

                {/* Content */}
                <h3 className="text-lg font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">{feature.description}</p>

                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-gray-200 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Hover indicator */}
                <motion.div
                  className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  initial={{ scale: 0, rotate: -45 }}
                  whileHover={{ scale: 1, rotate: 0 }}
                >
                  <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                    <ArrowUpRight size={16} className="text-primary-600" />
                  </div>
                </motion.div>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}

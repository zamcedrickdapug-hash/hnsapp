import { motion } from 'framer-motion'
import { Search, Calendar, MapPin, CheckCircle, ArrowRight } from 'lucide-react'

export default function HowItWorksSection() {
  const steps = [
    {
      number: '01',
      icon: Search,
      title: 'Search Available Rides',
      description: 'Browse and select from verified drivers available in your area.',
    },
    {
      number: '02',
      icon: Calendar,
      title: 'Book Your Ride',
      description: 'Choose your preferred time, route, and confirm your booking.',
    },
    {
      number: '03',
      icon: MapPin,
      title: 'Track in Real-time',
      description: 'Follow your drivers location with live GPS tracking updates.',
    },
    {
      number: '04',
      icon: CheckCircle,
      title: 'Safe Delivery',
      description: 'Get notifications when your child arrives at destination safely.',
    },
  ]

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
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.5 },
    },
  }

  return (
    <section id="how-it-works" className="py-20 md:py-32 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          className="text-center mb-16 md:mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            How It Works
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Get started in 4 simple steps
          </p>
        </motion.div>

        {/* Steps */}
        <motion.div
          className="relative"
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {/* Desktop timeline */}
          <div className="hidden lg:block absolute top-1/4 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-500 to-secondary-200" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, idx) => {
              const Icon = step.icon
              return (
                <motion.div key={idx} variants={item} className="relative">
                  {/* Step card */}
                  <div className="bg-white rounded-2xl p-8 hover:shadow-lg transition-all duration-300 relative z-10">
                    {/* Step number circle */}
                    <motion.div
                      className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center mb-6 relative -top-8"
                      whileHover={{ scale: 1.1, rotate: 10 }}
                    >
                      <span className="text-2xl font-bold text-white">{step.number}</span>
                    </motion.div>

                    {/* Icon */}
                    <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                      <Icon size={24} className="text-primary-600" />
                    </div>

                    {/* Title and description */}
                    <h3 className="text-lg font-bold text-gray-900 mb-3">{step.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{step.description}</p>

                    {/* Arrow for desktop */}
                    {idx < steps.length - 1 && (
                      <motion.div
                        className="hidden lg:block absolute -right-4 top-1/3 z-20"
                        animate={{ x: [0, 8, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <ArrowRight size={24} className="text-primary-500" />
                      </motion.div>
                    )}

                    {/* Arrow for mobile/tablet */}
                    {idx < steps.length - 1 && (
                      <div className="lg:hidden flex justify-center mt-8 text-primary-500">
                        <motion.div
                          animate={{ y: [0, 4, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          <svg className="w-6 h-6 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </motion.div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

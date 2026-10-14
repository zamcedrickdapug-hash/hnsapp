import { motion } from 'framer-motion'
import { Star } from 'lucide-react'

export default function TestimonialsSection() {
  const testimonials = [
    {
      name: 'Maria Rodriguez',
      role: 'Parent',
      content:
        'H&S Booking has been a game-changer for our family. The real-time tracking gives me peace of mind knowing exactly where my children are at all times.',
      rating: 5,
      image: '👩‍💼',
    },
    {
      name: 'Ahmed Hassan',
      role: 'School Driver',
      description: '5 Years Experience',
      content:
        'Great platform! Easy bookings, reliable customers, and the payment system is transparent. I love how it connects me with families who value safety.',
      rating: 5,
      image: '👨‍💼',
    },
    {
      name: 'Lisa Chen',
      role: 'Parent',
      content:
        "My kids feel safe, I get notifications, and the drivers are all verified. Best investment for my family's transportation needs. Highly recommended!",
      rating: 5,
      image: '👩‍🦰',
    },
    {
      name: 'James Wilson',
      role: 'School Administrator',
      description: "St. Mary's Academy",
      content:
        'H&S Booking has streamlined our transportation management. The system is reliable, the drivers are professional, and parents love the transparency.',
      rating: 5,
      image: '👨‍🏫',
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
    <section id="testimonials" className="py-20 md:py-32 bg-white">
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
            Loved by Families & Drivers
          </h2>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Hear from thousands of parents and drivers who trust H&S Booking
          </p>
        </motion.div>

        {/* Testimonials grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-16"
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {testimonials.map((testimonial, idx) => (
            <motion.div
              key={idx}
              className="group bg-white rounded-2xl p-8 border border-gray-100 hover:border-primary-100 hover:shadow-lg transition-all duration-300 relative"
              variants={item}
              whileHover={{
                y: -4,
                boxShadow: '0 12px 24px rgba(0, 102, 255, 0.08)',
              }}
            >
              {/* Quote mark background */}
              <div className="absolute top-6 right-6 text-6xl text-primary-100 font-serif opacity-50 group-hover:opacity-75 transition-opacity">
                &quot;
              </div>

              {/* Rating */}
              <div className="flex gap-1.5 mb-4 relative z-10">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{
                      duration: 0.4,
                      delay: i * 0.08,
                      ease: 'easeInOut',
                    }}
                  >
                    <Star size={18} className="fill-amber-400 text-amber-400" />
                  </motion.div>
                ))}
              </div>

              {/* Testimonial content */}
              <p className="text-gray-700 mb-6 leading-relaxed relative z-10">
                "{testimonial.content}"
              </p>

              {/* Author section */}
              <div className="flex items-center gap-4 relative z-10 pt-4 border-t border-gray-100 group-hover:border-primary-100 transition-colors">
                <div className="text-5xl flex-shrink-0">{testimonial.image}</div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 text-sm">{testimonial.name}</p>
                  <p className="text-xs text-gray-600">{testimonial.role}</p>
                  {testimonial.description && (
                    <p className="text-xs text-primary-600 font-medium">
                      {testimonial.description}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Social proof stats */}
        <motion.div
          className="grid grid-cols-3 gap-4 md:gap-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
        >
          {[
            { value: '5,000+', label: 'Happy Users' },
            { value: '98%', label: 'Satisfaction' },
            { value: '50K+', label: 'Safe Trips' },
          ].map((stat, idx) => (
            <motion.div
              key={idx}
              className="text-center px-4 py-6 md:py-8 rounded-xl bg-gradient-to-br from-primary-50 to-secondary-50 border border-primary-100 hover:border-primary-200 transition-colors"
              whileHover={{ scale: 1.02 }}
            >
              <p className="text-3xl md:text-4xl font-bold text-primary-600 mb-2">
                {stat.value}
              </p>
              <p className="text-sm md:text-base text-gray-600 font-medium">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

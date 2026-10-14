import { motion } from 'framer-motion'
import { Check, ArrowRight } from 'lucide-react'

export default function PricingSection() {
  const plans = [
    {
      name: 'Pay Per Trip',
      description: 'Perfect for occasional use',
      price: 'As low as',
      amount: '$5',
      billing: 'per trip',
      popular: false,
      features: [
        'Book on-demand rides',
        'Real-time GPS tracking',
        'Instant notifications',
        'Driver ratings',
        'Payment options',
      ],
      cta: 'Get Started',
    },
    {
      name: 'Monthly Pass',
      description: 'Best for regular commutes',
      price: 'Starting from',
      amount: '$199',
      billing: 'per month',
      popular: true,
      features: [
        'Unlimited bookings',
        'Priority booking',
        'Real-time GPS tracking',
        'Instant notifications',
        'Driver ratings',
        'Monthly invoice',
        'Priority support',
        '10% savings vs pay-per-trip',
      ],
      cta: 'Subscribe Now',
    },
    {
      name: 'School Plan',
      description: 'For schools & institutions',
      price: 'Custom',
      amount: 'Pricing',
      billing: 'tailored to your needs',
      popular: false,
      features: [
        'Bulk ride discounts',
        'School management portal',
        'Advanced analytics',
        'Dedicated support',
        'Custom scheduling',
        'Fleet management',
        'Monthly reporting',
      ],
      cta: 'Contact Sales',
    },
  ]

  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  }

  return (
    <section id="pricing" className="py-20 md:py-32 bg-gradient-to-b from-gray-50 to-white">
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
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Choose the plan that works best for you
          </p>
        </motion.div>

        {/* Pricing cards */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-6"
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {plans.map((plan, idx) => (
            <motion.div
              key={idx}
              className={`relative rounded-2xl transition-all duration-300 ${
                plan.popular
                  ? 'md:scale-105 bg-gradient-to-br from-primary-50 to-primary-100 border-2 border-primary-500 shadow-xl'
                  : 'bg-white border border-gray-200 hover:border-primary-200 hover:shadow-lg'
              }`}
              variants={item}
              whileHover={{ y: plan.popular ? 0 : -8 }}
            >
              {/* Popular badge */}
              {plan.popular && (
                <motion.div
                  className="absolute -top-4 left-1/2 transform -translate-x-1/2"
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-6 py-1 rounded-full text-sm font-bold shadow-lg">
                    Most Popular
                  </div>
                </motion.div>
              )}

              <div className="p-8 flex flex-col h-full">
                {/* Plan name */}
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-gray-600 text-sm mb-6">{plan.description}</p>

                {/* Pricing */}
                <div className="mb-8">
                  <p className="text-sm text-gray-600 mb-2">{plan.price}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-primary-600">{plan.amount}</span>
                    <span className="text-gray-600">{plan.billing}</span>
                  </div>
                </div>

                {/* CTA Button */}
                <motion.button
                  className={`w-full py-3 px-6 rounded-lg font-bold mb-8 flex items-center justify-center gap-2 transition-all ${
                    plan.popular
                      ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white hover:shadow-lg'
                      : 'border-2 border-primary-500 text-primary-600 hover:bg-primary-50'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {plan.cta}
                  <ArrowRight size={18} />
                </motion.button>

                {/* Divider */}
                <div className="border-t border-gray-200 mb-6" />

                {/* Features list */}
                <div className="space-y-4 flex-grow">
                  {plan.features.map((feature, fIdx) => (
                    <motion.div
                      key={fIdx}
                      className="flex items-start gap-3"
                      whileInView={{ x: [0, 4, 0] }}
                      transition={{ duration: 0.5, delay: fIdx * 0.05 }}
                      viewport={{ once: true }}
                    >
                      <Check size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{feature}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* FAQ note */}
        <motion.div
          className="mt-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          viewport={{ once: true }}
        >
          <p className="text-gray-600 mb-4">
            No setup fees. No contracts. Cancel anytime.
          </p>
          <a
            href="#faq"
            className="text-primary-600 font-bold hover:text-primary-700 transition-colors inline-flex items-center gap-2"
          >
            Have questions? Check our FAQ
            <ArrowRight size={18} />
          </a>
        </motion.div>
      </div>
    </section>
  )
}

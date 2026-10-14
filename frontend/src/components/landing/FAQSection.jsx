import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

export default function FAQSection() {
  const [activeIdx, setActiveIdx] = useState(0)

  const faqs = [
    {
      question: 'How do I book a ride?',
      answer:
        'Simply download the H&S app, sign up or log in, enter your pickup and destination, select your preferred time, and book! The driver will be matched with you within minutes.',
    },
    {
      question: 'Are all drivers verified?',
      answer:
        'Yes, 100% of our drivers undergo thorough background checks, vehicle inspections, and training. Your child\'s safety is our top priority.',
    },
    {
      question: 'What if my child doesn\'t arrive on time?',
      answer:
        'You\'ll receive real-time notifications throughout the journey. If there\'s any delay, you\'ll be notified immediately with the updated ETA. Our support team is available 24/7 if you need help.',
    },
    {
      question: 'How much does it cost?',
      answer:
        'Pricing starts as low as $5 per trip. We also offer monthly passes starting at $199 for unlimited bookings. School plans are available with custom pricing for bulk bookings.',
    },
    {
      question: 'Can I schedule recurring rides?',
      answer:
        'Yes! You can set up recurring daily or weekly bookings for school commutes. This saves time and ensures consistent driver assignments for your child.',
    },
    {
      question: 'What payment methods do you accept?',
      answer:
        'We accept all major credit/debit cards, digital wallets (Apple Pay, Google Pay), and bank transfers for school accounts. All payments are secure and encrypted.',
    },
    {
      question: 'What if I need to cancel a booking?',
      answer:
        'You can cancel anytime. If cancelled more than 1 hour before pickup, there\'s no charge. Cancellations within 1 hour may incur a small fee.',
    },
    {
      question: 'Is there customer support available?',
      answer:
        'Absolutely! We offer 24/7 customer support via app chat, email, and phone. Our team is trained to handle any concerns quickly and professionally.',
    },
  ]

  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.2,
      },
    },
  }

  const item = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4 },
    },
  }

  return (
    <section id="faq" className="py-20 md:py-32 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          className="text-center mb-16 md:mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-gray-600">
            Find answers to common questions about H&S Booking
          </p>
        </motion.div>

        {/* FAQ Items */}
        <motion.div
          className="space-y-4"
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {faqs.map((faq, idx) => (
            <motion.div
              key={idx}
              variants={item}
              className="border border-gray-200 rounded-xl overflow-hidden hover:border-primary-300 transition-colors"
            >
              <motion.button
                onClick={() => setActiveIdx(activeIdx === idx ? -1 : idx)}
                className="w-full px-6 py-4 md:py-5 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors text-left"
                whileHover={{ backgroundColor: 'rgb(249, 250, 251)' }}
              >
                <span className="font-bold text-gray-900 pr-4">{faq.question}</span>
                <motion.div
                  animate={{ rotate: activeIdx === idx ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex-shrink-0"
                >
                  <ChevronDown size={24} className="text-primary-600" />
                </motion.div>
              </motion.button>

              <AnimatePresence>
                {activeIdx === idx && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="border-t border-gray-200"
                  >
                    <p className="px-6 py-5 text-gray-600 leading-relaxed">
                      {faq.answer}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>

        {/* Contact support */}
        <motion.div
          className="mt-16 text-center bg-primary-50 rounded-2xl p-8 md:p-12 border border-primary-200"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          viewport={{ once: true }}
        >
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Still have questions?</h3>
          <p className="text-gray-600 mb-6 max-w-xl mx-auto">
            Can't find the answer you're looking for? Our support team is here to help.
          </p>
          <motion.a
            href="mailto:support@hsbooking.com"
            className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg font-bold hover:shadow-lg transition-all"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Get in Touch
          </motion.a>
        </motion.div>
      </div>
    </section>
  )
}

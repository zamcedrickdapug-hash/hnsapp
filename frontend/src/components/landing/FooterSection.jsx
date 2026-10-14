import { motion } from 'framer-motion'
import { Heart, Mail, Phone, MapPin } from 'lucide-react'
import { FaFacebook, FaTwitter, FaLinkedin, FaInstagram } from 'react-icons/fa'

export default function FooterSection() {
  const currentYear = new Date().getFullYear()

  const footerLinks = {
    Product: [
      { label: 'Features', href: '#features' },
      { label: 'How It Works', href: '#how-it-works' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'FAQ', href: '#faq' },
    ],
    Company: [
      { label: 'About Us', href: '#' },
      { label: 'Blog', href: '#' },
      { label: 'Careers', href: '#' },
      { label: 'Contact', href: '#' },
    ],
    Legal: [
      { label: 'Privacy Policy', href: '#' },
      { label: 'Terms of Service', href: '#' },
      { label: 'Cookie Policy', href: '#' },
      { label: 'Disclaimer', href: '#' },
    ],
    Support: [
      { label: 'Help Center', href: '#' },
      { label: 'Contact Us', href: '#' },
      { label: 'Status Page', href: '#' },
      { label: 'Documentation', href: '#' },
    ],
  }

  const socialLinks = [
    { icon: FaFacebook, href: '#', label: 'Facebook' },
    { icon: FaTwitter, href: '#', label: 'Twitter' },
    { icon: FaLinkedin, href: '#', label: 'LinkedIn' },
    { icon: FaInstagram, href: '#', label: 'Instagram' },
  ]

  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      },
    },
  }

  const item = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: 'easeOut' },
    },
  }

  return (
    <footer className="bg-gray-900 text-gray-300 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main footer content */}
        <div className="py-16 md:py-20">
          <motion.div
            className="grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-12 mb-12"
            variants={container}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {/* Brand column */}
            <motion.div variants={item} className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-3 mb-6">
                <motion.div
                  className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center shadow-lg"
                  whileHover={{ scale: 1.05 }}
                >
                  <span className="text-white font-bold">HS</span>
                </motion.div>
                <span className="text-lg font-bold text-white">H&S Booking</span>
              </div>
              <p className="text-sm text-gray-400 mb-8 leading-relaxed">
                Safe, reliable, and convenient school transport solutions for modern families.
              </p>

              {/* Contact info */}
              <div className="space-y-3 text-sm">
                <motion.a
                  href="mailto:support@hsbooking.com"
                  className="flex items-center gap-3 text-gray-400 hover:text-primary-400 transition-colors group"
                  whileHover={{ x: 4 }}
                >
                  <Mail size={16} className="text-primary-500 flex-shrink-0" />
                  <span className="group-hover:underline">support@hsbooking.com</span>
                </motion.a>
                <motion.a
                  href="tel:+1234567890"
                  className="flex items-center gap-3 text-gray-400 hover:text-primary-400 transition-colors group"
                  whileHover={{ x: 4 }}
                >
                  <Phone size={16} className="text-primary-500 flex-shrink-0" />
                  <span className="group-hover:underline">+1 (234) 567-890</span>
                </motion.a>
                <div className="flex items-start gap-3 text-gray-400">
                  <MapPin size={16} className="text-primary-500 flex-shrink-0 mt-1" />
                  <span>123 Tech Street, City, State 12345</span>
                </div>
              </div>
            </motion.div>

            {/* Link columns */}
            {Object.entries(footerLinks).map(([title, links]) => (
              <motion.div key={title} variants={item}>
                <h4 className="text-white font-bold text-sm mb-6 tracking-tight">{title}</h4>
                <ul className="space-y-3">
                  {links.map((link) => (
                    <li key={link.label}>
                      <motion.a
                        href={link.href}
                        className="text-sm text-gray-400 hover:text-primary-400 transition-colors inline-flex items-center group"
                        whileHover={{ x: 2 }}
                      >
                        {link.label}
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity ml-1">→</span>
                      </motion.a>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>

          {/* Divider */}
          <div className="border-t border-gray-800" />

          {/* Bottom footer */}
          <motion.div
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-8 mt-8"
            variants={container}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {/* Copyright */}
            <motion.div
              className="flex flex-col items-center md:items-start gap-3 text-center md:text-left"
              variants={item}
            >
              <p className="text-sm text-gray-400">
                © {currentYear} H&S Booking. All rights reserved.
              </p>
              <p className="text-sm text-gray-500 flex items-center justify-center md:justify-start gap-2">
                Made with
                <Heart size={14} className="text-primary-500 fill-primary-500" />
                for safe school transport
              </p>
            </motion.div>

            {/* Social links */}
            <motion.div
              className="flex items-center justify-center md:justify-end gap-3"
              variants={item}
            >
              {socialLinks.map((social) => {
                const Icon = social.icon
                return (
                  <motion.a
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    className="w-10 h-10 bg-gray-800 hover:bg-primary-600 rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-all border border-gray-700 hover:border-primary-600"
                    whileHover={{
                      scale: 1.1,
                      backgroundColor: 'rgb(0, 102, 255)',
                    }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Icon size={18} />
                  </motion.a>
                )
              })}
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-800 bg-gray-950 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-gray-500">
          <div className="text-center sm:text-left">
            Made with
            <Heart size={13} className="inline mx-1.5 text-red-500 fill-red-500" />
            by H&S Booking Team
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-primary-400 transition-colors">
              Privacy Policy
            </a>
            <span className="text-gray-700">•</span>
            <a href="#" className="hover:text-primary-400 transition-colors">
              Terms of Service
            </a>
            <span className="text-gray-700">•</span>
            <a href="#" className="hover:text-primary-400 transition-colors">
              Cookie Policy
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

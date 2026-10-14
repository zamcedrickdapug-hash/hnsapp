/**
 * LoadingState Component
 * ======================
 * Reusable loading placeholder
 * Improves UX with clear loading indication
 */

import { motion } from 'framer-motion'

function LoadingState({ message = 'Loading...', fullHeight = false }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`flex flex-col items-center justify-center gap-4 ${fullHeight ? 'h-96' : 'py-12'}`}
    >
      <motion.div
        className="w-12 h-12 border-4 border-gray-200 border-t-primary-500 rounded-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      <p className="text-gray-600 text-sm font-medium">{message}</p>
    </motion.div>
  )
}

export default LoadingState

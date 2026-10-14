/**
 * EmptyState Component
 * ====================
 * Reusable empty state placeholder
 * Shows when there's no data to display
 */

import { motion } from 'framer-motion'

function EmptyState({ 
  icon = '📭', 
  title = 'No Data', 
  message = 'There is nothing to display',
  action = null 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-12 px-4"
    >
      <motion.div
        className="text-5xl mb-4"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {icon}
      </motion.div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 text-center mb-6">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  )
}

export default EmptyState

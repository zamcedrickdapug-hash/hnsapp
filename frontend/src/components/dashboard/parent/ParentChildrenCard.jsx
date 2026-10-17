/**
 * ParentChildrenCard Component
 * ============================
 * Displays student/child information card for parent dashboard
 * 
 * Architecture: Reusable component for displaying child details
 * Shows: Child name, grade, school, status indicators
 */

import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card'
import { Button } from '../../ui/button'
import { BookOpen, MapPin } from 'lucide-react'

export function ParentChildrenCard({
  studentName = 'Student Name',
  studentGradeSection = 'Grade/Section',
  schoolName = 'School Name',
  pickupZone = 'Pickup Zone',
  status = 'waiting',
  hasStudentDetails = true,
  onEditClick = () => {},
  isLoading = false,
}) {
  const statusConfig = {
    waiting: { color: 'text-gray-700', bg: 'bg-gray-50', label: 'Waiting' },
    accepted: { color: 'text-blue-800', bg: 'bg-blue-50', label: 'Driver Assigned' },
    active: { color: 'text-blue-800', bg: 'bg-blue-50', label: 'In Transit' },
    arrived: { color: 'text-green-800', bg: 'bg-green-50', label: 'Arrived' },
    completed: { color: 'text-green-800', bg: 'bg-green-50', label: 'Completed' },
  }

  const statusInfo = statusConfig[status] || statusConfig.waiting

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="h-6 bg-gray-200 rounded w-2/3 animate-pulse" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">{studentName}</CardTitle>
              <CardDescription>{studentGradeSection}</CardDescription>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-semibold ${statusInfo.bg} ${statusInfo.color}`}>
              {statusInfo.label}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-300">School</p>
            <div className="flex items-center gap-2 mt-1">
              <BookOpen size={16} className="text-slate-400" />
              <p className="font-medium text-slate-50">{schoolName}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-300">Pickup Zone</p>
            <div className="flex items-center gap-2 mt-1">
              <MapPin size={16} className="text-slate-400" />
              <p className="font-medium text-slate-50">{pickupZone}</p>
            </div>
          </div>

          <Button
            onClick={onEditClick}
            variant="outline"
            size="sm"
            className="w-full mt-2"
          >
            {hasStudentDetails ? 'Edit Student Info' : 'Add student details'}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}

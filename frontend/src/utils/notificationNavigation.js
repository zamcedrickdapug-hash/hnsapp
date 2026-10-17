const tripSections = new Set([
  'booked',
  'trip_booked',
  'van_request_booked',
  'accepted',
  'trip_accepted',
  'driver_accepted',
  'request_accepted',
  'arrived',
  'trip_arrived',
  'driver_arrived',
  'arrived_at_pickup',
  'trip_arrived_at_pickup',
  'picked_up',
  'trip_picked_up',
  'student_picked_up',
  'at_school',
  'trip_at_school',
  'arrived_at_school',
  'completed',
  'trip_completed',
  'cancelled',
  'canceled',
  'trip_cancelled',
  'trip_canceled',
  'request_cancelled',
  'request_canceled',
])

const newRequestTypes = new Set([
  'new_request',
  'new_requests',
  'new_van_request',
  'request_created',
  'request_received',
  'incoming_request',
]);

const normalizeType = (value) => (
  typeof value === 'string' ? value.trim().toLowerCase().replace(/[\s-]+/g, '_') : ''
)

export function getNotificationDestination(notification, role) {
  const type = normalizeType(notification?.type)
  const status = normalizeType(notification?.metadata?.status)
  const requestId = notification?.requestId || notification?.metadata?.requestId || null

  if (type === 'message' || type.includes('message')) {
    return { section: 'messages', requestId }
  }
  if (type === 'payment' || type.includes('payment')) {
    return { section: 'payments', requestId: null }
  }
  if (role === 'driver' && newRequestTypes.has(type)) {
    return { section: 'requests', requestId }
  }
  if (tripSections.has(type) || tripSections.has(status)) {
    return { section: 'dashboard', requestId }
  }

  return null
}

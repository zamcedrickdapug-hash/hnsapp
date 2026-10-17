import { apiFetch } from '../api'

export async function hideFinishedTrips(path, token, requestIds) {
  const hiddenRequestIds = []
  for (let index = 0; index < requestIds.length; index += 50) {
    const batch = requestIds.slice(index, index + 50)
    try {
      await apiFetch(path, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestIds: batch }),
      })
      hiddenRequestIds.push(...batch)
    } catch (requestError) {
      const error = new Error(requestError.message || 'Unable to hide trips from your history.')
      error.hiddenRequestIds = hiddenRequestIds
      throw error
    }
  }
}

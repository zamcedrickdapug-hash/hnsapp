import { apiFetch } from '../api'

type PushSubscriptionJson = {
  endpoint: string
  expirationTime?: number | null
  keys: {
    auth: string
    p256dh: string
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

export async function registerPushSubscription(token: string) {
  if (!token || !isPushSupported()) {
    return
  }

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission()

  if (permission !== 'granted') {
    return
  }

  const vapidResponse = await apiFetch('/api/auth/push/vapid-public-key')
  const publicKey = String(vapidResponse?.publicKey || '')

  if (!publicKey) {
    return
  }

  const registration =
    (await navigator.serviceWorker.getRegistration('/push-sw.js')) ||
    (await navigator.serviceWorker.register('/push-sw.js'))
  const existingSubscription = await registration.pushManager.getSubscription()

  const nextSubscription =
    existingSubscription ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }))

  const subscriptionJson = nextSubscription.toJSON() as PushSubscriptionJson

  await apiFetch('/api/auth/push/subscribe', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ subscription: subscriptionJson }),
  })
}

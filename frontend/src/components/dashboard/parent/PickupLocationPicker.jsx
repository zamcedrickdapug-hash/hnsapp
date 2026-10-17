import { useCallback, useEffect, useRef, useState } from 'react'
import { APIProvider, AdvancedMarker, Map, useMapsLibrary } from '@vis.gl/react-google-maps'

const DEFAULT_CENTER = { lat: 14.5994, lng: 120.9842 }

const toPoint = (latitude, longitude) => {
  if (latitude === '' || longitude === '' || latitude === null || longitude === null ||
      latitude === undefined || longitude === undefined) return null
  const lat = Number(latitude)
  const lng = Number(longitude)
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return null
  }
  return { lat, lng }
}

function PlaceSearch({ onPlaceSelected, disabled }) {
  const places = useMapsLibrary('places')
  const inputRef = useRef(null)

  useEffect(() => {
    if (!places || !inputRef.current) return undefined

    const autocomplete = new places.Autocomplete(inputRef.current, {
      fields: ['formatted_address', 'geometry', 'name'],
    })
    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      const location = place.geometry?.location
      if (!location) return
      onPlaceSelected({
        pickupZone: place.formatted_address || place.name || 'Selected place',
        latitude: location.lat(),
        longitude: location.lng(),
      })
    })

    return () => listener.remove()
  }, [onPlaceSelected, places])

  return (
    <div>
      <input
        ref={inputRef}
        type="search"
        placeholder="Search for a place"
        aria-label="Search for pickup place"
        className="w-full rounded-md border border-gray-300 px-3 py-2"
        disabled={disabled}
      />
      {!places && (
        <p className="mt-1 text-sm text-gray-600">
          Place search is unavailable; tap the map or use your current location.
        </p>
      )}
    </div>
  )
}

function PickupMap({ point, onLocationChange, pickupZone, disabled }) {
  const handleMapClick = (event) => {
    const location = event.detail?.latLng
    if (!location) return
    onLocationChange({
      pickupZone: pickupZone || 'Pinned pickup',
      latitude: location.lat,
      longitude: location.lng,
    })
  }

  const handleMarkerDragEnd = (event) => {
    const location = event.detail?.latLng
    if (!location) return
    onLocationChange({
      pickupZone: pickupZone || 'Pinned pickup',
      latitude: location.lat,
      longitude: location.lng,
    })
  }

  return (
    <Map
      style={{ width: '100%', height: 320 }}
      center={point || DEFAULT_CENTER}
      defaultZoom={15}
      mapId="DEMO_MAP_ID"
      gestureHandling="greedy"
      onClick={disabled ? undefined : handleMapClick}
    >
      {point && (
        <AdvancedMarker
          position={point}
          title="Student pickup location"
          draggable={!disabled}
          onDragEnd={handleMarkerDragEnd}
        />
      )}
    </Map>
  )
}

export default function PickupLocationPicker({
  pickupZone,
  latitude,
  longitude,
  onLocationChange,
  disabled = false,
}) {
  const point = toPoint(latitude, longitude)
  const [locationError, setLocationError] = useState('')

  const reportLocation = useCallback((location) => {
    setLocationError('')
    onLocationChange(location)
  }, [onLocationChange])

  const useCurrentLocation = () => {
    setLocationError('')
    if (!navigator.geolocation) {
      setLocationError('Current location is unavailable in this browser.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => reportLocation({
        pickupZone: pickupZone || 'Current location',
        latitude: coords.latitude,
        longitude: coords.longitude,
      }),
      () => setLocationError('Unable to get your current location. Please pin it on the map.'),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 },
    )
  }

  return (
    <div className="mt-3 space-y-2">
      <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
        <PlaceSearch onPlaceSelected={reportLocation} disabled={disabled} />
        <PickupMap
          point={point}
          onLocationChange={reportLocation}
          pickupZone={pickupZone}
          disabled={disabled}
        />
      </APIProvider>
      <button
        type="button"
        onClick={useCurrentLocation}
        disabled={disabled}
        className="rounded-md border border-gray-400 px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-100 disabled:text-slate-600"
      >
        Use my current location
      </button>
      {locationError && <p className="text-sm text-red-700" role="alert">{locationError}</p>}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../../../api'

export default function SchoolSelect({
  value = '',
  onChange,
  latitude = '',
  longitude = '',
  token,
  disabled = false,
}) {
  const [schools, setSchools] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const searchSequence = useRef(0)

  useEffect(() => {
    let active = true
    apiFetch('/api/schools', {
      headers: { Authorization: `Bearer ${token}` },
    }).then((response) => {
      if (!active) return
      const catalog = response.schools || []
      setSchools(catalog)
      setSearchResults(catalog)
      setError('')
    }).catch((requestError) => {
      if (active) setError(requestError.message || 'Unable to load the school list.')
    }).finally(() => {
      if (active) setLoading(false)
    })

    return () => {
      active = false
    }
  }, [token])

  useEffect(() => {
    const query = search.trim()
    if (!query) {
      searchSequence.current += 1
      setSearchResults(schools)
      setError('')
      return undefined
    }

    const sequence = ++searchSequence.current
    const timer = setTimeout(() => {
      apiFetch(`/api/schools?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((response) => {
        if (sequence !== searchSequence.current) return
        setSearchResults(response.schools || [])
        setError('')
      }).catch((requestError) => {
        if (sequence === searchSequence.current) {
          setError(requestError.message || 'Unable to search schools.')
        }
      })
    }, 300)

    return () => clearTimeout(timer)
  }, [search, schools, token])

  const selectedSchool = schools.find((school) => school.name === value)
  const hasPreviouslySavedLocation = Boolean(value) && !selectedSchool
  const options = [...searchResults]
  if (selectedSchool && !options.some((school) => school.name === selectedSchool.name)) {
    options.unshift(selectedSchool)
  }

  const handleChange = (event) => {
    const selected = options.find((school) => school.name === event.target.value)
    if (selected) onChange?.(selected)
    else if (hasPreviouslySavedLocation && event.target.value === value) {
      onChange?.({ name: value, latitude, longitude, previouslySaved: true })
    } else {
      onChange?.(null)
    }
  }

  return (
    <div className="space-y-2">
      <label htmlFor="school-search" className="block text-sm font-medium text-gray-700">
        Search schools
      </label>
      <input
        id="school-search"
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by school or area"
        className="w-full rounded-md border border-gray-300 px-3 py-2"
        disabled={disabled}
      />
      {error && <p className="text-sm text-red-700" role="status">{error}</p>}
      <label htmlFor="school-select" className="block text-sm font-medium text-gray-700">
        School Name <span aria-hidden="true">*</span>
      </label>
      <select
        id="school-select"
        value={value}
        onChange={handleChange}
        className="w-full rounded-md border border-gray-300 px-3 py-2"
        disabled={disabled}
      >
        <option value="">{loading ? 'Loading schools...' : 'Select a school'}</option>
        {hasPreviouslySavedLocation && (
          <option value={value}>Previously saved location — {value}</option>
        )}
        {options.map((school) => (
          <option key={school._id || school.name} value={school.name}>
            {school.name}{school.area ? ` — ${school.area}` : ''}
          </option>
        ))}
      </select>
      {value && (
        <div className="text-xs text-gray-600" aria-live="polite">
          <p>
            {hasPreviouslySavedLocation
              ? `Previously saved location: ${value}`
              : `${selectedSchool?.name || value}${selectedSchool?.area ? ` — ${selectedSchool.area}` : ''}`}
          </p>
          {latitude !== '' && longitude !== '' && (
            <p>Coordinates: {latitude}, {longitude}</p>
          )}
        </div>
      )}
    </div>
  )
}

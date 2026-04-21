const express = require('express')
const https = require('https')

const router = express.Router()

const OSRM_PROFILES = ['driving']
const OSRM_BASE = 'router.project-osrm.org'
const REQUEST_TIMEOUT_MS = 10000
const RATE_LIMIT_COOLDOWN_MS = 30000
const MIN_ROUTE_DISTANCE_DEGREES = 0.00005
const MAX_MULTI_ROUTE_POINTS = 10

let rateLimitBackoffUntil = 0

function isSameRoutePoint(pickupLat, pickupLng, vanLat, vanLng) {
    return (
        Math.abs(vanLat - pickupLat) <= MIN_ROUTE_DISTANCE_DEGREES &&
        Math.abs(vanLng - pickupLng) <= MIN_ROUTE_DISTANCE_DEGREES
    )
}

function osrmFetch(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: OSRM_BASE,
            path,
            method: 'GET',
            headers: { 'User-Agent': 'HNSApp/1.0' },
            timeout: REQUEST_TIMEOUT_MS,
        }

        const request = https.request(options, (response) => {
            if (response.statusCode === 429) {
                return reject(Object.assign(new Error('OSRM rate limited'), { code: 'RATE_LIMIT' }))
            }

            if (response.statusCode !== 200) {
                return reject(new Error(`OSRM responded with ${response.statusCode}`))
            }

            let body = ''
            response.on('data', (chunk) => { body += chunk })
            response.on('end', () => {
                try {
                    resolve(JSON.parse(body))
                } catch {
                    reject(new Error('Invalid JSON from OSRM'))
                }
            })
        })

        request.on('timeout', () => {
            request.destroy()
            reject(new Error('OSRM request timed out'))
        })

        request.on('error', reject)
        request.end()
    })
}

function toLngLatPair(position) {
    if (!Array.isArray(position) || position.length < 2) return null
    const lat = Number(position[0])
    const lng = Number(position[1])
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng }
}

// POST /api/routing/route
// Body: { "start": [lat, lng], "end": [lat, lng] }
router.post('/route', async (req, res) => {
    const { start, end } = req.body

    if (!Array.isArray(start) || !Array.isArray(end)) {
        return res.status(400).json({ message: 'start and end coordinates (as [lat, lng] arrays) are required.' })
    }

    const pickupLat = Number(start[0])
    const pickupLng = Number(start[1])
    const vanLat = Number(end[0])
    const vanLng = Number(end[1])

    if (
        !Number.isFinite(pickupLat) || !Number.isFinite(pickupLng) ||
        !Number.isFinite(vanLat) || !Number.isFinite(vanLng)
    ) {
        return res.status(400).json({ message: 'Valid start and end coordinates are required.' })
    }

    if (isSameRoutePoint(pickupLat, pickupLng, vanLat, vanLng)) {
        return res.status(200).json({
            success: true,
            route: {
                coordinates: [
                    [pickupLng, pickupLat],
                    [vanLng, vanLat],
                ],
                distance: 0,
                duration: 0,
                profile: 'stationary',
            }
        })
    }

    if (Date.now() < rateLimitBackoffUntil) {
        return res.status(429).json({ message: 'Routing service is temporarily busy. Try again shortly.' })
    }

    for (const profile of OSRM_PROFILES) {
        try {
            const path = `/route/v1/${profile}/${pickupLng},${pickupLat};${vanLng},${vanLat}?overview=full&geometries=geojson`
            const payload = await osrmFetch(path)
            const coordinates = payload?.routes?.[0]?.geometry?.coordinates
            const distance = payload?.routes?.[0]?.distance
            const duration = payload?.routes?.[0]?.duration

            if (!Array.isArray(coordinates) || coordinates.length < 2) {
                continue
            }

            const cleaned = coordinates
                .filter((point) => Array.isArray(point) && point.length >= 2)
                .map(([lng, lat]) => [Number(lng), Number(lat)])

            if (cleaned.length < 2) {
                continue
            }

            return res.status(200).json({
                success: true,
                route: {
                    coordinates: cleaned,
                    distance: distance || 0,
                    duration: duration || 0,
                    profile
                }
            })
        } catch (error) {
            if (error.code === 'RATE_LIMIT') {
                rateLimitBackoffUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS
                return res.status(429).json({ message: 'Routing service is temporarily busy. Try again shortly.' })
            }
            // Try next profile.
        }
    }

    return res.status(503).json({ message: 'No road-aligned route could be found.' })
})

// POST /api/routing/multi-route
// Body: { "start": [lat,lng], "pickups": [[lat,lng], ...], "end": [lat,lng] }
// Returns: { route: { coordinates: [[lng,lat], ...] }, stops: [{ type, index, position: [lat,lng] }, ...] }
router.post('/multi-route', async (req, res) => {
    const start = toLngLatPair(req.body?.start)
    const end = toLngLatPair(req.body?.end)
    const pickups = Array.isArray(req.body?.pickups) ? req.body.pickups : []

    if (!start || !end) {
        return res.status(400).json({ message: 'Valid start and end coordinates are required.' })
    }

    const cleanedPickups = pickups
        .map(toLngLatPair)
        .filter(Boolean)

    // Need at least one pickup for multi-route to make sense.
    if (cleanedPickups.length === 0) {
        return res.status(200).json({
            success: true,
            route: { coordinates: [[start.lng, start.lat], [end.lng, end.lat]], distance: 0, duration: 0, profile: 'stationary' },
            stops: [
                { type: 'start', index: 0, position: [start.lat, start.lng] },
                { type: 'end', index: 1, position: [end.lat, end.lng] },
            ],
        })
    }

    const all = [start, ...cleanedPickups, end]
    if (all.length > MAX_MULTI_ROUTE_POINTS) {
        return res.status(400).json({ message: `Too many stops. Max supported is ${MAX_MULTI_ROUTE_POINTS}.` })
    }

    if (Date.now() < rateLimitBackoffUntil) {
        return res.status(429).json({ message: 'Routing service is temporarily busy. Try again shortly.' })
    }

    for (const profile of OSRM_PROFILES) {
        try {
            const coordinates = all.map((p) => `${p.lng},${p.lat}`).join(';')
            const path = `/trip/v1/${profile}/${coordinates}?source=first&destination=last&roundtrip=false&overview=full&geometries=geojson`
            const payload = await osrmFetch(path)

            const routeCoordinates = payload?.trips?.[0]?.geometry?.coordinates
            const distance = payload?.trips?.[0]?.distance
            const duration = payload?.trips?.[0]?.duration
            const waypoints = payload?.waypoints

            if (!Array.isArray(routeCoordinates) || routeCoordinates.length < 2 || !Array.isArray(waypoints)) {
                continue
            }

            const cleanedRoute = routeCoordinates
                .filter((point) => Array.isArray(point) && point.length >= 2)
                .map(([lng, lat]) => [Number(lng), Number(lat)])

            const stopsByWaypointIndex = new Array(all.length).fill(null)
            waypoints.forEach((wp, inputIndex) => {
                const waypointIndex = Number(wp?.waypoint_index)
                if (!Number.isFinite(waypointIndex) || waypointIndex < 0 || waypointIndex >= all.length) return
                stopsByWaypointIndex[waypointIndex] = inputIndex
            })

            const orderedStops = stopsByWaypointIndex
                .map((inputIndex, waypointIndex) => {
                    if (!Number.isFinite(inputIndex)) return null
                    const position = all[inputIndex]
                    const type = inputIndex === 0 ? 'start' : inputIndex === all.length - 1 ? 'end' : 'pickup'
                    return { type, index: waypointIndex, inputIndex, position: [position.lat, position.lng] }
                })
                .filter(Boolean)

            return res.status(200).json({
                success: true,
                route: {
                    coordinates: cleanedRoute,
                    distance: distance || 0,
                    duration: duration || 0,
                    profile,
                },
                stops: orderedStops,
            })
        } catch (error) {
            if (error.code === 'RATE_LIMIT') {
                rateLimitBackoffUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS
                return res.status(429).json({ message: 'Routing service is temporarily busy. Try again shortly.' })
            }
        }
    }

    return res.status(503).json({ message: 'No road-aligned route could be found.' })
})

module.exports = router

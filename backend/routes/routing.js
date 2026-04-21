const express = require('express')
const https = require('https')
const VanRequest = require('../models/VanRequest')

const router = express.Router()

const OSRM_PROFILES = ['driving']
const OSRM_BASE = 'router.project-osrm.org'
const REQUEST_TIMEOUT_MS = 10000
const RATE_LIMIT_COOLDOWN_MS = 30000
const MIN_ROUTE_DISTANCE_DEGREES = 0.00005

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

// GET /api/routing/saved/:requestId
router.get('/saved/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params
        const request = await VanRequest.findById(requestId).select('routeCoordinates routeMetadata')

        if (!request || !request.routeCoordinates) {
            return res.status(404).json({ message: 'No saved route found.' })
        }

        return res.status(200).json({
            success: true,
            route: {
                coordinates: request.routeCoordinates,
                distance: request.routeMetadata?.distance || 0,
                duration: request.routeMetadata?.duration || 0,
                profile: request.routeMetadata?.profile || 'driving',
                cached: true,
            }
        })
    } catch (error) {
        return res.status(500).json({ message: 'Error retrieving saved route.' })
    }
})

// POST /api/routing/save/:requestId
// Body: { "coordinates": [[lng, lat], ...], "distance": 1000, "duration": 60, "profile": "driving" }
router.post('/save/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params
        const { coordinates, distance, duration, profile } = req.body

        if (!Array.isArray(coordinates) || coordinates.length < 2) {
            return res.status(400).json({ message: 'Valid coordinates array is required.' })
        }

        const request = await VanRequest.findByIdAndUpdate(
            requestId,
            {
                routeCoordinates: coordinates,
                'routeMetadata.distance': distance || 0,
                'routeMetadata.duration': duration || 0,
                'routeMetadata.profile': profile || 'driving',
                'routeMetadata.calculatedAt': new Date(),
            },
            { new: true }
        ).select('routeCoordinates routeMetadata')

        if (!request) {
            return res.status(404).json({ message: 'Request not found.' })
        }

        return res.status(200).json({
            success: true,
            message: 'Route saved successfully.',
            route: {
                coordinates: request.routeCoordinates,
                distance: request.routeMetadata?.distance || 0,
                duration: request.routeMetadata?.duration || 0,
                profile: request.routeMetadata?.profile || 'driving',
            }
        })
    } catch (error) {
        return res.status(500).json({ message: 'Error saving route.' })
    }
})

module.exports = router

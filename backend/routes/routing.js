const express = require('express')
const https = require('https')

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

// GET /api/routing/route?pickupLat=&pickupLng=&vanLat=&vanLng=
router.get('/route', async (req, res) => {
    const pickupLat = Number(req.query.pickupLat)
    const pickupLng = Number(req.query.pickupLng)
    const vanLat    = Number(req.query.vanLat)
    const vanLng    = Number(req.query.vanLng)

    if (
        !Number.isFinite(pickupLat) || !Number.isFinite(pickupLng) ||
        !Number.isFinite(vanLat)    || !Number.isFinite(vanLng)
    ) {
        return res.status(400).json({ message: 'Valid pickupLat, pickupLng, vanLat, vanLng are required.' })
    }

    if (isSameRoutePoint(pickupLat, pickupLng, vanLat, vanLng)) {
        return res.status(200).json({
            coordinates: [
                [pickupLng, pickupLat],
                [vanLng, vanLat],
            ],
            profile: 'stationary',
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

            if (!Array.isArray(coordinates) || coordinates.length < 2) {
                continue
            }

            const cleaned = coordinates
                .filter((point) => Array.isArray(point) && point.length >= 2)
                .map(([lng, lat]) => [Number(lng), Number(lat)])

            if (cleaned.length < 2) {
                continue
            }

            return res.status(200).json({ coordinates: cleaned, profile })
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

module.exports = router

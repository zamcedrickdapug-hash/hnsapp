import { useState, useRef, useEffect, useCallback } from 'react'
import { DemoDrivingSimulator, DEMO_ROUTES } from '../utils/demoDrivingSimulator'

/**
 * Hook for demo driving simulation
 * Handles all demo mode logic including position updates and status changes
 */
export function useDemoDrivingSimulator(enabled = false) {
	const simulatorRef = useRef(null)
	const [position, setPosition] = useState(null)
	const [heading, setHeading] = useState(0)
	const [status, setStatus] = useState('Searching for driver')
	const [progress, setProgress] = useState(0)
	const [route, setRoute] = useState(null)
	const [isRunning, setIsRunning] = useState(false)
	const [isPaused, setIsPaused] = useState(false)

	// Initialize simulator
	useEffect(() => {
		if (!enabled) return

		simulatorRef.current = new DemoDrivingSimulator(
			(state) => {
				setPosition(state.position)
				setHeading(state.heading)
				setStatus(state.status)
				setProgress(state.progress)
			},
			(newStatus) => {
				setStatus(newStatus)
			},
			() => {
				// Route progress updated
			},
		)

		return () => {
			if (simulatorRef.current) {
				simulatorRef.current.stop()
			}
		}
	}, [enabled])

	// Start demo with specific route
	const startDemo = useCallback(
		(routeKey = 'CITY_CENTER') => {
			if (!simulatorRef.current) return

			const selectedRoute = DEMO_ROUTES[routeKey]
			setRoute(selectedRoute)
			simulatorRef.current.start(routeKey)
			setIsRunning(true)
			setIsPaused(false)
		},
		[]
	)

	// Pause demo
	const pauseDemo = useCallback(() => {
		if (!simulatorRef.current) return
		simulatorRef.current.pause()
		setIsPaused(true)
	}, [])

	// Resume demo
	const resumeDemo = useCallback(() => {
		if (!simulatorRef.current) return
		simulatorRef.current.resume()
		setIsPaused(false)
	}, [])

	// Stop demo
	const stopDemo = useCallback(() => {
		if (!simulatorRef.current) return
		simulatorRef.current.stop()
		setIsRunning(false)
		setIsPaused(false)
		setPosition(null)
		setProgress(0)
		setStatus('Searching for driver')
	}, [])

	return {
		position,
		heading,
		status,
		progress,
		route,
		isRunning,
		isPaused,
		startDemo,
		pauseDemo,
		resumeDemo,
		stopDemo,
		availableRoutes: Object.keys(DEMO_ROUTES).map((key) => ({
			key,
			name: DEMO_ROUTES[key].name,
		})),
	}
}

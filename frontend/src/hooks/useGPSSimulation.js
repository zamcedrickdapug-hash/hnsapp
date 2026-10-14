import { useEffect, useRef, useState, useCallback } from 'react'
import GPSSimulator from '../utils/gpsSimulation'
import { DEMO_CONFIG, createDemoTrip } from '../utils/demoConfig'

/**
 * Custom hook for managing GPS simulation and demo mode
 * Provides smooth vehicle movement, heading rotation, and status updates
 */
export function useGPSSimulation(isEnabled = false) {
	const simulatorRef = useRef(null)
	const [position, setPosition] = useState(null)
	const [heading, setHeading] = useState(0)
	const [isMoving, setIsMoving] = useState(false)
	const [status, setStatus] = useState('idle')
	const [progress, setProgress] = useState(0)
	const [eta, setEta] = useState(null)

	// Initialize simulator
	useEffect(() => {
		if (!isEnabled) return

		const simulator = new GPSSimulator({
			SPEED_MULTIPLIER: 2.0,
			UPDATE_INTERVAL: DEMO_CONFIG.TIMING.POSITION_UPDATE_INTERVAL,
			HEADING_SMOOTHING: 0.15,
		})

		simulator.onPositionUpdate = (state) => {
			setPosition(state.position)
			setHeading(state.heading)
			setIsMoving(state.isMoving)
			setProgress(state.progress)
		}

		simulator.onStatusChange = (newStatus) => {
			setStatus(newStatus)
		}

		simulatorRef.current = simulator
		return () => {
			simulator.stop()
		}
	}, [isEnabled])

	// Start simulation with route
	const startSimulation = useCallback((route, pickupLocation, destinationLocation) => {
		if (!simulatorRef.current) return false

		const success = simulatorRef.current.initialize(route, pickupLocation, destinationLocation)
		if (success) {
			simulatorRef.current.start()
		}
		return success
	}, [])

	// Stop simulation
	const stopSimulation = useCallback(() => {
		if (simulatorRef.current) {
			simulatorRef.current.stop()
		}
	}, [])

	// Pause/resume
	const pauseSimulation = useCallback(() => {
		if (simulatorRef.current) {
			simulatorRef.current.pause()
		}
	}, [])

	const resumeSimulation = useCallback(() => {
		if (simulatorRef.current) {
			simulatorRef.current.resume()
		}
	}, [])

	// Reset simulation
	const resetSimulation = useCallback(() => {
		if (simulatorRef.current) {
			simulatorRef.current.reset()
			setPosition(null)
			setHeading(0)
			setIsMoving(false)
			setStatus('idle')
			setProgress(0)
			setEta(null)
		}
	}, [])

	// Get current state
	const getState = useCallback(() => {
		if (!simulatorRef.current) return null
		return simulatorRef.current.getState()
	}, [])

	return {
		position,
		heading,
		isMoving,
		status,
		progress,
		eta,
		startSimulation,
		stopSimulation,
		pauseSimulation,
		resumeSimulation,
		resetSimulation,
		getState,
		isInitialized: !!simulatorRef.current,
	}
}

/**
 * Hook for managing demo mode scenarios
 */
export function useDemoMode(enabled = false) {
	const [demoTrip, setDemoTrip] = useState(null)
	const [scenario, setScenario] = useState('CITY_CENTER')
	const gpsSimulation = useGPSSimulation(enabled)

	const startDemoTrip = useCallback((scenarioKey = 'CITY_CENTER') => {
		const trip = createDemoTrip()
		setDemoTrip(trip)
		setScenario(scenarioKey)

		gpsSimulation.startSimulation(
			trip.route,
			trip.pickupLocation,
			trip.destinationLocation,
		)
	}, [gpsSimulation])

	const stopDemoTrip = useCallback(() => {
		gpsSimulation.stopSimulation()
		setDemoTrip(null)
	}, [gpsSimulation])

	const resetDemoTrip = useCallback(() => {
		gpsSimulation.resetSimulation()
		setDemoTrip(null)
	}, [gpsSimulation])

	return {
		...gpsSimulation,
		demoTrip,
		scenario,
		startDemoTrip,
		stopDemoTrip,
		resetDemoTrip,
		isDemoActive: !!demoTrip,
	}
}

export default useGPSSimulation

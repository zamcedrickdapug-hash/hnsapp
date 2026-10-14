/**
 * DriverDashboard.jsx - GPS Integration Example
 * 
 * This file shows exactly where and how to add GPS tracking to the existing DriverDashboard
 * Copy-paste ready code snippets
 */

// ============================================================================
// STEP 1: ADD IMPORT AT TOP OF FILE
// ============================================================================

import { useDriverGPSTracking } from '../../hooks/useDriverGPSTracking'

// ... existing imports ...


// ============================================================================
// STEP 2: ADD STATE IN COMPONENT
// ============================================================================

export default function DriverDashboard({ token, user, onLogout }) {
	// ... existing state ...

	// GPS TRACKING STATE
	const [gpsEnabled, setGpsEnabled] = useState(false)
	const [speedHistory, setSpeedHistory] = useState([])
	const [headingHistory, setHeadingHistory] = useState([])

	// GPS Tracking Hook - tracks driver location
	const gpsTracking = useDriverGPSTracking(
		socket,
		selectedRequestId,
		{
			enabled: gpsEnabled && !!selectedRequestId,
			minAccuracy: 100, // Accept readings within 100m accuracy
			updateInterval: 2000, // Update every 2 seconds
		}
	)

	// ... rest of component ...


// ============================================================================
// STEP 3: ADD EFFECT TO MANAGE GPS LIFECYCLE
// ============================================================================

	// Auto-enable GPS when trip is accepted
	useEffect(() => {
		if (!selectedTrip) {
			// No active trip - disable GPS
			if (gpsEnabled) {
				console.log('[Driver Dashboard] Stopping GPS - no active trip')
				setGpsEnabled(false)
			}
			return
		}

		// Trip is active (accepted, arrived, or picked_up)
		if (!gpsEnabled && ['accepted', 'arrived', 'picked_up'].includes(selectedTrip.status)) {
			console.log('[Driver Dashboard] Starting GPS for trip:', selectedRequestId)
			setGpsEnabled(true)
		}
	}, [selectedTrip, selectedRequestId, gpsEnabled])

	// Track speed history for ETA
	useEffect(() => {
		if (!gpsTracking.speed || gpsTracking.speed === 0) {
			return
		}

		setSpeedHistory(prev => {
			const updated = [...prev, gpsTracking.speed]
			return updated.slice(-20) // Keep last 20 readings
		})
	}, [gpsTracking.speed])

	// Track heading history
	useEffect(() => {
		if (gpsTracking.heading === undefined) {
			return
		}

		setHeadingHistory(prev => {
			const updated = [...prev, gpsTracking.heading]
			return updated.slice(-10) // Keep last 10 readings
		})
	}, [gpsTracking.heading])

	// Emit GPS location to Socket.io (already done by useDriverGPSTracking)
	// Just need to make sure Socket.io listens for 'gps:location-update' events on backend


// ============================================================================
// STEP 4: ADD UI FOR GPS STATUS DISPLAY
// ============================================================================

	// In your JSX, add this section to show GPS status:

	return (
		<div className="driver-dashboard">
			{/* ... existing dashboard content ... */}

			{/* GPS STATUS SECTION - Add this in the controls area */}
			{selectedTrip && (
				<div className="gps-tracking-section">
					<div className="gps-header">
						<h3>📡 Real-Time Tracking</h3>
						<span className={`gps-indicator ${gpsTracking.isTracking ? 'active' : 'inactive'}`}>
							{gpsTracking.isTracking ? '🟢 LIVE' : '⚪ INACTIVE'}
						</span>
					</div>

					{/* GPS Error Display */}
					{gpsTracking.error && (
						<div className="alert alert-error">
							<strong>⚠️ GPS Error:</strong> {gpsTracking.error}
							<button onClick={() => setGpsEnabled(true)}>Retry</button>
						</div>
					)}

					{/* Online Status */}
					{!gpsTracking.isOnline && (
						<div className="alert alert-warning">
							<strong>📡 Offline:</strong> No internet connection. Locations will sync when online.
						</div>
					)}

					{/* GPS Details - Only show when tracking */}
					{gpsTracking.isTracking && gpsTracking.location && (
						<div className="gps-details-grid">
							{/* Current Location */}
							<div className="gps-detail-item">
								<label>Current Location</label>
								<p className="gps-value">
									{gpsTracking.location.latitude.toFixed(6)},<br />
									{gpsTracking.location.longitude.toFixed(6)}
								</p>
							</div>

							{/* Speed */}
							<div className="gps-detail-item">
								<label>Speed</label>
								<p className="gps-value">
									{gpsTracking.speed.toFixed(1)} km/h
								</p>
							</div>

							{/* Heading */}
							<div className="gps-detail-item">
								<label>Direction</label>
								<p className="gps-value">
									{gpsTracking.heading}°
									<span className="heading-text">
										{gpsTracking.heading < 45 || gpsTracking.heading >= 315 ? '↑ N' : ''}
										{gpsTracking.heading >= 45 && gpsTracking.heading < 135 ? '→ E' : ''}
										{gpsTracking.heading >= 135 && gpsTracking.heading < 225 ? '↓ S' : ''}
										{gpsTracking.heading >= 225 && gpsTracking.heading < 315 ? '← W' : ''}
									</span>
								</p>
							</div>

							{/* Accuracy */}
							<div className="gps-detail-item">
								<label>Accuracy</label>
								<p className={`gps-value accuracy-${gpsTracking.accuracy < 50 ? 'high' : gpsTracking.accuracy < 100 ? 'medium' : 'low'}`}>
									±{gpsTracking.accuracy}m
								</p>
							</div>

							{/* Last Update */}
							<div className="gps-detail-item">
								<label>Last Update</label>
								<p className="gps-value">
									{gpsTracking.location?.timestamp 
										? new Date(gpsTracking.location.timestamp).toLocaleTimeString()
										: 'Never'}
								</p>
							</div>

							{/* Connection Status */}
							<div className="gps-detail-item">
								<label>Connection</label>
								<p className="gps-value">
									{gpsTracking.isOnline ? '🟢 Online' : '🔴 Offline'}
								</p>
							</div>
						</div>
					)}

					{/* Manual GPS Toggle */}
					<div className="gps-controls">
						<button
							className={`btn btn-gps ${gpsTracking.isTracking ? 'active' : ''}`}
							onClick={() => setGpsEnabled(!gpsEnabled)}
							disabled={!selectedTrip}
						>
							{gpsTracking.isTracking ? '🛑 Stop Tracking' : '▶️ Start Tracking'}
						</button>
					</div>
				</div>
			)}

			{/* ... rest of dashboard ... */}
		</div>
	)
}


// ============================================================================
// STEP 5: ADD STYLING (in DriverDashboard.scss)
// ============================================================================

/*
.gps-tracking-section {
	background: linear-gradient(135deg, rgba(79, 172, 254, 0.1), rgba(0, 242, 254, 0.05));
	border: 1px solid rgba(79, 172, 254, 0.3);
	border-radius: 12px;
	padding: 16px;
	margin: 16px 0;
	color: #fff;

	.gps-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;

		h3 {
			margin: 0;
			font-size: 16px;
			font-weight: 600;
		}

		.gps-indicator {
			font-size: 14px;
			font-weight: 600;

			&.active {
				color: #4caf50;
				animation: pulse-green 1s infinite;
			}

			&.inactive {
				color: #9e9e9e;
			}
		}
	}

	.alert {
		padding: 10px 12px;
		border-radius: 6px;
		margin-bottom: 10px;
		font-size: 13px;

		&.alert-error {
			background: rgba(244, 67, 54, 0.2);
			border: 1px solid rgba(244, 67, 54, 0.5);
			color: #ff6b6b;
		}

		&.alert-warning {
			background: rgba(255, 152, 0, 0.2);
			border: 1px solid rgba(255, 152, 0, 0.5);
			color: #ffb74d;
		}

		button {
			margin-left: 8px;
			padding: 4px 10px;
			background: rgba(255, 255, 255, 0.2);
			border: 1px solid rgba(255, 255, 255, 0.4);
			border-radius: 4px;
			color: inherit;
			cursor: pointer;
			font-size: 12px;

			&:hover {
				background: rgba(255, 255, 255, 0.3);
			}
		}
	}

	.gps-details-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 12px;
		margin-bottom: 12px;

		.gps-detail-item {
			background: rgba(10, 14, 39, 0.5);
			border: 1px solid rgba(79, 172, 254, 0.2);
			border-radius: 6px;
			padding: 10px;

			label {
				display: block;
				font-size: 11px;
				color: rgba(255, 255, 255, 0.6);
				text-transform: uppercase;
				letter-spacing: 0.5px;
				margin-bottom: 4px;
			}

			.gps-value {
				margin: 0;
				font-size: 14px;
				font-weight: 600;
				color: #00f2fe;
				font-family: 'Courier New', monospace;

				.heading-text {
					display: block;
					font-size: 12px;
					color: rgba(255, 255, 255, 0.7);
					margin-top: 2px;
				}

				&.accuracy-high {
					color: #4caf50;
				}

				&.accuracy-medium {
					color: #2196f3;
				}

				&.accuracy-low {
					color: #ff9800;
				}
			}
		}
	}

	.gps-controls {
		display: flex;
		gap: 8px;

		.btn-gps {
			flex: 1;
			padding: 10px 14px;
			background: rgba(79, 172, 254, 0.2);
			border: 2px solid rgba(79, 172, 254, 0.5);
			border-radius: 6px;
			color: #4facfe;
			font-weight: 600;
			cursor: pointer;
			transition: all 0.2s ease;

			&:hover:not(:disabled) {
				background: rgba(79, 172, 254, 0.4);
				border-color: #4facfe;
				color: #00f2fe;
			}

			&.active {
				background: rgba(76, 175, 80, 0.3);
				border-color: #4caf50;
				color: #4caf50;
			}

			&:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}
		}
	}
}

@keyframes pulse-green {
	0%, 100% {
		opacity: 1;
	}
	50% {
		opacity: 0.6;
	}
}
*/


// ============================================================================
// THAT'S IT! GPS IS NOW INTEGRATED!
// ============================================================================

/*
Summary of what was added:
1. ✅ Imported useDriverGPSTracking hook
2. ✅ Added GPS state variables
3. ✅ Initialized GPS tracking hook
4. ✅ Added lifecycle effects to manage GPS on/off
5. ✅ Added history tracking for ETA calculation
6. ✅ Added UI section to display GPS status
7. ✅ Added error handling and displays
8. ✅ Added manual controls for user

GPS will now:
- Start automatically when driver accepts a trip
- Track location every 2 seconds
- Send updates to Socket.io for parent dashboard
- Save locations to MongoDB
- Stop when trip is completed
- Show real-time status to driver
- Handle errors gracefully

Parent dashboard will now:
- See live vehicle marker on map
- See ETA updating in real-time
- See trip progress
- See distance remaining
- See driver information
- See smooth animations

Total integration time: ~15-20 minutes
Lines of code added: ~150 lines
*/

import React from 'react'
import './AnimatedVehicleMarker.css'

/**
 * Animated Vehicle Marker Component
 * Displays a rotating vehicle icon with glow effects
 * Simulates real-time movement and direction
 */
export default function AnimatedVehicleMarker({ heading = 0, isMoving = true, vehicleType = 'van' }) {
	return (
		<div className="vehicle-marker-wrapper">
			{/* Active glow effect when moving */}
			{isMoving && <div className="vehicle-marker-glow" />}

			{/* Main vehicle marker */}
			<div className="vehicle-marker" style={{ transform: `rotate(${heading}deg)` }}>
				{/* Outer ring pulse */}
				<div className="vehicle-marker-ring" />

				{/* Vehicle icon container */}
				<div className="vehicle-marker-icon">
					{vehicleType === 'van' && (
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
							{/* Van icon - from feather/lucide */}
							<path d="M2 3h20v9H2V3z" />
							<path d="M2 12h20" />
							<path d="M7 16v2m10 0v-2" />
							<circle cx="6" cy="18" r="2" />
							<circle cx="18" cy="18" r="2" />
							<path d="M2 12h2l2-4h12l2 4h2" />
						</svg>
					)}

					{vehicleType === 'car' && (
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
							{/* Car icon - top view */}
							<path d="M19 17H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2z" />
							<circle cx="6.5" cy="17" r="2.5" />
							<circle cx="17.5" cy="17" r="2.5" />
							<path d="M5 10h14" />
						</svg>
					)}

					{vehicleType === 'location' && (
						<svg viewBox="0 0 24 24" fill="currentColor">
							{/* Centered dot for default */}
							<circle cx="12" cy="12" r="3" />
						</svg>
					)}
				</div>

				{/* Direction indicator (arrow pointing forward) */}
				<div className="vehicle-marker-direction">
					<svg viewBox="0 0 24 24" fill="currentColor" width="8" height="8">
						<path d="M12 2l10 20H2z" />
					</svg>
				</div>
			</div>

			{/* Loading/active indicator */}
			{isMoving && <div className="vehicle-marker-pulse" />}
		</div>
	)
}

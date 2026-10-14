import React, { useMemo } from 'react'
import { Marker, Popup } from 'react-map-gl/maplibre'
import './AnimatedVehicleMarker.css'

/**
 * Vehicle icon SVG components
 */
const VehicleIcons = {
	van: (
		<svg
			width='40'
			height='40'
			viewBox='0 0 40 40'
			fill='none'
			xmlns='http://www.w3.org/2000/svg'
		>
			{/* Vehicle body with gradient */}
			<defs>
				<linearGradient id='vanGradient' x1='0%' y1='0%' x2='100%' y2='100%'>
					<stop offset='0%' style={{ stopColor: '#4facfe', stopOpacity: 1 }} />
					<stop offset='100%' style={{ stopColor: '#00f2fe', stopOpacity: 1 }} />
				</linearGradient>
			</defs>

			{/* Main body */}
			<rect x='8' y='12' width='24' height='16' rx='2' fill='url(#vanGradient)' stroke='#00d4ff' strokeWidth='1' />

			{/* Cabin */}
			<rect x='24' y='10' width='8' height='8' rx='1' fill='#00d4ff' />

			{/* Windows */}
			<rect x='10' y='14' width='6' height='4' fill='#1a3a4d' opacity='0.6' rx='1' />
			<rect x='18' y='14' width='6' height='4' fill='#1a3a4d' opacity='0.6' rx='1' />

			{/* Wheels */}
			<circle cx='12' cy='29' r='3' fill='#0a1f2e' stroke='#4facfe' strokeWidth='1' />
			<circle cx='28' cy='29' r='3' fill='#0a1f2e' stroke='#4facfe' strokeWidth='1' />

			{/* Direction indicator (arrow/triangle at front) */}
			<polygon points='32,20 35,18 35,22' fill='#ffd700' />
		</svg>
	),

	car: (
		<svg
			width='40'
			height='40'
			viewBox='0 0 40 40'
			fill='none'
			xmlns='http://www.w3.org/2000/svg'
		>
			<defs>
				<linearGradient id='carGradient' x1='0%' y1='0%' x2='100%' y2='100%'>
					<stop offset='0%' style={{ stopColor: '#4facfe', stopOpacity: 1 }} />
					<stop offset='100%' style={{ stopColor: '#00f2fe', stopOpacity: 1 }} />
				</linearGradient>
			</defs>

			{/* Body */}
			<ellipse cx='20' cy='20' rx='14' ry='10' fill='url(#carGradient)' stroke='#00d4ff' strokeWidth='1' />

			{/* Cabin */}
			<rect x='14' y='12' width='12' height='10' rx='2' fill='#1a3a4d' opacity='0.4' />

			{/* Windows */}
			<rect x='15' y='13' width='4' height='4' fill='#1a3a4d' opacity='0.6' rx='1' />
			<rect x='21' y='13' width='4' height='4' fill='#1a3a4d' opacity='0.6' rx='1' />

			{/* Wheels */}
			<circle cx='10' cy='24' r='3.5' fill='#0a1f2e' stroke='#4facfe' strokeWidth='1' />
			<circle cx='30' cy='24' r='3.5' fill='#0a1f2e' stroke='#4facfe' strokeWidth='1' />

			{/* Direction indicator */}
			<polygon points='32,20 36,20 34,22' fill='#ffd700' />
		</svg>
	),

	truck: (
		<svg
			width='40'
			height='40'
			viewBox='0 0 40 40'
			fill='none'
			xmlns='http://www.w3.org/2000/svg'
		>
			<defs>
				<linearGradient id='truckGradient' x1='0%' y1='0%' x2='100%' y2='100%'>
					<stop offset='0%' style={{ stopColor: '#4facfe', stopOpacity: 1 }} />
					<stop offset='100%' style={{ stopColor: '#00f2fe', stopOpacity: 1 }} />
				</linearGradient>
			</defs>

			{/* Cargo bed */}
			<rect x='6' y='14' width='20' height='14' rx='2' fill='url(#truckGradient)' stroke='#00d4ff' strokeWidth='1' />

			{/* Cabin */}
			<rect x='26' y='12' width='8' height='10' rx='1' fill='#00d4ff' />

			{/* Window */}
			<rect x='27' y='14' width='6' height='6' fill='#1a3a4d' opacity='0.6' rx='1' />

			{/* Wheels */}
			<circle cx='10' cy='29' r='3' fill='#0a1f2e' stroke='#4facfe' strokeWidth='1' />
			<circle cx='24' cy='29' r='3' fill='#0a1f2e' stroke='#4facfe' strokeWidth='1' />
			<circle cx='32' cy='29' r='3' fill='#0a1f2e' stroke='#4facfe' strokeWidth='1' />

			{/* Direction indicator */}
			<polygon points='34,21 38,21 36,23' fill='#ffd700' />
		</svg>
	),
}

/**
 * Animated Vehicle Marker Component
 * Displays a rotating vehicle icon with animations
 */
const AnimatedVehicleMarker = React.forwardRef(
	(
		{
			position,
			heading = 0,
			vehicleType = 'van',
			status = 'On The Way',
			isActive = true,
		},
		ref
	) => {
		if (!position || !Array.isArray(position) || position.length < 2) {
			return null
		}

		const icon = VehicleIcons[vehicleType] || VehicleIcons.van

		return (
			<Marker
				longitude={position[1]}
				latitude={position[0]}
				ref={ref}
				anchor='center'
				scale={1}
			>
				<div
					className={`vehicle-marker ${isActive ? 'active' : ''}`}
					style={{
						transform: `rotate(${heading}deg)`,
						animation: isActive ? 'vehicleGlow 2s ease-in-out infinite' : 'none',
					}}
				>
					{/* Pulsing glow background */}
					<div className='vehicle-glow' />

					{/* Glow ring */}
					<div className='vehicle-ring-pulse' />

					{/* Vehicle icon */}
					<div className='vehicle-icon'>{icon}</div>

					{/* Status badge */}
					{status && (
						<div className='vehicle-status-badge'>
							<span className='status-dot' />
							{status}
						</div>
					)}
				</div>
			</Marker>
		)
	}
)

AnimatedVehicleMarker.displayName = 'AnimatedVehicleMarker'

export default AnimatedVehicleMarker

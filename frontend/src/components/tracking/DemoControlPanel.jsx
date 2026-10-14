import React, { useState } from 'react'
import './DemoControlPanel.css'
import { Play, Pause, RotateCcw, Square } from 'lucide-react'

/**
 * Demo Control Panel
 * Simple UI for controlling demo playback
 */
function DemoControlPanel({
	isRunning,
	isPaused,
	progress,
	status,
	availableRoutes,
	selectedRoute,
	onStart,
	onPause,
	onResume,
	onStop,
	onRouteChange,
}) {
	const [showPanel, setShowPanel] = useState(true)

	if (!showPanel) {
		return (
			<button
				className='demo-toggle-btn'
				onClick={() => setShowPanel(true)}
				title='Show Demo Controls'
			>
				🎮
			</button>
		)
	}

	return (
		<div className='demo-control-panel'>
			<div className='demo-header'>
				<h3>🎬 Demo Mode</h3>
				<button
					className='close-btn'
					onClick={() => setShowPanel(false)}
					title='Minimize'
				>
					−
				</button>
			</div>

			<div className='demo-section'>
				<label>Route Scenario:</label>
				<select
					value={selectedRoute}
					onChange={(e) => onRouteChange(e.target.value)}
					disabled={isRunning}
					className='route-select'
				>
					{availableRoutes.map((route) => (
						<option key={route.key} value={route.key}>
							{route.name}
						</option>
					))}
				</select>
			</div>

			<div className='demo-controls'>
				{!isRunning ? (
					<button className='control-btn start' onClick={() => onStart(selectedRoute)}>
						<Play size={16} />
						Start
					</button>
				) : isPaused ? (
					<button className='control-btn resume' onClick={onResume}>
						<Play size={16} />
						Resume
					</button>
				) : (
					<button className='control-btn pause' onClick={onPause}>
						<Pause size={16} />
						Pause
					</button>
				)}

				<button className='control-btn stop' onClick={onStop} disabled={!isRunning}>
					<Square size={16} />
					Stop
				</button>

				<button className='control-btn reset' onClick={onStop}>
					<RotateCcw size={16} />
					Reset
				</button>
			</div>

			<div className='demo-status'>
				<div className='status-item'>
					<span className='label'>Status:</span>
					<span className='value'>{status}</span>
				</div>
				<div className='status-item'>
					<span className='label'>Progress:</span>
					<span className='value'>{Math.round(progress * 100)}%</span>
				</div>
			</div>

			<div className='progress-bar'>
				<div className='progress-fill' style={{ width: `${progress * 100}%` }} />
			</div>

			<div className='demo-info'>
				<p>✓ Demo mode works offline</p>
				<p>✓ No real GPS required</p>
				<p>✓ Perfect for presentations</p>
			</div>
		</div>
	)
}

export default DemoControlPanel

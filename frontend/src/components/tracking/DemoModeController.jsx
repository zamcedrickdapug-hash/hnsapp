import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Play, Pause, RotateCcw, Info } from 'lucide-react'
import './DemoModeController.css'

/**
 * Demo Mode Controller Component
 * Allows drivers to start, control, and monitor demo GPS tracking
 * Perfect for presentations and testing
 */
export function DemoModeController({
	isActive = false,
	isPaused = false,
	progress = 0,
	status = 'idle',
	onStart = () => {},
	onStop = () => {},
	onPause = () => {},
	onResume = () => {},
	onReset = () => {},
	scenarioOptions = ['CITY_CENTER', 'METRO_ROUTE', 'SUBURBS'],
	selectedScenario = 'CITY_CENTER',
	onScenarioChange = () => {},
}) {
	const [showInfo, setShowInfo] = useState(false)

	const handleStart = () => {
		if (!isActive) {
			onStart()
		}
	}

	const handlePauseResume = () => {
		if (isPaused) {
			onResume()
		} else {
			onPause()
		}
	}

	const handleStop = () => {
		onStop()
	}

	const handleReset = () => {
		onReset()
	}

	const scenarioLabels = {
		CITY_CENTER: 'City Center',
		METRO_ROUTE: 'Metro Area',
		SUBURBS: 'Suburban',
	}

	return (
		<motion.div
			className="demo-mode-controller"
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3 }}
		>
			<div className="controller-header">
				<h3>Demo Mode Controller</h3>
				<motion.button
					className="info-button"
					onClick={() => setShowInfo(!showInfo)}
					whileHover={{ scale: 1.1 }}
					whileTap={{ scale: 0.95 }}
				>
					<Info size={18} />
				</motion.button>
			</div>

			{/* Info Panel */}
			{showInfo && (
				<motion.div
					className="controller-info"
					initial={{ opacity: 0, height: 0 }}
					animate={{ opacity: 1, height: 'auto' }}
					exit={{ opacity: 0, height: 0 }}
				>
					<p>
						Demo mode simulates realistic vehicle movement along a predefined route.
						Perfect for presentations and testing the live tracking system.
					</p>
					<ul>
						<li>Choose a scenario (City Center, Metro, or Suburban)</li>
						<li>Click Start to begin the simulation</li>
						<li>Pause/Resume to control playback</li>
						<li>Reset to start over</li>
					</ul>
				</motion.div>
			)}

			{/* Scenario Selection */}
			<div className="controller-section">
				<label className="controller-label">Route Scenario</label>
				<div className="scenario-selector">
					{scenarioOptions.map((option) => (
						<motion.button
							key={option}
							className={`scenario-option ${selectedScenario === option ? 'active' : ''}`}
							onClick={() => onScenarioChange(option)}
							disabled={isActive}
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
						>
							{scenarioLabels[option]}
						</motion.button>
					))}
				</div>
			</div>

			{/* Status Display */}
			<div className="controller-section">
				<label className="controller-label">Trip Status</label>
				<motion.div
					className="status-display"
					animate={{ opacity: isActive ? 1 : 0.6 }}
				>
					<span className={`status-badge ${status.toLowerCase().replace(/\s+/g, '-')}`}>
						{status || 'Idle'}
					</span>
					<span className="progress-display">{Math.round(progress * 100)}%</span>
				</motion.div>
			</div>

			{/* Control Buttons */}
			<div className="controller-controls">
				{!isActive ? (
					<motion.button
						className="control-button start-button"
						onClick={handleStart}
						whileHover={{ scale: 1.05 }}
						whileTap={{ scale: 0.95 }}
					>
						<Play size={16} />
						Start Demo
					</motion.button>
				) : (
					<>
						<motion.button
							className="control-button pause-button"
							onClick={handlePauseResume}
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
						>
							<Pause size={16} />
							{isPaused ? 'Resume' : 'Pause'}
						</motion.button>

						<motion.button
							className="control-button stop-button"
							onClick={handleStop}
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
						>
							<span>●</span>
							Stop
						</motion.button>
					</>
				)}

				<motion.button
					className="control-button reset-button"
					onClick={handleReset}
					whileHover={{ scale: 1.05 }}
					whileTap={{ scale: 0.95 }}
				>
					<RotateCcw size={16} />
					Reset
				</motion.button>
			</div>

			{/* Progress Bar */}
			{isActive && (
				<motion.div
					className="controller-progress"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
				>
					<div className="progress-bar-container">
						<motion.div
							className="progress-bar-fill"
							initial={{ width: 0 }}
							animate={{ width: `${Math.min(progress * 100, 100)}%` }}
							transition={{ duration: 0.2 }}
						/>
					</div>
					<div className="progress-text">
						{Math.round(progress * 100)}% • {isPaused ? '⏸ Paused' : '▶ Running'}
					</div>
				</motion.div>
			)}
		</motion.div>
	)
}

export default DemoModeController

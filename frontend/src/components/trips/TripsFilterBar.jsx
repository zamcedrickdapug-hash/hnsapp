import { motion } from 'framer-motion'
import { Filter, X, Calendar } from 'lucide-react'
import { useState } from 'react'

const FILTER_OPTIONS = [
	{ value: 'all', label: 'All Trips' },
	{ value: 'completed', label: 'Completed' },
	{ value: 'on the way', label: 'On The Way' },
	{ value: 'cancelled', label: 'Cancelled' },
	{ value: 'searching', label: 'Searching' },
]

const SORT_OPTIONS = [
	{ value: 'date-desc', label: 'Newest First' },
	{ value: 'date-asc', label: 'Oldest First' },
	{ value: 'distance-desc', label: 'Longest Distance' },
	{ value: 'distance-asc', label: 'Shortest Distance' },
]

export default function TripsFilterBar({
	selectedFilter,
	onFilterChange,
	dateRange,
	onDateRangeChange,
	sortBy,
	onSortChange,
	filterCounts = {}, // NEW: Filter counts prop
}) {
	const [showAdvanced, setShowAdvanced] = useState(false)

	return (
		<motion.div className="filters-bar" initial={{ y: 8 }} animate={{ y: 0 }}>
			{/* Status Filter */}
			<div className="filter-group">
				<label className="filter-label">Status</label>
				<div className="filter-buttons">
					{FILTER_OPTIONS.map((option) => {
						// Get count for this filter
						const count = filterCounts[option.value] || 0

						return (
							<motion.button
								key={option.value}
								className={`filter-button ${selectedFilter === option.value ? 'active' : ''}`}
								aria-pressed={selectedFilter === option.value}
								onClick={() => {
									onFilterChange(option.value)
									// DEBUG: Log filter click
									console.log(`📌 Filter clicked: ${option.value} (${count} trips)`)
								}}
								whileHover={{ scale: 1.05 }}
								whileTap={{ scale: 0.95 }}
								title={`Show ${option.label.toLowerCase()} trips`}
							>
								<span className="filter-label-text">{option.label}</span>
								<span className="filter-count">{count}</span>
								{selectedFilter === option.value && (
									<motion.div
										className="filter-button-indicator"
										layoutId="filter-indicator"
										transition={{ type: 'spring', stiffness: 300, damping: 30 }}
									/>
								)}
							</motion.button>
						)
					})}
				</div>
			</div>

			{/* Sort */}
			<div className="filter-group">
				<label className="filter-label">Sort By</label>
				<select className="sort-select" value={sortBy} onChange={(e) => onSortChange(e.target.value)}>
					{SORT_OPTIONS.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
			</div>

			{/* Advanced Filters Toggle */}
			<motion.button
				className="advanced-filter-btn"
				onClick={() => setShowAdvanced(!showAdvanced)}
				aria-expanded={showAdvanced}
				whileHover={{ scale: 1.05 }}
				whileTap={{ scale: 0.95 }}
			>
				<Filter size={18} />
				<span>Advanced</span>
			</motion.button>

			{/* Advanced Filters */}
			<motion.div
				className="advanced-filters"
				initial={false}
				animate={{ height: showAdvanced ? 'auto' : 0 }}
				transition={{ type: 'spring', stiffness: 200, damping: 25 }}
				style={{ overflow: 'hidden' }}
			>
				<div className="advanced-filters-content">
					<div className="date-range-group">
						<label className="filter-label">
							<Calendar size={16} />
							Date Range
						</label>
						<div className="date-inputs">
							<input
								type="date"
								className="date-input"
								value={dateRange.start}
								onChange={(e) => onDateRangeChange({ ...dateRange, start: e.target.value })}
								placeholder="Start Date"
							/>
							<span className="date-separator">→</span>
							<input
								type="date"
								className="date-input"
								value={dateRange.end}
								onChange={(e) => onDateRangeChange({ ...dateRange, end: e.target.value })}
								placeholder="End Date"
							/>
						</div>
					</div>

					{(dateRange.start || dateRange.end) && (
						<motion.button
							className="clear-dates-btn"
							onClick={() => onDateRangeChange({ start: '', end: '' })}
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
						>
							<X size={16} />
							Clear Dates
						</motion.button>
					)}
				</div>
			</motion.div>
		</motion.div>
	)
}

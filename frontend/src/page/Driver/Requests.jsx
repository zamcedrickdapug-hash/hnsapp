import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'

function formatDate(dateValue) {
	if (!dateValue) {
		return 'N/A'
	}

	return new Date(dateValue).toLocaleString()
}

function formatLocation(location) {
	if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
		return 'Location not shared'
	}

	return `${Number(location.latitude).toFixed(6)}, ${Number(location.longitude).toFixed(6)}`
}

function buildMapLink(location) {
	if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
		return ''
	}

	return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`
}

export default function Requests({
	requests,
	acceptingRequestId,
	acceptError,
	onAcceptRequest,
	onRejectRequest,
	highlightedRequestId,
	driverOnline,
	driverBusy,
	availabilityLoading,
	onToggleAvailability,
}) {
	const searchingRequests = requests.filter((item) => item.status === 'searching')

	return (
		<section className="driver-requests-section">
			<header className="driver-main__header">
				<h1>Requests</h1>
				<p>Review incoming parent school van requests and accept an available trip.</p>
			</header>

			<Card>
				<CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
					<div>
						<p className="font-semibold">{driverBusy ? 'Handling an active request' : driverOnline ? 'Available for requests' : 'You are offline'}</p>
						<p className="text-sm text-on-dark-label">Only approved, active drivers who are online can accept a request.</p>
					</div>
					<Button
						onClick={onToggleAvailability}
						disabled={availabilityLoading || driverBusy}
						variant={driverOnline ? 'outline' : 'default'}
					>
						{availabilityLoading ? 'Updating...' : driverOnline ? 'Go Offline' : 'Go Online'}
					</Button>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Incoming Ride Requests</CardTitle>
					<CardDescription>These requests are waiting for an available driver.</CardDescription>
				</CardHeader>
				<CardContent className="driver-requests-list">
					{acceptError ? (
						<div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
							{acceptError}
						</div>
					) : null}
					{searchingRequests.length === 0 ? (
						<p className="driver-empty-text">No pending requests right now.</p>
					) : null}

					{searchingRequests.map((request) => (
						<div
							key={request._id}
							className={`driver-request-item ${String(request._id) === highlightedRequestId ? 'driver-request-item--new' : ''}`}
						>
							<div className="driver-request-item__meta">
								<h4>{request.parent?.fullName || 'Parent Account'}</h4>
								<p>
									<strong>Student:</strong> {request.studentName}
								</p>
								<p>
									<strong>Pickup Zone:</strong> {request.pickupZone}
								</p>
								<p>
									<strong>School:</strong> {request.schoolName || 'Not set'}
								</p>
								<p>
									<strong>Requester Location:</strong> {formatLocation(request.requesterLocation)}
								</p>
								{buildMapLink(request.requesterLocation) ? (
									<a className="driver-map-link" href={buildMapLink(request.requesterLocation)} target="_blank" rel="noreferrer">
										Open in Google Maps
									</a>
								) : null}
								<small className="text-sm">{formatDate(request.createdAt)}</small>
							</div>

							<div className="flex gap-2">
								<Button
									onClick={() => onAcceptRequest(request._id)}
									disabled={acceptingRequestId === request._id || !driverOnline}
								>
									{acceptingRequestId === request._id ? 'Processing...' : 'Accept Request'}
								</Button>
								<Button
									onClick={() => onRejectRequest(request._id)}
									disabled={acceptingRequestId === request._id}
									variant="outline"
								>
									Reject
								</Button>
							</div>
						</div>
					))}
				</CardContent>
			</Card>
		</section>
	)
}

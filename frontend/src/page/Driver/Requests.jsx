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

export default function Requests({ requests, acceptingRequestId, onAcceptRequest }) {
	const searchingRequests = requests.filter((item) => item.status === 'searching')

	return (
		<section className="driver-requests-section">
			<header className="driver-main__header">
				<h1>Requests</h1>
				<p>Review incoming parent school van requests and accept an available trip.</p>
			</header>

			<Card>
				<CardHeader>
					<CardTitle>Incoming Ride Requests</CardTitle>
					<CardDescription>These requests are waiting for an available driver.</CardDescription>
				</CardHeader>
				<CardContent className="driver-requests-list">
					{searchingRequests.length === 0 ? (
						<p className="driver-empty-text">No pending requests right now.</p>
					) : null}

					{searchingRequests.map((request) => (
						<div key={request._id} className="driver-request-item">
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
								<small>{formatDate(request.createdAt)}</small>
							</div>

							<Button
								onClick={() => onAcceptRequest(request._id)}
								disabled={acceptingRequestId === request._id}
							>
								{acceptingRequestId === request._id ? 'Accepting...' : 'Accept Request'}
							</Button>
						</div>
					))}
				</CardContent>
			</Card>
		</section>
	)
}

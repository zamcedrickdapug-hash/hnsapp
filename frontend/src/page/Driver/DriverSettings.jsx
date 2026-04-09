import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'

export default function DriverSettings({
	user,
	profileData,
	photoName,
	driverIdName,
	savingProfile,
	profileStatus,
	onFieldChange,
	onPhotoChange,
	onDriverIdChange,
	onSave,
}) {
	return (
		<section className="driver-settings-section">
			<header className="driver-main__header">
				<h1>Driver Settings</h1>
				<p>Manage your driver profile details for parent visibility and dispatch matching.</p>
			</header>

			<Card className="driver-profile-card">
				<CardHeader className="driver-section-head">
					<div>
						<CardTitle>Driver Profile Information</CardTitle>
						<CardDescription>
							Update only operational details required for trip assignment and tracking.
						</CardDescription>
					</div>
					<span className="driver-pill">Settings</span>
				</CardHeader>

				<CardContent>
					<form className="driver-profile-grid" onSubmit={onSave}>
						<section className="driver-profile-uploads">
							<div className="upload-box">
								<p>PROFILE PHOTO</p>
								<div className="upload-placeholder">{photoName || 'No photo selected'}</div>
							</div>

							<div className="upload-box">
								<p>DRIVER ID FILE</p>
								<div className="upload-placeholder">{driverIdName || 'No file selected'}</div>
							</div>
						</section>

						<section className="driver-profile-fields">
							<label>
								<span>Driver Full Name</span>
								<Input value={user.fullName} readOnly />
							</label>

							<label>
								<span>Driver Phone</span>
								<Input
									value={profileData.driverPhone}
									onChange={(event) => onFieldChange('driverPhone', event.target.value)}
									placeholder="09XXXXXXXXX"
									required
								/>
							</label>

							<label>
								<span>Vehicle Type</span>
								<Input
									value={profileData.vehicleType}
									onChange={(event) => onFieldChange('vehicleType', event.target.value)}
									placeholder="School Service Van"
									required
								/>
							</label>

							<label>
								<span>Plate Number</span>
								<Input
									value={profileData.plateNumber}
									onChange={(event) => onFieldChange('plateNumber', event.target.value)}
									placeholder="NAB 1234"
									required
								/>
							</label>

							<label>
								<span>License Number</span>
								<Input
									value={profileData.licenseNumber}
									onChange={(event) => onFieldChange('licenseNumber', event.target.value)}
									placeholder="D12-34-567890"
									required
								/>
							</label>

							<label>
								<span>License Expiry</span>
								<Input
									value={profileData.licenseExpiry}
									onChange={(event) => onFieldChange('licenseExpiry', event.target.value)}
									placeholder="MM/YYYY"
								/>
							</label>

							<label>
								<span>Emergency Contact</span>
								<Input
									value={profileData.emergencyContact}
									onChange={(event) => onFieldChange('emergencyContact', event.target.value)}
									placeholder="09XXXXXXXXX"
								/>
							</label>

							<label>
								<span>Driver Address</span>
								<Input
									value={profileData.driverAddress}
									onChange={(event) => onFieldChange('driverAddress', event.target.value)}
									placeholder="Enter home address"
								/>
							</label>

							<label className="driver-upload-field driver-upload-field--full">
								<span>Profile Photo</span>
								<input type="file" accept="image/*" onChange={onPhotoChange} />
								<small>{photoName}</small>
							</label>

							<label className="driver-upload-field driver-upload-field--full">
								<span>Driver ID</span>
								<input type="file" accept="image/*,.pdf" onChange={onDriverIdChange} />
								<small>{driverIdName}</small>
							</label>

							<div className="driver-profile-actions driver-upload-field--full">
								<Button type="submit" disabled={savingProfile}>
									{savingProfile ? 'Saving...' : 'Save Driver Settings'}
								</Button>
							</div>
							{profileStatus ? <p className="driver-success-text driver-upload-field--full">{profileStatus}</p> : null}
						</section>
					</form>
				</CardContent>
			</Card>
		</section>
	)
}

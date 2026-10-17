import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'

function todayString() {
	const today = new Date()
	return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

export default function DriverSettings({
	user,
	profileData,
	photoName,
	driverIdName,
	photoPreview,
	driverIdPreview,
	savingProfile,
	profileStatus,
	fileError,
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
				</CardHeader>

				<CardContent>
					<form className="driver-profile-grid" onSubmit={onSave}>
						{fileError && (
							<div className="driver-error-text">
								{fileError}
							</div>
						)}
						
						<section className="driver-profile-uploads">
							<div className="upload-box">
								<p>Profile Photo</p>
								<small className="driver-upload-note">Your profile photo is set by the administrator</small>
								{photoPreview ? (
									<div className="upload-placeholder upload-placeholder--with-image">
										<img src={photoPreview} alt="Profile preview" />
									</div>
								) : (
									<div className="upload-placeholder">{photoName || 'No photo selected'}</div>
								)}
								<label className="driver-upload-field">
									<span>Profile Photo</span>
									<input type="file" accept="image/*" onChange={onPhotoChange} />
									<small>{photoName}</small>
								</label>
							</div>

							<div className="upload-box">
								<p>Driver ID File</p>
								{driverIdPreview ? (
									<div className="upload-placeholder upload-placeholder--with-image">
										{driverIdName?.toLowerCase().endsWith('.pdf') ? (
											<div className="pdf-placeholder">📄 PDF</div>
										) : (
											<img src={driverIdPreview} alt="Driver ID preview" />
										)}
									</div>
								) : (
									<div className="upload-placeholder">{driverIdName || 'No file selected'}</div>
								)}
								<label className="driver-upload-field">
									<span>Driver ID</span>
									<input type="file" accept="image/*,.pdf" onChange={onDriverIdChange} />
									<small>{driverIdName}</small>
								</label>
							</div>
						</section>

						<section className="driver-settings-fields">
							<div className="driver-settings-group">
								<header className="driver-settings-group__header">
									<h2>Personal information</h2>
									<p>Your contact details and address for trip coordination.</p>
								</header>
								<div className="driver-profile-fields">
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
								</div>
							</div>

							<div className="driver-settings-group">
								<header className="driver-settings-group__header">
									<h2>Vehicle</h2>
									<p>Keep vehicle details current for dispatch and matching.</p>
								</header>
								<div className="driver-profile-fields">
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
										<span>Vehicle Color</span>
										<Input
											value={profileData.vehicleColor}
											onChange={(event) => onFieldChange('vehicleColor', event.target.value)}
											maxLength={30}
										/>
									</label>
									<label>
										<span>Seat Capacity</span>
										<Input
											type="number"
											value={profileData.seatCapacity}
											onChange={(event) => onFieldChange('seatCapacity', event.target.value)}
											min="3"
											max="20"
											step="1"
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
								</div>
							</div>

							<div className="driver-settings-group">
								<header className="driver-settings-group__header">
									<h2>License</h2>
									<p>Provide valid license details for account verification.</p>
								</header>
								<div className="driver-profile-fields">
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
											type="date"
											value={profileData.licenseExpiry}
											onChange={(event) => onFieldChange('licenseExpiry', event.target.value)}
											min={todayString()}
										/>
									</label>
								</div>
							</div>
						</section>

						<div className="driver-profile-actions driver-upload-field--full">
							<Button type="submit" disabled={savingProfile} className="driver-settings-save">
								{savingProfile ? 'Saving...' : 'Save Driver Settings'}
							</Button>
						</div>
						
						{profileStatus && (
							<p className="driver-success-text driver-upload-field--full">
								{profileStatus}
							</p>
						)}
					</form>
				</CardContent>
			</Card>
		</section>
	)
}

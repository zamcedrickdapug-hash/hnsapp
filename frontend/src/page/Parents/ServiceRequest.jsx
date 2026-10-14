import { useState } from 'react'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import './ServiceRequest.scss'

const defaultForm = {
	parentName: '',
	parentPhone: '',
	studentName: '',
	schoolName: '',
	gradeSection: '',
	emergencyContact: '',
	pickupAddress: '',
	notes: '',
}

export default function ServiceRequest({ user }) {
	const [formData, setFormData] = useState({
		...defaultForm,
		parentName: user?.fullName || '',
	})
	const [status, setStatus] = useState('')

	const updateField = (fieldName, fieldValue) => {
		setFormData((current) => ({
			...current,
			[fieldName]: fieldValue,
		}))
	}

	const handleSubmit = (event) => {
		event.preventDefault()
		setStatus('Service request saved locally. Connect this form to your backend endpoint next.')
	}

	const handleReset = () => {
		setFormData({
			...defaultForm,
			parentName: user?.fullName || '',
		})
		setStatus('')
	}

	return (
		<section className="service-request">
			<header className="service-request__header">
				<h1>Service Request</h1>
				<p>Submit a school service request for your child</p>
			</header>

			<form className="service-request__panel" onSubmit={handleSubmit}>
				<div className="service-request__grid">
					<label className="service-request__field">
						<span>Parent Name</span>
						<Input
							value={formData.parentName}
							onChange={(event) => updateField('parentName', event.target.value)}
							placeholder="Enter parent name"
							required
						/>
					</label>

					<label className="service-request__field">
						<span>Parent Phone</span>
						<Input
							value={formData.parentPhone}
							onChange={(event) => updateField('parentPhone', event.target.value)}
							placeholder="09XXXXXXXXX"
							required
						/>
					</label>

					<label className="service-request__field">
						<span>Student Name</span>
						<Input
							value={formData.studentName}
							onChange={(event) => updateField('studentName', event.target.value)}
							placeholder="Enter student name"
							required
						/>
					</label>

					<label className="service-request__field">
						<span>School Name</span>
						<Input
							value={formData.schoolName}
							onChange={(event) => updateField('schoolName', event.target.value)}
							placeholder="Enter school name"
							required
						/>
					</label>

					<label className="service-request__field">
						<span>Grade / Section</span>
						<Input
							value={formData.gradeSection}
							onChange={(event) => updateField('gradeSection', event.target.value)}
							placeholder="Example: Grade 5 - Rizal"
							required
						/>
					</label>

					<label className="service-request__field">
						<span>Emergency Contact</span>
						<Input
							value={formData.emergencyContact}
							onChange={(event) => updateField('emergencyContact', event.target.value)}
							placeholder="09XXXXXXXXX"
							required
						/>
					</label>

					<label className="service-request__field service-request__field--full">
						<span>Pickup Address</span>
						<Input
							value={formData.pickupAddress}
							onChange={(event) => updateField('pickupAddress', event.target.value)}
							placeholder="Enter pickup address"
							required
						/>
					</label>

					<label className="service-request__field service-request__field--full">
						<span>Notes for Driver</span>
						<textarea
							className="service-request__textarea"
							value={formData.notes}
							onChange={(event) => updateField('notes', event.target.value)}
							placeholder="Enter instructions, child details, landmark, or any important reminder"
							rows={5}
						/>
					</label>
				</div>

				<div className="service-request__actions">
					<Button type="button" variant="secondary" onClick={handleReset}>
						Clear
					</Button>
					<Button type="submit">Submit Request</Button>
				</div>

				{status ? <p className="service-request__status">{status}</p> : null}
			</form>
		</section>
	)
}

import { useState } from 'react';
import { apiFetch } from '../../api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import './signup.scss';

const initialForm = {
	role: 'parent',
	fullName: '',
	email: '',
	phone: '',
	homeAddress: '',
	password: '',
	confirmPassword: '',
	studentFullName: '',
	age: '',
	gradeLevel: '',
	studentNumber: '',
	schoolName: '',
	licenseNumber: '',
	licenseExpiry: '',
	vehicleType: '',
	plateNumber: '',
	yearsOfExperience: '',
};

export default function SignupPage() {
	const [form, setForm] = useState(initialForm);
	const [validIdFile, setValidIdFile] = useState(null);
	const [submitting, setSubmitting] = useState(false);
	const [errors, setErrors] = useState([]);
	const [success, setSuccess] = useState('');

	const handleChange = (event) => {
		const { name, value } = event.target;

		setForm((current) => ({
			...current,
			[name]: value,
		}));
	};

	const handleSubmit = async (event) => {
		event.preventDefault();

		setSubmitting(true);
		setErrors([]);
		setSuccess('');

		const payload = new FormData();

		Object.entries(form).forEach(([key, value]) => {
			payload.append(key, String(value || '').trim());
		});

		if (validIdFile) {
			payload.append('validId', validIdFile);
		}

		try {
			const response = await apiFetch('/api/parents/register', {
				method: 'POST',
				body: payload,
			});

			setSuccess(response.message || 'Registration submitted successfully.');
			setForm(initialForm);
			setValidIdFile(null);
		} catch (requestError) {
			if (Array.isArray(requestError?.data?.errors)) {
				setErrors(requestError.data.errors);
			} else {
				setErrors([requestError.message || 'Unable to submit registration.']);
			}
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<section className="signup-page">
			<h2>Create Account</h2>
			<p>
				Select your role and complete the required details. All accounts stay Pending Verification until approved by admin.
			</p>

			<form className="registration-form" onSubmit={handleSubmit}>
				<fieldset>
					<legend>Account Role</legend>

					<label>
						Role
						<Select name="role" value={form.role} onChange={handleChange}>
							<option value="parent">Parent</option>
							<option value="driver">Driver</option>
						</Select>
					</label>
				</fieldset>

				<fieldset>
					<legend>{form.role === 'parent' ? 'Parent Information' : 'Driver Information'}</legend>

					<label>
						Full Name
						<Input name="fullName" value={form.fullName} onChange={handleChange} required />
					</label>

					<label>
						Email Address
						<Input name="email" type="email" value={form.email} onChange={handleChange} required />
					</label>

					<label>
						Phone Number
						<Input name="phone" value={form.phone} onChange={handleChange} required />
					</label>

					<label>
						Home Address
						<Input name="homeAddress" value={form.homeAddress} onChange={handleChange} required />
					</label>

					<label>
						Password
						<Input name="password" type="password" value={form.password} onChange={handleChange} required />
					</label>

					<label>
						Confirm Password
						<Input
							name="confirmPassword"
							type="password"
							value={form.confirmPassword}
							onChange={handleChange}
							required
						/>
					</label>

					<label>
						Valid ID (Image or PDF)
						<Input
							type="file"
							accept=".jpg,.jpeg,.png,.webp,.pdf"
							onChange={(event) => setValidIdFile(event.target.files?.[0] || null)}
							required
						/>
					</label>
				</fieldset>

				{form.role === 'parent' ? (
					<fieldset>
						<legend>Student Information</legend>

						<label>
							Student Full Name
							<Input name="studentFullName" value={form.studentFullName} onChange={handleChange} required />
						</label>

						<label>
							Age
							<Input name="age" type="number" min="3" max="25" value={form.age} onChange={handleChange} required />
						</label>

						<label>
							Grade Level
							<Input name="gradeLevel" value={form.gradeLevel} onChange={handleChange} required />
						</label>

						<label>
							Student Number
							<Input name="studentNumber" value={form.studentNumber} onChange={handleChange} required />
						</label>

						<label>
							School Name
							<Input name="schoolName" value={form.schoolName} onChange={handleChange} required />
						</label>
					</fieldset>
				) : (
					<fieldset>
						<legend>Driver Verification Details</legend>

						<label>
							License Number
							<Input name="licenseNumber" value={form.licenseNumber} onChange={handleChange} required />
						</label>

						<label>
							License Expiry Date
							<Input name="licenseExpiry" type="date" value={form.licenseExpiry} onChange={handleChange} required />
						</label>

						<label>
							Vehicle Type
							<Input name="vehicleType" value={form.vehicleType} onChange={handleChange} required />
						</label>

						<label>
							Plate Number
							<Input name="plateNumber" value={form.plateNumber} onChange={handleChange} required />
						</label>

						<label>
							Years of Experience
							<Input
								name="yearsOfExperience"
								type="number"
								min="0"
								max="60"
								value={form.yearsOfExperience}
								onChange={handleChange}
								required
							/>
						</label>
					</fieldset>
				)}

				<Button type="submit" disabled={submitting}>
					{submitting ? 'Submitting Application...' : 'Submit Registration'}
				</Button>
			</form>

			{errors.length > 0 ? (
				<ul className="errors">
					{errors.map((error) => (
						<li key={error}>{error}</li>
					))}
				</ul>
			) : null}

			{success ? <p className="success">{success}</p> : null}
		</section>
	);
}

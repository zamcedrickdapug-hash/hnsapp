import React, { useState } from 'react';
import { validateEmail, validatePhoneNumber, validatePasswordStrength } from '../../utils/licenseValidation';
import { apiFetch } from '../../api';

/**
 * Phase 3 - Driver Application Form Component
 * Comprehensive driver onboarding - NOT instant approval
 * Admin review required before driver activation
 */
function Phase3DriverApplicationForm() {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // All form data
  const [formData, setFormData] = useState({
    // Personal Info
    firstName: '',
    lastName: '',
    gender: '',
    dateOfBirth: '',
    email: '',
    contactNumber: '',
    address: '',
    password: '',
    confirmPassword: '',

    // Professional Details
    yearsExperience: '',
    licenseNumber: '',
    licenseType: 'professional',
    licenseExpirationDate: '',
    nbiClearanceNumber: '',

    // Vehicle Details
    vehicleType: '',
    vehicleBrand: '',
    vehicleColor: '',
    plateNumber: '',
    seatingCapacity: '',
  });

  const [fieldErrors, setFieldErrors] = useState({});

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  };

  // Validation for specific steps
  const validateStep = (step) => {
    const errors = {};

    if (step === 1) {
      if (!formData.firstName.trim()) errors.firstName = 'First name required';
      if (!formData.lastName.trim()) errors.lastName = 'Last name required';
      if (!formData.gender) errors.gender = 'Gender required';
      if (!formData.dateOfBirth) errors.dateOfBirth = 'Date of birth required';

      const emailVal = validateEmail(formData.email);
      if (!emailVal.valid) errors.email = emailVal.message;

      const phoneVal = validatePhoneNumber(formData.contactNumber);
      if (!phoneVal.valid) errors.contactNumber = phoneVal.message;

      if (!formData.address.trim()) errors.address = 'Address required';

      const passwordVal = validatePasswordStrength(formData.password);
      if (!passwordVal.valid) errors.password = passwordVal.message;

      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
    }

    if (step === 2) {
      if (!formData.yearsExperience) errors.yearsExperience = 'Years of experience required';
      if (parseInt(formData.yearsExperience) < 1) {
        errors.yearsExperience = 'Must have at least 1 year experience';
      }

      if (!formData.licenseNumber.trim()) errors.licenseNumber = 'License number required';
      if (!formData.licenseType) errors.licenseType = 'License type required';
      if (!formData.licenseExpirationDate) errors.licenseExpirationDate = 'License expiration required';
      if (!formData.nbiClearanceNumber.trim()) errors.nbiClearanceNumber = 'NBI clearance number required';
    }

    if (step === 3) {
      if (!formData.vehicleType) errors.vehicleType = 'Vehicle type required';
      if (!formData.vehicleBrand.trim()) errors.vehicleBrand = 'Vehicle brand required';
      if (!formData.vehicleColor.trim()) errors.vehicleColor = 'Vehicle color required';
      if (!formData.plateNumber.trim()) errors.plateNumber = 'Plate number required';
      if (!formData.seatingCapacity) errors.seatingCapacity = 'Seating capacity required';

      if (parseInt(formData.seatingCapacity) < 3) {
        errors.seatingCapacity = 'Vehicle must have at least 3 seats';
      }
    }

    return errors;
  };

  const handleStepSubmit = async (step) => {
    const errors = validateStep(step);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Please correct the errors below');
      return;
    }

    if (step < 3) {
      setCurrentStep(step + 1);
      return;
    }

    // Final submission
    submitApplication();
  };

  const submitApplication = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('/api/phase3/driver/apply', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.message || 'Application submission failed');
        setLoading(false);
        return;
      }

      setSubmitSuccess(true);
      setCurrentStep(4);
    } catch (err) {
      setError('Failed to submit application');
      setLoading(false);
    }
  };

  const progressPercent = (currentStep / 4) * 100;

  // Success screen
  if (submitSuccess && currentStep === 4) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-800/50 border border-slate-700/50 rounded-xl p-8 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-3xl font-bold text-white mb-2">Application Submitted!</h1>
          <p className="text-slate-300 mb-6">
            Thank you for applying. Your application is under review by our admin team.
          </p>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
            <p className="text-blue-300 text-sm">
              <strong>Next Step:</strong> You will receive an email once your application is approved. Only approved
              drivers can access the dashboard and accept trips.
            </p>
          </div>

          <button
            onClick={() => (window.location.href = '/login')}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">🚗 Professional Driver Application</h1>
          <p className="text-slate-400">Step {currentStep} of 3</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">{error}</div>
        )}

        {/* Form Container */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-8 backdrop-blur">
          {/* STEP 1: Personal Information */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white mb-6">Personal Information</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">First Name *</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    className={`w-full px-4 py-2 bg-slate-700 border-2 rounded-lg text-white ${
                      fieldErrors.firstName ? 'border-red-500' : 'border-slate-600'
                    }`}
                  />
                  {fieldErrors.firstName && <p className="text-red-400 text-xs mt-1">{fieldErrors.firstName}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">Last Name *</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    className={`w-full px-4 py-2 bg-slate-700 border-2 rounded-lg text-white ${
                      fieldErrors.lastName ? 'border-red-500' : 'border-slate-600'
                    }`}
                  />
                  {fieldErrors.lastName && <p className="text-red-400 text-xs mt-1">{fieldErrors.lastName}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Gender *</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => handleInputChange('gender', e.target.value)}
                    className={`w-full px-4 py-2 bg-slate-700 border-2 rounded-lg text-white ${
                      fieldErrors.gender ? 'border-red-500' : 'border-slate-600'
                    }`}
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">Date of Birth *</label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                    className={`w-full px-4 py-2 bg-slate-700 border-2 rounded-lg text-white ${
                      fieldErrors.dateOfBirth ? 'border-red-500' : 'border-slate-600'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={`w-full px-4 py-2 bg-slate-700 border-2 rounded-lg text-white ${
                    fieldErrors.email ? 'border-red-500' : 'border-slate-600'
                  }`}
                />
                {fieldErrors.email && <p className="text-red-400 text-xs mt-1">{fieldErrors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Contact Number *</label>
                <input
                  type="tel"
                  value={formData.contactNumber}
                  onChange={(e) => handleInputChange('contactNumber', e.target.value)}
                  placeholder="09171234567"
                  className={`w-full px-4 py-2 bg-slate-700 border-2 rounded-lg text-white ${
                    fieldErrors.contactNumber ? 'border-red-500' : 'border-slate-600'
                  }`}
                />
                {fieldErrors.contactNumber && <p className="text-red-400 text-xs mt-1">{fieldErrors.contactNumber}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Address *</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Street address"
                  className={`w-full px-4 py-2 bg-slate-700 border-2 rounded-lg text-white ${
                    fieldErrors.address ? 'border-red-500' : 'border-slate-600'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Password *</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className={`w-full px-4 py-2 bg-slate-700 border-2 rounded-lg text-white ${
                      fieldErrors.password ? 'border-red-500' : 'border-slate-600'
                    }`}
                  />
                  {fieldErrors.password && <p className="text-red-400 text-xs mt-1">{fieldErrors.password}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">Confirm Password *</label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    className={`w-full px-4 py-2 bg-slate-700 border-2 rounded-lg text-white ${
                      fieldErrors.confirmPassword ? 'border-red-500' : 'border-slate-600'
                    }`}
                  />
                  {fieldErrors.confirmPassword && <p className="text-red-400 text-xs mt-1">{fieldErrors.confirmPassword}</p>}
                </div>
              </div>

              <button
                onClick={() => handleStepSubmit(1)}
                className="w-full py-3 mt-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800"
              >
                Continue to Professional Details
              </button>
            </div>
          )}

          {/* STEP 2: Professional Details */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white mb-6">Professional Details</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Years of Experience *</label>
                  <input
                    type="number"
                    value={formData.yearsExperience}
                    onChange={(e) => handleInputChange('yearsExperience', e.target.value)}
                    min="1"
                    max="60"
                    className={`w-full px-4 py-2 bg-slate-700 border-2 rounded-lg text-white ${
                      fieldErrors.yearsExperience ? 'border-red-500' : 'border-slate-600'
                    }`}
                  />
                  {fieldErrors.yearsExperience && <p className="text-red-400 text-xs mt-1">{fieldErrors.yearsExperience}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">License Type *</label>
                  <select
                    value={formData.licenseType}
                    onChange={(e) => handleInputChange('licenseType', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border-2 border-slate-600 rounded-lg text-white"
                  >
                    <option value="professional">Professional</option>
                    <option value="nonprofessional">Non-Professional</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">License Number *</label>
                <input
                  type="text"
                  value={formData.licenseNumber}
                  onChange={(e) => handleInputChange('licenseNumber', e.target.value)}
                  className={`w-full px-4 py-2 bg-slate-700 border-2 rounded-lg text-white ${
                    fieldErrors.licenseNumber ? 'border-red-500' : 'border-slate-600'
                  }`}
                />
                {fieldErrors.licenseNumber && <p className="text-red-400 text-xs mt-1">{fieldErrors.licenseNumber}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">License Expiration Date *</label>
                <input
                  type="date"
                  value={formData.licenseExpirationDate}
                  onChange={(e) => handleInputChange('licenseExpirationDate', e.target.value)}
                  className={`w-full px-4 py-2 bg-slate-700 border-2 rounded-lg text-white ${
                    fieldErrors.licenseExpirationDate ? 'border-red-500' : 'border-slate-600'
                  }`}
                />
                {fieldErrors.licenseExpirationDate && (
                  <p className="text-red-400 text-xs mt-1">{fieldErrors.licenseExpirationDate}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">NBI Clearance Number *</label>
                <input
                  type="text"
                  value={formData.nbiClearanceNumber}
                  onChange={(e) => handleInputChange('nbiClearanceNumber', e.target.value)}
                  placeholder="NBI Number"
                  className={`w-full px-4 py-2 bg-slate-700 border-2 rounded-lg text-white ${
                    fieldErrors.nbiClearanceNumber ? 'border-red-500' : 'border-slate-600'
                  }`}
                />
                {fieldErrors.nbiClearanceNumber && <p className="text-red-400 text-xs mt-1">{fieldErrors.nbiClearanceNumber}</p>}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="flex-1 py-3 border-2 border-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700"
                >
                  Back
                </button>
                <button
                  onClick={() => handleStepSubmit(2)}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800"
                >
                  Continue to Vehicle Details
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Vehicle Details */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white mb-6">Vehicle Details</h2>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Vehicle Type *</label>
                <select
                  value={formData.vehicleType}
                  onChange={(e) => handleInputChange('vehicleType', e.target.value)}
                  className={`w-full px-4 py-2 bg-slate-700 border-2 rounded-lg text-white ${
                    fieldErrors.vehicleType ? 'border-red-500' : 'border-slate-600'
                  }`}
                >
                  <option value="">Select vehicle type</option>
                  <option value="van">Van</option>
                  <option value="suv">SUV</option>
                  <option value="minibus">Mini Bus</option>
                  <option value="school_vehicle">School Service Vehicle</option>
                </select>
                {fieldErrors.vehicleType && <p className="text-red-400 text-xs mt-1">{fieldErrors.vehicleType}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Brand/Make *</label>
                  <input
                    type="text"
                    value={formData.vehicleBrand}
                    onChange={(e) => handleInputChange('vehicleBrand', e.target.value)}
                    placeholder="e.g., Toyota"
                    className={`w-full px-4 py-2 bg-slate-700 border-2 rounded-lg text-white ${
                      fieldErrors.vehicleBrand ? 'border-red-500' : 'border-slate-600'
                    }`}
                  />
                  {fieldErrors.vehicleBrand && <p className="text-red-400 text-xs mt-1">{fieldErrors.vehicleBrand}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">Color *</label>
                  <input
                    type="text"
                    value={formData.vehicleColor}
                    onChange={(e) => handleInputChange('vehicleColor', e.target.value)}
                    placeholder="e.g., White"
                    className={`w-full px-4 py-2 bg-slate-700 border-2 rounded-lg text-white ${
                      fieldErrors.vehicleColor ? 'border-red-500' : 'border-slate-600'
                    }`}
                  />
                  {fieldErrors.vehicleColor && <p className="text-red-400 text-xs mt-1">{fieldErrors.vehicleColor}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Plate Number *</label>
                  <input
                    type="text"
                    value={formData.plateNumber}
                    onChange={(e) => handleInputChange('plateNumber', e.target.value.toUpperCase())}
                    placeholder="ABC-1234"
                    className={`w-full px-4 py-2 bg-slate-700 border-2 rounded-lg text-white uppercase ${
                      fieldErrors.plateNumber ? 'border-red-500' : 'border-slate-600'
                    }`}
                  />
                  {fieldErrors.plateNumber && <p className="text-red-400 text-xs mt-1">{fieldErrors.plateNumber}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">Seating Capacity *</label>
                  <input
                    type="number"
                    value={formData.seatingCapacity}
                    onChange={(e) => handleInputChange('seatingCapacity', e.target.value)}
                    min="3"
                    max="50"
                    className={`w-full px-4 py-2 bg-slate-700 border-2 rounded-lg text-white ${
                      fieldErrors.seatingCapacity ? 'border-red-500' : 'border-slate-600'
                    }`}
                  />
                  {fieldErrors.seatingCapacity && <p className="text-red-400 text-xs mt-1">{fieldErrors.seatingCapacity}</p>}
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mt-6">
                <h4 className="text-blue-300 font-semibold mb-2">⚠️ Important Notice</h4>
                <p className="text-blue-300 text-sm">
                  Once you submit this application, it will be reviewed by our admin team. Only approved drivers can
                  login and accept trips. You will receive an email once your application status changes.
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="flex-1 py-3 border-2 border-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700"
                >
                  Back
                </button>
                <button
                  onClick={() => handleStepSubmit(3)}
                  disabled={loading}
                  className="flex-1 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Phase3DriverApplicationForm;

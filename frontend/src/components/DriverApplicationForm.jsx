import React, { useState } from 'react';
import {
  validateAge,
  validateLicenseExpiration,
  validateFileUpload,
  getMaximumDateOfBirth,
  getMinimumLicenseExpirationDate,
  getLicenseTypes,
  calculateAge,
} from '../../utils/licenseValidation';

/**
 * Professional License Document Upload Component
 * Handles single document upload with preview and validation
 */
function DocumentUploadField({ label, docKey, onFileChange, file, error, required = true }) {
  const fileInputRef = React.useRef(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validation = validateFileUpload(selectedFile);
      if (validation.valid) {
        onFileChange(docKey, selectedFile);
      } else {
        onFileChange(docKey, null, validation.message);
      }
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-white">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <button
        type="button"
        onClick={handleClick}
        className={`w-full p-4 border-2 border-dashed rounded-lg transition-colors ${
          file
            ? 'border-green-500/50 bg-green-500/5'
            : 'border-slate-500/30 bg-slate-700/20 hover:border-blue-500/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          accept=".jpg,.jpeg,.png,.pdf"
          className="hidden"
        />

        {file ? (
          <div className="text-left">
            <div className="flex items-center gap-2 text-green-400">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="font-medium">✓ File uploaded</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{file.name}</p>
          </div>
        ) : (
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto text-slate-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            <p className="text-sm text-slate-300">Click to upload document</p>
            <p className="text-xs text-slate-500 mt-1">JPG, PNG, or PDF (max 10MB)</p>
          </div>
        )}
      </button>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

/**
 * Professional Driver Application Form
 * Strict license validation for school transportation
 */
function DriverApplicationForm({ onSubmit, isLoading = false }) {
  const [formData, setFormData] = useState({
    dateOfBirth: '',
    licenseNumber: '',
    licenseType: 'professional',
    licenseExpirationDate: '',
    documents: {
      licenseFront: null,
      licenseBack: null,
      selfieVerification: null,
      nbiClearance: null,
      vehicleOrCr: null,
    },
  });

  const [errors, setErrors] = useState({});
  const [fileErrors, setFileErrors] = useState({});
  const [validations, setValidations] = useState({});

  // Handle text input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error for this field
    setErrors((prev) => ({
      ...prev,
      [name]: '',
    }));

    // Validate date of birth on change
    if (name === 'dateOfBirth' && value) {
      const ageValidation = validateAge(value);
      setValidations((prev) => ({
        ...prev,
        ageValidation,
      }));
    }

    // Validate license expiration on change
    if (name === 'licenseExpirationDate' && value) {
      const expirationValidation = validateLicenseExpiration(value);
      setValidations((prev) => ({
        ...prev,
        expirationValidation,
      }));
    }
  };

  // Handle file uploads
  const handleFileChange = (docKey, file, error = null) => {
    setFormData((prev) => ({
      ...prev,
      documents: {
        ...prev.documents,
        [docKey]: file,
      },
    }));

    if (error) {
      setFileErrors((prev) => ({
        ...prev,
        [docKey]: error,
      }));
    } else {
      setFileErrors((prev) => ({
        ...prev,
        [docKey]: '',
      }));
    }
  };

  // Validate form before submission
  const validateForm = () => {
    const newErrors = {};

    // Validate date of birth
    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required';
    } else {
      const ageValidation = validateAge(formData.dateOfBirth);
      if (!ageValidation.valid) {
        newErrors.dateOfBirth = ageValidation.message;
      }
    }

    // Validate license type
    if (!formData.licenseType) {
      newErrors.licenseType = 'License type is required';
    }

    // Validate license number
    if (!formData.licenseNumber.trim()) {
      newErrors.licenseNumber = 'License number is required';
    }

    // Validate license expiration
    if (!formData.licenseExpirationDate) {
      newErrors.licenseExpirationDate = 'License expiration date is required';
    } else {
      const expirationValidation = validateLicenseExpiration(formData.licenseExpirationDate);
      if (!expirationValidation.valid) {
        newErrors.licenseExpirationDate = expirationValidation.message;
      }
    }

    // Validate documents
    const requiredDocs = [
      { key: 'licenseFront', label: 'License front' },
      { key: 'licenseBack', label: 'License back' },
      { key: 'selfieVerification', label: 'Selfie verification' },
      { key: 'nbiClearance', label: 'NBI clearance' },
      { key: 'vehicleOrCr', label: 'Vehicle OR/CR' },
    ];

    requiredDocs.forEach(({ key, label }) => {
      if (!formData.documents[key]) {
        newErrors[`doc_${key}`] = `${label} is required`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (onSubmit) {
      await onSubmit(formData);
    }
  };

  const age = formData.dateOfBirth ? calculateAge(formData.dateOfBirth) : null;
  const expirationValidation = formData.licenseExpirationDate
    ? validateLicenseExpiration(formData.licenseExpirationDate)
    : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Personal Information Section */}
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-bold text-white mb-4">📋 Personal Information</h3>
        </div>

        {/* Date of Birth */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-white">
            Date of Birth <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="dateOfBirth"
            value={formData.dateOfBirth}
            onChange={handleInputChange}
            max={getMaximumDateOfBirth()}
            className={`w-full px-4 py-2 rounded-lg bg-slate-700 text-white border-2 transition-colors ${
              errors.dateOfBirth ? 'border-red-500' : 'border-slate-600 focus:border-blue-500'
            }`}
          />
          {errors.dateOfBirth && <p className="text-sm text-red-400">{errors.dateOfBirth}</p>}
          {age !== null && (
            <p className={`text-sm ${age >= 21 ? 'text-green-400' : 'text-red-400'}`}>
              Age: {age} years old {age >= 21 ? '✓' : '❌ (Must be 21+)'}
            </p>
          )}
        </div>

        {/* License Number */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-white">
            Driver License Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="licenseNumber"
            value={formData.licenseNumber}
            onChange={handleInputChange}
            placeholder="e.g., DL-2025-123456"
            className={`w-full px-4 py-2 rounded-lg bg-slate-700 text-white border-2 transition-colors ${
              errors.licenseNumber ? 'border-red-500' : 'border-slate-600 focus:border-blue-500'
            }`}
          />
          {errors.licenseNumber && <p className="text-sm text-red-400">{errors.licenseNumber}</p>}
        </div>

        {/* License Type */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-white">
            License Type <span className="text-red-500">*</span>
          </label>
          <select
            name="licenseType"
            value={formData.licenseType}
            onChange={handleInputChange}
            className={`w-full px-4 py-2 rounded-lg bg-slate-700 text-white border-2 transition-colors ${
              errors.licenseType ? 'border-red-500' : 'border-slate-600 focus:border-blue-500'
            }`}
          >
            {getLicenseTypes().map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
                {type.recommended ? ' (Required)' : ' (Not eligible)'}
              </option>
            ))}
          </select>
          {errors.licenseType && <p className="text-sm text-red-400">{errors.licenseType}</p>}
          {formData.licenseType === 'nonprofessional' && (
            <p className="text-sm text-amber-400">⚠ Non-professional licenses are not eligible for school transportation.</p>
          )}
        </div>

        {/* License Expiration Date */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-white">
            License Expiration Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="licenseExpirationDate"
            value={formData.licenseExpirationDate}
            onChange={handleInputChange}
            min={getMinimumLicenseExpirationDate()}
            className={`w-full px-4 py-2 rounded-lg bg-slate-700 text-white border-2 transition-colors ${
              errors.licenseExpirationDate ? 'border-red-500' : 'border-slate-600 focus:border-blue-500'
            }`}
          />
          {errors.licenseExpirationDate && <p className="text-sm text-red-400">{errors.licenseExpirationDate}</p>}
          {expirationValidation && expirationValidation.valid && (
            <p className="text-sm text-green-400">
              ✓ License valid for {expirationValidation.daysUntilExpiry} more days
            </p>
          )}
        </div>
      </div>

      {/* Document Upload Section */}
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-bold text-white mb-4">📄 Required Documents</h3>
          <p className="text-sm text-slate-400 mb-4">All documents are required for verification</p>
        </div>

        {/* License Front */}
        <DocumentUploadField
          label="Driver License - Front"
          docKey="licenseFront"
          onFileChange={handleFileChange}
          file={formData.documents.licenseFront}
          error={fileErrors.licenseFront || errors.doc_licenseFront}
        />

        {/* License Back */}
        <DocumentUploadField
          label="Driver License - Back"
          docKey="licenseBack"
          onFileChange={handleFileChange}
          file={formData.documents.licenseBack}
          error={fileErrors.licenseBack || errors.doc_licenseBack}
        />

        {/* Selfie Verification */}
        <DocumentUploadField
          label="Selfie Verification"
          docKey="selfieVerification"
          onFileChange={handleFileChange}
          file={formData.documents.selfieVerification}
          error={fileErrors.selfieVerification || errors.doc_selfieVerification}
        />

        {/* NBI Clearance */}
        <DocumentUploadField
          label="NBI Clearance"
          docKey="nbiClearance"
          onFileChange={handleFileChange}
          file={formData.documents.nbiClearance}
          error={fileErrors.nbiClearance || errors.doc_nbiClearance}
        />

        {/* Vehicle OR/CR */}
        <DocumentUploadField
          label="Vehicle Official Receipt (OR) / Certificate of Registration (CR)"
          docKey="vehicleOrCr"
          onFileChange={handleFileChange}
          file={formData.documents.vehicleOrCr}
          error={fileErrors.vehicleOrCr || errors.doc_vehicleOrCr}
        />
      </div>

      {/* Professional Requirements Info */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <h4 className="font-medium text-blue-300 mb-2">🔐 Professional Requirements</h4>
        <ul className="space-y-1 text-sm text-slate-300">
          <li>✓ Must be at least 21 years old</li>
          <li>✓ Professional Driver's License required</li>
          <li>✓ License must be valid for at least 30+ days</li>
          <li>✓ All documents must be clear and legible</li>
          <li>✓ Documents will be verified by administrators</li>
        </ul>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Processing Application...' : 'Submit Driver Application'}
      </button>
    </form>
  );
}

export default DriverApplicationForm;

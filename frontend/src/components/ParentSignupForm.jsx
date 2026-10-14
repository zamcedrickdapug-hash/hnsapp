import React, { useState } from 'react';
import {
  validateEmail,
  validatePhoneNumber,
  validatePasswordStrength,
} from '../../utils/licenseValidation';
import { apiFetch } from '../../api';

/**
 * OTP Verification Component
 */
function OTPVerification({ email, onVerified, onResend }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(300); // 5 minutes

  // Countdown timer effect
  React.useEffect(() => {
    if (timerSeconds <= 0) return;
    const timer = setTimeout(() => setTimerSeconds(timerSeconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [timerSeconds]);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('OTP must be 6 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('/api/phase3/parent/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.message || 'Verification failed');
        return;
      }

      const data = await response.json();
      if (onVerified) onVerified(data);
    } catch (err) {
      setError('Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/otp/resend', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setCode('');
        setTimerSeconds(300);
        if (onResend) onResend();
      }
    } catch (err) {
      console.error('Resend failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const canResend = timerSeconds === 0;
  const minutes = Math.floor(timerSeconds / 60);
  const seconds = timerSeconds % 60;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-white mb-2">
          Enter 6-Digit OTP Code
        </label>
        <input
          type="text"
          maxLength="6"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="000000"
          className="w-full px-4 py-3 text-center text-2xl tracking-widest bg-slate-700 border-2 border-slate-600 rounded-lg text-white placeholder-slate-500"
        />
        <p className="text-xs text-slate-400 text-center mt-2">Sent to {email}</p>
      </div>

      {error && <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">{error}</div>}

      <button
        onClick={handleVerify}
        disabled={loading || code.length !== 6}
        className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Verifying...' : 'Verify Email'}
      </button>

      <div className="flex items-center justify-between text-sm">
        {!canResend ? (
          <span className="text-slate-400">
            Resend OTP in {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
        ) : (
          <button
            onClick={handleResend}
            disabled={loading}
            className="text-blue-400 hover:text-blue-300 font-medium disabled:opacity-50"
          >
            Resend OTP
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Multi-Step Parent Signup Component
 */
function ParentSignupForm() {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState(null);

  // Step 1: Account Information
  const [step1Data, setStep1Data] = useState({
    firstName: '',
    lastName: '',
    gender: '',
    email: '',
    contactNumber: '',
    password: '',
    confirmPassword: '',
  });
  const [step1Errors, setStep1Errors] = useState({});

  // Step 3: Children
  const [children, setChildren] = useState([
    { fullName: '', gender: '', age: '', schoolName: '', gradeLevel: '' },
  ]);

  // Step 4: Location
  const [location, setLocation] = useState({ latitude: null, longitude: null, address: '' });

  // Step 5: Agreements
  const [agreements, setAgreements] = useState({
    acceptTerms: false,
    acceptPrivacy: false,
    acceptSafetyAgreement: false,
    acceptGPSMonitoring: false,
  });

  // ==== STEP 1: Account Information ====
  const handleStep1Change = (field, value) => {
    setStep1Data((prev) => ({ ...prev, [field]: value }));
    setStep1Errors((prev) => ({ ...prev, [field]: '' }));
  };

  const validateStep1 = () => {
    const errors = {};

    if (!step1Data.firstName.trim()) errors.firstName = 'First name required';
    if (!step1Data.lastName.trim()) errors.lastName = 'Last name required';
    if (!step1Data.gender) errors.gender = 'Gender required';

    const emailVal = validateEmail(step1Data.email);
    if (!emailVal.valid) errors.email = emailVal.message;

    const phoneVal = validatePhoneNumber(step1Data.contactNumber);
    if (!phoneVal.valid) errors.contactNumber = phoneVal.message;

    const passwordVal = validatePasswordStrength(step1Data.password);
    if (!passwordVal.valid) errors.password = passwordVal.message;

    if (step1Data.password !== step1Data.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    return errors;
  };

  const handleStep1Submit = async (e) => {
    e.preventDefault();
    const errors = validateStep1();
    if (Object.keys(errors).length > 0) {
      setStep1Errors(errors);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('/api/phase3/parent/register', {
        method: 'POST',
        body: JSON.stringify(step1Data),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.message || 'Registration failed');
        return;
      }

      const data = await response.json();
      setUserId(data.userId);
      setCurrentStep(2);
    } catch (err) {
      setError('Failed to register');
    } finally {
      setLoading(false);
    }
  };

  // ==== STEP 3: Children ====
  const handleChildChange = (index, field, value) => {
    const newChildren = [...children];
    newChildren[index][field] = value;
    setChildren(newChildren);
  };

  const addChild = () => {
    setChildren([...children, { fullName: '', gender: '', age: '', schoolName: '', gradeLevel: '' }]);
  };

  const removeChild = (index) => {
    if (children.length > 1) {
      setChildren(children.filter((_, i) => i !== index));
    }
  };

  const handleChildrenSubmit = async (e) => {
    e.preventDefault();
    if (!children.some((c) => c.fullName && c.age && c.schoolName)) {
      setError('Please add at least one child with name, age, and school');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('/api/phase3/parent/add-children', {
        method: 'POST',
        body: JSON.stringify({ userId, children }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.message || 'Failed to add children');
        return;
      }

      setCurrentStep(4);
    } catch (err) {
      setError('Failed to add children');
    } finally {
      setLoading(false);
    }
  };

  // ==== STEP 4: Location ====
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setError('GPS is not supported on your device');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          address: 'Location detected',
        });
        setLoading(false);
      },
      (err) => {
        setError('Failed to get GPS location. Please enable location access.');
        setLoading(false);
      }
    );
  };

  const handleLocationSubmit = async (e) => {
    e.preventDefault();
    if (location.latitude === null || location.longitude === null) {
      setError('Please allow GPS access or enter coordinates');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('/api/phase3/parent/set-location', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.message || 'Failed to set location');
        return;
      }

      setCurrentStep(5);
    } catch (err) {
      setError('Failed to save location');
    } finally {
      setLoading(false);
    }
  };

  // ==== STEP 5: Agreements ====
  const handleAgreementChange = (field) => {
    setAgreements((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleAgreementsSubmit = async (e) => {
    e.preventDefault();
    if (!Object.values(agreements).every((v) => v)) {
      setError('You must accept all agreements');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('/api/phase3/parent/accept-agreements', {
        method: 'POST',
        body: JSON.stringify({ userId, ...agreements }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.message || 'Failed to accept agreements');
        return;
      }

      // Success! Redirect to login
      window.location.href = '/login?registered=true';
    } catch (err) {
      setError('Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  // Progress bar
  const progressPercent = (currentStep / 5) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">🚌 HNSAPP Parent Registration</h1>
          <p className="text-slate-400">Step {currentStep} of 5</p>
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

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Form Container */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-8 backdrop-blur">
          {/* STEP 1: Account Information */}
          {currentStep === 1 && (
            <form onSubmit={handleStep1Submit} className="space-y-4">
              <h2 className="text-2xl font-bold text-white mb-6">Account Information</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">First Name *</label>
                  <input
                    type="text"
                    value={step1Data.firstName}
                    onChange={(e) => handleStep1Change('firstName', e.target.value)}
                    className={`w-full px-4 py-2 bg-slate-700 border-2 rounded-lg text-white ${
                      step1Errors.firstName ? 'border-red-500' : 'border-slate-600'
                    }`}
                  />
                  {step1Errors.firstName && <p className="text-red-400 text-xs mt-1">{step1Errors.firstName}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">Last Name *</label>
                  <input
                    type="text"
                    value={step1Data.lastName}
                    onChange={(e) => handleStep1Change('lastName', e.target.value)}
                    className={`w-full px-4 py-2 bg-slate-700 border-2 rounded-lg text-white ${
                      step1Errors.lastName ? 'border-red-500' : 'border-slate-600'
                    }`}
                  />
                  {step1Errors.lastName && <p className="text-red-400 text-xs mt-1">{step1Errors.lastName}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Gender *</label>
                <select
                  value={step1Data.gender}
                  onChange={(e) => handleStep1Change('gender', e.target.value)}
                  className={`w-full px-4 py-2 bg-slate-700 border-2 rounded-lg text-white ${
                    step1Errors.gender ? 'border-red-500' : 'border-slate-600'
                  }`}
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                {step1Errors.gender && <p className="text-red-400 text-xs mt-1">{step1Errors.gender}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Email *</label>
                <input
                  type="email"
                  value={step1Data.email}
                  onChange={(e) => handleStep1Change('email', e.target.value)}
                  className={`w-full px-4 py-2 bg-slate-700 border-2 rounded-lg text-white ${
                    step1Errors.email ? 'border-red-500' : 'border-slate-600'
                  }`}
                />
                {step1Errors.email && <p className="text-red-400 text-xs mt-1">{step1Errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Contact Number (11 digits) *</label>
                <input
                  type="tel"
                  value={step1Data.contactNumber}
                  onChange={(e) => handleStep1Change('contactNumber', e.target.value)}
                  placeholder="09171234567"
                  className={`w-full px-4 py-2 bg-slate-700 border-2 rounded-lg text-white ${
                    step1Errors.contactNumber ? 'border-red-500' : 'border-slate-600'
                  }`}
                />
                {step1Errors.contactNumber && <p className="text-red-400 text-xs mt-1">{step1Errors.contactNumber}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Password *</label>
                <input
                  type="password"
                  value={step1Data.password}
                  onChange={(e) => handleStep1Change('password', e.target.value)}
                  className={`w-full px-4 py-2 bg-slate-700 border-2 rounded-lg text-white ${
                    step1Errors.password ? 'border-red-500' : 'border-slate-600'
                  }`}
                />
                {step1Errors.password && <p className="text-red-400 text-xs mt-1">{step1Errors.password}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Confirm Password *</label>
                <input
                  type="password"
                  value={step1Data.confirmPassword}
                  onChange={(e) => handleStep1Change('confirmPassword', e.target.value)}
                  className={`w-full px-4 py-2 bg-slate-700 border-2 rounded-lg text-white ${
                    step1Errors.confirmPassword ? 'border-red-500' : 'border-slate-600'
                  }`}
                />
                {step1Errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{step1Errors.confirmPassword}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 mt-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50"
              >
                {loading ? 'Creating Account...' : 'Continue to Email Verification'}
              </button>
            </form>
          )}

          {/* STEP 2: OTP Verification */}
          {currentStep === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Email Verification</h2>
              <OTPVerification
                email={step1Data.email}
                onVerified={() => setCurrentStep(3)}
                onResend={() => {}}
              />
            </div>
          )}

          {/* STEP 3: Children Information */}
          {currentStep === 3 && (
            <form onSubmit={handleChildrenSubmit} className="space-y-6">
              <h2 className="text-2xl font-bold text-white mb-6">Add Children Information</h2>

              {children.map((child, index) => (
                <div key={index} className="p-4 bg-slate-700/30 rounded-lg space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-white font-semibold">Child {index + 1}</h4>
                    {children.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeChild(index)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    placeholder="Full Name"
                    value={child.fullName}
                    onChange={(e) => handleChildChange(index, 'fullName', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                  />

                  <select
                    value={child.gender}
                    onChange={(e) => handleChildChange(index, 'gender', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>

                  <input
                    type="number"
                    placeholder="Age"
                    value={child.age}
                    onChange={(e) => handleChildChange(index, 'age', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                  />

                  <input
                    type="text"
                    placeholder="School Name"
                    value={child.schoolName}
                    onChange={(e) => handleChildChange(index, 'schoolName', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                  />

                  <input
                    type="text"
                    placeholder="Grade Level"
                    value={child.gradeLevel}
                    onChange={(e) => handleChildChange(index, 'gradeLevel', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                  />
                </div>
              ))}

              <button
                type="button"
                onClick={addChild}
                className="w-full py-2 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/10"
              >
                + Add Another Child
              </button>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Continue to Location Setup'}
              </button>
            </form>
          )}

          {/* STEP 4: Location Setup */}
          {currentStep === 4 && (
            <form onSubmit={handleLocationSubmit} className="space-y-6">
              <h2 className="text-2xl font-bold text-white mb-6">Pickup Location</h2>

              <button
                type="button"
                onClick={handleGetLocation}
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50"
              >
                {loading ? 'Getting Location...' : '📍 Use My Current Location'}
              </button>

              {location.latitude && (
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <p className="text-green-300 text-sm">
                    ✓ Location detected: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                  </p>
                </div>
              )}

              <input
                type="text"
                placeholder="Address (optional)"
                value={location.address}
                onChange={(e) => setLocation((prev) => ({ ...prev, address: e.target.value }))}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
              />

              <button
                type="submit"
                disabled={loading || location.latitude === null}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Continue to Agreements'}
              </button>
            </form>
          )}

          {/* STEP 5: Agreements */}
          {currentStep === 5 && (
            <form onSubmit={handleAgreementsSubmit} className="space-y-6">
              <h2 className="text-2xl font-bold text-white mb-6">Terms & Agreements</h2>

              <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreements.acceptTerms}
                    onChange={() => handleAgreementChange('acceptTerms')}
                    className="mt-1"
                  />
                  <span className="text-slate-300">
                    I accept the <span className="font-semibold">Terms & Conditions</span>
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreements.acceptPrivacy}
                    onChange={() => handleAgreementChange('acceptPrivacy')}
                    className="mt-1"
                  />
                  <span className="text-slate-300">
                    I accept the <span className="font-semibold">Privacy Policy</span>
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreements.acceptSafetyAgreement}
                    onChange={() => handleAgreementChange('acceptSafetyAgreement')}
                    className="mt-1"
                  />
                  <span className="text-slate-300">
                    I accept the <span className="font-semibold">Parent Safety Agreement</span>
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreements.acceptGPSMonitoring}
                    onChange={() => handleAgreementChange('acceptGPSMonitoring')}
                    className="mt-1"
                  />
                  <span className="text-slate-300">
                    I consent to <span className="font-semibold">GPS Monitoring</span> of my child's location
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={
                  loading || !Object.values(agreements).every((v) => v)
                }
                className="w-full py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50"
              >
                {loading ? 'Completing...' : '✓ Complete Registration'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default ParentSignupForm;

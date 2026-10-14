import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../api';

/**
 * License Status Badge Component
 * Shows visual indicator of license status
 */
function LicenseStatusBadge({ status, expiringDays }) {
  if (status === 'expired') {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/20 border border-red-500/50 rounded-full">
        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
        <span className="text-sm text-red-300">❌ Expired</span>
      </div>
    );
  }

  if (status === 'expiring_soon' && expiringDays) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-500/50 rounded-full">
        <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
        <span className="text-sm text-amber-300">⚠ Expiring in {expiringDays} days</span>
      </div>
    );
  }

  if (status === 'verified') {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/20 border border-green-500/50 rounded-full">
        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
        <span className="text-sm text-green-300">✅ Verified</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-600/30 border border-slate-500/50 rounded-full">
      <span className="w-2 h-2 bg-slate-400 rounded-full"></span>
      <span className="text-sm text-slate-300">⏳ Pending</span>
    </div>
  );
}

/**
 * Document Status Indicator
 * Shows individual document verification status
 */
function DocumentStatusIndicator({ docName, status, rejectionReason }) {
  const statusColor = {
    verified: 'text-green-400',
    rejected: 'text-red-400',
    pending: 'text-amber-400',
  };

  const statusIcon = {
    verified: '✅',
    rejected: '❌',
    pending: '⏳',
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm">
        <span className={`text-lg ${statusColor[status]}`}>{statusIcon[status]}</span>
        <span className="text-white font-medium">{docName}</span>
        <span className={`text-xs font-medium ${statusColor[status]}`}>{status}</span>
      </div>
      {rejectionReason && (
        <p className="text-xs text-red-300 pl-6">Reason: {rejectionReason}</p>
      )}
    </div>
  );
}

/**
 * Admin Driver Review Panel
 * Shows comprehensive driver information and license status
 */
function AdminDriverReviewPanel({ driverId }) {
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDriverInfo = async () => {
      try {
        setLoading(true);
        const response = await apiFetch(`/api/drivers/${driverId}`);
        if (response.ok) {
          const data = await response.json();
          setDriver(data);
        } else {
          setError('Failed to load driver information');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (driverId) {
      fetchDriverInfo();
    }
  }, [driverId]);

  if (loading) {
    return (
      <div className="p-8 bg-slate-800 rounded-lg text-center">
        <p className="text-slate-300">Loading driver information...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300">
        {error}
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="p-8 bg-slate-800 rounded-lg text-center">
        <p className="text-slate-300">No driver found</p>
      </div>
    );
  }

  const driverData = driver.driver || {};
  const age = driver.age;
  const licenseStatus = driver.licenseStatus; // expired, expiring_soon, verified, pending
  const daysUntilExpiry = driver.daysUntilExpiry;

  return (
    <div className="space-y-6">
      {/* Header with Status */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">{driver.fullName}</h3>
            <p className="text-sm text-slate-400">{driver.email}</p>
          </div>
          <LicenseStatusBadge status={licenseStatus} expiringDays={daysUntilExpiry} />
        </div>

        {/* Alerts */}
        {licenseStatus === 'expired' && (
          <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
            <strong>⚠️ ACTION REQUIRED:</strong> Driver's license has expired. This driver should be suspended
            from accepting trips.
          </div>
        )}

        {licenseStatus === 'expiring_soon' && (
          <div className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-300 text-sm">
            <strong>⚠️ NOTICE:</strong> Driver's license expires in {daysUntilExpiry} days. Driver should renew
            before expiration.
          </div>
        )}

        {driver.accountState === 'suspended' && (
          <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
            <strong>🚫 SUSPENDED:</strong> {driver.suspensionReason || 'By administrator'}
          </div>
        )}
      </div>

      {/* Driver Information */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-700/30 rounded-lg p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Age</p>
          <p className={`text-lg font-bold mt-1 ${age >= 21 ? 'text-green-400' : 'text-red-400'}`}>
            {age} years old
            {age >= 21 ? ' ✓' : ' ❌'}
          </p>
        </div>

        <div className="bg-slate-700/30 rounded-lg p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide">License Type</p>
          <p className="text-lg font-bold text-white mt-1">
            {driverData.licenseType === 'professional' ? '🎓 Professional' : '📄 Non-Professional'}
          </p>
        </div>

        <div className="bg-slate-700/30 rounded-lg p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide">License Number</p>
          <p className="text-sm font-mono text-slate-300 mt-1">{driverData.licenseNumber || 'N/A'}</p>
        </div>

        <div className="bg-slate-700/30 rounded-lg p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide">License Expiration</p>
          <p className="text-sm font-mono text-slate-300 mt-1">
            {driverData.licenseExpirationDate
              ? new Date(driverData.licenseExpirationDate).toLocaleDateString()
              : 'N/A'}
          </p>
        </div>
      </div>

      {/* Document Verification */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-bold text-white">📋 Document Verification</h4>
          <LicenseStatusBadge status={driverData.documentStatus || 'pending'} />
        </div>

        <div className="bg-slate-700/20 rounded-lg p-4 space-y-3">
          {driverData.documents && (
            <>
              <DocumentStatusIndicator
                docName="License - Front"
                status={driverData.documents.licenseFront?.verificationStatus || 'pending'}
                rejectionReason={driverData.documents.licenseFront?.rejectionReason}
              />
              <DocumentStatusIndicator
                docName="License - Back"
                status={driverData.documents.licenseBack?.verificationStatus || 'pending'}
                rejectionReason={driverData.documents.licenseBack?.rejectionReason}
              />
              <DocumentStatusIndicator
                docName="Selfie Verification"
                status={driverData.documents.selfieVerification?.verificationStatus || 'pending'}
                rejectionReason={driverData.documents.selfieVerification?.rejectionReason}
              />
              <DocumentStatusIndicator
                docName="NBI Clearance"
                status={driverData.documents.nbiClearance?.verificationStatus || 'pending'}
                rejectionReason={driverData.documents.nbiClearance?.rejectionReason}
              />
              <DocumentStatusIndicator
                docName="Vehicle OR/CR"
                status={driverData.documents.vehicleOrCr?.verificationStatus || 'pending'}
                rejectionReason={driverData.documents.vehicleOrCr?.rejectionReason}
              />
            </>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button className="flex-1 py-2 px-4 bg-green-600/20 hover:bg-green-600/30 text-green-300 font-medium rounded-lg transition-colors border border-green-500/30">
          ✅ Approve Driver
        </button>
        <button className="flex-1 py-2 px-4 bg-red-600/20 hover:bg-red-600/30 text-red-300 font-medium rounded-lg transition-colors border border-red-500/30">
          ❌ Decline Application
        </button>
      </div>
    </div>
  );
}

export default AdminDriverReviewPanel;
export { LicenseStatusBadge, DocumentStatusIndicator };

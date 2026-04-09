import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../api';
import './admin.scss';

const statusOptions = ['pending', 'reviewing', 'approved', 'declined', 'all'];

function formatDate(dateValue) {
  if (!dateValue) {
    return 'N/A';
  }

  return new Date(dateValue).toLocaleString();
}

function bytesToReadable(size) {
  if (!size) {
    return 'Unknown size';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export default function AdminPanel({ token }) {
  const [registrations, setRegistrations] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [declineReasons, setDeclineReasons] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actioningId, setActioningId] = useState('');

  const summary = useMemo(() => {
    return registrations.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.status] += 1;
        return acc;
      },
      {
        total: 0,
        pending: 0,
        reviewing: 0,
        approved: 0,
        declined: 0,
      }
    );
  }, [registrations]);

  const loadRegistrations = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch(`/api/admin/registrations?status=${statusFilter}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setRegistrations(response.registrations || []);
    } catch (requestError) {
      setError(requestError.message || 'Unable to load registrations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRegistrations();
  }, [statusFilter]);

  const updateStatus = async (registrationId, nextStatus) => {
    setActioningId(registrationId);
    setError('');

    try {
      const body = {
        status: nextStatus,
      };

      if (nextStatus === 'declined') {
        body.reason = declineReasons[registrationId] || '';
      }

      await apiFetch(`/api/admin/registrations/${registrationId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      await loadRegistrations();
    } catch (requestError) {
      setError(requestError.message || 'Unable to update account status.');
    } finally {
      setActioningId('');
    }
  };

  const previewValidId = async (registrationId) => {
    setError('');

    try {
      const response = await fetch(`/api/admin/registrations/${registrationId}/id-document`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Unable to preview uploaded valid ID.');
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');

      window.setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 15000);
    } catch (requestError) {
      setError(requestError.message || 'Unable to preview uploaded valid ID.');
    }
  };

  return (
    <section className="admin-panel">
      <div className="admin-topbar">
        <h2>Admin Review Dashboard</h2>

        <label>
          Filter by status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="summary-grid">
        <article>
          <span>Total</span>
          <strong>{summary.total}</strong>
        </article>
        <article>
          <span>Pending</span>
          <strong>{summary.pending}</strong>
        </article>
        <article>
          <span>Reviewing</span>
          <strong>{summary.reviewing}</strong>
        </article>
        <article>
          <span>Approved</span>
          <strong>{summary.approved}</strong>
        </article>
        <article>
          <span>Declined</span>
          <strong>{summary.declined}</strong>
        </article>
      </div>

      {error ? <p className="feedback error">{error}</p> : null}
      {loading ? <p className="feedback">Loading registrations...</p> : null}

      {!loading && registrations.length === 0 ? (
        <p className="feedback">No registrations found for the selected status.</p>
      ) : null}

      <div className="registration-list">
        {registrations.map((registration) => (
          <article className="registration-card" key={registration.id}>
            <header>
              <h3>{registration.fullName}</h3>
              <span className={`status-badge ${registration.status}`}>{registration.status}</span>
            </header>

            <div className="details-grid">
              <p>
                <strong>Role:</strong> {registration.role}
              </p>
              <p>
                <strong>Email:</strong> {registration.email}
              </p>
              <p>
                <strong>Phone:</strong> {registration.phone}
              </p>
              <p>
                <strong>Address:</strong> {registration.homeAddress}
              </p>
              <p>
                <strong>Submitted:</strong> {formatDate(registration.createdAt)}
              </p>
            </div>

            {registration.role === 'parent' ? (
              <section className="student-block">
                <h4>Student Information</h4>
                <p>
                  <strong>Name:</strong> {registration.student?.fullName}
                </p>
                <p>
                  <strong>Age:</strong> {registration.student?.age}
                </p>
                <p>
                  <strong>Grade:</strong> {registration.student?.gradeLevel}
                </p>
                <p>
                  <strong>Student Number:</strong> {registration.student?.studentNumber}
                </p>
                <p>
                  <strong>School:</strong> {registration.student?.schoolName}
                </p>
              </section>
            ) : (
              <section className="driver-block">
                <h4>Driver Information</h4>
                <p>
                  <strong>License Number:</strong> {registration.driver?.licenseNumber}
                </p>
                <p>
                  <strong>License Expiry:</strong>{' '}
                  {registration.driver?.licenseExpiry
                    ? new Date(registration.driver.licenseExpiry).toLocaleDateString()
                    : 'N/A'}
                </p>
                <p>
                  <strong>Vehicle Type:</strong> {registration.driver?.vehicleType}
                </p>
                <p>
                  <strong>Plate Number:</strong> {registration.driver?.plateNumber}
                </p>
                <p>
                  <strong>Years of Experience:</strong> {registration.driver?.yearsOfExperience}
                </p>
              </section>
            )}

            <section className="id-block">
              <p>
                <strong>Uploaded ID:</strong> {registration.validId?.originalName || 'N/A'} ({bytesToReadable(registration.validId?.size)})
              </p>
              <button type="button" onClick={() => previewValidId(registration.id)}>
                Preview Valid ID
              </button>
            </section>

            <section className="actions-block">
              <textarea
                rows={3}
                value={declineReasons[registration.id] || ''}
                placeholder="Optional decline reason"
                onChange={(event) =>
                  setDeclineReasons((current) => ({
                    ...current,
                    [registration.id]: event.target.value,
                  }))
                }
              />

              <div className="button-row">
                <button
                  type="button"
                  disabled={actioningId === registration.id}
                  onClick={() => updateStatus(registration.id, 'reviewing')}
                >
                  Set Reviewing
                </button>
                <button
                  type="button"
                  disabled={actioningId === registration.id}
                  className="approve"
                  onClick={() => updateStatus(registration.id, 'approved')}
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={actioningId === registration.id}
                  className="decline"
                  onClick={() => updateStatus(registration.id, 'declined')}
                >
                  Decline
                </button>
              </div>
            </section>
          </article>
        ))}
      </div>
    </section>
  );
}

const toPlainObject = (value) =>
  typeof value?.toObject === 'function' ? value.toObject() : value;

const buildPublicDriverProfile = (driverUser) => {
  if (!driverUser) return null;

  const driver = toPlainObject(driverUser);
  const licenseExpiry = driver.driver?.licenseExpirationDate
    ? new Date(driver.driver.licenseExpirationDate)
    : null;
  const hasValidExpiry = licenseExpiry && Number.isFinite(licenseExpiry.getTime());
  const licenseExpired = hasValidExpiry && licenseExpiry.getTime() < Date.now();
  const photoVersion = driver.driver?.photoUpdatedAt
    ? new Date(driver.driver.photoUpdatedAt).getTime()
    : null;

  return {
    name: String(driver.fullName || ''),
    phone: String(driver.phone || ''),
    vehicleType: String(driver.driver?.vehicleType || ''),
    plateNumber: String(driver.driver?.plateNumber || ''),
    verified: driver.status === 'approved' && (driver.accountState || 'active') === 'active',
    licenseValidUntil: hasValidExpiry
      ? `${licenseExpiry.getUTCFullYear()}-${String(licenseExpiry.getUTCMonth() + 1).padStart(2, '0')}`
      : null,
    photoVersion: Number.isFinite(photoVersion) ? photoVersion : null,
    ...(licenseExpired ? { licenseExpired: true } : {}),
  };
};

const toParentSafeRequest = (request) => {
  if (!request) return request;

  const plainRequest = toPlainObject(request);
  const driverUser = toPlainObject(plainRequest.driver);
  if (!driverUser || typeof driverUser !== 'object') return plainRequest;

  return {
    ...plainRequest,
    driverProfile: buildPublicDriverProfile(driverUser),
    driver: {
      _id: driverUser._id,
      fullName: driverUser.fullName,
      phone: driverUser.phone,
      driver: {
        vehicleType: driverUser.driver?.vehicleType,
        plateNumber: driverUser.driver?.plateNumber,
      },
    },
  };
};

module.exports = {
  buildPublicDriverProfile,
  toParentSafeRequest,
};

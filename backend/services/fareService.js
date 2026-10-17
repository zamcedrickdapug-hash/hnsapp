const paymentConfig = require('../config/paymentConfig');

const EARTH_RADIUS_KM = 6371;

const isValidCoordinate = (point) => (
  point
  && Number.isFinite(point.latitude)
  && Number.isFinite(point.longitude)
  && point.latitude >= -90
  && point.latitude <= 90
  && point.longitude >= -180
  && point.longitude <= 180
);

const haversineKm = (a, b) => {
  if (!isValidCoordinate(a) || !isValidCoordinate(b)) return null;
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(b.latitude - a.latitude);
  const longitudeDelta = toRadians(b.longitude - a.longitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(a.latitude))
      * Math.cos(toRadians(b.latitude))
      * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, haversine)));
};

const computeFare = ({ pickup, destination }) => {
  const straightLineKm = haversineKm(pickup, destination);
  if (straightLineKm === null) {
    return { distanceKm: null, fare: paymentConfig.fallbackFare };
  }
  const distanceKm = Math.round(straightLineKm * 100) / 100;
  const roadKm = straightLineKm * paymentConfig.roadFactor;
  const unroundedFare = paymentConfig.baseFare
    + Math.max(0, roadKm - paymentConfig.baseKm) * paymentConfig.perKm;
  const roundedFare = Math.ceil(unroundedFare / paymentConfig.roundTo) * paymentConfig.roundTo;
  return {
    distanceKm,
    fare: Math.min(paymentConfig.maxFare, Math.max(paymentConfig.minFare, roundedFare)),
  };
};

module.exports = { haversineKm, computeFare };

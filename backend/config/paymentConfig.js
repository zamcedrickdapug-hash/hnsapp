module.exports = {
  feePerTrip: 100, // set by owner
  baseFare: 50, // set by owner
  baseKm: 2, // set by owner
  perKm: 10, // set by owner
  roundTo: 5, // set by owner
  minFare: 50, // set by owner
  maxFare: 300, // set by owner
  roadFactor: 1.3, // set by owner
  fallbackFare: 100, // set by owner
  billingStartDate: '2026-10-17T00:00:00+08:00', // set by owner
  currency: 'PHP',
  maxPaymentAmount: 50000,
  methods: ['cash', 'gcash'],
};

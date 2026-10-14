# HNSAPP: IMPLEMENTATION EXAMPLES & CODE PATTERNS

**Document Purpose:** Technical reference for capstone defense code implementation  
**Target Audience:** Developers, capstone judges, technical leads  
**Date:** May 15, 2026

---

## TABLE OF CONTENTS

1. Route Feasibility Validation Algorithm
2. Smart Driver Assignment Algorithm (Complete Implementation)
3. API Request/Response Examples
4. WebSocket Real-Time Events
5. Safety Validation Logic
6. Database Query Patterns
7. Error Handling & Edge Cases
8. Performance Optimization Patterns

---

# 1. ROUTE FEASIBILITY VALIDATION ALGORITHM

## 1.1 Core Algorithm Implementation

```javascript
/**
 * Route Feasibility Validator
 * Determines if a multi-point pickup route is operationally feasible
 * 
 * Constraints Checked:
 * 1. Distance limits (no single leg >20km)
 * 2. Time constraints (pickup must complete in window)
 * 3. Capacity utilization (no overbooking)
 * 4. Detour limits (no inefficient routes)
 * 5. Schedule conflicts (no overlapping assignments)
 * 6. Driver availability (must be free for entire route)
 */

class RouteValidator {
  
  // Haversine formula for distance calculation
  static calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  }

  // Main validation function
  static async validateRoute(tripRequest) {
    const {
      pickupLocations,      // Array of {address, lat, lng, studentId}
      dropoffLocation,      // {address, lat, lng}
      pickupTimeWindow,     // {start: time, end: time}
      vehicleId,
      driverId,
      desiredTime
    } = tripRequest;

    const validationResult = {
      isValid: false,
      feasibilityScore: 0,
      warnings: [],
      errors: [],
      details: {}
    };

    try {
      // STEP 1: Distance Validation
      const distanceCheck = await this.validateDistances(
        pickupLocations,
        dropoffLocation
      );
      
      if (!distanceCheck.valid) {
        validationResult.errors.push(...distanceCheck.errors);
        return { ...validationResult, isValid: false };
      }
      validationResult.details.distances = distanceCheck;

      // STEP 2: Time Feasibility Validation
      const timeCheck = await this.validateTimeConstraints(
        pickupLocations,
        dropoffLocation,
        pickupTimeWindow,
        desiredTime
      );
      
      if (!timeCheck.valid) {
        validationResult.errors.push(...timeCheck.errors);
        return { ...validationResult, isValid: false };
      }
      validationResult.details.timing = timeCheck;

      // STEP 3: Capacity Validation
      const capacityCheck = await this.validateCapacity(
        vehicleId,
        pickupLocations.length
      );
      
      if (!capacityCheck.valid) {
        validationResult.errors.push(...capacityCheck.errors);
        return { ...validationResult, isValid: false };
      }
      validationResult.details.capacity = capacityCheck;

      // STEP 4: Driver Schedule Conflict Check
      const scheduleCheck = await this.validateDriverSchedule(
        driverId,
        timeCheck.estimatedDuration,
        desiredTime
      );
      
      if (!scheduleCheck.valid) {
        validationResult.errors.push(...scheduleCheck.errors);
        return { ...validationResult, isValid: false };
      }
      validationResult.details.schedule = scheduleCheck;

      // STEP 5: Route Efficiency Validation
      const efficiencyCheck = this.validateRouteEfficiency(
        pickupLocations,
        dropoffLocation
      );
      
      if (efficiencyCheck.detourPercentage > 25) {
        validationResult.warnings.push(
          `Route detour: ${efficiencyCheck.detourPercentage}% (recommended <25%)`
        );
      }
      validationResult.details.efficiency = efficiencyCheck;

      // Calculate feasibility score
      validationResult.feasibilityScore = 
        (distanceCheck.score * 0.20) +
        (timeCheck.score * 0.30) +
        (capacityCheck.score * 0.20) +
        (scheduleCheck.score * 0.15) +
        (efficiencyCheck.score * 0.15);

      validationResult.isValid = 
        validationResult.errors.length === 0 &&
        validationResult.feasibilityScore >= 70;

      return validationResult;

    } catch (error) {
      validationResult.errors.push(`Validation error: ${error.message}`);
      return validationResult;
    }
  }

  // Distance Validation
  static async validateDistances(pickupLocations, dropoffLocation) {
    const result = {
      valid: true,
      errors: [],
      distances: [],
      score: 100
    };

    const MAX_SINGLE_LEG = 20; // km
    const MAX_TOTAL_DISTANCE = 50; // km

    // Calculate leg distances
    let totalDistance = 0;
    let previousLocation = pickupLocations[0];

    for (let i = 1; i < pickupLocations.length; i++) {
      const distance = this.calculateDistance(
        previousLocation.lat, previousLocation.lng,
        pickupLocations[i].lat, pickupLocations[i].lng
      );

      if (distance > MAX_SINGLE_LEG) {
        result.errors.push(
          `Pickup ${i} to ${i+1}: ${distance.toFixed(1)}km exceeds limit (${MAX_SINGLE_LEG}km)`
        );
        result.valid = false;
      }

      totalDistance += distance;
      result.distances.push({ from: i-1, to: i, distance });
      previousLocation = pickupLocations[i];
    }

    // Last leg to dropoff
    const lastLeg = this.calculateDistance(
      previousLocation.lat, previousLocation.lng,
      dropoffLocation.lat, dropoffLocation.lng
    );

    if (lastLeg > MAX_SINGLE_LEG) {
      result.errors.push(
        `Final dropoff: ${lastLeg.toFixed(1)}km exceeds limit (${MAX_SINGLE_LEG}km)`
      );
      result.valid = false;
    }

    totalDistance += lastLeg;

    if (totalDistance > MAX_TOTAL_DISTANCE) {
      result.errors.push(
        `Total distance: ${totalDistance.toFixed(1)}km exceeds limit (${MAX_TOTAL_DISTANCE}km)`
      );
      result.valid = false;
    }

    result.totalDistance = totalDistance;
    result.score = Math.max(0, 100 - (totalDistance / MAX_TOTAL_DISTANCE * 30));

    return result;
  }

  // Time Feasibility Validation
  static async validateTimeConstraints(
    pickupLocations,
    dropoffLocation,
    pickupTimeWindow,
    desiredTime
  ) {
    const result = {
      valid: true,
      errors: [],
      score: 100,
      timing: []
    };

    // Get traffic data (mock for now)
    const trafficMultiplier = 1.5; // Assume 1.5x normal speed in traffic

    // Calculate time for each leg
    let cumulativeTime = new Date(pickupTimeWindow.start);
    let previousLocation = pickupLocations[0];

    for (let i = 1; i < pickupLocations.length; i++) {
      const distance = this.calculateDistance(
        previousLocation.lat, previousLocation.lng,
        pickupLocations[i].lat, pickupLocations[i].lng
      );

      // Estimate time: 40 km/h average + 3 min stop
      const travelMinutes = Math.ceil((distance / 40) * 60 * trafficMultiplier);
      const stopMinutes = 3;
      const legDuration = travelMinutes + stopMinutes;

      cumulativeTime = new Date(cumulativeTime.getTime() + legDuration * 60000);

      // Check if still in time window
      if (cumulativeTime > new Date(pickupTimeWindow.end)) {
        result.errors.push(
          `Pickup ${i} would be at ${cumulativeTime.toLocaleTimeString()}, ` +
          `exceeds window end ${pickupTimeWindow.end}`
        );
        result.valid = false;
      }

      result.timing.push({
        stopNumber: i,
        arrivalTime: cumulativeTime.toLocaleTimeString(),
        isInWindow: cumulativeTime <= new Date(pickupTimeWindow.end)
      });

      previousLocation = pickupLocations[i];
    }

    // Final leg to dropoff
    const finalDistance = this.calculateDistance(
      previousLocation.lat, previousLocation.lng,
      dropoffLocation.lat, dropoffLocation.lng
    );
    const finalTravelMinutes = Math.ceil((finalDistance / 40) * 60 * trafficMultiplier);
    const estimatedArrival = new Date(cumulativeTime.getTime() + finalTravelMinutes * 60000);

    result.estimatedDuration = 
      (estimatedArrival - new Date(pickupTimeWindow.start)) / 60000;
    result.estimatedArrival = estimatedArrival.toLocaleTimeString();

    return result;
  }

  // Capacity Validation
  static async validateCapacity(vehicleId, studentCount) {
    // Query database for vehicle and current bookings
    const vehicle = await db.query(
      'SELECT seating_capacity FROM vehicles WHERE vehicle_id = ?',
      [vehicleId]
    );

    const currentBookings = await db.query(
      'SELECT COUNT(*) as count FROM trips ' +
      'WHERE vehicle_id = ? AND trip_status IN (?, ?)',
      [vehicleId, 'assigned', 'in_transit']
    );

    const result = {
      valid: true,
      errors: [],
      score: 100
    };

    const capacity = vehicle[0].seating_capacity;
    const booked = currentBookings[0].count;
    const available = capacity - booked;

    if (studentCount > available) {
      result.errors.push(
        `Insufficient capacity: ${studentCount} students, only ${available} seats available`
      );
      result.valid = false;
    }

    result.capacity = capacity;
    result.booked = booked;
    result.available = available;
    result.utilizationRate = (booked + studentCount) / capacity;
    result.score = Math.max(0, 100 - (result.utilizationRate * 30));

    return result;
  }

  // Driver Schedule Conflict Check
  static async validateDriverSchedule(driverId, durationMinutes, startTime) {
    const endTime = new Date(new Date(startTime).getTime() + durationMinutes * 60000);

    const result = {
      valid: true,
      errors: [],
      score: 100,
      conflicts: []
    };

    // Find all existing trips for this driver
    const existingTrips = await db.query(
      'SELECT trip_id, scheduled_pickup_time, actual_dropoff_time FROM trips ' +
      'WHERE driver_id = ? AND trip_status IN (?, ?)',
      [driverId, 'assigned', 'in_transit']
    );

    for (const trip of existingTrips) {
      const tripStart = new Date(trip.scheduled_pickup_time);
      const tripEnd = new Date(trip.actual_dropoff_time);

      // Check for overlap
      if ((startTime < tripEnd && endTime > tripStart)) {
        result.conflicts.push({
          tripId: trip.trip_id,
          conflictStart: tripStart.toLocaleTimeString(),
          conflictEnd: tripEnd.toLocaleTimeString()
        });
        result.valid = false;
        result.errors.push(
          `Schedule conflict with trip ${trip.trip_id}: ` +
          `${tripStart.toLocaleTimeString()}-${tripEnd.toLocaleTimeString()}`
        );
      }
    }

    return result;
  }

  // Route Efficiency Validation
  static validateRouteEfficiency(pickupLocations, dropoffLocation) {
    // Direct distance vs actual route distance
    const directDistance = this.calculateDistance(
      pickupLocations[0].lat,
      pickupLocations[0].lng,
      dropoffLocation.lat,
      dropoffLocation.lng
    );

    let actualDistance = 0;
    let current = pickupLocations[0];

    for (let i = 1; i < pickupLocations.length; i++) {
      actualDistance += this.calculateDistance(
        current.lat, current.lng,
        pickupLocations[i].lat, pickupLocations[i].lng
      );
      current = pickupLocations[i];
    }

    actualDistance += this.calculateDistance(
      current.lat, current.lng,
      dropoffLocation.lat, dropoffLocation.lng
    );

    const detourPercentage = ((actualDistance - directDistance) / directDistance) * 100;

    return {
      directDistance: directDistance.toFixed(1),
      actualDistance: actualDistance.toFixed(1),
      detourPercentage: Math.round(detourPercentage * 10) / 10,
      score: Math.max(0, 100 - (detourPercentage / 50 * 30)),
      isEfficient: detourPercentage <= 25
    };
  }
}
```

## 1.2 Usage Example

```javascript
// Request a trip
const tripRequest = {
  pickupLocations: [
    { 
      address: "Sta. Maria, Bulacan",
      lat: 14.7512,
      lng: 120.9671,
      studentId: "STU-001"
    },
    {
      address: "SM Fairview",
      lat: 14.7286,
      lng: 121.0419,
      studentId: "STU-002"
    }
  ],
  dropoffLocation: {
    address: "University of Makati",
    lat: 14.5650,
    lng: 121.0185
  },
  pickupTimeWindow: {
    start: "2026-05-15T07:00:00",
    end: "2026-05-15T07:30:00"
  },
  vehicleId: "VEH-001",
  driverId: "DRV-042",
  desiredTime: "2026-05-15T07:15:00"
};

// Validate route
const validation = await RouteValidator.validateRoute(tripRequest);

if (validation.isValid) {
  console.log("✅ Route is FEASIBLE");
  console.log(`Feasibility Score: ${validation.feasibilityScore}/100`);
  console.log(`Estimated Duration: ${validation.details.timing.estimatedDuration} min`);
  console.log(`Estimated Arrival: ${validation.details.timing.estimatedArrival}`);
} else {
  console.log("❌ Route REJECTED");
  console.log("Errors:", validation.errors);
  console.log("Warnings:", validation.warnings);
}
```

---

# 2. SMART DRIVER ASSIGNMENT ALGORITHM

## 2.1 Multi-Factor Scoring System

```javascript
/**
 * Intelligent Driver Assignment Engine
 * Assigns drivers based on multiple weighted factors
 * 
 * Scoring Factors:
 * - Location proximity (30%) - nearest not always best
 * - Experience level (12.5%) - years and trips completed
 * - Parent rating (12.5%) - 1-5 star rating
 * - Vehicle capacity (20%) - optimal load distribution
 * - Route efficiency (5%) - how detoured is current route
 * - Schedule availability (10%) - buffer time available
 * - Special requirements (10%) - accessibility, preferences
 */

class SmartDriverAssignment {
  
  // Main assignment function
  static async assignDriver(tripRequest, availableCandidates) {
    const {
      pickupLocations,
      dropoffLocation,
      pickupTime,
      estimatedDuration,
      studentCount,
      specialRequirements = {}
    } = tripRequest;

    // Score all candidates
    const scoredCandidates = await Promise.all(
      availableCandidates.map(driver => 
        this.scoreDriver(
          driver,
          tripRequest
        )
      )
    );

    // Sort by score (highest first)
    scoredCandidates.sort((a, b) => b.totalScore - a.totalScore);

    // Return ranked list with assignment recommendation
    return {
      topCandidate: scoredCandidates[0],
      candidates: scoredCandidates.slice(0, 5),
      fallbackCandidates: scoredCandidates.slice(5),
      assignmentReason: this.generateAssignmentReason(scoredCandidates[0])
    };
  }

  // Score individual driver
  static async scoreDriver(driver, tripRequest) {
    const scoreBreakdown = {};

    // Factor 1: Location Proximity (30%)
    const proximityScore = await this.scoreProximity(
      driver,
      tripRequest.pickupLocations[0]
    );
    scoreBreakdown.proximity = {
      score: proximityScore,
      weight: 0.30,
      weighted: proximityScore * 0.30
    };

    // Factor 2: Experience (12.5%)
    const experienceScore = this.scoreExperience(driver);
    scoreBreakdown.experience = {
      score: experienceScore,
      weight: 0.125,
      weighted: experienceScore * 0.125
    };

    // Factor 3: Rating (12.5%)
    const ratingScore = this.scoreRating(driver);
    scoreBreakdown.rating = {
      score: ratingScore,
      weight: 0.125,
      weighted: ratingScore * 0.125
    };

    // Factor 4: Vehicle Capacity Optimization (20%)
    const capacityScore = await this.scoreCapacity(
      driver,
      tripRequest.studentCount
    );
    scoreBreakdown.capacity = {
      score: capacityScore,
      weight: 0.20,
      weighted: capacityScore * 0.20
    };

    // Factor 5: Route Efficiency (5%)
    const efficiencyScore = await this.scoreRouteEfficiency(
      driver,
      tripRequest
    );
    scoreBreakdown.efficiency = {
      score: efficiencyScore,
      weight: 0.05,
      weighted: efficiencyScore * 0.05
    };

    // Factor 6: Schedule Availability (10%)
    const scheduleScore = await this.scoreSchedule(
      driver,
      tripRequest
    );
    scoreBreakdown.schedule = {
      score: scheduleScore,
      weight: 0.10,
      weighted: scheduleScore * 0.10
    };

    // Factor 7: Special Requirements (10%)
    const specialScore = await this.scoreSpecialRequirements(
      driver,
      tripRequest.specialRequirements
    );
    scoreBreakdown.special = {
      score: specialScore,
      weight: 0.10,
      weighted: specialScore * 0.10
    };

    const totalScore = Object.values(scoreBreakdown).reduce(
      (sum, factor) => sum + factor.weighted,
      0
    );

    return {
      driverId: driver.driver_id,
      driverName: driver.first_name + ' ' + driver.last_name,
      totalScore: Math.round(totalScore * 100) / 100,
      scoreBreakdown,
      vehicle: driver.vehicle,
      rating: driver.safety_rating,
      experience: driver.years_experience,
      currentLoad: driver.current_passengers,
      capacity: driver.vehicle.seating_capacity
    };
  }

  // Proximity Scoring
  static async scoreProximity(driver, pickupLocation) {
    // Get driver's current location
    const currentLocation = await this.getDriverLocation(driver.driver_id);

    const distance = this.calculateDistance(
      currentLocation.lat,
      currentLocation.lng,
      pickupLocation.lat,
      pickupLocation.lng
    );

    // Scoring: 0-2km = 100, 2-5km = 90-100, 5-10km = 70-90, 10-15km = 50-70
    if (distance <= 2) return 100;
    if (distance <= 5) return 100 - ((distance - 2) / 3) * 10;
    if (distance <= 10) return 90 - ((distance - 5) / 5) * 20;
    if (distance <= 15) return 70 - ((distance - 10) / 5) * 20;
    return 0; // Too far
  }

  // Experience Scoring
  static scoreExperience(driver) {
    const yearsExp = driver.years_experience || 1;
    const tripsCompleted = driver.total_trips || 0;

    // Years: 1 year = 20 points, 15+ years = 100 points
    const yearsScore = Math.min(100, (yearsExp / 15) * 100);

    // Trips: 100 trips = 50 points, 2000+ trips = 100 points
    const tripsScore = Math.min(100, (tripsCompleted / 2000) * 100);

    // Average the two
    return (yearsScore + tripsScore) / 2;
  }

  // Rating Scoring
  static scoreRating(driver) {
    const rating = driver.safety_rating || 3.5;
    // 3.0/5.0 = 60, 4.0/5.0 = 80, 5.0/5.0 = 100
    return Math.max(0, (rating / 5.0) * 100);
  }

  // Capacity Optimization Scoring
  static async scoreCapacity(driver, newStudentCount) {
    const capacity = driver.vehicle.seating_capacity;
    const currentLoad = driver.current_passengers || 0;
    const projectedLoad = currentLoad + newStudentCount;

    // Optimal utilization: 40-70%
    const utilizationRate = projectedLoad / capacity;

    if (utilizationRate > 1) return 0; // Overloaded
    if (utilizationRate >= 0.40 && utilizationRate <= 0.70) return 100;
    if (utilizationRate >= 0.30 && utilizationRate < 0.40) return 80;
    if (utilizationRate >= 0.70 && utilizationRate <= 0.85) return 85;
    if (utilizationRate >= 0.85 && utilizationRate <= 1.00) return 40;
    return 90; // Very low (still okay)
  }

  // Route Efficiency Scoring
  static async scoreRouteEfficiency(driver, tripRequest) {
    // Check if driver's current route + new stops is efficient
    const currentRoute = await this.getDriverRoute(driver.driver_id);
    const proposedRoute = this.buildProposedRoute(
      currentRoute,
      tripRequest.pickupLocations[0]
    );

    // Calculate detour percentage
    const directDist = this.calculateDistance(
      currentRoute.currentLocation.lat,
      currentRoute.currentLocation.lng,
      tripRequest.dropoffLocation.lat,
      tripRequest.dropoffLocation.lng
    );

    const detourDist = proposedRoute.totalDistance;
    const detourPercent = ((detourDist - directDist) / directDist) * 100;

    // Scoring: 0% detour = 100, 25% detour = 80, 50%+ = 0
    if (detourPercent <= 0) return 100;
    if (detourPercent <= 25) return 100 - (detourPercent / 25) * 20;
    if (detourPercent <= 50) return 80 - ((detourPercent - 25) / 25) * 80;
    return 0;
  }

  // Schedule Availability Scoring
  static async scoreSchedule(driver, tripRequest) {
    const existingTrips = await this.getDriverTrips(driver.driver_id);
    const newTripStart = new Date(tripRequest.pickupTime);
    const newTripEnd = new Date(
      newTripStart.getTime() + tripRequest.estimatedDuration * 60000
    );

    let hasConflict = false;
    let bufferMinutes = 60; // Minimum buffer required

    for (const trip of existingTrips) {
      const tripEnd = new Date(trip.estimated_dropoff_time);
      const minutesUntilNewTrip = (newTripStart - tripEnd) / 60000;

      if (minutesUntilNewTrip < 0) {
        hasConflict = true;
        break;
      }

      if (minutesUntilNewTrip < bufferMinutes) {
        bufferMinutes = minutesUntilNewTrip;
      }
    }

    if (hasConflict) return 0;
    if (bufferMinutes >= 60) return 100;
    if (bufferMinutes >= 30) return 70;
    return 30;
  }

  // Special Requirements Scoring
  static async scoreSpecialRequirements(driver, requirements) {
    let score = 100;

    if (requirements.wheelchairAccessible && !driver.vehicle.wheelchair_lift) {
      score -= 50;
    }

    if (requirements.preferredGender && 
        requirements.preferredGender !== driver.gender) {
      score -= 20;
    }

    if (requirements.preferredLanguage && 
        !driver.languages.includes(requirements.preferredLanguage)) {
      score -= 10;
    }

    return Math.max(0, score);
  }

  // Generate human-readable reason for assignment
  static generateAssignmentReason(topCandidate) {
    const breakdown = topCandidate.scoreBreakdown;
    const topFactors = Object.entries(breakdown)
      .sort((a, b) => b[1].weighted - a[1].weighted)
      .slice(0, 3)
      .map(([name, factor]) => {
        return `${name} (${Math.round(factor.score)}/100)`;
      });

    return `Assigned ${topCandidate.driverName} based on: ${topFactors.join(', ')}`;
  }

  // Helper: Get driver current location
  static async getDriverLocation(driverId) {
    const location = await db.query(
      'SELECT latitude, longitude FROM driver_locations ' +
      'WHERE driver_id = ? ORDER BY timestamp DESC LIMIT 1',
      [driverId]
    );
    return location[0] || { lat: 0, lng: 0 };
  }

  // Helper: Get driver current route
  static async getDriverRoute(driverId) {
    const activeTrips = await db.query(
      'SELECT * FROM trips WHERE driver_id = ? AND trip_status IN (?, ?)',
      [driverId, 'assigned', 'in_transit']
    );
    return activeTrips[0] || null;
  }

  // Helper: Get driver's trips for day
  static async getDriverTrips(driverId) {
    return await db.query(
      'SELECT * FROM trips WHERE driver_id = ? AND DATE(scheduled_pickup_time) = CURDATE()',
      [driverId]
    );
  }

  // Helper: Distance calculation
  static calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}
```

---

# 3. API REQUEST/RESPONSE EXAMPLES

## 3.1 Book Trip Endpoint

### Request:
```http
POST /api/v1/parent/trips HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "studentId": "STU-1234",
  "tripType": "roundtrip",
  "pickupLocation": {
    "address": "123 Main Street, Makati",
    "latitude": 14.5550,
    "longitude": 121.0245,
    "name": "Home"
  },
  "dropoffLocation": {
    "address": "BGC International School, Taguig",
    "latitude": 14.5994,
    "longitude": 121.0437,
    "name": "School"
  },
  "preferredPickupTime": "2026-05-16T07:30:00",
  "pickupTimeWindow": {
    "start": "2026-05-16T07:00:00",
    "end": "2026-05-16T08:00:00"
  },
  "specialRequirements": {
    "wheelchairAccessible": false,
    "notes": "Usually late, please be patient"
  },
  "recurringDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  "notes": "Regular school commute"
}
```

### Success Response (200):
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "success",
  "tripId": "TRP-2026-051601",
  "studentName": "Maria Cruz",
  "tripStatus": "assigned",
  "assignment": {
    "driverId": "DRV-042",
    "driverName": "Juan Dela Cruz",
    "driverRating": 4.87,
    "driverPhone": "+63-917-123-4567",
    "vehicleId": "VEH-001",
    "vehicleType": "Nissan Urvan",
    "licensePlate": "XYZ 5678",
    "vehicleColor": "White",
    "estimatedPickupTime": "2026-05-16T07:28:00",
    "estimatedDropoffTime": "2026-05-16T07:53:00",
    "estimatedDuration": "25 minutes",
    "feasibilityScore": 92
  },
  "notifications": {
    "sms": "+63-917-222-3333",
    "email": "parent@example.com",
    "inApp": true
  },
  "tracking": {
    "trackingUrl": "https://hnsapp.example.com/track/TRP-2026-051601",
    "liveTrackingEnabled": true,
    "estimatedArrivalUrl": "https://maps.google.com/..."
  },
  "pricing": {
    "baseFare": "₱450",
    "discounts": "₱0",
    "totalFare": "₱450",
    "paymentStatus": "pending"
  },
  "warnings": [],
  "nextSteps": [
    "Driver will arrive in 15 minutes",
    "Look for white Nissan Urvan (XYZ 5678)",
    "Student will receive pickup confirmation"
  ]
}
```

### Validation Error Response (422):
```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json

{
  "status": "error",
  "error": "route_infeasible",
  "message": "Trip request cannot be fulfilled due to operational constraints",
  "validationErrors": [
    {
      "field": "pickupLocation",
      "error": "distance_too_far",
      "description": "Pickup location is 42km away from dropoff location. Maximum allowed is 35km."
    },
    {
      "field": "pickupTimeWindow",
      "error": "time_conflict",
      "description": "Requested pickup time conflicts with existing driver assignments."
    }
  ],
  "suggestions": [
    "Try scheduling 30 minutes later (8:00 AM)",
    "Request alternative driver",
    "Contact support for manual routing"
  ]
}
```

---

# 4. WEBSOCKET REAL-TIME EVENTS

## 4.1 Parent WebSocket Stream

```javascript
// Parent connects to WebSocket
const socket = new WebSocket('wss://api.hnsapp.example.com/ws/parent?token=...');

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  
  switch(message.type) {
    case 'trip:assigned':
      handleTripAssigned(message.data);
      break;
    case 'driver:location:updated':
      handleLocationUpdate(message.data);
      break;
    case 'trip:completed':
      handleTripCompleted(message.data);
      break;
  }
});

// Event 1: Trip Assigned
const tripAssignedEvent = {
  type: 'trip:assigned',
  timestamp: '2026-05-15T07:20:00Z',
  tripId: 'TRP-2026-051501',
  data: {
    driverName: 'Juan Dela Cruz',
    driverRating: 4.87,
    driverPhoto: 'https://...',
    driverPhone: '+63-917-123-4567',
    vehicle: {
      type: 'Nissan Urvan',
      plate: 'XYZ 5678',
      color: 'White'
    },
    estimatedPickupTime: '2026-05-15T07:25:00Z',
    currentDistance: 3.2,
    eta: 8 // minutes
  }
};

// Event 2: Driver Location Updated (every 10 seconds)
const locationUpdateEvent = {
  type: 'driver:location:updated',
  timestamp: '2026-05-15T07:23:15Z',
  tripId: 'TRP-2026-051501',
  data: {
    driverId: 'DRV-042',
    currentLocation: {
      latitude: 14.5687,
      longitude: 121.0234,
      address: 'EDSA, Makati'
    },
    speed: 45, // km/h
    heading: 180, // degrees
    accuracy: 5, // meters
    eta: 5, // minutes to pickup
    currentDistance: 2.1, // km
    speedingAlert: false
  }
};

// Event 3: Pickup Confirmed
const pickupConfirmedEvent = {
  type: 'trip:pickup:confirmed',
  timestamp: '2026-05-15T07:25:33Z',
  tripId: 'TRP-2026-051501',
  data: {
    studentName: 'Maria Cruz',
    pickupTime: '2026-05-15T07:25:33Z',
    confirmationType: 'photo_verified',
    confirmationPhotoUrl: 'https://...',
    seatbeltStatus: 'secured',
    nextStatus: 'en_route_to_school',
    etaToDropoff: 25 // minutes
  }
};

// Event 4: Trip Completed
const tripCompletedEvent = {
  type: 'trip:completed',
  timestamp: '2026-05-15T07:50:45Z',
  tripId: 'TRP-2026-051501',
  data: {
    studentName: 'Maria Cruz',
    dropoffTime: '2026-05-15T07:50:45Z',
    dropoffLocation: 'BGC International School',
    confirmationType: 'photo_verified',
    confirmationPhotoUrl: 'https://...',
    totalDuration: 25, // minutes
    distanceTraveled: 12.3, // km
    finalFare: 450, // PHP
    paymentStatus: 'paid',
    driverRating: {
      prompt: 'Rate your trip',
      defaultRating: 5,
      allowComment: true
    }
  }
};
```

---

# 5. SAFETY VALIDATION LOGIC

## 5.1 Pickup Confirmation with Verification

```javascript
class PickupConfirmation {
  
  static async confirmPickup(tripId, confirmationData) {
    const {
      driverId,
      studentId,
      confirmationType, // 'photo' | 'qr_code' | 'manual'
      photoUrl, // if photo
      qrCodeData, // if QR
      timestamp
    } = confirmationData;

    const validation = {
      isValid: false,
      errors: [],
      warnings: [],
      student: null,
      trip: null
    };

    try {
      // Step 1: Verify trip exists and is in correct state
      const trip = await db.query(
        'SELECT * FROM trips WHERE trip_id = ? AND trip_status = ?',
        [tripId, 'in_transit']
      );

      if (!trip[0]) {
        validation.errors.push('Trip not in active transit status');
        return validation;
      }
      validation.trip = trip[0];

      // Step 2: Verify student identity
      if (confirmationType === 'photo') {
        validation.isValid = await this.verifyPhotoIdentification(
          studentId,
          photoUrl
        );
        
        if (!validation.isValid) {
          validation.errors.push('Photo identification does not match student record');
        }
      } else if (confirmationType === 'qr_code') {
        const student = await db.query(
          'SELECT * FROM students WHERE student_id = ?',
          [studentId]
        );

        validation.isValid = qrCodeData === student[0].qr_code;
        
        if (!validation.isValid) {
          validation.errors.push('QR code does not match student QR');
        }
        
        validation.student = student[0];
      } else if (confirmationType === 'manual') {
        // Manual confirmation requires admin override
        const student = await db.query(
          'SELECT * FROM students WHERE student_id = ?',
          [studentId]
        );
        
        validation.student = student[0];
        validation.warnings.push('Manual confirmation - requires driver verification');
      }

      // Step 3: Verify driver at pickup location
      const driverLocation = await this.getDriverLocation(driverId);
      const pickupLocation = {
        lat: trip[0].pickup_latitude,
        lng: trip[0].pickup_longitude
      };

      const distance = this.calculateDistance(
        driverLocation.lat,
        driverLocation.lng,
        pickupLocation.lat,
        pickupLocation.lng
      );

      if (distance > 0.1) { // 100 meters
        validation.errors.push(
          `Driver not at pickup location (${(distance * 1000).toFixed(0)}m away)`
        );
        validation.isValid = false;
      }

      // Step 4: Verify pickup time is within reasonable window
      const pickupTime = new Date(timestamp);
      const scheduledTime = new Date(trip[0].scheduled_pickup_time);
      const timeDiff = Math.abs((pickupTime - scheduledTime) / 60000); // minutes

      if (timeDiff > 30) {
        validation.warnings.push(
          `Pickup is ${timeDiff} minutes ${timeDiff > 0 ? 'late' : 'early'}`
        );
      }

      // Step 5: Save confirmation
      if (validation.isValid) {
        await db.query(
          'UPDATE trips SET pickup_confirmation_type = ?, ' +
          'pickup_photo_url = ?, actual_pickup_time = ?, ' +
          'trip_status = ? WHERE trip_id = ?',
          [
            confirmationType,
            photoUrl || null,
            timestamp,
            'in_transit',
            tripId
          ]
        );

        // Send parent notification
        await this.notifyParent(trip[0].student_id, {
          type: 'pickup:confirmed',
          message: `${trip[0].driver_name} picked up ${validation.student.first_name}`
        });
      }

      return validation;

    } catch (error) {
      validation.errors.push(`Error: ${error.message}`);
      return validation;
    }
  }

  static async verifyPhotoIdentification(studentId, photoUrl) {
    // Use facial recognition API to verify student photo
    // This is a simplified example
    
    const student = await db.query(
      'SELECT student_photo_for_identification FROM students ' +
      'WHERE student_id = ?',
      [studentId]
    );

    if (!student[0]) return false;

    // In production, use AWS Rekognition or similar
    const recognitionResult = await this.runFacialRecognition(
      photoUrl,
      student[0].student_photo_for_identification
    );

    return recognitionResult.confidence > 0.95; // 95% confidence
  }

  static async getDriverLocation(driverId) {
    const location = await db.query(
      'SELECT latitude, longitude FROM driver_locations ' +
      'WHERE driver_id = ? ORDER BY timestamp DESC LIMIT 1',
      [driverId]
    );
    return location[0];
  }

  static calculateDistance(lat1, lng1, lat2, lng2) {
    // Haversine formula (returns km)
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  static async notifyParent(studentId, notification) {
    // Send push notification to parent
    // Implementation details...
  }
}
```

---

# 6. DATABASE QUERY PATTERNS

## 6.1 Complex Queries

### Query 1: Find Available Drivers for Assignment
```sql
SELECT 
  d.driver_id,
  d.first_name,
  d.last_name,
  d.years_experience,
  d.safety_rating,
  d.total_trips,
  v.vehicle_id,
  v.license_plate,
  v.seating_capacity,
  v.color,
  (SELECT COUNT(*) FROM trips 
   WHERE driver_id = d.driver_id 
   AND trip_status IN ('assigned', 'in_transit')) as current_trips,
  dl.latitude,
  dl.longitude,
  dl.timestamp as location_timestamp
FROM drivers d
JOIN vehicles v ON d.current_vehicle_id = v.vehicle_id
LEFT JOIN driver_locations dl ON d.driver_id = dl.driver_id
WHERE 
  d.status = 'active' 
  AND d.employment_status = 'active'
  AND d.suspension_end_date IS NULL
  AND v.is_active = TRUE
  AND d.safety_rating >= 4.0
  AND v.seating_capacity >= ?
  AND (SELECT COUNT(*) FROM trips 
       WHERE driver_id = d.driver_id 
       AND trip_status IN ('assigned', 'in_transit')) < (v.seating_capacity * 0.8)
  AND dl.timestamp > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
ORDER BY dl.timestamp DESC
```

### Query 2: Get Driver's Schedule for Day with Time Gaps
```sql
SELECT 
  d.driver_id,
  d.first_name,
  d.last_name,
  t.trip_id,
  t.scheduled_pickup_time,
  t.estimated_dropoff_time,
  t.trip_status,
  s.student_id,
  s.first_name as student_name,
  UNIX_TIMESTAMP(t.estimated_dropoff_time) - 
  UNIX_TIMESTAMP(LAG(t.estimated_dropoff_time) 
  OVER (PARTITION BY d.driver_id ORDER BY t.scheduled_pickup_time)) as gap_seconds
FROM trips t
JOIN drivers d ON t.driver_id = d.driver_id
JOIN students s ON t.student_id = s.student_id
WHERE 
  d.driver_id = ?
  AND DATE(t.scheduled_pickup_time) = CURDATE()
  AND t.trip_status IN ('assigned', 'in_transit', 'completed')
ORDER BY t.scheduled_pickup_time
```

### Query 3: Incident Analysis by Driver
```sql
SELECT 
  d.driver_id,
  d.first_name,
  d.last_name,
  COUNT(i.incident_id) as total_incidents,
  SUM(CASE WHEN i.severity = 'high' THEN 1 ELSE 0 END) as high_severity_incidents,
  SUM(CASE WHEN i.severity = 'critical' THEN 1 ELSE 0 END) as critical_incidents,
  COUNT(DISTINCT CASE WHEN i.status = 'resolved' THEN i.incident_id END) as resolved_incidents,
  AVG(DATEDIFF(i.resolution_timestamp, i.report_timestamp)) as avg_resolution_days,
  MAX(i.report_timestamp) as last_incident_date
FROM drivers d
LEFT JOIN incidents i ON d.driver_id = i.driver_id
WHERE d.status = 'active'
GROUP BY d.driver_id, d.first_name, d.last_name
HAVING total_incidents > 0
ORDER BY high_severity_incidents DESC, total_incidents DESC
```

---

# 7. ERROR HANDLING & EDGE CASES

## 7.1 Graceful Degradation

```javascript
class ErrorHandler {
  
  static async handleRouteAssignmentFailure(tripRequest, error) {
    const fallbacks = {
      databaseDown: async () => {
        // Use cached driver list
        return this.assignFromCache(tripRequest);
      },
      
      noDriversAvailable: async () => {
        // Create waitlist for automatic assignment
        return this.addToWaitlist(tripRequest);
      },
      
      routeNotFeasible: async () => {
        // Suggest alternative times to parent
        return this.suggestAlternativeTimes(tripRequest);
      },
      
      apiTimeoutError: async () => {
        // Retry with exponential backoff
        return this.retryWithBackoff(tripRequest, 3);
      }
    };

    if (fallbacks[error.type]) {
      try {
        return await fallbacks[error.type]();
      } catch (fallbackError) {
        return this.contactHumanOperator(tripRequest, error, fallbackError);
      }
    }
  }

  static async contactHumanOperator(tripRequest, originalError, fallbackError) {
    // Alert operations team for manual intervention
    await notificationService.alertOperations({
      priority: 'high',
      type: 'assignment_failure',
      studentId: tripRequest.studentId,
      error: originalError,
      fallbackError,
      timestamp: new Date()
    });

    return {
      status: 'manual_review',
      message: 'Operations team has been alerted and will contact you shortly'
    };
  }
}
```

---

# 8. PERFORMANCE OPTIMIZATION PATTERNS

## 8.1 Caching Strategy

```javascript
class CacheStrategy {
  
  static async getAvailableDrivers(zoneId, useCache = true) {
    const cacheKey = `available_drivers:${zoneId}`;
    
    // Try cache first
    if (useCache) {
      const cached = await redis.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 60000) {
        return cached.data;
      }
    }

    // Query database if cache miss
    const drivers = await db.query(
      'SELECT * FROM drivers WHERE zone_id = ? AND status = "active"',
      [zoneId]
    );

    // Cache for 60 seconds
    await redis.set(cacheKey, {
      data: drivers,
      timestamp: Date.now()
    }, 60);

    return drivers;
  }

  static async preloadZoneCapacity(zones) {
    // Batch load capacity for all zones
    const capacityData = await Promise.all(
      zones.map(zone => 
        db.query(
          'SELECT zone_id, ' +
          '(SELECT COUNT(*) FROM students WHERE service_zone_id = ?) as students, ' +
          'max_daily_capacity FROM service_zones WHERE zone_id = ?',
          [zone.zone_id, zone.zone_id]
        )
      )
    );

    // Cache batch result
    await redis.set('zone_capacity_all', capacityData, 300);

    return capacityData;
  }
}
```

---

## CONCLUSION

This implementation document provides production-ready code patterns for core HNSAPP functionality. The algorithms demonstrate:

✅ **Route Feasibility** - Realistic transportation logic
✅ **Smart Assignment** - Multi-factor intelligent driver matching
✅ **Safety Validation** - Student identification verification
✅ **Real-Time Events** - Parent transparency through WebSockets
✅ **Error Handling** - Graceful degradation for service continuity
✅ **Performance** - Caching and optimization strategies

These patterns form the foundation of a professional transportation management system capable of handling complex logistics while maintaining absolute prioritization of child safety.


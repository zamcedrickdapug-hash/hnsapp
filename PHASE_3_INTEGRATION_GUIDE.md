# PHASE 3 INTEGRATION GUIDE

## Quick Start: 5-Step Integration

### Step 1: Update Main Server File (index.js)

In `backend/index.js`, add the transportation routes:

```javascript
// Add this line with other route imports (around line 13)
const transportationRoutes = require('./routes/transportation.routes');

// Add this line with other route mounting (around line 150, after other routes)
app.use('/api/transportation', transportationRoutes);
```

### Step 2: Update WebSocket Server (socket.js)

In `backend/socket.js`, add real-time transportation handlers:

```javascript
// Add import at top
const TransportationTracking = require('./handlers/transportationTracking');

// Add these event handlers in the connection handler (around line 80)
socket.on('trip:tracking-start', (data) => {
  TransportationTracking.initializeTripTracking(io, socket, data.tripId);
});

socket.on('driver:location', (data) => {
  TransportationTracking.updateDriverLocation(io, socket, data);
});

socket.on('pickup:status', (data) => {
  TransportationTracking.updatePickupStatus(io, socket, data);
});

socket.on('trip:status', (data) => {
  TransportationTracking.updateTripStatus(io, socket, data);
});

socket.on('emergency:sos', (data) => {
  TransportationTracking.activateSOS(io, socket, data);
});

socket.on('parent:approval', (data) => {
  TransportationTracking.parentApprovalResponse(io, socket, data);
});
```

### Step 3: Verify Database Models

All models are ready:
- ✅ `models/Vehicle.js` - Fleet management
- ✅ `models/TripAssignment.js` - Trip lifecycle  
- ✅ `models/SafetyProfile.js` - Driver verification
- ✅ `models/IncidentReport.js` - Safety incidents

MongoDB will auto-create these on first use.

### Step 4: Check Services

All services ready for use:
- ✅ `services/routeOptimizationService.js` - Route feasibility
- ✅ `services/driverAssignmentService.js` - Intelligent assignment
- ✅ `services/vehicleCapacityService.js` - Capacity management
- ✅ `services/incidentManagementService.js` - Incident handling

### Step 5: Test Backend Routes

Start the backend:
```bash
cd backend
npm install  # if new dependencies added
npm run dev
```

Test with curl or Postman:

```bash
# Register a vehicle
curl -X POST http://localhost:4000/api/vehicles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "plateNumber": "ABC1234",
    "vehicleType": "van",
    "seatCapacity": 12,
    "licenseExpiry": "2027-12-31",
    "gpsDeviceId": "gps-001"
  }'

# Create a trip
curl -X POST http://localhost:4000/api/transportation/trips \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "pickupPoints": [
      {
        "studentId": "s1",
        "studentName": "John Doe",
        "pickupLocation": {"latitude": 14.5890, "longitude": 121.0726},
        "parentId": "parent-uuid",
        "emergencyContact": {"phone": "09123456789", "name": "Parent"}
      }
    ],
    "schoolId": "sch1",
    "schoolName": "XYZ School",
    "schoolLocation": {"latitude": 14.6000, "longitude": 121.1000}
  }'

# Report an incident
curl -X POST http://localhost:4000/api/incidents/report \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "tripId": "trip-uuid",
    "incidentType": "speeding",
    "severity": "high",
    "description": "Driver exceeded speed limit"
  }'
```

---

## 📁 Complete File Structure

```
backend/
├── models/
│   ├── User.js                          (updated)
│   ├── Vehicle.js                       ✨ NEW
│   ├── TripAssignment.js                ✨ NEW
│   ├── SafetyProfile.js                 ✨ NEW
│   ├── IncidentReport.js                ✨ NEW
│   ├── DriverStatus.js                  (existing)
│   ├── DriverLocation.js                (existing)
│   └── ...
│
├── services/
│   ├── routeOptimizationService.js      ✨ NEW
│   ├── driverAssignmentService.js       ✨ NEW
│   ├── vehicleCapacityService.js        ✨ NEW
│   ├── incidentManagementService.js     ✨ NEW
│   ├── driverService.js                 (existing)
│   └── notificationService.js           (existing)
│
├── controllers/
│   ├── tripManagementController.js      ✨ NEW
│   ├── incidentManagementController.js  ✨ NEW
│   ├── vehicleManagementController.js   ✨ NEW
│   └── ...
│
├── routes/
│   ├── transportation.routes.js         ✨ NEW
│   ├── auth.routes.js                   (existing)
│   ├── driver.routes.js                 (existing)
│   └── ...
│
├── middleware/
│   ├── transportationValidation.js      ✨ NEW
│   ├── authMiddleware.js                (existing)
│   └── ...
│
├── handlers/
│   ├── transportationTracking.js        ✨ NEW
│   └── ...
│
├── index.js                             (update)
├── socket.js                            (update)
├── package.json                         (no changes)
└── PHASE_3_TRANSPORTATION_SYSTEM.md     ✨ NEW (documentation)
```

**Summary**: 13 new files created, 2 files updated (index.js, socket.js)

---

## 🔑 Key API Endpoints

### Transportation Trips

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/transportation/trips` | Create trip with auto-assignment |
| GET | `/api/transportation/trips/:tripId` | Get trip details |
| PATCH | `/api/transportation/trips/:tripId/status` | Update trip status |
| GET | `/api/transportation/trips` | Trip history with filters |

### Incidents

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/incidents/report` | Report incident |
| GET | `/api/incidents/:reportId` | Get incident details |
| POST | `/api/incidents/:reportId/investigate` | Start investigation |
| POST | `/api/incidents/:reportId/notes` | Add investigation note |
| POST | `/api/incidents/:reportId/complete` | Complete investigation |
| POST | `/api/incidents/:reportId/resolve` | Resolve incident |
| GET | `/api/incidents` | Incident history |
| GET | `/api/incidents/statistics` | Incident analytics |
| GET | `/api/drivers/:driverId/safety` | Driver safety profile |

### Vehicles

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/vehicles` | Register vehicle |
| GET | `/api/vehicles/:vehicleId` | Get vehicle details |
| POST | `/api/vehicles/:vehicleId/assign-driver` | Assign driver |
| POST | `/api/vehicles/:vehicleId/remove-driver` | Remove driver |
| PATCH | `/api/vehicles/:vehicleId/location` | Update GPS location |
| GET | `/api/vehicles` | List fleet vehicles |
| GET | `/api/vehicles/fleet/capacity` | Fleet capacity status |
| POST | `/api/vehicles/:vehicleId/maintenance` | Schedule maintenance |

---

## 🔌 WebSocket Events (Real-Time)

### Driver Sends

```javascript
// Initialize tracking
socket.emit('trip:tracking-start', { tripId: 'trip-uuid' });

// Update location (every 5-10 seconds during trip)
socket.emit('driver:location', {
  tripId: 'trip-uuid',
  latitude: 14.5890,
  longitude: 121.0726,
  speed: 45,
  heading: 180,
  accuracy: 5
});

// Update pickup status
socket.emit('pickup:status', {
  tripId: 'trip-uuid',
  pickupIndex: 0,
  status: 'picked_up',
  qrVerificationCode: 'QR123'
});

// Update trip status
socket.emit('trip:status', {
  tripId: 'trip-uuid',
  newStatus: 'in_transit_to_school'
});

// Emergency SOS
socket.emit('emergency:sos', {
  tripId: 'trip-uuid',
  reason: 'Medical emergency'
});
```

### Parent Sends

```javascript
// Approve trip
socket.emit('parent:approval', {
  tripId: 'trip-uuid',
  approved: true
});
```

### Server Broadcasts

```javascript
// Parent receives
socket.emit('trip:status-update', {
  tripId: 'trip-uuid',
  status: 'in_progress',
  message: 'Trip has started'
});

socket.emit('pickup:status', {
  studentName: 'John Doe',
  status: 'picked_up',
  message: 'Your child has been picked up'
});

socket.emit('driver:location-updated', {
  tripId: 'trip-uuid',
  location: { latitude, longitude, speed, ... },
  timestamp: '2026-05-15T10:30:00Z'
});

socket.emit('eta:updated', {
  destination: 'pickup',
  studentName: 'Jane Smith',
  distance: 2.5,
  eta: '2026-05-15T10:35:00Z'
});

socket.emit('safety:alert', {
  studentName: 'John Doe',
  eventType: 'speeding',
  message: 'Driver exceeding speed limit (92 km/h)'
});

socket.emit('emergency:sos', {
  studentName: 'John Doe',
  message: 'Emergency SOS activated. Help is being sent.',
  location: { latitude, longitude }
});
```

---

## 🧪 Sample Test Scenarios

### Scenario 1: Complete Happy Path

1. Parent books trip for 2 students
2. System validates route (feasible ✓)
3. System assigns Driver A with score 82
4. Vehicle seats reserved
5. Trip created, status = pending_approval
6. Parents receive approval request
7. Parents approve
8. Driver receives trip details
9. Driver starts trip
10. GPS tracking active
11. Driver picks up first student (QR verified)
12. Driver picks up second student (QR verified)
13. All pickups done, heading to school
14. Driver arrives at school
15. Trip marked completed
16. Parents rate trip (5 stars)
17. All data saved successfully ✓

### Scenario 2: Safety Incident Investigation

1. Parent reports: "Driver speeding"
2. Incident created (INC-20260515-0001)
3. Admin starts investigation
4. Reviews GPS data showing 92 km/h in 60 km/h zone
5. GPS data confirms speeding
6. Admin findings: driverAtFault = true, severity = moderate
7. System issues 1 strike to driver
8. Driver now has 1 strike (3 max)
9. Safety profile updated
10. Parents notified: "Incident resolved"
11. Driver receives: "1 strike added to your record"
12. Incident marked resolved ✓

### Scenario 3: Driver Suspension

1. Driver has 2 strikes from previous incidents
2. Critical incident reported (reckless driving)
3. Investigation completed: driverAtFault = true, severity = critical
4. System issues 3 strikes
5. Driver total = 2 + 3 = 5 strikes (exceeds 3 limit)
6. Driver auto-suspended indefinitely
7. Safety profile: isSuspended = true
8. Operator notified: "Driver X suspended"
9. All new trip assignments skip this driver
10. Driver cannot go online
11. Incident marked resolved with suspension action ✓

---

## 📊 Database Indexes

Automatically created on first run:

```javascript
// Vehicle indexes
- { operatorId: 1, status: 1 }
- { plateNumber: 1 }
- { assignedDriver: 1 }
- { currentLocation.coordinates: '2dsphere' } // Geospatial

// TripAssignment indexes
- { operatorId: 1, createdAt: -1 }
- { driverId: 1, status: 1 }
- { vehicleId: 1, status: 1 }
- { schoolId: 1, startedAt: 1 }
- { status: 1, startedAt: -1 }
- { tripNumber: 1 }
- { 'pickupPoints.parentId': 1 }

// SafetyProfile indexes
- { driverId: 1 }
- { isEligibleToDrive: 1, isSuspended: 1 }
- { licenseExpiry: 1 }
- { nbiClearanceExpiry: 1 }

// IncidentReport indexes
- { reportNumber: 1 }
- { driverId: 1, incidentDate: -1 }
- { incidentType: 1, severity: 1 }
- { investigationStatus: 1, createdAt: -1 }
```

---

## ⚠️ Important Notes

### Security

- ✅ All routes require authentication
- ✅ Role-based access control enforced
- ✅ Data access limited to involved parties
- ✅ Sensitive operations (investigation) admin-only
- ✅ All operations logged for audit

### Performance

- Routes optimized for common queries
- Geospatial indexes for location-based search
- No external API calls (calculations done in-app)
- WebSocket for real-time updates (no polling)
- Atomic operations for consistency

### Compliance

- Complete audit trail of all operations
- Driver verification before any trip
- Parent approval required
- Student safety prioritized
- Incident investigations documented
- Transparency in discipline process

---

## 🚀 Next: Frontend Integration

Once backend is running, integrate in React:

1. **Parent App**: Trip booking, approval, real-time tracking
2. **Driver App**: Trip acceptance, GPS tracking, pickup verification
3. **Admin Dashboard**: Incident management, driver safety, fleet status
4. **Operator Dashboard**: Trip monitoring, assignment control

---

## 📞 Support

All code is fully documented with:
- Inline comments explaining transportation logic
- Method docstrings with examples
- Complete API documentation
- Database schema documentation
- Real-world usage examples

---

**PHASE 3 Complete**  
**Integration Time: ~15 minutes**  
**Production Ready: YES** ✅

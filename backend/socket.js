const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const User = require('./models/User');
const VanRequest = require('./models/VanRequest');
const { getJwtSecret } = require('./utils/jwtSecret');
const { getAllowedFrontendOrigins } = require('./utils/frontendOrigins');

let ioInstance = null;
const allowedOrigins = getAllowedFrontendOrigins();

const buildTripRoomName = (requestId) => `trip:${String(requestId)}`;
const buildUserRoomName = (userId) => `user:${String(userId)}`;

const getSocketToken = (socket) => {
  const tokenFromAuth = socket.handshake?.auth?.token;

  if (tokenFromAuth) {
    return String(tokenFromAuth);
  }

  const authHeader = socket.handshake?.headers?.authorization || '';
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return '';
};

const canJoinTripRoom = async (user, requestId) => {
  if (!user || !requestId) {
    return false;
  }

  if (user.role === 'admin') {
    return true;
  }

  if (user.role === 'parent') {
    const match = await VanRequest.exists({ _id: requestId, parent: user._id });
    return Boolean(match);
  }

  if (user.role === 'driver') {
    const match = await VanRequest.exists({ _id: requestId, driver: user._id });
    return Boolean(match);
  }

  return false;
};

const initSocketServer = (server) => {
  ioInstance = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    // Improve connection stability
    transports: ['websocket', 'polling'],
    // Prevent connection timeout issues
    pingInterval: 25000,
    pingTimeout: 20000,
    // Allow more simultaneous connections
    maxHttpBufferSize: 1e6,
    // Better error recovery
    connectTimeout: 45000,
  });

  ioInstance.use(async (socket, next) => {
    try {
      const token = getSocketToken(socket);

      if (!token) {
        return next(new Error('Authentication token is required.'));
      }

      const payload = jwt.verify(token, getJwtSecret());
      if (typeof payload?.userId !== 'string' || !payload.userId) {
        return next(new Error('Authentication token is invalid or expired.'));
      }
      const user = await User.findById(payload.userId).select('_id role fullName');

      if (!user) {
        return next(new Error('Invalid authentication token.'));
      }

      if (socket.handshake?.auth?.scope === 'admin' && user.role !== 'admin') {
        return next(new Error('Admin access is required.'));
      }

      socket.user = user;
      socket.join(buildUserRoomName(user._id));
      return next();
    } catch (error) {
      if (error.code === 'JWT_SECRET_MISSING') {
        console.error('[Socket] JWT authentication is not configured on the server.');
        return next(new Error('Authentication service is temporarily unavailable.'));
      }
      if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
        return next(new Error('Authentication token is invalid or expired.'));
      }
      if (/^(Mongo|Mongoose)/.test(error?.name || '') || ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'].includes(error?.code)) {
        console.error('[Socket] Database unavailable during handshake:', error.name);
        return next(new Error('Authentication service is temporarily unavailable.'));
      }
      console.error('[Socket] Unexpected handshake failure:', error.name || 'UnknownError');
      return next(new Error('Unable to authenticate this connection.'));
    }
  });

  ioInstance.on('connection', (socket) => {
    const userId = socket.user?._id;
    const userRole = socket.user?.role;
    
    console.log(`[Socket] User connected - ID: ${userId}, Role: ${userRole}, Socket: ${socket.id}`);

    if (socket.user?.role === 'admin') {
      socket.join('admins');
    }

    // Add drivers to drivers room for broadcast events
    if (socket.user?.role === 'driver') {
      socket.join('drivers');
      console.log(`[Socket] Driver joined drivers room - User: ${userId}`);
    }

    // Handle errors on this socket connection
    socket.on('error', (error) => {
      console.error(`[Socket] Socket error for ${userId}:`, error);
      try {
        socket.emit('error', { message: 'An error occurred' });
      } catch (e) {
        console.error(`[Socket] Failed to emit error to ${userId}:`, e.message);
      }
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] User disconnected - ID: ${userId}, Reason: ${reason}, Socket: ${socket.id}`);
      
      // Clean up any pending operations
      try {
        socket.removeAllListeners();
      } catch (e) {
        console.error(`[Socket] Error cleaning up listeners for ${userId}:`, e.message);
      }
    });

    // Handle disconnect errors (abrupt disconnections)
    socket.on('disconnect_error', (error) => {
      console.error(`[Socket] Disconnect error for ${userId}:`, error);
    });

    // Trip subscription with enhanced error handling
    socket.on('trip:subscribe', async (payload = {}, ack) => {
      try {
        const requestId = payload?.requestId;

        if (!requestId) {
          if (typeof ack === 'function') {
            ack({ ok: false, message: 'Request id is required.' });
          }
          return;
        }

        const allowed = await canJoinTripRoom(socket.user, requestId);
        if (!allowed) {
          console.warn(`[Socket] Unauthorized trip subscription attempt - User: ${userId}, Trip: ${requestId}`);
          if (typeof ack === 'function') {
            ack({ ok: false, message: 'You are not allowed to subscribe to this trip.' });
          }
          return;
        }

        socket.join(buildTripRoomName(requestId));
        console.log(`[Socket] User subscribed to trip - User: ${userId}, Trip: ${requestId}`);

        if (typeof ack === 'function') {
          ack({ ok: true });
        }
      } catch (error) {
        console.error(`[Socket] Trip subscription error - User: ${userId}:`, error.message);
        if (typeof ack === 'function') {
          ack({ ok: false, message: 'Unable to subscribe to trip updates.' });
        }
      }
    });

    // Trip unsubscription
    socket.on('trip:unsubscribe', (payload = {}, ack) => {
      try {
        const requestId = payload?.requestId;
        if (requestId) {
          socket.leave(buildTripRoomName(requestId));
          console.log(`[Socket] User unsubscribed from trip - User: ${userId}, Trip: ${requestId}`);
        }
        if (typeof ack === 'function') {
          ack({ ok: true });
        }
      } catch (error) {
        console.error(`[Socket] Trip unsubscription error - User: ${userId}:`, error.message);
        if (typeof ack === 'function') {
          ack({ ok: false, message: 'Unable to unsubscribe from trip.' });
        }
      }
    });

    // Handle GPS stopped event - clears route for both driver and parent
    socket.on('gps_stopped', async (payload = {}, ack) => {
      try {
        const requestId = String(payload?.requestId || '');
        const driverId = String(payload?.driverId || '');

        if (!requestId || !driverId) {
          if (typeof ack === 'function') {
            ack({ ok: false, message: 'Request id and driver id are required.' });
          }
          return;
        }

        // Verify this is the driver stopping GPS for their own trip
        if (String(socket.user?._id) !== driverId) {
          console.warn(`[Socket] Unauthorized GPS stop attempt - User: ${userId}, Driver: ${driverId}`);
          if (typeof ack === 'function') {
            ack({ ok: false, message: 'You are not authorized to stop GPS for this trip.' });
          }
          return;
        }

        const request = await VanRequest.findOne({
          _id: requestId,
          driver: driverId,
          status: { $in: ['accepted', 'arrived', 'picked_up'] },
        }).select('_id parent status');

        if (!request) {
          if (typeof ack === 'function') {
            ack({ ok: false, message: 'You are not assigned to an active request.' });
          }
          return;
        }

        const updatedRequest = await VanRequest.findOneAndUpdate(
          { _id: requestId, driver: driverId, status: { $in: ['accepted', 'arrived', 'picked_up'] } },
          { $set: { liveLocation: null } },
          { new: true }
        );

        if (!updatedRequest) {
          if (typeof ack === 'function') {
            ack({ ok: false, message: 'Request status changed before GPS could be stopped.' });
          }
          return;
        }

        // Broadcast GPS stopped event to trip room
        // This clears the route on BOTH driver and parent dashboards
        const tripRoom = buildTripRoomName(requestId);
        
        socket.to(tripRoom).emit('gps_stopped', {
          requestId,
          driverId,
          gpsActive: false,
          routeCoordinates: [], // Explicitly clear route data
          timestamp: new Date().toISOString(),
        });

        // Also emit to driver's personal room
        const driverRoom = buildUserRoomName(driverId);
        ioInstance.to(driverRoom).emit('gps_stopped', {
          requestId,
          driverId,
          gpsActive: false,
          routeCoordinates: [],
          timestamp: new Date().toISOString(),
        });

        const locationPayload = {
          requestId,
          driverId,
          liveLocation: null,
          status: request.status,
        };
        ioInstance.to(tripRoom).emit('trip:location-updated', locationPayload);
        ioInstance.to(buildUserRoomName(request.parent)).emit('trip:location-updated', locationPayload);

        console.log(`[Socket] GPS stopped for trip - Driver: ${userId}, Trip: ${requestId}`);
        console.log(`[Socket] Broadcasting gps_stopped to rooms: ${tripRoom}, ${driverRoom}`);

        if (typeof ack === 'function') {
          ack({ ok: true, message: 'GPS tracking stopped. Route cleared.' });
        }
      } catch (error) {
        console.error(`[Socket] GPS stopped error - User: ${userId}:`, error.message);
        if (typeof ack === 'function') {
          ack({ ok: false, message: 'Unable to process GPS stop event.' });
        }
      }
    });

    // Handle GPS started event - prepares for new route
    socket.on('gps_started', (payload = {}, ack) => {
      try {
        const requestId = String(payload?.requestId || '');
        const driverId = String(payload?.driverId || '');

        if (!requestId || !driverId) {
          if (typeof ack === 'function') {
            ack({ ok: false, message: 'Request id and driver id are required.' });
          }
          return;
        }

        // Verify this is the driver starting GPS for their own trip
        if (String(socket.user?._id) !== driverId) {
          console.warn(`[Socket] Unauthorized GPS start attempt - User: ${userId}, Driver: ${driverId}`);
          if (typeof ack === 'function') {
            ack({ ok: false, message: 'You are not authorized to start GPS for this trip.' });
          }
          return;
        }

        // Broadcast GPS started event to trip room
        const tripRoom = buildTripRoomName(requestId);
        
        ioInstance.to(tripRoom).emit('gps_started', {
          requestId,
          driverId,
          gpsActive: true,
          timestamp: new Date().toISOString(),
        });

        console.log(`[Socket] GPS started for trip - Driver: ${userId}, Trip: ${requestId}`);

        if (typeof ack === 'function') {
          ack({ ok: true, message: 'GPS tracking started.' });
        }
      } catch (error) {
        console.error(`[Socket] GPS started error - User: ${userId}:`, error.message);
        if (typeof ack === 'function') {
          ack({ ok: false, message: 'Unable to process GPS start event.' });
        }
      }
    });

    // Handle trip completion - clears active requests for both parent and driver
    socket.on('trip:completed', (payload = {}, ack) => {
      try {
        const requestId = String(payload?.requestId || '');
        const driverId = String(payload?.driverId || '');

        if (!requestId || !driverId) {
          if (typeof ack === 'function') {
            ack({ ok: false, message: 'Request id and driver id are required.' });
          }
          return;
        }

        // Verify this is the driver completing the trip
        if (String(socket.user?._id) !== driverId) {
          console.warn(`[Socket] Unauthorized trip completion attempt - User: ${userId}, Driver: ${driverId}`);
          if (typeof ack === 'function') {
            ack({ ok: false, message: 'You are not authorized to complete this trip.' });
          }
          return;
        }

        // Broadcast trip completion to trip room and affected users
        const tripRoom = buildTripRoomName(requestId);
        
        socket.to(tripRoom).emit('trip:completed', {
          requestId,
          driverId,
          timestamp: new Date().toISOString(),
          message: 'Trip has been completed. Active request cleared.',
        });

        console.log(`[Socket] Trip completed - Driver: ${userId}, Trip: ${requestId}`);

        if (typeof ack === 'function') {
          ack({ ok: true });
        }
      } catch (error) {
        console.error(`[Socket] Trip completion error - User: ${userId}:`, error.message);
        if (typeof ack === 'function') {
          ack({ ok: false, message: 'Unable to process trip completion event.' });
        }
      }
    });

    // Handle notification broadcast - sends notification to specific user
    socket.on('notification:send', (payload = {}, ack) => {
      try {
        const { targetUserId, notification } = payload;

        if (!targetUserId || !notification) {
          if (typeof ack === 'function') {
            ack({ ok: false, message: 'Target user id and notification are required.' });
          }
          return;
        }

        // Only allow admins, drivers, or the user to send notifications to parents
        if (socket.user?.role !== 'admin' && socket.user?.role !== 'driver') {
          console.warn(`[Socket] Unauthorized notification send attempt - User: ${userId}`);
          if (typeof ack === 'function') {
            ack({ ok: false, message: 'You are not authorized to send notifications.' });
          }
          return;
        }

        // Broadcast notification to target user
        const targetUserRoom = buildUserRoomName(targetUserId);
        
        ioInstance.to(targetUserRoom).emit('notification:received', {
          ...notification,
          sentAt: new Date().toISOString(),
        });

        console.log(`[Socket] Notification sent - From: ${userId}, To: ${targetUserId}, Type: ${notification.type}`);

        if (typeof ack === 'function') {
          ack({ ok: true });
        }
      } catch (error) {
        console.error(`[Socket] Notification send error - User: ${userId}:`, error.message);
        if (typeof ack === 'function') {
          ack({ ok: false, message: 'Unable to send notification.' });
        }
      }
    });

    // ===== 7-STAGE NOTIFICATION WORKFLOW =====
    
    // STAGE 1: Driver started GPS to parent (on the way)
    socket.on('driver:gps_started_to_parent', (payload = {}, ack) => {
      try {
        const { requestId, driverId, eta } = payload;
        
        if (!requestId || !driverId) {
          if (typeof ack === 'function') ack({ ok: false, message: 'Missing required fields' });
          return;
        }

        // Broadcast to trip room
        const tripRoom = buildTripRoomName(requestId);
        ioInstance.to(tripRoom).emit('driver:gps_started_to_parent', {
          requestId,
          driverId,
          eta,
          timestamp: new Date().toISOString(),
        });

        console.log(`[Socket] Driver GPS started to parent - Trip: ${requestId}, Driver: ${driverId}`);
        if (typeof ack === 'function') ack({ ok: true });
      } catch (error) {
        console.error('[Socket] GPS started error:', error.message);
        if (typeof ack === 'function') ack({ ok: false });
      }
    });

    // STAGE 2: Driver arrived at parent location
    socket.on('driver:arrived_at_pickup', (payload = {}, ack) => {
      try {
        const { requestId, driverId } = payload;
        
        if (!requestId || !driverId) {
          if (typeof ack === 'function') ack({ ok: false, message: 'Missing required fields' });
          return;
        }

        // Broadcast to trip room
        const tripRoom = buildTripRoomName(requestId);
        ioInstance.to(tripRoom).emit('driver:arrived_at_pickup', {
          requestId,
          driverId,
          timestamp: new Date().toISOString(),
        });

        console.log(`[Socket] Driver arrived at pickup - Trip: ${requestId}, Driver: ${driverId}`);
        if (typeof ack === 'function') ack({ ok: true });
      } catch (error) {
        console.error('[Socket] Arrived at pickup error:', error.message);
        if (typeof ack === 'function') ack({ ok: false });
      }
    });

    // STAGE 3: Student picked up
    socket.on('student:picked_up', (payload = {}, ack) => {
      try {
        const { requestId, driverId, studentName } = payload;
        
        if (!requestId || !driverId) {
          if (typeof ack === 'function') ack({ ok: false, message: 'Missing required fields' });
          return;
        }

        // Broadcast to trip room
        const tripRoom = buildTripRoomName(requestId);
        ioInstance.to(tripRoom).emit('student:picked_up', {
          requestId,
          driverId,
          studentName,
          timestamp: new Date().toISOString(),
        });

        console.log(`[Socket] Student picked up - Trip: ${requestId}, Driver: ${driverId}`);
        if (typeof ack === 'function') ack({ ok: true });
      } catch (error) {
        console.error('[Socket] Student picked up error:', error.message);
        if (typeof ack === 'function') ack({ ok: false });
      }
    });

    // STAGE 4: Driver started GPS to school
    socket.on('driver:gps_started_to_school', (payload = {}, ack) => {
      try {
        const { requestId, driverId, eta } = payload;
        
        if (!requestId || !driverId) {
          if (typeof ack === 'function') ack({ ok: false, message: 'Missing required fields' });
          return;
        }

        // Broadcast to trip room
        const tripRoom = buildTripRoomName(requestId);
        ioInstance.to(tripRoom).emit('driver:gps_started_to_school', {
          requestId,
          driverId,
          eta,
          timestamp: new Date().toISOString(),
        });

        console.log(`[Socket] Driver GPS started to school - Trip: ${requestId}, Driver: ${driverId}`);
        if (typeof ack === 'function') ack({ ok: true });
      } catch (error) {
        console.error('[Socket] GPS started to school error:', error.message);
        if (typeof ack === 'function') ack({ ok: false });
      }
    });

    // STAGE 5: FINAL - Driver arrived at school
    socket.on('driver:arrived_at_school', (payload = {}, ack) => {
      try {
        const { requestId, driverId, studentName, schoolName } = payload;
        
        if (!requestId || !driverId) {
          if (typeof ack === 'function') ack({ ok: false, message: 'Missing required fields' });
          return;
        }

        // Broadcast to trip room
        const tripRoom = buildTripRoomName(requestId);
        ioInstance.to(tripRoom).emit('driver:arrived_at_school', {
          requestId,
          driverId,
          studentName,
          schoolName,
          timestamp: new Date().toISOString(),
        });

        console.log(`[Socket] Driver arrived at school (FINAL) - Trip: ${requestId}, Driver: ${driverId}`);
        if (typeof ack === 'function') ack({ ok: true });
      } catch (error) {
        console.error('[Socket] Arrived at school error:', error.message);
        if (typeof ack === 'function') ack({ ok: false });
      }
    });

    // STAGE 5: Live location update during trip
    socket.on('driver:location_update', (payload = {}, ack) => {
      try {
        const { requestId, driverId, latitude, longitude, eta } = payload;
        
        if (!requestId || !driverId || latitude === undefined || longitude === undefined) {
          if (typeof ack === 'function') ack({ ok: false, message: 'Missing required fields' });
          return;
        }

        // Broadcast to trip room only (real-time map updates)
        const tripRoom = buildTripRoomName(requestId);
        ioInstance.to(tripRoom).emit('driver:location_update', {
          requestId,
          driverId,
          latitude,
          longitude,
          eta,
          timestamp: new Date().toISOString(),
        });

        if (typeof ack === 'function') ack({ ok: true });
      } catch (error) {
        console.error('[Socket] Location update error:', error.message);
        if (typeof ack === 'function') ack({ ok: false });
      }
    });

    // Real-time GPS location updates with database storage
    socket.on('gps:location-update', async (payload = {}, ack) => {
      try {
        const { requestId, latitude, longitude, speed, heading, accuracy, timestamp } = payload;
        
        if (!requestId || latitude === undefined || longitude === undefined) {
          if (typeof ack === 'function') {
            ack({ ok: false, message: 'Missing required fields: requestId, latitude, longitude' });
          }
          return;
        }

        // Verify driver authorization for this request
        const driverId = String(socket.user?._id || '');
        if (String(socket.user?.role) !== 'driver') {
          console.warn(`[Socket] Non-driver GPS update attempt - User: ${userId}, Role: ${socket.user?.role}`);
          if (typeof ack === 'function') {
            ack({ ok: false, message: 'Only drivers can send GPS updates' });
          }
          return;
        }

        // Verify this is an active request for the driver
        let request;
        try {
          request = await VanRequest.findById(requestId);
          if (!request) {
            if (typeof ack === 'function') {
              ack({ ok: false, message: 'Request not found' });
            }
            return;
          }

          if (String(request.driver?._id || '') !== driverId) {
            console.warn(`[Socket] Unauthorized GPS update - Driver: ${driverId}, Request: ${requestId}`);
            if (typeof ack === 'function') {
              ack({ ok: false, message: 'You are not the driver for this request' });
            }
            return;
          }
        } catch (err) {
          console.error(`[Socket] Error verifying request - Driver: ${driverId}, Request: ${requestId}:`, err.message);
          if (typeof ack === 'function') {
            ack({ ok: false, message: 'Unable to verify request' });
          }
          return;
        }

        // Save to DriverLocation history (async, don't wait for it)
        try {
          const DriverLocation = require('./models/DriverLocation');
          const newLocation = new DriverLocation({
            driverId,
            requestId,
            latitude: Number(latitude),
            longitude: Number(longitude),
            speed: speed !== undefined ? Number(speed) : 0,
            heading: heading !== undefined ? Number(heading) : null,
            accuracy: accuracy !== undefined ? Number(accuracy) : null,
            recordedAt: timestamp ? new Date(timestamp) : new Date(),
          });
          await newLocation.save();
        } catch (err) {
          console.error(`[Socket] Error saving location - Driver: ${driverId}:`, err.message);
          // Continue anyway - save to DB is optional for real-time tracking
        }

        // Update the request with live location
        try {
          await VanRequest.updateOne(
            { _id: requestId },
            {
              liveLocation: {
                latitude: Number(latitude),
                longitude: Number(longitude),
                updatedAt: new Date(timestamp || Date.now()),
              },
            }
          );
        } catch (err) {
          console.error(`[Socket] Error updating request location - Request: ${requestId}:`, err.message);
        }

        // Broadcast to trip room (parents and admins watching this trip)
        const tripRoom = buildTripRoomName(requestId);
        ioInstance.to(tripRoom).emit('trip:location-updated', {
          requestId,
          driverId,
          liveLocation: {
            latitude: Number(latitude),
            longitude: Number(longitude),
            updatedAt: timestamp || new Date().toISOString(),
          },
          latitude: Number(latitude),
          longitude: Number(longitude),
          speed: speed !== undefined ? Number(speed) : 0,
          heading: heading !== undefined ? Number(heading) : 0,
          accuracy: accuracy !== undefined ? Number(accuracy) : null,
          timestamp: timestamp || new Date().toISOString(),
          status: request.status,
        });

        console.log(`[Socket] GPS update received and broadcasted - Driver: ${driverId}, Request: ${requestId}, Location: ${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`);

        if (typeof ack === 'function') {
          ack({ ok: true, message: 'Location update received' });
        }
      } catch (error) {
        console.error(`[Socket] GPS location update error - User: ${userId}:`, error.message);
        if (typeof ack === 'function') {
          ack({ ok: false, message: 'Unable to process GPS update' });
        }
      }
    });
  });

  // Global error handling
  ioInstance.engine.on('connection_error', (err) => {
    console.error('[Socket Engine] Connection error:', err);
  });

  return ioInstance;
};

const getIo = () => ioInstance;


module.exports = {
  initSocketServer,
  getIo,
  buildTripRoomName,
  buildUserRoomName,
};

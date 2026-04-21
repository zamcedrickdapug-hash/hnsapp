const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const User = require('./models/User');
const VanRequest = require('./models/VanRequest');

let ioInstance = null;

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
      origin: true,
      credentials: true,
    },
  });

  ioInstance.use(async (socket, next) => {
    try {
      const token = getSocketToken(socket);

      if (!token) {
        return next(new Error('Authentication token is required.'));
      }

      const payload = jwt.verify(token, process.env.JWT_SECRET || 'development-secret-key');
      const user = await User.findById(payload.userId).select('_id role fullName');

      if (!user) {
        return next(new Error('Invalid authentication token.'));
      }

      socket.user = user;
      socket.join(buildUserRoomName(user._id));
      return next();
    } catch (error) {
      return next(new Error('Authentication failed.'));
    }
  });

  ioInstance.on('connection', (socket) => {
    if (socket.user?.role === 'admin') {
      socket.join('admins');
    }

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
          if (typeof ack === 'function') {
            ack({ ok: false, message: 'You are not allowed to subscribe to this trip.' });
          }
          return;
        }

        socket.join(buildTripRoomName(requestId));

        if (typeof ack === 'function') {
          ack({ ok: true });
        }
      } catch (error) {
        if (typeof ack === 'function') {
          ack({ ok: false, message: 'Unable to subscribe to trip updates.' });
        }
      }
    });
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

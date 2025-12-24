const UserStatus = require('../models/UserStatus');

/**
 * Middleware to track user activity for online/offline status
 * Updates the user's last_activity timestamp on each authenticated API request
 */
const userActivityMiddleware = async (req, res, next) => {
  try {
    // Only track activity for authenticated users
    if (req.user && req.user.id) {
      const userId = req.user.id;
      const userType = req.user.role === 0 ? 'admin' : 'user';
      
      // Get device info from headers
      const deviceInfo = req.headers['user-agent'] || null;
      const ipAddress = req.ip || req.connection?.remoteAddress || null;
      
      // Find or create user status and update activity
      // Use updateOne for better performance (no need to fetch document)
      await UserStatus.findOneAndUpdate(
        { user_id: userId },
        {
          $set: {
            is_online: true,
            last_activity: new Date(),
            user_type: userType,
            device_info: deviceInfo,
            ip_address: ipAddress
          }
        },
        { upsert: true, new: true }
      );
      
      // Attach status info to request for potential use in controllers
      req.userOnline = true;
    }
  } catch (error) {
    // Don't block the request if status update fails
    console.error('Error updating user activity:', error.message);
  }
  
  next();
};

/**
 * Middleware to check if a specific user is online
 * Use this when you need to know if a target user is available
 */
const checkUserOnline = async (req, res, next) => {
  try {
    const targetUserId = req.params.targetUserId || req.body.targetUserId;
    
    if (targetUserId) {
      const isOnline = await UserStatus.isUserOnline(targetUserId);
      req.targetUserOnline = isOnline;
    }
  } catch (error) {
    console.error('Error checking user online status:', error.message);
    req.targetUserOnline = false;
  }
  
  next();
};

/**
 * Function to periodically check and mark offline users
 * This should be called by the server at regular intervals
 */
const checkOfflineUsers = async (io = null) => {
  try {
    // Get users who should be marked offline
    const usersToMarkOffline = await UserStatus.getUsersToMarkOffline();
    
    if (usersToMarkOffline.length > 0) {
      console.log(`📴 Marking ${usersToMarkOffline.length} users as offline`);
      
      // Mark users offline in database
      await UserStatus.checkAndSetOfflineUsers();
      
      // Emit socket events if io is available
      if (io) {
        for (const userStatus of usersToMarkOffline) {
          // Emit user offline event
          io.emit('userOffline', {
            userId: userStatus.user_id._id || userStatus.user_id,
            userName: userStatus.user_id?.full_name || 'User',
            timestamp: new Date()
          });
          
          // Close user's active chat rooms
          if (userStatus.active_rooms && userStatus.active_rooms.length > 0) {
            for (const roomId of userStatus.active_rooms) {
              io.to(roomId).emit('userLeftRoom', {
                userId: userStatus.user_id._id || userStatus.user_id,
                reason: 'offline',
                timestamp: new Date()
              });
            }
          }
        }
      }
    }
    
    return usersToMarkOffline;
  } catch (error) {
    console.error('Error checking offline users:', error.message);
    return [];
  }
};

/**
 * Start the offline checker interval
 * @param {Object} io - Socket.io instance
 * @param {number} intervalMs - Check interval in milliseconds (default: 30 seconds)
 */
const startOfflineChecker = (io, intervalMs = 30000) => {
  console.log(`⏱️ Starting offline checker with ${intervalMs / 1000}s interval`);
  
  const intervalId = setInterval(async () => {
    await checkOfflineUsers(io);
  }, intervalMs);
  
  return intervalId;
};

module.exports = {
  userActivityMiddleware,
  checkUserOnline,
  checkOfflineUsers,
  startOfflineChecker
};


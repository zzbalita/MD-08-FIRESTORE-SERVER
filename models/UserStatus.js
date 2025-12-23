const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Timeout for considering user offline (2 minutes in milliseconds)
const OFFLINE_TIMEOUT = 2 * 60 * 1000;

const UserStatusSchema = new Schema({
  // user_id can be ObjectId (registered users) or String (anonymous/guest users)
  user_id: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    unique: true,
    index: true
  },

  // User type: 'user', 'admin', 'bot'
  user_type: {
    type: String,
    enum: ['user', 'admin', 'bot'],
    default: 'user'
  },

  // Current online status
  is_online: {
    type: Boolean,
    default: false
  },

  // Last activity timestamp (updated on each API request)
  last_activity: {
    type: Date,
    default: Date.now
  },

  // Last seen timestamp (set when user goes offline)
  last_seen: {
    type: Date,
    default: Date.now
  },

  // Current socket ID(s) - a user can have multiple connections
  socket_ids: [{
    type: String
  }],

  // Current active chat rooms
  active_rooms: [{
    type: String
  }],

  // Device/Platform info
  device_info: {
    type: String,
    default: null
  },

  // IP Address (optional, for analytics)
  ip_address: {
    type: String,
    default: null
  }

}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Indexes
UserStatusSchema.index({ is_online: 1 });
UserStatusSchema.index({ last_activity: -1 });
UserStatusSchema.index({ user_type: 1, is_online: 1 });

// Virtual to check if user should be considered offline
UserStatusSchema.virtual('should_be_offline').get(function() {
  const now = Date.now();
  const lastActivity = this.last_activity ? this.last_activity.getTime() : 0;
  return (now - lastActivity) > OFFLINE_TIMEOUT;
});

// Method to update last activity (called on each API request)
UserStatusSchema.methods.updateActivity = async function(socketId = null, deviceInfo = null, ipAddress = null) {
  this.last_activity = new Date();
  this.is_online = true;
  
  if (socketId && !this.socket_ids.includes(socketId)) {
    this.socket_ids.push(socketId);
  }
  
  if (deviceInfo) {
    this.device_info = deviceInfo;
  }
  
  if (ipAddress) {
    this.ip_address = ipAddress;
  }
  
  return this.save();
};

// Method to set user offline
UserStatusSchema.methods.setOffline = async function() {
  this.is_online = false;
  this.last_seen = new Date();
  this.socket_ids = [];
  return this.save();
};

// Method to add socket ID
UserStatusSchema.methods.addSocketId = async function(socketId) {
  if (!this.socket_ids.includes(socketId)) {
    this.socket_ids.push(socketId);
    this.is_online = true;
    this.last_activity = new Date();
    return this.save();
  }
  return this;
};

// Method to remove socket ID
UserStatusSchema.methods.removeSocketId = async function(socketId) {
  this.socket_ids = this.socket_ids.filter(id => id !== socketId);
  
  if (this.socket_ids.length === 0) {
    // No more active sockets, mark as offline
    this.is_online = false;
    this.last_seen = new Date();
  }
  
  return this.save();
};

// Method to join a chat room
UserStatusSchema.methods.joinRoom = async function(roomId) {
  if (!this.active_rooms.includes(roomId)) {
    this.active_rooms.push(roomId);
    return this.save();
  }
  return this;
};

// Method to leave a chat room
UserStatusSchema.methods.leaveRoom = async function(roomId) {
  this.active_rooms = this.active_rooms.filter(id => id !== roomId);
  return this.save();
};

// Static method to find or create user status
UserStatusSchema.statics.findOrCreateStatus = async function(userId, userType = 'user') {
  let status = await this.findOne({ user_id: userId });
  
  if (!status) {
    status = new this({
      user_id: userId,
      user_type: userType,
      is_online: true,
      last_activity: new Date()
    });
    await status.save();
  }
  
  return status;
};

// Static method to get all online users
UserStatusSchema.statics.getOnlineUsers = function(userType = null) {
  const query = { is_online: true };
  if (userType) {
    query.user_type = userType;
  }
  return this.find(query).populate('user_id', 'full_name email avatar_url');
};

// Static method to check and update offline users
UserStatusSchema.statics.checkAndSetOfflineUsers = async function() {
  const now = Date.now();
  const offlineThreshold = new Date(now - OFFLINE_TIMEOUT);
  
  const result = await this.updateMany(
    {
      is_online: true,
      last_activity: { $lt: offlineThreshold }
    },
    {
      $set: {
        is_online: false,
        last_seen: new Date(),
        socket_ids: []
      }
    }
  );
  
  return result;
};

// Static method to get users who should be marked offline
UserStatusSchema.statics.getUsersToMarkOffline = async function() {
  const now = Date.now();
  const offlineThreshold = new Date(now - OFFLINE_TIMEOUT);
  
  return this.find({
    is_online: true,
    last_activity: { $lt: offlineThreshold }
  }).populate('user_id', 'full_name email');
};

// Static method to check if user is online
UserStatusSchema.statics.isUserOnline = async function(userId) {
  const status = await this.findOne({ user_id: userId });
  if (!status) return false;
  
  // Check if last activity is within timeout
  const now = Date.now();
  const lastActivity = status.last_activity ? status.last_activity.getTime() : 0;
  return status.is_online && (now - lastActivity) <= OFFLINE_TIMEOUT;
};

// Export the timeout constant as well
UserStatusSchema.statics.OFFLINE_TIMEOUT = OFFLINE_TIMEOUT;

module.exports = mongoose.model('UserStatus', UserStatusSchema, 'user_status');


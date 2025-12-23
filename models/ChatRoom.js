const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ChatRoomSchema = new Schema({
  // Room ID format: ${user1Id}_${user2Id} (user2 can be 'bot' or admin ID)
  room_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Room type: 'bot' for AI chat, 'admin' for admin support chat
  room_type: {
    type: String,
    enum: ['bot', 'admin'],
    required: true,
    default: 'bot'
  },

  // User who initiated the chat (can be ObjectId or String for anonymous users)
  user_id: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    index: true
  },

  // Target: 'bot' or admin's ObjectId
  target_id: {
    type: String, // Can be 'bot' string or ObjectId string
    required: true
  },

  // For admin chats, reference to the admin
  admin_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },

  // Room status
  status: {
    type: String,
    enum: ['active', 'inactive', 'closed'],
    default: 'active'
  },

  // Socket room name for real-time communication
  socket_room: {
    type: String,
    required: true
  },

  // Participants currently in the room (socket-wise)
  // user_id can be ObjectId or String (for anonymous/guest users)
  participants: [{
    user_id: {
      type: mongoose.Schema.Types.Mixed, // Allow both ObjectId and String for flexibility
      refPath: 'participants.user_type'
    },
    user_type: {
      type: String,
      enum: ['User', 'Admin', 'Guest'],
      default: 'User'
    },
    socket_id: String,
    joined_at: {
      type: Date,
      default: Date.now
    }
  }],

  // Last activity in the room
  last_activity: {
    type: Date,
    default: Date.now
  },

  // Total message count (for quick stats)
  message_count: {
    type: Number,
    default: 0
  },

  // Last message preview
  last_message: {
    text: String,
    sender_id: String,
    sender_type: String,
    timestamp: Date
  },

  // Room metadata
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  }

}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Indexes
ChatRoomSchema.index({ user_id: 1, room_type: 1 });
ChatRoomSchema.index({ target_id: 1 });
ChatRoomSchema.index({ status: 1 });
ChatRoomSchema.index({ last_activity: -1 });

// Generate room ID based on user and target
ChatRoomSchema.statics.generateRoomId = function(userId, targetId, roomType) {
  // For bot chats: userId_bot
  // For admin chats: userId_adminId
  const target = roomType === 'bot' ? 'bot' : targetId.toString();
  return `${userId.toString()}_${target}`;
};

// Generate socket room name
ChatRoomSchema.statics.generateSocketRoom = function(roomId, roomType) {
  return `${roomType}_room_${roomId}`;
};

// Helper to check if a string is a valid MongoDB ObjectId
ChatRoomSchema.statics.isValidObjectId = function(id) {
  if (!id) return false;
  const mongoose = require('mongoose');
  return mongoose.Types.ObjectId.isValid(id) && 
         (String(new mongoose.Types.ObjectId(id)) === String(id));
};

// Static method to find or create a chat room
ChatRoomSchema.statics.findOrCreateRoom = async function(userId, targetId, roomType = 'bot') {
  const roomId = this.generateRoomId(userId, targetId, roomType);
  const socketRoom = this.generateSocketRoom(roomId, roomType);
  
  let room = await this.findOne({ room_id: roomId });
  
  if (!room) {
    // For admin chats, only set admin_id if it's a valid ObjectId
    // 'admin_pool' or other placeholder strings should result in null
    let adminIdValue = null;
    if (roomType === 'admin' && this.isValidObjectId(targetId)) {
      adminIdValue = targetId;
    }
    
    room = new this({
      room_id: roomId,
      room_type: roomType,
      user_id: userId,
      target_id: roomType === 'bot' ? 'bot' : targetId.toString(),
      admin_id: adminIdValue,
      socket_room: socketRoom,
      status: 'active',
      last_activity: new Date()
    });
    await room.save();
  } else if (room.status === 'closed' || room.status === 'inactive') {
    // Reactivate the room
    room.status = 'active';
    room.last_activity = new Date();
    await room.save();
  }
  
  return room;
};

// Method to add participant to room
ChatRoomSchema.methods.addParticipant = async function(userId, userType, socketId) {
  // Check if participant already exists
  const existingIndex = this.participants.findIndex(
    p => p.user_id?.toString() === userId.toString() && p.socket_id === socketId
  );
  
  if (existingIndex === -1) {
    this.participants.push({
      user_id: userId,
      user_type: userType,
      socket_id: socketId,
      joined_at: new Date()
    });
    await this.save();
  }
  
  return this;
};

// Method to remove participant from room
ChatRoomSchema.methods.removeParticipant = async function(userId, socketId = null) {
  if (socketId) {
    this.participants = this.participants.filter(
      p => !(p.user_id?.toString() === userId.toString() && p.socket_id === socketId)
    );
  } else {
    // Remove all entries for this user
    this.participants = this.participants.filter(
      p => p.user_id?.toString() !== userId.toString()
    );
  }
  
  await this.save();
  return this;
};

// Method to update last activity
ChatRoomSchema.methods.updateActivity = async function(message = null) {
  this.last_activity = new Date();
  this.message_count += 1;
  
  if (message) {
    this.last_message = {
      text: message.text?.substring(0, 100) || '', // Preview only
      sender_id: message.sender_id,
      sender_type: message.sender_type,
      timestamp: new Date()
    };
  }
  
  return this.save();
};

// Method to close room
ChatRoomSchema.methods.closeRoom = async function() {
  this.status = 'closed';
  this.participants = [];
  return this.save();
};

// Method to set room inactive
ChatRoomSchema.methods.setInactive = async function() {
  this.status = 'inactive';
  return this.save();
};

// Static method to find active rooms for a user
ChatRoomSchema.statics.findActiveRoomsForUser = function(userId) {
  return this.find({
    user_id: userId,
    status: 'active'
  }).sort({ last_activity: -1 });
};

// Static method to find room by socket room name
ChatRoomSchema.statics.findBySocketRoom = function(socketRoom) {
  return this.findOne({ socket_room: socketRoom });
};

// Static method to find user's room with bot
ChatRoomSchema.statics.findUserBotRoom = function(userId) {
  return this.findOne({
    user_id: userId,
    room_type: 'bot',
    status: { $in: ['active', 'inactive'] }
  });
};

// Static method to find user's room with specific admin
ChatRoomSchema.statics.findUserAdminRoom = function(userId, adminId = null) {
  const query = {
    user_id: userId,
    room_type: 'admin',
    status: { $in: ['active', 'inactive'] }
  };
  
  if (adminId) {
    query.admin_id = adminId;
  }
  
  return this.findOne(query).sort({ last_activity: -1 });
};

// Static method to close inactive rooms
ChatRoomSchema.statics.closeInactiveRooms = async function(inactivityMinutes = 30) {
  const threshold = new Date(Date.now() - inactivityMinutes * 60 * 1000);
  
  return this.updateMany(
    {
      status: 'active',
      last_activity: { $lt: threshold }
    },
    {
      $set: {
        status: 'inactive',
        participants: []
      }
    }
  );
};

module.exports = mongoose.model('ChatRoom', ChatRoomSchema, 'chat_rooms');


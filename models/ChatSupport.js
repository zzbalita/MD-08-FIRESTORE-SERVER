const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ChatSupportSchema = new Schema({
  // Reference to the chat room
  room_id: {
    type: String,
    required: true,
    index: true
  },

  // Message content
  message: {
    type: String,
    required: true,
    maxLength: 2000
  },

  // Sender information (can be ObjectId or String for bot/anonymous)
  sender_id: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  // Sender type: 'user', 'admin', 'bot'
  sender_type: {
    type: String,
    enum: ['user', 'admin', 'bot'],
    required: true
  },

  // For Mongoose population
  sender_type_ref: {
    type: String,
    enum: ['User', 'Admin'],
    default: 'User'
  },

  // Message type
  message_type: {
    type: String,
    enum: ['text', 'image', 'file', 'system', 'suggestion'],
    default: 'text'
  },

  // For bot messages - response metadata
  bot_metadata: {
    response_type: {
      type: String,
      enum: ['greeting', 'product_info', 'product_list', 'pricing', 'shipping', 'support', 'help', 'info', 'default'],
      default: 'default'
    },
    confidence_score: {
      type: Number,
      min: 0,
      max: 1,
      default: 1
    },
    suggested_products: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    }],
    follow_up_questions: [String]
  },

  // Read status
  is_read: {
    type: Boolean,
    default: false
  },

  // Delivered status
  is_delivered: {
    type: Boolean,
    default: false
  },

  // Additional metadata
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

// Indexes for efficient queries
ChatSupportSchema.index({ room_id: 1, created_at: -1 });
ChatSupportSchema.index({ sender_id: 1, created_at: -1 });
ChatSupportSchema.index({ sender_type: 1 });
ChatSupportSchema.index({ is_read: 1 });
ChatSupportSchema.index({ created_at: -1 });

// Virtual for formatted timestamp
ChatSupportSchema.virtual('formatted_time').get(function() {
  return this.created_at.toLocaleString('vi-VN');
});

// Virtual to check if message is from user
ChatSupportSchema.virtual('is_from_user').get(function() {
  return this.sender_type === 'user';
});

// Method to mark as read
ChatSupportSchema.methods.markAsRead = async function() {
  this.is_read = true;
  return this.save();
};

// Method to mark as delivered
ChatSupportSchema.methods.markAsDelivered = async function() {
  this.is_delivered = true;
  return this.save();
};

// Static method to create a new message
ChatSupportSchema.statics.createMessage = async function(data) {
  const message = new this({
    room_id: data.room_id,
    message: data.message,
    sender_id: data.sender_id,
    sender_type: data.sender_type,
    sender_type_ref: data.sender_type === 'admin' ? 'Admin' : 'User',
    message_type: data.message_type || 'text',
    bot_metadata: data.bot_metadata || {},
    metadata: data.metadata || {}
  });
  
  return message.save();
};

// Static method to get chat history for a room
ChatSupportSchema.statics.getChatHistory = async function(roomId, limit = 50, before = null) {
  const query = { room_id: roomId };
  
  if (before) {
    query.created_at = { $lt: new Date(before) };
  }
  
  const messages = await this.find(query)
    .sort({ created_at: -1 })
    .limit(limit)
    .lean();
  
  // Populate sender_id only if it's a valid ObjectId
  const mongoose = require('mongoose');
  const User = require('./User');
  const Admin = require('./Admin');
  
  const populatedMessages = await Promise.all(messages.map(async (msg) => {
    if (msg.sender_id && mongoose.Types.ObjectId.isValid(msg.sender_id)) {
      try {
        // Try to populate as User first
        const user = await User.findById(msg.sender_id).select('full_name email avatar_url').lean();
        if (user) {
          msg.sender_id = user;
          return msg;
        }
        
        // Try Admin if not found as User
        const admin = await Admin.findById(msg.sender_id).select('username name').lean();
        if (admin) {
          msg.sender_id = { ...admin, full_name: admin.name || admin.username };
          return msg;
        }
      } catch (err) {
        // If population fails, keep original sender_id
      }
    }
    return msg;
  }));
  
  // Return in chronological order
  return populatedMessages.reverse();
};

// Static method to get unread messages count for a room
ChatSupportSchema.statics.getUnreadCount = async function(roomId, userId) {
  return this.countDocuments({
    room_id: roomId,
    sender_id: { $ne: userId },
    is_read: false
  });
};

// Static method to mark all messages as read for a user in a room
ChatSupportSchema.statics.markAllAsRead = async function(roomId, userId) {
  return this.updateMany(
    {
      room_id: roomId,
      sender_id: { $ne: userId },
      is_read: false
    },
    {
      $set: { is_read: true }
    }
  );
};

// Static method to get latest message in a room
ChatSupportSchema.statics.getLatestMessage = async function(roomId) {
  return this.findOne({ room_id: roomId })
    .sort({ created_at: -1 })
    .populate('sender_id', 'full_name email avatar_url');
};

// Static method to search messages
ChatSupportSchema.statics.searchMessages = async function(roomId, searchText, limit = 20) {
  return this.find({
    room_id: roomId,
    message: { $regex: searchText, $options: 'i' }
  })
    .sort({ created_at: -1 })
    .limit(limit)
    .populate('sender_id', 'full_name email avatar_url');
};

// Static method to get message statistics for a room
ChatSupportSchema.statics.getRoomStats = async function(roomId) {
  const stats = await this.aggregate([
    { $match: { room_id: roomId } },
    {
      $group: {
        _id: '$room_id',
        total_messages: { $sum: 1 },
        user_messages: {
          $sum: { $cond: [{ $eq: ['$sender_type', 'user'] }, 1, 0] }
        },
        admin_messages: {
          $sum: { $cond: [{ $eq: ['$sender_type', 'admin'] }, 1, 0] }
        },
        bot_messages: {
          $sum: { $cond: [{ $eq: ['$sender_type', 'bot'] }, 1, 0] }
        },
        unread_user_messages: {
          $sum: { 
            $cond: [
              { $and: [
                { $eq: ['$sender_type', 'user'] },
                { $eq: ['$is_read', false] }
              ]}, 
              1, 
              0
            ] 
          }
        },
        first_message: { $min: '$created_at' },
        last_message: { $max: '$created_at' }
      }
    }
  ]);
  
  return stats[0] || {
    total_messages: 0,
    user_messages: 0,
    admin_messages: 0,
    bot_messages: 0,
    unread_user_messages: 0
  };
};

// Static method to get all chats for a user (across all rooms)
ChatSupportSchema.statics.getUserChatHistory = async function(userId, limit = 100) {
  // First, find all room IDs where user participated
  const roomIds = await this.distinct('room_id', { sender_id: userId });
  
  // Then get all messages from these rooms
  return this.find({ room_id: { $in: roomIds } })
    .sort({ created_at: -1 })
    .limit(limit)
    .populate('sender_id', 'full_name email avatar_url');
};

// Static method to delete old messages (for cleanup - optional)
ChatSupportSchema.statics.deleteOldMessages = async function(olderThanDays = 365) {
  const threshold = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  
  return this.deleteMany({
    created_at: { $lt: threshold }
  });
};

// Format message for API response
ChatSupportSchema.methods.toAPIResponse = function() {
  return {
    id: this._id,
    room_id: this.room_id,
    message: this.message,
    sender_id: this.sender_id,
    sender_type: this.sender_type,
    message_type: this.message_type,
    is_read: this.is_read,
    is_delivered: this.is_delivered,
    is_from_user: this.sender_type === 'user',
    timestamp: this.created_at,
    bot_metadata: this.sender_type === 'bot' ? this.bot_metadata : undefined
  };
};

module.exports = mongoose.model('ChatSupport', ChatSupportSchema, 'chat_support');


const ChatSupportService = require('../services/chatSupportService');

/**
 * Chat Support Controller - Handles HTTP requests for chat support
 */
class ChatSupportController {

  /**
   * Start a chat support session (bot or admin)
   * POST /api/chat-support/start
   */
  static async startChatSupport(req, res) {
    try {
      const userId = req.user.id;
      const { chat_type = 'bot', admin_id = null } = req.body;
      
      // Validate chat type
      if (!['bot', 'admin'].includes(chat_type)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid chat type. Must be "bot" or "admin"'
        });
      }
      
      const result = await ChatSupportService.startChatSupport(userId, chat_type, admin_id);
      
      // Emit socket event for new chat session
      const io = req.app.get('io');
      if (io && chat_type === 'admin') {
        io.to('admin_room').emit('newChatSession', {
          room_id: result.data.room.room_id,
          user_id: userId,
          user_name: req.user.full_name || req.user.email,
          chat_type: chat_type,
          timestamp: new Date()
        });
      }
      
      res.json(result);
    } catch (error) {
      console.error('Error starting chat support:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Send a message in chat support
   * POST /api/chat-support/rooms/:roomId/messages
   */
  static async sendMessage(req, res) {
    try {
      const userId = req.user.id;
      const { roomId } = req.params;
      const { message } = req.body;
      
      // Validate message
      if (!message || !message.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Message content is required'
        });
      }
      
      if (message.length > 2000) {
        return res.status(400).json({
          success: false,
          message: 'Message too long (max 2000 characters)'
        });
      }
      
      const result = await ChatSupportService.sendMessage(roomId, userId, message.trim(), 'user');
      
      // Emit socket events
      const io = req.app.get('io');
      if (io) {
        // Get the room to find socket room name
        const ChatRoom = require('../models/ChatRoom');
        const room = await ChatRoom.findOne({ room_id: roomId });
        
        if (room) {
          // Emit user message to the room
          io.to(room.socket_room).emit('newMessage', {
            room_id: roomId,
            message: result.data.user_message
          });
          
          // If bot response exists, emit it after a delay
          if (result.data.bot_response) {
            setTimeout(() => {
              io.to(room.socket_room).emit('newMessage', {
                room_id: roomId,
                message: result.data.bot_response
              });
            }, 1000 + Math.random() * 1500); // 1-2.5 second delay for natural feel
          }
          
          // Notify admins about new user message (for admin chats)
          if (room.room_type === 'admin') {
            // Emit to general admin room (for all online admins)
            io.to('admin_room').emit('newUserMessage', {
              room_id: roomId,
              user_id: userId,
              message: result.data.user_message,
              timestamp: new Date()
            });
            
            // Also emit to the specific chat room socket (for admins who joined this room)
            io.to(room.socket_room).emit('newUserMessage', {
              room_id: roomId,
              user_id: userId,
              message: result.data.user_message,
              timestamp: new Date()
            });
            
            console.log(`📤 Emitted newUserMessage to admin_room and ${room.socket_room}`);
          }
        }
      }
      
      res.json(result);
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Admin sends response to user
   * POST /api/chat-support/admin/rooms/:roomId/respond
   */
  static async sendAdminResponse(req, res) {
    try {
      // Extract admin ID - authAdminOrStaff sets req.user.userId
      const adminId = req.user.userId || req.user.id || req.user._id;
      const { roomId } = req.params;
      const { message } = req.body;
      
      console.log(`📤 Admin sendAdminResponse called: adminId=${adminId}, roomId=${roomId}, message length=${message?.length || 0}`);
      console.log(`📤 req.user:`, JSON.stringify(req.user, null, 2));
      
      if (!adminId) {
        return res.status(401).json({
          success: false,
          message: 'Admin ID not found in request'
        });
      }
      
      // Validate message
      if (!message || !message.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Message content is required'
        });
      }
      
      if (message.length > 2000) {
        return res.status(400).json({
          success: false,
          message: 'Message too long (max 2000 characters)'
        });
      }
      
      const result = await ChatSupportService.sendAdminResponse(roomId, adminId, message.trim());
      
      // Emit socket events
      const io = req.app.get('io');
      if (io) {
        const ChatRoom = require('../models/ChatRoom');
        const room = await ChatRoom.findOne({ room_id: roomId });
        
        if (room) {
          console.log(`📤 Emitting socket events for room ${roomId}, socket_room: ${room.socket_room}`);
          
          // Emit to the chat room socket (for all participants in this room)
          io.to(room.socket_room).emit('newMessage', {
            room_id: roomId,
            message: result.data.message
          });
          
          // Also emit newAdminMessage to the specific room
          io.to(room.socket_room).emit('newAdminMessage', {
            room_id: roomId,
            message: result.data.message
          });
          
          // Also emit to user's personal room (fallback for user to receive)
          const userIdStr = room.user_id?.toString() || room.user_id;
          io.to(`user_${userIdStr}`).emit('newAdminMessage', {
            room_id: roomId,
            message: result.data.message
          });
          
          // Also emit to admin_room for other admins
          io.to('admin_room').emit('newAdminMessage', {
            room_id: roomId,
            admin_id: adminId,
            message: result.data.message
          });
          
          console.log(`✅ Admin response emitted to ${room.socket_room}, user_${userIdStr}, and admin_room`);
        } else {
          console.warn(`⚠️ Room ${roomId} not found for socket emission`);
        }
      } else {
        console.warn('⚠️ Socket.io not available');
      }
      
      res.json(result);
    } catch (error) {
      console.error('❌ Error sending admin response:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to send admin response'
      });
    }
  }

  /**
   * Get chat history for a room
   * GET /api/chat-support/rooms/:roomId/history
   */
  static async getChatHistory(req, res) {
    try {
      const userId = req.user.id;
      const { roomId } = req.params;
      const { limit = 50, before = null } = req.query;
      
      const result = await ChatSupportService.getChatHistory(
        roomId, 
        userId, 
        parseInt(limit), 
        before
      );
      
      res.json(result);
    } catch (error) {
      console.error('Error getting chat history:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get all chat rooms for the current user
   * GET /api/chat-support/rooms
   */
  static async getUserChatRooms(req, res) {
    try {
      const userId = req.user.id;
      
      const result = await ChatSupportService.getUserChatRooms(userId);
      
      res.json(result);
    } catch (error) {
      console.error('Error getting user chat rooms:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get chat rooms for admin dashboard
   * GET /api/chat-support/admin/rooms
   */
  static async getAdminChatRooms(req, res) {
    try {
      // authAdminOrStaff sets req.user.userId
      const adminId = req.user.userId || req.user.id;
      const { status = 'active', page = 1, limit = 20, all = false } = req.query;
      
      // If all=true, don't filter by admin
      const filterAdminId = all === 'true' ? null : adminId;
      
      const result = await ChatSupportService.getAdminChatRooms(
        filterAdminId,
        status,
        parseInt(page),
        parseInt(limit)
      );
      
      res.json(result);
    } catch (error) {
      console.error('Error getting admin chat rooms:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Close a chat room
   * PATCH /api/chat-support/rooms/:roomId/close
   */
  static async closeChatRoom(req, res) {
    try {
      const userId = req.user.id;
      const { roomId } = req.params;
      
      const result = await ChatSupportService.closeChatRoom(roomId, userId);
      
      // Emit socket event
      const io = req.app.get('io');
      if (io) {
        const ChatRoom = require('../models/ChatRoom');
        const room = await ChatRoom.findOne({ room_id: roomId });
        
        if (room) {
          io.to(room.socket_room).emit('roomClosed', {
            room_id: roomId,
            closed_by: userId,
            timestamp: new Date()
          });
        }
      }
      
      res.json(result);
    } catch (error) {
      console.error('Error closing chat room:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get online admins available for chat
   * GET /api/chat-support/online-admins
   */
  static async getOnlineAdmins(req, res) {
    try {
      const result = await ChatSupportService.getOnlineAdmins();
      
      res.json(result);
    } catch (error) {
      console.error('Error getting online admins:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get user's online status
   * GET /api/chat-support/status/:userId
   */
  static async getUserStatus(req, res) {
    try {
      const { userId } = req.params;
      const UserStatus = require('../models/UserStatus');
      
      const isOnline = await UserStatus.isUserOnline(userId);
      const status = await UserStatus.findOne({ user_id: userId });
      
      res.json({
        success: true,
        data: {
          user_id: userId,
          is_online: isOnline,
          last_seen: status?.last_seen || null,
          last_activity: status?.last_activity || null
        }
      });
    } catch (error) {
      console.error('Error getting user status:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Mark messages as read
   * PATCH /api/chat-support/rooms/:roomId/read
   */
  static async markMessagesAsRead(req, res) {
    try {
      const userId = req.user.id;
      const { roomId } = req.params;
      const ChatSupport = require('../models/ChatSupport');
      
      await ChatSupport.markAllAsRead(roomId, userId);
      
      res.json({
        success: true,
        message: 'Messages marked as read'
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get room statistics
   * GET /api/chat-support/rooms/:roomId/stats
   */
  static async getRoomStats(req, res) {
    try {
      const { roomId } = req.params;
      const ChatSupport = require('../models/ChatSupport');
      
      const stats = await ChatSupport.getRoomStats(roomId);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting room stats:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = ChatSupportController;


const ChatRoom = require('../models/ChatRoom');
const ChatSupport = require('../models/ChatSupport');
const UserStatus = require('../models/UserStatus');
const User = require('../models/User');
const Admin = require('../models/Admin');
const geminiService = require('./geminiService');

// Bot ID constant (used as target_id for bot chats)
const BOT_ID = 'bot';
const BOT_NAME = 'Trợ lý ảo FireStore';

/**
 * Chat Support Service - Handles all chat support business logic
 */
class ChatSupportService {

  /**
   * Start a new chat support session (bot or admin)
   * Creates room and loads chat history if exists
   */
  static async startChatSupport(userId, chatType = 'bot', adminId = null) {
    try {
      console.log(`🆕 Starting chat support: userId=${userId}, chatType=${chatType}, adminId=${adminId}`);
      
      // Determine target based on chat type
      const targetId = chatType === 'bot' ? BOT_ID : (adminId || 'admin_pool');
      
      console.log(`🆕 Creating room with targetId=${targetId}`);
      
      // Find or create the chat room
      const room = await ChatRoom.findOrCreateRoom(userId, targetId, chatType);
      
      console.log(`🆕 Room created/found: room_id=${room.room_id}, room_type=${room.room_type}, status=${room.status}`);
      
      // Update user status - mark as online and in this room
      try {
        const userStatus = await UserStatus.findOrCreateStatus(userId, 'user');
        await userStatus.joinRoom(room.socket_room);
      } catch (statusError) {
        console.log(`⚠️ Could not update user status (non-critical): ${statusError.message}`);
        // Don't fail the whole operation if status update fails
      }
      
      // Get chat history for this room
      const chatHistory = await ChatSupport.getChatHistory(room.room_id, 50);
      
      // If this is a new room with no messages, send welcome message
      if (chatHistory.length === 0) {
        const welcomeMessage = await this.sendWelcomeMessage(room, chatType);
        chatHistory.push(welcomeMessage);
      }
      
      // Get unread count
      const unreadCount = await ChatSupport.getUnreadCount(room.room_id, userId);
      
      return {
        success: true,
        data: {
          room: {
            room_id: room.room_id,
            socket_room: room.socket_room,
            room_type: room.room_type,
            status: room.status
          },
          messages: chatHistory,
          unread_count: unreadCount,
          is_new_chat: chatHistory.length <= 1
        }
      };
    } catch (error) {
      throw new Error(`Failed to start chat support: ${error.message}`);
    }
  }

  /**
   * Send welcome message for new chat sessions
   */
  static async sendWelcomeMessage(room, chatType) {
    let welcomeText;
    let senderType;
    let senderId;
    
    if (chatType === 'bot') {
      welcomeText = '👋 Chào bạn! Tôi là Trợ lý ảo của FireStore. Tôi có thể giúp bạn:\n\n' +
        '• Tìm kiếm sản phẩm\n' +
        '• Thông tin về đơn hàng\n' +
        '• Hỗ trợ thanh toán\n' +
        '• Chính sách đổi trả\n\n' +
        'Bạn cần hỗ trợ gì ạ? 😊';
      senderType = 'bot';
      senderId = room.user_id; // Use user's ID as placeholder for bot
    } else {
      welcomeText = '👋 Chào mừng bạn đến với FireStore Support!\n\n' +
        'Tôi là nhân viên hỗ trợ, rất vui được giúp đỡ bạn. ' +
        'Vui lòng mô tả vấn đề của bạn, tôi sẽ phản hồi trong thời gian sớm nhất! 😊';
      senderType = 'admin';
      // Get first available admin or use system admin
      const admin = await Admin.findOne({ status: 1 }).sort({ created_at: 1 });
      senderId = admin ? admin._id : room.user_id;
    }
    
    const message = await ChatSupport.createMessage({
      room_id: room.room_id,
      message: welcomeText,
      sender_id: senderId,
      sender_type: senderType,
      message_type: 'text',
      bot_metadata: chatType === 'bot' ? { response_type: 'greeting' } : {}
    });
    
    // Update room activity
    await room.updateActivity({
      text: welcomeText,
      sender_id: senderId.toString(),
      sender_type: senderType
    });
    
    return message.toAPIResponse();
  }

  /**
   * Send a message in chat support
   */
  static async sendMessage(roomId, userId, messageText, senderType = 'user') {
    try {
      // Find the room
      const room = await ChatRoom.findOne({ room_id: roomId });
      if (!room) {
        throw new Error('Chat room not found');
      }
      
      // Determine sender info
      let senderId = userId;
      let senderTypeRef = 'User';
      
      if (senderType === 'admin') {
        senderTypeRef = 'Admin';
      }
      
      // Create the message
      const message = await ChatSupport.createMessage({
        room_id: roomId,
        message: messageText,
        sender_id: senderId,
        sender_type: senderType,
        sender_type_ref: senderTypeRef,
        message_type: 'text'
      });
      
      // Update room activity
      await room.updateActivity({
        text: messageText,
        sender_id: senderId.toString(),
        sender_type: senderType
      });
      
      // If this is a bot chat and sender is user, generate bot response
      let botResponse = null;
      if (room.room_type === 'bot' && senderType === 'user') {
        botResponse = await this.generateBotResponse(roomId, messageText, userId);
      }
      
      return {
        success: true,
        data: {
          user_message: message.toAPIResponse(),
          bot_response: botResponse
        }
      };
    } catch (error) {
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  /**
   * Generate bot response based on user message
   * Uses OpenAI with feature detection and DB queries, falls back to keyword-based responses
   */
  static async generateBotResponse(roomId, userMessage, userId) {
    let responseText;
    let responseType = 'default';
    let confidenceScore = 0.8;
    
    // Try to get chat history for context (last 10 messages)
    let chatHistory = [];
    try {
      chatHistory = await ChatSupport.getChatHistory(roomId, 10);
      // Format history for Gemini
      chatHistory = chatHistory.map(msg => ({
        message: msg.message,
        sender_type: msg.sender_type
      }));
    } catch (error) {
      console.log('⚠️ Could not load chat history for context:', error.message);
    }
    
    // Try Gemini AI first
    try {
      const geminiResponse = await geminiService.generateResponse(userMessage, chatHistory, userId);
      
      if (geminiResponse && geminiResponse.text) {
        responseText = geminiResponse.text;
        responseType = geminiResponse.responseType || 'default';
        confidenceScore = geminiResponse.confidenceScore || 0.8;
        console.log(`✅ Gemini AI response generated (type: ${responseType}, confidence: ${confidenceScore.toFixed(2)})`);
      } else {
        // Fallback to keyword-based
        console.log('⚠️ Gemini AI not available, using keyword-based fallback');
        throw new Error('Gemini not available');
      }
    } catch (error) {
      // Fallback to keyword-based responses
      console.log('⚠️ Using keyword-based fallback response');
      const lowerMessage = userMessage.toLowerCase();
      
      if (lowerMessage.includes('chào') || lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
        responseText = 'Chào bạn! Rất vui được hỗ trợ bạn. Bạn cần giúp gì ạ?';
        responseType = 'greeting';
      } else if (lowerMessage.includes('sản phẩm') || lowerMessage.includes('áo') || lowerMessage.includes('quần')) {
        responseText = 'Bạn đang tìm sản phẩm gì? Tôi có thể giúp bạn tìm kiếm theo:\n\n' +
          '• Tên sản phẩm\n' +
          '• Danh mục (áo, quần, phụ kiện...)\n' +
          '• Khoảng giá\n\n' +
          'Hãy cho tôi biết thêm chi tiết nhé!';
        responseType = 'product_info';
      } else if (lowerMessage.includes('đơn hàng') || lowerMessage.includes('order')) {
        responseText = 'Để kiểm tra đơn hàng, bạn có thể:\n\n' +
          '1. Vào mục "Đơn hàng" trong tài khoản của bạn\n' +
          '2. Cung cấp mã đơn hàng để tôi tra cứu giúp bạn\n\n' +
          'Bạn cần hỗ trợ theo cách nào?';
        responseType = 'info';
      } else if (lowerMessage.includes('ship') || lowerMessage.includes('giao hàng') || lowerMessage.includes('vận chuyển')) {
        responseText = '🚚 Thông tin vận chuyển:\n\n' +
          '• Nội thành HCM/HN: 1-2 ngày\n' +
          '• Các tỉnh thành khác: 3-5 ngày\n' +
          '• Miễn phí ship cho đơn từ 500k\n\n' +
          'Bạn cần thêm thông tin gì không?';
        responseType = 'shipping';
      } else if (lowerMessage.includes('thanh toán') || lowerMessage.includes('payment') || lowerMessage.includes('trả')) {
        responseText = '💳 Các hình thức thanh toán:\n\n' +
          '• COD (thanh toán khi nhận hàng)\n' +
          '• Chuyển khoản ngân hàng\n' +
          '• VNPay/MoMo/ZaloPay\n' +
          '• Thẻ Visa/MasterCard\n\n' +
          'Bạn muốn thanh toán bằng hình thức nào?';
        responseType = 'info';
      } else if (lowerMessage.includes('đổi') || lowerMessage.includes('trả') || lowerMessage.includes('hoàn')) {
        responseText = '🔄 Chính sách đổi trả:\n\n' +
          '• Đổi size trong 7 ngày\n' +
          '• Hoàn tiền nếu lỗi sản xuất\n' +
          '• Sản phẩm còn nguyên tem mác\n\n' +
          'Bạn cần đổi/trả sản phẩm nào?';
        responseType = 'support';
      } else if (lowerMessage.includes('admin') || lowerMessage.includes('nhân viên') || lowerMessage.includes('hỗ trợ thực')) {
        responseText = 'Tôi sẽ chuyển bạn đến nhân viên hỗ trợ. ' +
          'Vui lòng chọn "Chat với Admin" để được hỗ trợ trực tiếp từ nhân viên của chúng tôi.';
        responseType = 'support';
      } else if (lowerMessage.includes('cảm ơn') || lowerMessage.includes('thank')) {
        responseText = 'Không có gì ạ! Rất vui vì đã giúp được bạn. ' +
          'Nếu cần hỗ trợ thêm, đừng ngại liên hệ nhé! 😊';
        responseType = 'greeting';
      } else {
        responseText = 'Cảm ơn bạn đã liên hệ! Tôi chưa hiểu rõ câu hỏi của bạn.\n\n' +
          'Bạn có thể hỏi về:\n' +
          '• Sản phẩm và giá cả\n' +
          '• Đơn hàng và vận chuyển\n' +
          '• Thanh toán và đổi trả\n\n' +
          'Hoặc nhập "admin" để chat với nhân viên hỗ trợ.';
        responseType = 'help';
      }
    }
    
    // Create bot response message and store in chat history
    const botMessage = await ChatSupport.createMessage({
      room_id: roomId,
      message: responseText,
      sender_id: userId, // Use user's ID as placeholder
      sender_type: 'bot',
      message_type: 'text',
      bot_metadata: {
        response_type: responseType,
        confidence_score: confidenceScore,
        ai_generated: geminiService.isAvailable()
      }
    });
    
    // Update room activity
    const room = await ChatRoom.findOne({ room_id: roomId });
    if (room) {
      await room.updateActivity({
        text: responseText,
        sender_id: 'bot',
        sender_type: 'bot'
      });
    }
    
    return botMessage.toAPIResponse();
  }

  /**
   * Admin sends response to user
   * Admin can always send messages, regardless of room status
   */
  static async sendAdminResponse(roomId, adminId, messageText) {
    try {
      console.log(`📤 Admin ${adminId} sending message to room ${roomId}`);
      
      const room = await ChatRoom.findOne({ room_id: roomId });
      if (!room) {
        throw new Error(`Chat room not found: ${roomId}`);
      }
      
      console.log(`📤 Room found: status=${room.status}, room_type=${room.room_type}`);
      
      // Admin can always send messages - reactivate room if it's inactive or closed
      if (room.status === 'inactive' || room.status === 'closed') {
        console.log(`📤 Reactivating room ${roomId} from status ${room.status} to active`);
        room.status = 'active';
        room.last_activity = new Date();
      }
      
      // Create admin message
      const message = await ChatSupport.createMessage({
        room_id: roomId,
        message: messageText,
        sender_id: adminId,
        sender_type: 'admin',
        sender_type_ref: 'Admin',
        message_type: 'text'
      });
      
      console.log(`📤 Message created: ${message._id}`);
      
      // Update room activity
      await room.updateActivity({
        text: messageText,
        sender_id: adminId.toString(),
        sender_type: 'admin'
      });
      
      // If admin not already assigned, assign them
      if (!room.admin_id) {
        console.log(`📤 Assigning admin ${adminId} to room ${roomId}`);
        room.admin_id = adminId;
        await room.save();
      }
      
      return {
        success: true,
        data: {
          message: message.toAPIResponse()
        }
      };
    } catch (error) {
      console.error(`❌ Error in sendAdminResponse: ${error.message}`, error);
      throw new Error(`Failed to send admin response: ${error.message}`);
    }
  }

  /**
   * Get chat history for a room
   */
  static async getChatHistory(roomId, userId, limit = 50, before = null) {
    try {
      // Verify user has access to this room
      const room = await ChatRoom.findOne({ room_id: roomId });
      if (!room) {
        throw new Error('Chat room not found');
      }
      
      // Check if user is participant (owner or admin)
      if (room.user_id.toString() !== userId.toString() && 
          room.admin_id?.toString() !== userId.toString()) {
        throw new Error('Access denied to this chat room');
      }
      
      const messages = await ChatSupport.getChatHistory(roomId, limit, before);
      
      // Mark messages as read
      await ChatSupport.markAllAsRead(roomId, userId);
      
      return {
        success: true,
        data: {
          room_id: roomId,
          messages: messages.map(m => ({
            id: m._id,
            message: m.message,
            sender_id: m.sender_id?._id || m.sender_id,
            sender_name: m.sender_id?.full_name || (m.sender_type === 'bot' ? BOT_NAME : 'Unknown'),
            sender_type: m.sender_type,
            message_type: m.message_type,
            is_from_user: m.sender_type === 'user',
            timestamp: m.created_at,
            is_read: m.is_read
          })),
          has_more: messages.length === limit
        }
      };
    } catch (error) {
      throw new Error(`Failed to get chat history: ${error.message}`);
    }
  }

  /**
   * Get all chat rooms for a user
   */
  static async getUserChatRooms(userId) {
    try {
      const rooms = await ChatRoom.findActiveRoomsForUser(userId);
      
      // Get latest message and unread count for each room
      const roomsWithDetails = await Promise.all(rooms.map(async (room) => {
        const latestMessage = await ChatSupport.getLatestMessage(room.room_id);
        const unreadCount = await ChatSupport.getUnreadCount(room.room_id, userId);
        
        return {
          room_id: room.room_id,
          room_type: room.room_type,
          socket_room: room.socket_room,
          status: room.status,
          last_activity: room.last_activity,
          last_message: latestMessage ? {
            text: latestMessage.message,
            sender_type: latestMessage.sender_type,
            timestamp: latestMessage.created_at
          } : null,
          unread_count: unreadCount
        };
      }));
      
      return {
        success: true,
        data: {
          rooms: roomsWithDetails
        }
      };
    } catch (error) {
      throw new Error(`Failed to get user chat rooms: ${error.message}`);
    }
  }

  /**
   * Get chat rooms for admin dashboard
   */
  static async getAdminChatRooms(adminId = null, status = 'active', page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;
      const mongoose = require('mongoose');
      
      let query = {
        room_type: 'admin'
      };
      
      // Filter by status - 'all' shows everything, 'active' shows active and inactive (not closed)
      if (status === 'all') {
        // No status filter - show all
      } else if (status === 'active') {
        // Show both active and inactive rooms (not closed ones)
        query.status = { $in: ['active', 'inactive'] };
      } else {
        query.status = status;
      }
      
      if (adminId) {
        query.admin_id = adminId;
      }
      
      console.log('📋 Admin chat rooms query:', JSON.stringify(query));
      
      // First, let's log all chat rooms in the database for debugging
      const allRooms = await ChatRoom.find({}).select('room_id room_type status user_id');
      console.log(`📋 DEBUG: Total rooms in DB: ${allRooms.length}`);
      allRooms.forEach(r => {
        console.log(`   - ${r.room_id} | type: ${r.room_type} | status: ${r.status} | user: ${r.user_id}`);
      });
      
      const rooms = await ChatRoom.find(query)
        .populate('admin_id', 'username name')
        .sort({ last_activity: -1 })
        .skip(skip)
        .limit(limit);
      
      console.log(`📋 Found ${rooms.length} admin chat rooms matching query`);
      
      const total = await ChatRoom.countDocuments(query);
      
      // Get additional details for each room including user info
      const roomsWithDetails = await Promise.all(rooms.map(async (room) => {
        const latestMessage = await ChatSupport.getLatestMessage(room.room_id);
        const stats = await ChatSupport.getRoomStats(room.room_id);
        
        // Fetch user info separately since user_id can be Mixed type
        let userInfo = null;
        if (room.user_id) {
          try {
            // Try to fetch user from User model if it's a valid ObjectId
            if (mongoose.Types.ObjectId.isValid(room.user_id)) {
              const user = await User.findById(room.user_id).select('full_name phone_number avatar_url');
              if (user) {
                userInfo = {
                  id: user._id,
                  name: user.full_name,
                  phone_number: user.phone_number,
                  avatar: user.avatar_url
                };
              }
            }
            // If not found or not valid ObjectId, use the ID as anonymous user
            if (!userInfo) {
              userInfo = {
                id: room.user_id.toString(),
                name: 'Khách hàng',
                phone_number: null,
                avatar: null
              };
            }
          } catch (err) {
            userInfo = {
              id: room.user_id.toString(),
              name: 'Khách hàng',
              phone_number: null,
              avatar: null
            };
          }
        }
        
        return {
          room_id: room.room_id,
          socket_room: room.socket_room,
          user: userInfo,
          admin: room.admin_id ? {
            id: room.admin_id._id,
            username: room.admin_id.username,
            name: room.admin_id.name
          } : null,
          status: room.status,
          last_activity: room.last_activity,
          last_message: latestMessage ? {
            text: latestMessage.message,
            sender_type: latestMessage.sender_type,
            timestamp: latestMessage.created_at
          } : null,
          stats: stats
        };
      }));
      
      return {
        success: true,
        data: {
          rooms: roomsWithDetails,
          pagination: {
            current_page: page,
            total_pages: Math.ceil(total / limit),
            total_rooms: total,
            has_next: page * limit < total,
            has_prev: page > 1
          }
        }
      };
    } catch (error) {
      console.error('Error in getAdminChatRooms:', error);
      throw new Error(`Failed to get admin chat rooms: ${error.message}`);
    }
  }

  /**
   * Close a chat room
   */
  static async closeChatRoom(roomId, userId) {
    try {
      const room = await ChatRoom.findOne({ room_id: roomId });
      if (!room) {
        throw new Error('Chat room not found');
      }
      
      // Verify ownership
      if (room.user_id.toString() !== userId.toString()) {
        throw new Error('Access denied');
      }
      
      await room.closeRoom();
      
      // Update user status - remove from active rooms
      const userStatus = await UserStatus.findOne({ user_id: userId });
      if (userStatus) {
        await userStatus.leaveRoom(room.socket_room);
      }
      
      return {
        success: true,
        data: {
          message: 'Chat room closed successfully'
        }
      };
    } catch (error) {
      throw new Error(`Failed to close chat room: ${error.message}`);
    }
  }

  /**
   * Handle user going offline - close their socket rooms
   */
  static async handleUserOffline(userId, io) {
    try {
      // Get user's active rooms
      const userStatus = await UserStatus.findOne({ user_id: userId });
      if (!userStatus) return;
      
      const activeRooms = userStatus.active_rooms || [];
      
      // Notify rooms about user leaving
      for (const socketRoom of activeRooms) {
        if (io) {
          io.to(socketRoom).emit('userLeftRoom', {
            userId: userId,
            reason: 'offline',
            timestamp: new Date()
          });
        }
        
        // Set room to inactive
        const room = await ChatRoom.findBySocketRoom(socketRoom);
        if (room) {
          await room.setInactive();
          await room.removeParticipant(userId);
        }
      }
      
      // Clear user's active rooms
      userStatus.active_rooms = [];
      await userStatus.setOffline();
      
      return {
        success: true,
        closedRooms: activeRooms
      };
    } catch (error) {
      console.error('Error handling user offline:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Join a socket room
   */
  static async joinSocketRoom(roomId, userId, socketId, userType = 'User') {
    try {
      const room = await ChatRoom.findOne({ room_id: roomId });
      if (!room) {
        throw new Error('Chat room not found');
      }
      
      await room.addParticipant(userId, userType, socketId);
      
      // Update user status
      const userStatus = await UserStatus.findOrCreateStatus(userId, userType.toLowerCase());
      await userStatus.joinRoom(room.socket_room);
      await userStatus.addSocketId(socketId);
      
      return {
        success: true,
        data: {
          socket_room: room.socket_room,
          participants: room.participants
        }
      };
    } catch (error) {
      throw new Error(`Failed to join socket room: ${error.message}`);
    }
  }

  /**
   * Leave a socket room
   */
  static async leaveSocketRoom(roomId, userId, socketId) {
    try {
      const room = await ChatRoom.findOne({ room_id: roomId });
      if (!room) return { success: true }; // Room already doesn't exist
      
      await room.removeParticipant(userId, socketId);
      
      // Update user status
      const userStatus = await UserStatus.findOne({ user_id: userId });
      if (userStatus) {
        await userStatus.leaveRoom(room.socket_room);
        await userStatus.removeSocketId(socketId);
      }
      
      return {
        success: true,
        data: {
          socket_room: room.socket_room
        }
      };
    } catch (error) {
      throw new Error(`Failed to leave socket room: ${error.message}`);
    }
  }

  /**
   * Get online admins for user to chat with
   */
  static async getOnlineAdmins() {
    try {
      const onlineAdminStatuses = await UserStatus.getOnlineUsers('admin');
      
      return {
        success: true,
        data: {
          online_admins: onlineAdminStatuses.map(status => ({
            id: status.user_id?._id || status.user_id,
            name: status.user_id?.full_name || 'Admin',
            avatar: status.user_id?.avatar_url
          })),
          count: onlineAdminStatuses.length
        }
      };
    } catch (error) {
      throw new Error(`Failed to get online admins: ${error.message}`);
    }
  }
}

module.exports = ChatSupportService;


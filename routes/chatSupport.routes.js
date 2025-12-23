const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const authAdminOrStaff = require('../middlewares/authAdminOrStaff');
const ChatSupportController = require('../controllers/chatSupport.controller');

// All routes require authentication
router.use(authMiddleware);

// ========================================
// USER ROUTES
// ========================================

/**
 * Start a new chat support session
 * POST /api/chat-support/start
 * Body: { chat_type: 'bot' | 'admin', admin_id?: string }
 */
router.post('/start', ChatSupportController.startChatSupport);

/**
 * Get user's chat rooms
 * GET /api/chat-support/rooms
 */
router.get('/rooms', ChatSupportController.getUserChatRooms);

/**
 * Get chat history for a room
 * GET /api/chat-support/rooms/:roomId/history
 * Query: { limit?: number, before?: string (ISO date) }
 */
router.get('/rooms/:roomId/history', ChatSupportController.getChatHistory);

/**
 * Send a message in chat support
 * POST /api/chat-support/rooms/:roomId/messages
 * Body: { message: string }
 */
router.post('/rooms/:roomId/messages', ChatSupportController.sendMessage);

/**
 * Close a chat room
 * PATCH /api/chat-support/rooms/:roomId/close
 */
router.patch('/rooms/:roomId/close', ChatSupportController.closeChatRoom);

/**
 * Mark messages as read
 * PATCH /api/chat-support/rooms/:roomId/read
 */
router.patch('/rooms/:roomId/read', ChatSupportController.markMessagesAsRead);

/**
 * Get room statistics
 * GET /api/chat-support/rooms/:roomId/stats
 */
router.get('/rooms/:roomId/stats', ChatSupportController.getRoomStats);

/**
 * Get online admins available for chat
 * GET /api/chat-support/online-admins
 */
router.get('/online-admins', ChatSupportController.getOnlineAdmins);

/**
 * Get user's online status
 * GET /api/chat-support/status/:userId
 */
router.get('/status/:userId', ChatSupportController.getUserStatus);

// ========================================
// ADMIN ROUTES
// ========================================

/**
 * Get all admin chat rooms (for admin dashboard)
 * GET /api/chat-support/admin/rooms
 * Query: { status?: string, page?: number, limit?: number, all?: boolean }
 */
router.get('/admin/rooms', authAdminOrStaff, ChatSupportController.getAdminChatRooms);

/**
 * Admin sends response to user
 * POST /api/chat-support/admin/rooms/:roomId/respond
 * Body: { message: string }
 */
router.post('/admin/rooms/:roomId/respond', authAdminOrStaff, ChatSupportController.sendAdminResponse);

/**
 * Admin gets chat history (with extended access)
 * GET /api/chat-support/admin/rooms/:roomId/history
 */
router.get('/admin/rooms/:roomId/history', authAdminOrStaff, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, before = null } = req.query;
    const ChatSupport = require('../models/ChatSupport');
    
    const messages = await ChatSupport.getChatHistory(roomId, parseInt(limit), before);
    
    res.json({
      success: true,
      data: {
        room_id: roomId,
        messages: messages.map(m => ({
          id: m._id,
          message: m.message,
          sender_id: m.sender_id?._id || m.sender_id,
          sender_name: m.sender_id?.full_name || (m.sender_type === 'bot' ? 'Trợ lý ảo Manzone' : 'Unknown'),
          sender_type: m.sender_type,
          message_type: m.message_type,
          is_from_user: m.sender_type === 'user',
          timestamp: m.created_at,
          is_read: m.is_read
        })),
        has_more: messages.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error getting admin chat history:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ========================================
// LEGACY/COMPATIBILITY ROUTES
// ========================================

/**
 * Start bot chat (legacy)
 * POST /api/chat-support/bot/start
 */
router.post('/bot/start', async (req, res) => {
  req.body.chat_type = 'bot';
  return ChatSupportController.startChatSupport(req, res);
});

/**
 * Start admin chat (legacy)
 * POST /api/chat-support/admin/start
 */
router.post('/admin/start', async (req, res) => {
  req.body.chat_type = 'admin';
  return ChatSupportController.startChatSupport(req, res);
});

module.exports = router;


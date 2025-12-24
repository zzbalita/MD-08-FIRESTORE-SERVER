const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const authAdminOrStaff = require('../middlewares/authAdminOrStaff');
const {
  getChatHistory,
  sendMessage,
  getChatSessions,
  createChatSession,
  closeChatSession,
  // Suggestion handling
  handleSuggestionClick,
  // Admin chat methods
  getAllAdminChats,
  getAdminChatHistory,
  sendAdminResponse,
  createAdminChatSession,
  createUserAdminChatSession,
  sendAdminChatMessage,
  getUserAdminChatHistory
} = require('../controllers/chat.controller');

// All chat routes require authentication
router.use(authMiddleware);

// User chat routes
router.get('/sessions', getChatSessions);
router.post('/sessions', createChatSession);
router.get('/sessions/:sessionId', getChatHistory);
router.post('/sessions/:sessionId/messages', sendMessage);
router.patch('/sessions/:sessionId/close', closeChatSession);

// Suggestion handling route
router.post('/suggestion', handleSuggestionClick);

// User admin chat routes (for users to connect with admin)
router.post('/user-admin-sessions', createUserAdminChatSession);

// NEW: Admin chat message endpoint for users
router.post('/admin/sessions/:sessionId/messages', sendAdminChatMessage);

// NEW: Get admin chat history for user (all sessions)
router.get('/admin/history', getUserAdminChatHistory);

// Admin chat routes (require admin or staff privileges)
router.get('/admin/all-chats', authAdminOrStaff, getAllAdminChats);
router.get('/admin/sessions/:sessionId', authAdminOrStaff, getAdminChatHistory);
router.post('/admin/sessions/:sessionId/respond', authAdminOrStaff, sendAdminResponse);
router.post('/admin/sessions', authAdminOrStaff, createAdminChatSession);

module.exports = router;

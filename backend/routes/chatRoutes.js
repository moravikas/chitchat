const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const requireAuth = require('../middleware/auth');

// All chat routes are protected and require a valid auth token
router.use(requireAuth);

// 1. Get conversations list
router.get('/conversations', chatController.getConversations);

// 2. Get messages list inside a conversation
router.get('/messages/:conversationId', chatController.getMessages);

// 3. Find or create a direct chat
router.post('/conversations', chatController.getOrCreatePrivateChat);

// 4. Create a group chat
router.post('/conversations/group', chatController.createGroupChat);

// Group management routes
router.put('/conversations/group/:id', chatController.updateGroupMeta);
router.post('/conversations/group/:id/members', chatController.addMembers);
router.delete('/conversations/group/:id/members/:userId', chatController.removeMember);
router.put('/conversations/group/:id/admins/:userId', chatController.changeAdminRole);
router.post('/conversations/group/:id/leave', chatController.leaveGroup);
router.delete('/conversations/group/:id', chatController.deleteGroup);

// 5. Search users by query
router.get('/users/search', chatController.searchUsers);

module.exports = router;

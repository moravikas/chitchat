const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

/**
 * Get all conversations for the authenticated user
 */
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find conversations where user is a participant
    const conversations = await Conversation.find({
      participants: userId
    })
    .populate('participants', 'firstName lastName email mobileNumber')
    .populate({
      path: 'lastMessage',
      populate: {
        path: 'sender',
        select: 'firstName lastName'
      }
    })
    .sort({ updatedAt: -1 });

    res.status(200).json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
};

/**
 * Get message history for a conversation
 */
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Verify user is a participant of the conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    });

    if (!conversation) {
      return res.status(403).json({ error: 'You do not have access to this conversation' });
    }

    const messages = await Message.find({ conversationId })
      .populate('sender', 'firstName lastName email')
      .sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

/**
 * Search users to start new chat
 */
exports.searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    const currentUserId = req.user.id;

    if (!query) {
      return res.status(200).json([]);
    }

    // Search users by first name, last name, email, or mobile, excluding self
    const searchRegex = new RegExp(query, 'i');
    const users = await User.find({
      _id: { $ne: currentUserId },
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { mobileNumber: searchRegex }
      ]
    }).select('firstName lastName email mobileNumber');

    res.status(200).json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
};

/**
 * Find or create a private conversation with another user
 */
exports.getOrCreatePrivateChat = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const currentUserId = req.user.id;

    if (!targetUserId) {
      return res.status(400).json({ error: 'Target user ID is required' });
    }

    // Look for existing private conversation containing exactly these two participants
    let conversation = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [currentUserId, targetUserId], $size: 2 }
    })
    .populate('participants', 'firstName lastName email mobileNumber')
    .populate('lastMessage');

    // If not found, create new one
    if (!conversation) {
      conversation = new Conversation({
        participants: [currentUserId, targetUserId],
        isGroup: false
      });
      await conversation.save();

      // Populate user info for response
      conversation = await Conversation.findById(conversation._id)
        .populate('participants', 'firstName lastName email mobileNumber');
    }

    res.status(200).json(conversation);
  } catch (error) {
    console.error('Error opening private chat:', error);
    res.status(500).json({ error: 'Failed to open private chat' });
  }
};

/**
 * Create a new group conversation
 */
exports.createGroupChat = async (req, res) => {
  try {
    const { groupName, participantIds, groupDescription } = req.body;
    const currentUserId = req.user.id;

    if (!groupName || !participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({ error: 'Group name and participants are required' });
    }

    const allParticipants = Array.from(new Set([currentUserId, ...participantIds]));

    const newGroup = new Conversation({
      participants: allParticipants,
      isGroup: true,
      groupName: groupName.trim(),
      groupDescription: (groupDescription || '').trim(),
      groupAvatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(groupName)}&background=6366f1&color=fff&size=128`,
      admins: [currentUserId],
      createdBy: currentUserId
    });

    await newGroup.save();

    // Create system message
    const currentUser = await User.findById(currentUserId);
    const creatorName = `${currentUser.firstName} ${currentUser.lastName}`;
    const systemMessage = new Message({
      conversationId: newGroup._id,
      sender: null,
      text: `${creatorName} created group "${groupName.trim()}"`,
      isSystem: true
    });
    await systemMessage.save();

    newGroup.lastMessage = systemMessage._id;
    await newGroup.save();

    const populatedGroup = await Conversation.findById(newGroup._id)
      .populate('participants', 'firstName lastName email mobileNumber')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'firstName lastName'
        }
      });

    // Notify all participants via socket if connected
    const io = req.app.get('socketio');
    if (io) {
      allParticipants.forEach(pId => {
        io.to(pId.toString()).emit('new_message_notification', {
          conversationId: newGroup._id,
          message: systemMessage,
          isGroup: true
        });
      });
    }

    res.status(201).json(populatedGroup);
  } catch (error) {
    console.error('Error creating group chat:', error);
    res.status(500).json({ error: 'Failed to create group chat' });
  }
};

/**
 * Update group metadata (name, description, icon, setting)
 */
exports.updateGroupMeta = async (req, res) => {
  try {
    const { id } = req.params;
    const { groupName, groupDescription, groupAvatar, onlyAdminsCanMessage } = req.body;
    const currentUserId = req.user.id;

    const group = await Conversation.findById(id);
    if (!group || !group.isGroup) {
      return res.status(404).json({ error: 'Group chat not found' });
    }

    const isAdmin = group.admins.some(adminId => adminId.toString() === currentUserId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only group admins can modify group details' });
    }

    const currentUser = await User.findById(currentUserId);
    const userName = `${currentUser.firstName} ${currentUser.lastName}`;
    const updates = {};
    const systemTexts = [];

    if (groupName && groupName.trim() !== group.groupName) {
      updates.groupName = groupName.trim();
      systemTexts.push(`${userName} changed the group name to "${groupName.trim()}"`);
    }

    if (groupDescription !== undefined && groupDescription.trim() !== group.groupDescription) {
      updates.groupDescription = groupDescription.trim();
      systemTexts.push(`${userName} changed the group description`);
    }

    if (groupAvatar !== undefined && groupAvatar.trim() !== group.groupAvatar) {
      updates.groupAvatar = groupAvatar.trim();
      systemTexts.push(`${userName} changed the group icon`);
    }

    if (onlyAdminsCanMessage !== undefined && onlyAdminsCanMessage !== group.onlyAdminsCanMessage) {
      updates.onlyAdminsCanMessage = onlyAdminsCanMessage;
      systemTexts.push(
        onlyAdminsCanMessage
          ? `${userName} changed group settings to allow only admins to send messages`
          : `${userName} allowed all participants to send messages`
      );
    }

    if (Object.keys(updates).length === 0) {
      return res.status(200).json(group);
    }

    // Apply updates
    Object.assign(group, updates);
    group.updatedAt = Date.now();

    // Create system messages
    let lastSysMsg = null;
    for (const text of systemTexts) {
      const sysMsg = new Message({
        conversationId: group._id,
        sender: null,
        text,
        isSystem: true
      });
      await sysMsg.save();
      lastSysMsg = sysMsg;
    }

    if (lastSysMsg) {
      group.lastMessage = lastSysMsg._id;
    }
    await group.save();

    const populatedGroup = await Conversation.findById(group._id)
      .populate('participants', 'firstName lastName email mobileNumber')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'firstName lastName'
        }
      });

    // Notify all participants
    const io = req.app.get('socketio');
    if (io) {
      io.to(group._id.toString()).emit('group_update', {
        groupId: group._id,
        type: 'meta_update',
        group: populatedGroup
      });
      if (lastSysMsg) {
        io.to(group._id.toString()).emit('new_message', lastSysMsg);
      }
    }

    res.status(200).json(populatedGroup);
  } catch (error) {
    console.error('Error updating group metadata:', error);
    res.status(500).json({ error: 'Failed to update group metadata' });
  }
};

/**
 * Add member(s) to a group
 */
exports.addMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const { memberIds } = req.body;
    const currentUserId = req.user.id;

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ error: 'Member IDs are required' });
    }

    const group = await Conversation.findById(id);
    if (!group || !group.isGroup) {
      return res.status(404).json({ error: 'Group chat not found' });
    }

    const isAdmin = group.admins.some(adminId => adminId.toString() === currentUserId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only group admins can add members' });
    }

    const currentUser = await User.findById(currentUserId);
    const adminName = `${currentUser.firstName} ${currentUser.lastName}`;
    const addedUsers = await User.find({ _id: { $in: memberIds } });

    const newParticipants = [];
    const systemTexts = [];

    for (const user of addedUsers) {
      const pIdStr = user._id.toString();
      if (!group.participants.some(p => p.toString() === pIdStr)) {
        group.participants.push(user._id);
        newParticipants.push(pIdStr);
        systemTexts.push(`${adminName} added ${user.firstName} ${user.lastName}`);
      }
    }

    if (newParticipants.length === 0) {
      return res.status(400).json({ error: 'Selected contacts are already members of this group' });
    }

    // Save updates
    let lastSysMsg = null;
    for (const text of systemTexts) {
      const sysMsg = new Message({
        conversationId: group._id,
        sender: null,
        text,
        isSystem: true
      });
      await sysMsg.save();
      lastSysMsg = sysMsg;
    }

    if (lastSysMsg) {
      group.lastMessage = lastSysMsg._id;
    }
    group.updatedAt = Date.now();
    await group.save();

    const populatedGroup = await Conversation.findById(group._id)
      .populate('participants', 'firstName lastName email mobileNumber')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'firstName lastName'
        }
      });

    // Notify all participants
    const io = req.app.get('socketio');
    if (io) {
      io.to(group._id.toString()).emit('group_update', {
        groupId: group._id,
        type: 'members_added',
        group: populatedGroup
      });
      if (lastSysMsg) {
        io.to(group._id.toString()).emit('new_message', lastSysMsg);
      }
      
      // Notify added users' socket personal room to fetch the conversation dynamically
      newParticipants.forEach(pId => {
        io.to(pId).emit('new_message_notification', {
          conversationId: group._id,
          message: lastSysMsg,
          isGroup: true
        });
      });
    }

    res.status(200).json(populatedGroup);
  } catch (error) {
    console.error('Error adding group members:', error);
    res.status(500).json({ error: 'Failed to add group members' });
  }
};

/**
 * Remove a member from a group
 */
exports.removeMember = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const currentUserId = req.user.id;

    const group = await Conversation.findById(id);
    if (!group || !group.isGroup) {
      return res.status(404).json({ error: 'Group chat not found' });
    }

    const isAdmin = group.admins.some(adminId => adminId.toString() === currentUserId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only group admins can remove members' });
    }

    if (userId === currentUserId) {
      return res.status(400).json({ error: 'You cannot remove yourself. Leave instead' });
    }

    const isMember = group.participants.some(p => p.toString() === userId);
    if (!isMember) {
      return res.status(400).json({ error: 'User is not a member of this group' });
    }

    const currentUser = await User.findById(currentUserId);
    const adminName = `${currentUser.firstName} ${currentUser.lastName}`;
    const removedUser = await User.findById(userId);

    // Remove user ID from participants and admins arrays
    group.participants = group.participants.filter(p => p.toString() !== userId);
    group.admins = group.admins.filter(a => a.toString() !== userId);

    // Create system message
    const systemMessage = new Message({
      conversationId: group._id,
      sender: null,
      text: `${adminName} removed ${removedUser.firstName} ${removedUser.lastName}`,
      isSystem: true
    });
    await systemMessage.save();

    group.lastMessage = systemMessage._id;
    group.updatedAt = Date.now();
    await group.save();

    const populatedGroup = await Conversation.findById(group._id)
      .populate('participants', 'firstName lastName email mobileNumber')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'firstName lastName'
        }
      });

    // Notify all participants
    const io = req.app.get('socketio');
    if (io) {
      // Notify the removed user first so their client disconnects
      io.to(userId).emit('group_deleted', { groupId: group._id, reason: 'removed' });

      io.to(group._id.toString()).emit('group_update', {
        groupId: group._id,
        type: 'member_removed',
        group: populatedGroup
      });
      io.to(group._id.toString()).emit('new_message', systemMessage);
    }

    res.status(200).json(populatedGroup);
  } catch (error) {
    console.error('Error removing group member:', error);
    res.status(500).json({ error: 'Failed to remove group member' });
  }
};

/**
 * Promote or demote admin roles
 */
exports.changeAdminRole = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { makeAdmin } = req.body;
    const currentUserId = req.user.id;

    const group = await Conversation.findById(id);
    if (!group || !group.isGroup) {
      return res.status(404).json({ error: 'Group chat not found' });
    }

    const isAdmin = group.admins.some(adminId => adminId.toString() === currentUserId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only group admins can change admin permissions' });
    }

    const isMember = group.participants.some(p => p.toString() === userId);
    if (!isMember) {
      return res.status(400).json({ error: 'User is not a member of this group' });
    }

    const currentUser = await User.findById(currentUserId);
    const adminName = `${currentUser.firstName} ${currentUser.lastName}`;
    const targetUser = await User.findById(userId);

    const isCurrentlyAdmin = group.admins.some(a => a.toString() === userId);
    let systemText = '';

    if (makeAdmin) {
      if (isCurrentlyAdmin) {
        return res.status(400).json({ error: 'User is already an admin' });
      }
      group.admins.push(targetUser._id);
      systemText = `${adminName} made ${targetUser.firstName} ${targetUser.lastName} an admin`;
    } else {
      if (!isCurrentlyAdmin) {
        return res.status(400).json({ error: 'User is not an admin' });
      }
      if (group.admins.length === 1 && group.admins[0].toString() === userId) {
        return res.status(400).json({ error: 'A group must have at least one admin' });
      }
      group.admins = group.admins.filter(a => a.toString() !== userId);
      systemText = `${targetUser.firstName} ${targetUser.lastName} is no longer an admin`;
    }

    // Save system message
    const systemMessage = new Message({
      conversationId: group._id,
      sender: null,
      text: systemText,
      isSystem: true
    });
    await systemMessage.save();

    group.lastMessage = systemMessage._id;
    group.updatedAt = Date.now();
    await group.save();

    const populatedGroup = await Conversation.findById(group._id)
      .populate('participants', 'firstName lastName email mobileNumber')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'firstName lastName'
        }
      });

    // Notify all participants
    const io = req.app.get('socketio');
    if (io) {
      io.to(group._id.toString()).emit('group_update', {
        groupId: group._id,
        type: 'role_changed',
        group: populatedGroup
      });
      io.to(group._id.toString()).emit('new_message', systemMessage);
    }

    res.status(200).json(populatedGroup);
  } catch (error) {
    console.error('Error changing group admin role:', error);
    res.status(500).json({ error: 'Failed to change admin permissions' });
  }
};

/**
 * Leave a group conversation
 */
exports.leaveGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;

    const group = await Conversation.findById(id);
    if (!group || !group.isGroup) {
      return res.status(404).json({ error: 'Group chat not found' });
    }

    const isMember = group.participants.some(p => p.toString() === currentUserId);
    if (!isMember) {
      return res.status(400).json({ error: 'You are not a member of this group' });
    }

    const currentUser = await User.findById(currentUserId);
    const userName = `${currentUser.firstName} ${currentUser.lastName}`;

    // Remove user ID from participants and admins
    group.participants = group.participants.filter(p => p.toString() !== currentUserId);
    const wasAdmin = group.admins.some(a => a.toString() === currentUserId);
    group.admins = group.admins.filter(a => a.toString() !== currentUserId);

    let systemText = `${userName} left`;
    let autoPromotionText = '';

    // If they were an admin and there are no admins left, auto-promote the next oldest member
    if (wasAdmin && group.admins.length === 0 && group.participants.length > 0) {
      const nextAdminId = group.participants[0];
      group.admins.push(nextAdminId);
      const nextAdminUser = await User.findById(nextAdminId);
      autoPromotionText = `${nextAdminUser.firstName} ${nextAdminUser.lastName} is now an admin`;
    }

    // Save system messages
    const systemMessage = new Message({
      conversationId: group._id,
      sender: null,
      text: systemText,
      isSystem: true
    });
    await systemMessage.save();

    let autoPromoMessage = null;
    if (autoPromotionText) {
      autoPromoMessage = new Message({
        conversationId: group._id,
        sender: null,
        text: autoPromotionText,
        isSystem: true
      });
      await autoPromoMessage.save();
    }

    group.lastMessage = autoPromoMessage ? autoPromoMessage._id : systemMessage._id;
    group.updatedAt = Date.now();
    await group.save();

    const populatedGroup = await Conversation.findById(group._id)
      .populate('participants', 'firstName lastName email mobileNumber')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'firstName lastName'
        }
      });

    // Notify all participants
    const io = req.app.get('socketio');
    if (io) {
      // Notify the leaving user first
      io.to(currentUserId).emit('group_deleted', { groupId: group._id, reason: 'left' });

      io.to(group._id.toString()).emit('group_update', {
        groupId: group._id,
        type: 'member_left',
        group: populatedGroup
      });
      io.to(group._id.toString()).emit('new_message', systemMessage);
      if (autoPromoMessage) {
        io.to(group._id.toString()).emit('new_message', autoPromoMessage);
      }
    }

    res.status(200).json({ message: 'Successfully left the group' });
  } catch (error) {
    console.error('Error leaving group chat:', error);
    res.status(500).json({ error: 'Failed to leave group chat' });
  }
};

/**
 * Delete group entirely (Admin only)
 */
exports.deleteGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;

    const group = await Conversation.findById(id);
    if (!group || !group.isGroup) {
      return res.status(404).json({ error: 'Group chat not found' });
    }

    const isAdmin = group.admins.some(adminId => adminId.toString() === currentUserId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only group admins can delete groups' });
    }

    // Delete group conversations and messages from DB
    await Conversation.findByIdAndDelete(id);
    await Message.deleteMany({ conversationId: id });

    // Emit group_deleted to all participants via socket
    const io = req.app.get('socketio');
    if (io) {
      io.to(id.toString()).emit('group_deleted', { groupId: id, reason: 'deleted' });
    }

    res.status(200).json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
};

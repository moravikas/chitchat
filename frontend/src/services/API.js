import axios from 'axios';

// Base URL for the Express backend
export const BACKEND_URL = 'https://chitchat-s7ul.onrender.com';
const API_BASE_URL = `${BACKEND_URL}/api`;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach Authorization tokens if available (for future expansion)
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const authAPI = {
  /**
   * Logs in a user
   * @param {string} emailOrMobile - User email or mobile number
   * @param {string} password - User password
   */
  login: async (emailOrMobile, password) => {
    try {
      const response = await apiClient.post('/auth/login', { emailOrMobile, password });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to log in. Please try again.';
    }
  },

  /**
   * Registers a new user
   * @param {Object} userData - User registration details
   * @param {string} userData.firstName
   * @param {string} userData.lastName
   * @param {string} userData.email
   * @param {string} userData.mobileNumber
   * @param {string} userData.password
   */
  signup: async (userData) => {
    try {
      const response = await apiClient.post('/auth/signup', userData);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Registration failed. Please try again.';
    }
  },

  /**
   * Initiates forgot password flow
   * @param {string} emailOrMobile - User email or mobile number
   */
  forgotPassword: async (emailOrMobile) => {
    try {
      const response = await apiClient.post('/auth/forgot-password', { emailOrMobile });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Request failed. Please try again.';
    }
  },
};

export const chatAPI = {
  getConversations: async () => {
    try {
      const response = await apiClient.get('/chat/conversations');
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to load chats.';
    }
  },

  getMessages: async (conversationId) => {
    try {
      const response = await apiClient.get(`/chat/messages/${conversationId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to load messages.';
    }
  },

  getOrCreatePrivateChat: async (targetUserId) => {
    try {
      const response = await apiClient.post('/chat/conversations', { targetUserId });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to open direct chat.';
    }
  },

  createGroupChat: async (groupName, participantIds, groupDescription = '') => {
    try {
      const response = await apiClient.post('/chat/conversations/group', { groupName, participantIds, groupDescription });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to create group.';
    }
  },

  updateGroupMeta: async (groupId, data) => {
    try {
      const response = await apiClient.put(`/chat/conversations/group/${groupId}`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to update group settings.';
    }
  },

  addGroupMembers: async (groupId, memberIds) => {
    try {
      const response = await apiClient.post(`/chat/conversations/group/${groupId}/members`, { memberIds });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to add members.';
    }
  },

  removeGroupMember: async (groupId, userId) => {
    try {
      const response = await apiClient.delete(`/chat/conversations/group/${groupId}/members/${userId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to remove member.';
    }
  },

  changeGroupAdminRole: async (groupId, userId, makeAdmin) => {
    try {
      const response = await apiClient.put(`/chat/conversations/group/${groupId}/admins/${userId}`, { makeAdmin });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to change admin permissions.';
    }
  },

  leaveGroup: async (groupId) => {
    try {
      const response = await apiClient.post(`/chat/conversations/group/${groupId}/leave`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to leave group.';
    }
  },

  deleteGroup: async (groupId) => {
    try {
      const response = await apiClient.delete(`/chat/conversations/group/${groupId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to delete group.';
    }
  },

  searchUsers: async (query) => {
    try {
      const response = await apiClient.get(`/chat/users/search?query=${encodeURIComponent(query)}`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to search users.';
    }
  }
};

export default apiClient;

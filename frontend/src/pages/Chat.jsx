import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { chatAPI, BACKEND_URL } from '../services/API';
import SideBar from '../components/SideBar';
import RecentChats from '../components/RecentChats';
import Chatting from '../components/Chatting';
import GroupInfo from '../components/GroupInfo';
import '../styles/Chat.css';

function Chat() {
  const [activeTab, setActiveTab] = useState('chats'); // 'chats', 'groups', 'settings'
  const [activeConversation, setActiveConversation] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingStatus, setTypingStatus] = useState({}); // { convoId: [userName1, userName2] }
  const [showSettingsSaved, setShowSettingsSaved] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  const socketRef = useRef(null);
  const navigate = useNavigate();
  const activeConversationRef = useRef(activeConversation);

  // Sync activeConversation state with its Ref for listeners
  useEffect(() => {
    activeConversationRef.current = activeConversation;
    setShowGroupInfo(false);
  }, [activeConversation]);

  // Load user info from local storage
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      navigate('/login');
      return;
    }
    const user = JSON.parse(userStr);
    setCurrentUser(user);
  }, [navigate]);

  // Fetch initial conversations list once user is loaded
  useEffect(() => {
    if (!currentUser) return;

    const fetchConversations = async () => {
      try {
        const data = await chatAPI.getConversations();
        
        // Add a mock unreadCount property for UI tracking
        const formatted = data.map(convo => ({
          ...convo,
          unreadCount: convo.unreadCount || 0
        }));
        setConversations(formatted);
      } catch (err) {
        console.error('Failed to load conversations:', err);
      }
    };

    fetchConversations();
  }, [currentUser]);

  // Configure Socket.io connection and listeners
  useEffect(() => {
    if (!currentUser) return;

    // Connect to backend server passing current userId in handshake query
    const socket = io(BACKEND_URL, {
      query: { userId: currentUser.id }
    });
    socketRef.current = socket;

    // Listeners
    socket.on('connect', () => {
      console.log('Connected to chat socket server');
    });

    socket.on('online_users', (userIds) => {
      setOnlineUsers(userIds);
    });

    socket.on('typing_status', ({ conversationId, userId, isTyping, userName }) => {
      setTypingStatus(prev => {
        const currentList = prev[conversationId] || [];
        let updatedList;
        if (isTyping) {
          updatedList = currentList.includes(userName) ? currentList : [...currentList, userName];
        } else {
          updatedList = currentList.filter(name => name !== userName);
        }
        return {
          ...prev,
          [conversationId]: updatedList
        };
      });
    });

    socket.on('new_message', (message) => {
      const activeConvo = activeConversationRef.current;

      // 1. If message belongs to the current active chat, append it to messages state
      if (activeConvo && activeConvo._id === message.conversationId) {
        setMessages(prev => {
          // Prevent duplicates by checking if message is already in state
          const exists = prev.some(m => m._id === message._id);
          if (exists) return prev;
          return [...prev, message];
        });
      } else {
        // If not active chat, increment unread count in conversations list
        setConversations(prevConvos => {
          return prevConvos.map(c => {
            if (c._id === message.conversationId) {
              return {
                ...c,
                unreadCount: (c.unreadCount || 0) + 1
              };
            }
            return c;
          });
        });
      }

      // 2. Update last message in the conversations list and bring it to top
      setConversations(prevConvos => {
        const index = prevConvos.findIndex(c => c._id === message.conversationId);
        if (index !== -1) {
          const updatedConvos = [...prevConvos];
          updatedConvos[index] = {
            ...updatedConvos[index],
            lastMessage: message,
            updatedAt: message.createdAt
          };
          // Sort by updatedAt descending
          return updatedConvos.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        } else {
          // If conversation is new (e.g. initiated by another user), trigger refresh
          const fetchLatest = async () => {
            try {
              const data = await chatAPI.getConversations();
              setConversations(data);
            } catch (err) {
              console.error(err);
            }
          };
          fetchLatest();
        }
        return prevConvos;
      });
    });

    // Handle background notifications/updates for threads initiated elsewhere
    socket.on('new_message_notification', ({ conversationId, message, isGroup }) => {
      setConversations(prevConvos => {
        const index = prevConvos.findIndex(c => c._id === conversationId);
        if (index !== -1) {
          const updatedConvos = [...prevConvos];
          updatedConvos[index] = {
            ...updatedConvos[index],
            lastMessage: message,
            updatedAt: message.createdAt,
            unreadCount: (updatedConvos[index].unreadCount || 0) + 1
          };
          return updatedConvos.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        } else {
          // Refresh entire thread list to grab the new convo schema
          const fetchLatest = async () => {
            try {
              const data = await chatAPI.getConversations();
              setConversations(data);
            } catch (err) {
              console.error(err);
            }
          };
          fetchLatest();
        }
        return prevConvos;
      });
    });

    socket.on('group_update', ({ groupId, type, group }) => {
      setConversations(prev => prev.map(c => c._id === groupId ? group : c));
      setActiveConversation(current => {
        if (current && current._id === groupId) {
          return group;
        }
        return current;
      });
    });

    socket.on('group_deleted', ({ groupId, reason }) => {
      setActiveConversation(current => {
        if (current && current._id === groupId) {
          if (reason === 'removed') {
            alert('You were removed from the group by an admin.');
          } else if (reason === 'deleted') {
            alert('This group was deleted by an admin.');
          }
          return null;
        }
        return current;
      });
      setConversations(prev => prev.filter(c => c._id !== groupId));
    });

    return () => {
      socket.disconnect();
      console.log('Disconnected chat socket server');
    };
  }, [currentUser]);

  // Load message logs when active conversation changes
  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      return;
    }

    if (activeConversation.isDraft) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        const data = await chatAPI.getMessages(activeConversation._id);
        setMessages(data);

        // Reset unread count locally for this active conversation
        setConversations(prev =>
          prev.map(c => (c._id === activeConversation._id ? { ...c, unreadCount: 0 } : c))
        );

        // Subscribe to socket room for this chat room
        if (socketRef.current) {
          socketRef.current.emit('join_chat', activeConversation._id);
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      }
    };

    fetchMessages();

    // Cleanup: leave previous conversation room
    return () => {
      if (activeConversation && !activeConversation.isDraft && socketRef.current) {
        socketRef.current.emit('leave_chat', activeConversation._id);
      }
    };
  }, [activeConversation]);

  const handleGroupUpdated = (updatedConvo) => {
    setActiveConversation(updatedConvo);
    setConversations(prev => prev.map(c => c._id === updatedConvo._id ? updatedConvo : c));
  };

  const handleGroupDeleted = (groupId) => {
    if (activeConversation && activeConversation._id === groupId) {
      setActiveConversation(null);
    }
    setConversations(prev => prev.filter(c => c._id !== groupId));
  };

  const handleSendMessage = async (text, replyTo = null) => {
    if (!socketRef.current || !activeConversation || !currentUser) return;

    let conversationId = activeConversation._id;
    let targetConvo = activeConversation;

    // Intercept draft conversation creation on first message send
    if (activeConversation.isDraft) {
      const otherParticipant = activeConversation.participants.find(p => p && p._id !== currentUser.id);
      if (!otherParticipant) return;

      try {
        const realConvo = await chatAPI.getOrCreatePrivateChat(otherParticipant._id);
        conversationId = realConvo._id;
        targetConvo = realConvo;

        // Add real conversation to the local conversations state feed
        setConversations(prev => {
          const exists = prev.some(c => c._id === realConvo._id);
          if (exists) return prev;
          return [realConvo, ...prev];
        });

        // Set the active conversation to the real one
        setActiveConversation(realConvo);
      } catch (err) {
        console.error('Failed to create conversation for draft:', err);
        alert('Could not start conversation: ' + err);
        return;
      }
    }

    const isGroup = targetConvo.isGroup;
    const receiver = isGroup
      ? null
      : targetConvo.participants.find(p => p && p._id !== currentUser.id);

    // Emit send_message event
    socketRef.current.emit('send_message', {
      conversationId,
      senderId: currentUser.id,
      text,
      receiverId: receiver ? receiver._id : null,
      isGroup,
      replyTo
    });
  };

  const handleTyping = (isTyping) => {
    if (!socketRef.current || !activeConversation || !currentUser) return;

    socketRef.current.emit('typing', {
      conversationId: activeConversation._id,
      userId: currentUser.id,
      isTyping,
      userName: `${currentUser.firstName} ${currentUser.lastName}`
    });
  };

  const handleLogout = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleNewConversationCreated = (convo) => {
    setConversations(prev => {
      const exists = prev.some(c => c._id === convo._id);
      if (exists) return prev;
      return [convo, ...prev];
    });
  };

  // Mock settings save helper
  const handleSaveSettings = (e) => {
    e.preventDefault();
    setShowSettingsSaved(true);
    setTimeout(() => setShowSettingsSaved(false), 3000);
  };

  return (
    <div className="chat-layout-wrapper">
      {/* 1. Sidebar Nav */}
      <SideBar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          // Auto close active chat on tab switch to go back to overview on mobile
          if (tab !== 'chats') setActiveConversation(null);
        }}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* 2. Middle Panel: Chats, Groups overview OR Settings details */}
      {activeTab === 'chats' && (
        <RecentChats
          conversations={conversations}
          activeConversation={activeConversation}
          setActiveConversation={setActiveConversation}
          currentUser={currentUser}
          onlineUsers={onlineUsers}
          onNewConversationCreated={handleNewConversationCreated}
        />
      )}

      {activeTab === 'groups' && (
        <RecentChats
          conversations={conversations.filter(c => c.isGroup)}
          activeConversation={activeConversation}
          setActiveConversation={setActiveConversation}
          currentUser={currentUser}
          onlineUsers={onlineUsers}
          onNewConversationCreated={handleNewConversationCreated}
        />
      )}

      {activeTab === 'settings' && (
        <div className="settings-panel">
          <div className="settings-header">
            <h2>Settings</h2>
          </div>
          
          <div className="settings-scroll-area">
            <div className="glass-container settings-card">
              <div className="settings-profile-preview">
                <div className="settings-avatar">
                  {currentUser?.firstName?.[0]}{currentUser?.lastName?.[0]}
                </div>
                <h3>{currentUser?.firstName} {currentUser?.lastName}</h3>
                <p>{currentUser?.email}</p>
              </div>

              {showSettingsSaved && (
                <div className="alert-toast success">Profile settings saved successfully!</div>
              )}

              <form onSubmit={handleSaveSettings} className="settings-form">
                <div className="form-group">
                  <label className="form-label" htmlFor="settings-status">Status Message</label>
                  <input
                    type="text"
                    id="settings-status"
                    className="form-input"
                    defaultValue="Hey there! I am using ChitChat."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="settings-phone">Verified Mobile</label>
                  <input
                    type="text"
                    id="settings-phone"
                    className="form-input"
                    value={currentUser?.mobileNumber || ''}
                    disabled
                  />
                </div>

                <div className="form-group toggle-group">
                  <span className="form-label">Show Online Status</span>
                  <label className="toggle-switch">
                    <input type="checkbox" defaultChecked />
                    <span className="slider round"></span>
                  </label>
                </div>

                <button type="submit" className="btn-submit">
                  Save Changes
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 3. Right Panel: Active Chat viewport */}
      <div className={`chat-conversation-viewport ${activeConversation ? 'active' : ''}`}>
        <Chatting
          activeConversation={activeConversation}
          messages={messages}
          onSendMessage={handleSendMessage}
          currentUser={currentUser}
          typingStatus={typingStatus}
          onTyping={handleTyping}
          onBack={() => setActiveConversation(null)} // Click back to close chat on mobile
          onToggleInfo={() => setShowGroupInfo(prev => !prev)}
        />
        {activeConversation && showGroupInfo && (
          <GroupInfo
            conversation={activeConversation}
            currentUser={currentUser}
            onClose={() => setShowGroupInfo(false)}
            onGroupUpdated={handleGroupUpdated}
            onGroupDeleted={handleGroupDeleted}
            onlineUsers={onlineUsers}
            setActiveConversation={setActiveConversation}
          />
        )}
      </div>
    </div>
  );
}

export default Chat;
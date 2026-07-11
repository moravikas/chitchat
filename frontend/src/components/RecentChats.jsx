import React, { useState, useEffect } from 'react';
import { chatAPI } from '../services/API';
import '../styles/RecentChats.css';

function RecentChats({
  conversations,
  activeConversation,
  setActiveConversation,
  currentUser,
  onlineUsers,
  onNewConversationCreated
}) {
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'favourites'
  const [searchQuery, setSearchQuery] = useState(''); // Unified search query
  
  // Unified Search States
  const [globalSearchResults, setGlobalSearchResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  // Group Modal States
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState([]);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
  const [groupDescription, setGroupDescription] = useState('');
  
  // Track favourited conversations
  const [favourites, setFavourites] = useState(() => {
    const saved = localStorage.getItem('favourite_chats');
    return saved ? JSON.parse(saved) : [];
  });

  // Debounced search for global users (Unified Search)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setGlobalSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const users = await chatAPI.searchUsers(searchQuery);
        setGlobalSearchResults(users);
      } catch (err) {
        console.error('Global user search failed:', err);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 350); // Debounce duration: 350ms

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Debounced search for group members
  useEffect(() => {
    if (!groupSearchQuery.trim()) {
      setGroupSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const users = await chatAPI.searchUsers(groupSearchQuery);
        setGroupSearchResults(users);
      } catch (err) {
        console.error(err);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [groupSearchQuery]);

  const toggleFavourite = (convoId, e) => {
    e.stopPropagation();
    const updated = favourites.includes(convoId)
      ? favourites.filter(id => id !== convoId)
      : [...favourites, convoId];
    
    setFavourites(updated);
    localStorage.setItem('favourite_chats', JSON.stringify(updated));
  };

  const handleSelectNewContact = (user) => {
    // Construct a temporary draft conversation
    const draftConvo = {
      _id: `draft-${user._id}`,
      isGroup: false,
      participants: [
        { _id: currentUser?.id, firstName: currentUser?.firstName, lastName: currentUser?.lastName, email: currentUser?.email },
        user
      ],
      isDraft: true,
      unreadCount: 0,
      updatedAt: new Date().toISOString()
    };
    
    setActiveConversation(draftConvo);
    setSearchQuery(''); // Reset search to display normal chat list
  };

  const toggleGroupMemberSelection = (userId) => {
    if (selectedGroupMembers.includes(userId)) {
      setSelectedGroupMembers(selectedGroupMembers.filter(id => id !== userId));
    } else {
      setSelectedGroupMembers([...selectedGroupMembers, userId]);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) return alert('Please enter a group name');
    if (selectedGroupMembers.length === 0) return alert('Select at least one member');

    try {
      const groupConvo = await chatAPI.createGroupChat(groupName, selectedGroupMembers, groupDescription);
      setActiveConversation(groupConvo);
      setGroupName('');
      setGroupDescription('');
      setSelectedGroupMembers([]);
      setGroupSearchQuery('');
      setShowGroupModal(false);
      if (onNewConversationCreated) {
        onNewConversationCreated(groupConvo);
      }
    } catch (err) {
      alert('Failed to create group: ' + err);
    }
  };

  const getChatName = (convo) => {
    if (convo.isGroup) return convo.groupName;
    const otherParticipant = convo.participants.find(p => p && p._id !== currentUser?.id);
    return otherParticipant
      ? `${otherParticipant.firstName} ${otherParticipant.lastName}`
      : 'ChitChat User';
  };

  const getChatAvatar = (convo) => {
    if (convo.isGroup) {
      return convo.groupAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(convo.groupName)}&background=6366f1&color=fff`;
    }
    const otherParticipant = convo.participants.find(p => p && p._id !== currentUser?.id);
    const name = otherParticipant ? `${otherParticipant.firstName} ${otherParticipant.lastName}` : 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3b82f6&color=fff`;
  };

  const isUserOnline = (convo) => {
    if (convo.isGroup) return false;
    const otherParticipant = convo.participants.find(p => p && p._id !== currentUser?.id);
    return otherParticipant ? onlineUsers.includes(otherParticipant._id) : false;
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Build a Set of user IDs we already have active conversations with (to exclude from "New Contacts")
  const existingParticipantIds = new Set(
    conversations
      .filter(c => !c.isGroup)
      .map(c => {
        const other = c.participants.find(p => p && p._id !== currentUser?.id);
        return other ? other._id : null;
      })
      .filter(id => id !== null)
  );

  // Filter local chats based on query
  const localChatResults = conversations.filter(convo => {
    const chatName = getChatName(convo).toLowerCase();
    const lastMsgText = convo.lastMessage?.text?.toLowerCase() || '';
    const query = searchQuery.toLowerCase();
    
    return chatName.includes(query) || lastMsgText.includes(query);
  });

  // Filter global search results to exclude active contacts
  const newContactResults = globalSearchResults.filter(
    user => !existingParticipantIds.has(user._id)
  );

  // Standard filter applied when search is NOT active
  const filteredConversations = conversations.filter(convo => {
    if (filter === 'unread') {
      return convo.unreadCount > 0;
    }
    if (filter === 'favourites') {
      return favourites.includes(convo._id);
    }
    return true;
  });

  const renderConvoItem = (convo) => {
    const isActive = activeConversation && activeConversation._id === convo._id;
    const isFav = favourites.includes(convo._id);
    const isOnline = isUserOnline(convo);

    return (
      <div
        key={convo._id}
        className={`convo-thread-item ${isActive ? 'active' : ''}`}
        onClick={() => setActiveConversation(convo)}
      >
        <div className="convo-avatar-wrapper">
          <img
            src={getChatAvatar(convo)}
            alt={getChatName(convo)}
            className="convo-avatar"
          />
          {isOnline && <div className="convo-online-indicator"></div>}
        </div>

        <div className="convo-details">
          <div className="convo-details-top">
            <span className="convo-name">{getChatName(convo)}</span>
            <span className="convo-time">{formatTime(convo.updatedAt)}</span>
          </div>

          <div className="convo-details-bottom">
            <span className="convo-last-msg">
              {convo.lastMessage && convo.lastMessage.sender ? (
                <>
                  <strong className="last-msg-sender">
                    {((s) => s ? (typeof s === 'string' ? s : (s._id || s.id)) : null)(convo.lastMessage.sender) === (currentUser?.id || currentUser?._id) ? 'You: ' : `${convo.lastMessage.sender.firstName}: `}
                  </strong>
                  {convo.lastMessage.text}
                </>
              ) : convo.lastMessage ? (
                <>
                  <strong className="last-msg-sender">User: </strong>
                  {convo.lastMessage.text}
                </>
              ) : (
                <span className="empty-chat-text">No messages yet</span>
              )}
            </span>

            <div className="convo-meta-indicators">
              <button
                className={`fav-star-action-btn ${isFav ? 'starred' : ''}`}
                onClick={(e) => toggleFavourite(convo._id, e)}
                title={isFav ? "Remove from Favourites" : "Mark as Favourite"}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill={isFav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
              </button>

              {convo.unreadCount > 0 && (
                <span className="convo-unread-badge">{convo.unreadCount}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="recent-chats-panel">
      {/* Top Header */}
      <div className="chats-header">
        <h2>Chats</h2>
        <div className="header-actions">
          {/* New Group Button */}
          <button className="icon-action-btn" onClick={() => setShowGroupModal(true)} title="New Group">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <line x1="19" y1="8" x2="19" y2="14"></line>
              <line x1="16" y1="11" x2="22" y2="11"></line>
            </svg>
          </button>
          
          <button className="icon-action-btn" title="More Options">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="12" cy="5" r="1"></circle>
              <circle cx="12" cy="19" r="1"></circle>
            </svg>
          </button>
        </div>
      </div>

      {/* Unified Search Input (WhatsApp Style) */}
      <div className="search-bar-wrapper">
        <div className="search-input-container">
          <svg className="search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Search chats or new contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Render Lists */}
      {searchQuery.trim() === '' ? (
        <>
          {/* Filter Tabs - Only visible when not searching */}
          <div className="filter-tabs-wrapper">
            <button
              className={`filter-tab-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={`filter-tab-btn ${filter === 'unread' ? 'active' : ''}`}
              onClick={() => setFilter('unread')}
            >
              Unread {conversations.filter(c => c.unreadCount > 0).length > 0 && <span className="tab-badge"></span>}
            </button>
            <button
              className={`filter-tab-btn ${filter === 'favourites' ? 'active' : ''}`}
              onClick={() => setFilter('favourites')}
            >
              Favourites
            </button>
          </div>

          {/* Standard Chat List */}
          <div className="conversations-scroll-area">
            {filteredConversations.length === 0 ? (
              <div className="no-chats-placeholder">
                <p>No chats found</p>
                <span>Type in the search bar to find contacts or start a conversation.</span>
              </div>
            ) : (
              filteredConversations.map(renderConvoItem)
            )}
          </div>
        </>
      ) : (
        /* Unified Search Mode List */
        <div className="conversations-scroll-area search-results-scroll-area">
          {/* Section 1: Chats (Local matches) */}
          {localChatResults.length > 0 && (
            <div className="search-section">
              <div className="search-section-title">Chats</div>
              <div className="search-section-items">
                {localChatResults.map(renderConvoItem)}
              </div>
            </div>
          )}

          {/* Section 2: New Contacts (Global matches) */}
          {(newContactResults.length > 0 || isSearchingUsers) && (
            <div className="search-section">
              <div className="search-section-title">
                New Contacts
                {isSearchingUsers && <span className="section-loading-spinner"></span>}
              </div>
              <div className="search-section-items">
                {newContactResults.map(user => (
                  <div
                    key={user._id}
                    className="convo-thread-item contact-result-item"
                    onClick={() => handleSelectNewContact(user)}
                  >
                    <div className="convo-avatar-wrapper">
                      <div className="convo-avatar contact-text-avatar" style={{ background: '#6366f1' }}>
                        {user.firstName[0].toUpperCase()}{user.lastName[0].toUpperCase()}
                      </div>
                    </div>
                    <div className="convo-details">
                      <div className="convo-details-top">
                        <span className="convo-name">{user.firstName} {user.lastName}</span>
                      </div>
                      <div className="convo-details-bottom">
                        <span className="convo-last-msg">{user.email || user.mobileNumber}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty search results state */}
          {localChatResults.length === 0 && newContactResults.length === 0 && !isSearchingUsers && (
            <div className="no-chats-placeholder">
              <p>No chats or users found</p>
              <span>Try checking the spelling or search by phone/email.</span>
            </div>
          )}
        </div>
      )}

      {/* New Group Modal Overlay */}
      {showGroupModal && (
        <div className="group-modal-overlay">
          <div className="glass-container group-modal-card">
            <div className="modal-header">
              <h3>Create Group Chat</h3>
              <button className="close-modal-btn" onClick={() => {
                setShowGroupModal(false);
                setSelectedGroupMembers([]);
                setGroupName('');
                setGroupDescription('');
                setGroupSearchQuery('');
              }}>&times;</button>
            </div>
            
            <form onSubmit={handleCreateGroup}>
              <div className="form-group">
                <label className="form-label" htmlFor="groupName">Group Name</label>
                <input
                  type="text"
                  id="groupName"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="form-input"
                  placeholder="e.g. Project ChitChat"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="groupDescription">Group Description (Optional)</label>
                <input
                  type="text"
                  id="groupDescription"
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  className="form-input"
                  placeholder="e.g. Discussing project details"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Add Members</label>
                <div className="search-input-container">
                  <input
                    type="text"
                    value={groupSearchQuery}
                    onChange={(e) => setGroupSearchQuery(e.target.value)}
                    className="form-input search-input"
                    placeholder="Search users by name/email..."
                  />
                </div>
              </div>

              {/* Members Selection List */}
              <div className="members-select-container">
                {groupSearchQuery ? (
                  groupSearchResults.length > 0 ? (
                    groupSearchResults.map(user => {
                      const isChecked = selectedGroupMembers.includes(user._id);
                      return (
                        <div
                          key={user._id}
                          className={`member-select-item ${isChecked ? 'selected' : ''}`}
                          onClick={() => toggleGroupMemberSelection(user._id)}
                        >
                          <div className="member-avatar">
                            {user.firstName[0].toUpperCase()}
                          </div>
                          <div className="member-info">
                            <span>{user.firstName} {user.lastName}</span>
                            <span className="member-email">{user.email}</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // Selection handled by card click
                            className="member-checkbox"
                          />
                        </div>
                      );
                    })
                  ) : (
                    <p className="no-members-searched">No users found</p>
                  )
                ) : (
                  conversations
                    .filter(c => !c.isGroup)
                    .map(c => c.participants.find(p => p && p._id !== currentUser?.id))
                    .filter(Boolean).length > 0 ? (
                    conversations
                      .filter(c => !c.isGroup)
                      .map(c => c.participants.find(p => p && p._id !== currentUser?.id))
                      .filter(Boolean)
                      .map(user => {
                        const isChecked = selectedGroupMembers.includes(user._id);
                        return (
                          <div
                            key={user._id}
                            className={`member-select-item ${isChecked ? 'selected' : ''}`}
                            onClick={() => toggleGroupMemberSelection(user._id)}
                          >
                            <div className="member-avatar">
                              {user.firstName[0].toUpperCase()}
                            </div>
                            <div className="member-info">
                              <span>{user.firstName} {user.lastName}</span>
                              <span className="member-email">{user.email}</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // Selection handled by card click
                              className="member-checkbox"
                            />
                          </div>
                        );
                      })
                  ) : (
                    <p className="no-members-searched">Type to search and add participants</p>
                  )
                )}
              </div>

              {selectedGroupMembers.length > 0 && (
                <div className="selected-members-bar">
                  Selected: {selectedGroupMembers.length} participant(s)
                </div>
              )}

              <button type="submit" className="btn-submit" disabled={!groupName.trim() || selectedGroupMembers.length === 0}>
                Create Group
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default RecentChats;

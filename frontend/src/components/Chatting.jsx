import React, { useState, useEffect, useRef } from 'react';
import '../styles/Chatting.css';

function Chatting({
  activeConversation,
  messages,
  onSendMessage,
  currentUser,
  typingStatus,
  onTyping,
  onBack, // Used for responsive layout to go back to chats list on mobile
  onToggleInfo // Toggle group details panel
}) {
  const [inputText, setInputText] = useState('');
  const [replyingToMessage, setReplyingToMessage] = useState(null);
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Scroll to bottom whenever messages or activeConversation changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeConversation]);

  // Reset reply state if active conversation changes
  useEffect(() => {
    setReplyingToMessage(null);
  }, [activeConversation]);

  // Handle typing triggers
  const handleTextChange = (e) => {
    setInputText(e.target.value);

    // Emit typing status
    onTyping(true);

    // Clear previous timeout and set new timeout to stop typing status
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 1500);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    let replyToPayload = null;
    if (replyingToMessage) {
      const name = replyingToMessage.sender && typeof replyingToMessage.sender !== 'string'
        ? `${replyingToMessage.sender.firstName} ${replyingToMessage.sender.lastName}`
        : 'User';
      replyToPayload = {
        messageId: replyingToMessage._id,
        senderName: name,
        text: replyingToMessage.text
      };
    }

    onSendMessage(inputText.trim(), replyToPayload);
    setInputText('');
    setReplyingToMessage(null);
    
    // Stop typing status instantly
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    onTyping(false);
  };

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const getChatName = () => {
    if (!activeConversation) return '';
    if (activeConversation.isGroup) return activeConversation.groupName;
    const otherParticipant = activeConversation.participants.find(p => p && p._id !== currentUser?.id);
    return otherParticipant
      ? `${otherParticipant.firstName} ${otherParticipant.lastName}`
      : 'ChitChat User';
  };

  const getChatAvatar = () => {
    if (!activeConversation) return '';
    if (activeConversation.isGroup) {
      return activeConversation.groupAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeConversation.groupName)}&background=6366f1&color=fff&size=128`;
    }
    const otherParticipant = activeConversation.participants.find(p => p && p._id !== currentUser?.id);
    const name = otherParticipant ? `${otherParticipant.firstName} ${otherParticipant.lastName}` : 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3b82f6&color=fff`;
  };

  const formatMessageTime = (timeStr) => {
    const date = new Date(timeStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get active typing string
  const getTypingString = () => {
    if (!activeConversation) return null;
    const typingList = typingStatus[activeConversation._id];
    if (!typingList || typingList.length === 0) return null;

    if (activeConversation.isGroup) {
      if (typingList.length === 1) return `${typingList[0]} is typing...`;
      if (typingList.length === 2) return `${typingList[0]} and ${typingList[1]} are typing...`;
      return 'Multiple people are typing...';
    } else {
      return 'typing...';
    }
  };

  const scrollToOriginalMessage = (messageId) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Brief highlight animation trigger
      element.classList.add('highlighted-reply-target');
      setTimeout(() => {
        element.classList.remove('highlighted-reply-target');
      }, 1500);
    }
  };

  // Check if only admins can broadcast
  const isMessageBarLocked = activeConversation?.isGroup && 
    activeConversation.onlyAdminsCanMessage && 
    !activeConversation.admins?.some(admin => 
      (admin._id || admin) === currentUser?.id
    );

  // If no chat is active, show the default empty state
  if (!activeConversation) {
    return (
      <div className="chatting-panel empty-state">
        <div className="empty-state-content">
          <div className="branding-icon-wrapper">
            <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <h1>ChitChat Web</h1>
          <p>Send and receive messages in real-time. Keep your phone connected to the network.</p>
          <div className="encryption-disclaimer">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <span>End-to-end encrypted</span>
          </div>
        </div>
      </div>
    );
  }

  const activeTypingText = getTypingString();

  return (
    <div className="chatting-panel">
      {/* Header */}
      <header className="chatting-header">
        <div className="header-left">
          {/* Back button for mobile viewports */}
          <button className="mobile-back-btn" onClick={onBack} title="Back to Chats">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          
          <img
            src={getChatAvatar()}
            alt={getChatName()}
            className="chat-header-avatar"
            style={{ cursor: activeConversation.isGroup ? 'pointer' : 'default' }}
            onClick={activeConversation.isGroup ? onToggleInfo : undefined}
          />
          <div 
            className="chat-header-info" 
            style={{ cursor: activeConversation.isGroup ? 'pointer' : 'default' }}
            onClick={activeConversation.isGroup ? onToggleInfo : undefined}
          >
            <h3>{getChatName()}</h3>
            <span className="chat-status-subtext">
              {activeTypingText || (activeConversation.isGroup ? `${activeConversation.participants?.length || 0} participants` : 'Online')}
            </span>
          </div>
        </div>

        <div className="header-right">
          {activeConversation.isGroup && (
            <button className="icon-action-btn" onClick={onToggleInfo} title="Group Info">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            </button>
          )}
          <button className="icon-action-btn" title="Start Voice Call">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.1-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
            </svg>
          </button>
          <button className="icon-action-btn" title="Start Video Call">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7"></polygon>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
          </button>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="first-message-placeholder">
            <p>No messages here yet.</p>
            <span>Type a message below to start the conversation!</span>
          </div>
        ) : (
          messages.map((msg, index) => {
            // Render centered system notification messages differently
            if (msg.isSystem) {
              return (
                <div key={msg._id || index} className="system-message-row">
                  <span className="system-message-text">{msg.text}</span>
                </div>
              );
            }

            const getSenderId = (m) => {
              if (!m) return null;
              if (m.senderId) return m.senderId;
              if (m.userId) return m.userId;
              const s = m.sender;
              if (!s) return null;
              if (typeof s === 'string') return s;
              return s._id || s.id;
            };
            const getCurrentUserId = (u) => u ? (u.id || u._id) : null;
            const isMe = getSenderId(msg) === getCurrentUserId(currentUser);
            const senderName = msg.sender && typeof msg.sender !== 'string'
              ? `${msg.sender.firstName} ${msg.sender.lastName}`
              : 'User';
            
            return (
              <div
                key={msg._id || index}
                id={`msg-${msg._id}`}
                className={`message-bubble-wrapper ${isMe ? 'outgoing' : 'incoming'}`}
              >
                <div className="message-bubble">
                  {/* Hover Actions: Reply Button */}
                  <button 
                    className="message-reply-btn"
                    onClick={() => setReplyingToMessage(msg)}
                    title="Reply"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 17 4 12 9 7"></polyline>
                      <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
                    </svg>
                  </button>

                  {/* Sender Name in Group Chats */}
                  {activeConversation.isGroup && !isMe && (
                    <div className="group-message-sender-name">
                      {senderName}
                    </div>
                  )}

                  {/* Quoted Reply Reference Box */}
                  {msg.replyTo && (
                    <div 
                      className="nested-reply-preview-box"
                      onClick={() => scrollToOriginalMessage(msg.replyTo.messageId)}
                      title="Click to view original message"
                    >
                      <div className="reply-preview-sender">{msg.replyTo.senderName}</div>
                      <div className="reply-preview-text">{msg.replyTo.text}</div>
                    </div>
                  )}
                  
                  <div className="message-text">{msg.text}</div>
                  
                  <div className="message-time-meta">
                    {formatMessageTime(msg.createdAt)}
                    {isMe && (
                      <span className="read-receipt-ticks">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Preview Bar above input box */}
      {replyingToMessage && (
        <div className="reply-preview-bar">
          <div className="reply-preview-indicator"></div>
          <div className="reply-preview-details">
            <span className="reply-preview-name">
              {replyingToMessage.sender && typeof replyingToMessage.sender !== 'string'
                ? `${replyingToMessage.sender.firstName} ${replyingToMessage.sender.lastName}`
                : 'User'}
            </span>
            <span className="reply-preview-snippet">{replyingToMessage.text}</span>
          </div>
          <button className="reply-preview-close" onClick={() => setReplyingToMessage(null)} title="Cancel Reply">
            &times;
          </button>
        </div>
      )}

      {/* Footer Input Area */}
      <footer className="chatting-footer">
        {isMessageBarLocked ? (
          <div className="only-admins-message-banner">
            Only admins can send messages
          </div>
        ) : (
          <>
            <div className="footer-actions-left">
              <button className="icon-action-btn" title="Add Attachment">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                </svg>
              </button>
              
              <button className="icon-action-btn" title="Add Emoji">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                  <line x1="9" y1="9" x2="9.01" y2="9"></line>
                  <line x1="15" y1="9" x2="15.01" y2="9"></line>
                </svg>
              </button>
            </div>

            <form className="message-form" onSubmit={handleFormSubmit}>
              <input
                type="text"
                className="message-input"
                placeholder="Type a message..."
                value={inputText}
                onChange={handleTextChange}
              />
              <button type="submit" className="send-message-btn" disabled={!inputText.trim()}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </form>
          </>
        )}
      </footer>
    </div>
  );
}

export default Chatting;

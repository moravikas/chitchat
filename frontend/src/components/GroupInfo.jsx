import React, { useState, useEffect } from 'react';
import { chatAPI } from '../services/API';
import '../styles/GroupInfo.css';

function GroupInfo({
  conversation,
  currentUser,
  onClose,
  onGroupUpdated,
  onGroupDeleted,
  onlineUsers,
  setActiveConversation
}) {
  const [group, setGroup] = useState(conversation);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(group.groupName || '');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [newDesc, setNewDesc] = useState(group.groupDescription || '');
  
  // Settings toggle
  const [onlyAdminsCanMessage, setOnlyAdminsCanMessage] = useState(group.onlyAdminsCanMessage || false);

  // Invite modal states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');
  const [inviteSearchResults, setInviteSearchResults] = useState([]);
  const [selectedInviteIds, setSelectedInviteIds] = useState([]);

  // Check if current user is admin
  const isAdmin = group.admins?.some(adminId => 
    (adminId._id || adminId) === currentUser?.id
  ) || false;

  useEffect(() => {
    setGroup(conversation);
    setNewName(conversation.groupName || '');
    setNewDesc(conversation.groupDescription || '');
    setOnlyAdminsCanMessage(conversation.onlyAdminsCanMessage || false);
  }, [conversation]);

  // Debounced search for invite list
  useEffect(() => {
    if (!inviteSearchQuery.trim()) {
      setInviteSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const users = await chatAPI.searchUsers(inviteSearchQuery);
        // Exclude users who are already in the group
        const groupMemberIds = new Set(group.participants.map(p => p._id || p));
        const cleanResults = users.filter(u => !groupMemberIds.has(u._id));
        setInviteSearchResults(cleanResults);
      } catch (err) {
        console.error('Invite search failed:', err);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [inviteSearchQuery, group.participants]);

  const handleUpdateName = async () => {
    if (!newName.trim() || newName.trim() === group.groupName) {
      setIsEditingName(false);
      return;
    }
    try {
      const updated = await chatAPI.updateGroupMeta(group._id, { groupName: newName.trim() });
      setGroup(updated);
      setIsEditingName(false);
      if (onGroupUpdated) onGroupUpdated(updated);
    } catch (err) {
      alert('Failed to update group name: ' + err);
    }
  };

  const handleUpdateDescription = async () => {
    if (newDesc.trim() === group.groupDescription) {
      setIsEditingDesc(false);
      return;
    }
    try {
      const updated = await chatAPI.updateGroupMeta(group._id, { groupDescription: newDesc.trim() });
      setGroup(updated);
      setIsEditingDesc(false);
      if (onGroupUpdated) onGroupUpdated(updated);
    } catch (err) {
      alert('Failed to update group description: ' + err);
    }
  };

  const handleToggleMessageSetting = async (checked) => {
    try {
      setOnlyAdminsCanMessage(checked);
      const updated = await chatAPI.updateGroupMeta(group._id, { onlyAdminsCanMessage: checked });
      setGroup(updated);
      if (onGroupUpdated) onGroupUpdated(updated);
    } catch (err) {
      alert('Failed to toggle settings: ' + err);
      setOnlyAdminsCanMessage(!checked); // Revert
    }
  };

  const handleInviteMembers = async () => {
    if (selectedInviteIds.length === 0) return;
    try {
      const updated = await chatAPI.addGroupMembers(group._id, selectedInviteIds);
      setGroup(updated);
      setSelectedInviteIds([]);
      setInviteSearchQuery('');
      setShowInviteModal(false);
      if (onGroupUpdated) onGroupUpdated(updated);
    } catch (err) {
      alert('Failed to add members: ' + err);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Are you sure you want to remove this participant?')) return;
    try {
      const updated = await chatAPI.removeGroupMember(group._id, userId);
      setGroup(updated);
      if (onGroupUpdated) onGroupUpdated(updated);
    } catch (err) {
      alert('Failed to remove member: ' + err);
    }
  };

  const handleChangeRole = async (userId, makeAdmin) => {
    const actionText = makeAdmin ? 'promote this user to Admin?' : 'dismiss this admin as Member?';
    if (!window.confirm(`Are you sure you want to ${actionText}`)) return;
    try {
      const updated = await chatAPI.changeGroupAdminRole(group._id, userId, makeAdmin);
      setGroup(updated);
      if (onGroupUpdated) onGroupUpdated(updated);
    } catch (err) {
      alert('Failed to update permissions: ' + err);
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm('Are you sure you want to leave this group?')) return;
    try {
      await chatAPI.leaveGroup(group._id);
      if (onGroupDeleted) onGroupDeleted(group._id);
      onClose();
    } catch (err) {
      alert('Failed to leave group: ' + err);
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm('WARNING: Are you sure you want to permanently delete this group? All message history will be lost.')) return;
    try {
      await chatAPI.deleteGroup(group._id);
      if (onGroupDeleted) onGroupDeleted(group._id);
      onClose();
    } catch (err) {
      alert('Failed to delete group: ' + err);
    }
  };

  const handleSelectPrivateChat = async (user) => {
    try {
      const convo = await chatAPI.getOrCreatePrivateChat(user._id);
      setActiveConversation(convo);
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleInviteSelection = (userId) => {
    setSelectedInviteIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const getMemberName = (user) => {
    return `${user.firstName} ${user.lastName}`;
  };

  const getMemberInitials = (user) => {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  };

  const isMemberAdmin = (user) => {
    return group.admins?.some(admin => 
      (admin._id || admin) === user._id
    );
  };

  const isOnline = (user) => {
    return onlineUsers?.includes(user._id);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="group-info-panel-slide">
      <div className="group-info-header">
        <button className="close-panel-btn" onClick={onClose} title="Close Panel">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <h3>Group Info</h3>
      </div>

      <div className="group-info-scroll-area">
        {/* 1. Group Identity Banner */}
        <div className="group-identity-section">
          <img
            src={group.groupAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(group.groupName)}&background=6366f1&color=fff&size=128`}
            alt={group.groupName}
            className="group-info-avatar"
          />
          
          <div className="group-name-editing-wrapper">
            {isEditingName ? (
              <div className="inline-edit-form">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="inline-edit-input"
                  autoFocus
                />
                <button className="edit-action-btn check" onClick={() => setIsEditingName(false)}>✕</button>
                <button className="edit-action-btn check" onClick={handleUpdateName} style={{ color: '#10b981' }}>✓</button>
              </div>
            ) : (
              <div className="inline-display-name">
                <h2>{group.groupName}</h2>
                {isAdmin && (
                  <button className="edit-pencil-btn" onClick={() => setIsEditingName(true)} title="Edit Name">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
          <span className="group-participants-count">Group • {group.participants?.length} participants</span>
        </div>

        {/* 2. Group Description */}
        <div className="group-details-card">
          <div className="card-header">
            <h4>Description</h4>
            {isAdmin && !isEditingDesc && (
              <button className="edit-pencil-btn" onClick={() => setIsEditingDesc(true)} title="Edit Description">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
            )}
          </div>
          
          {isEditingDesc ? (
            <div className="desc-edit-area">
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="desc-edit-textarea"
                placeholder="Add group description..."
                rows="3"
                autoFocus
              />
              <div className="desc-edit-actions">
                <button className="btn-cancel-small" onClick={() => setIsEditingDesc(false)}>Cancel</button>
                <button className="btn-save-small" onClick={handleUpdateDescription}>Save</button>
              </div>
            </div>
          ) : (
            <p className="group-description-text">
              {group.groupDescription || <span className="empty-desc">No description added yet.</span>}
            </p>
          )}

          <div className="group-creation-meta">
            Created on {formatDate(group.createdAt || group.updatedAt)}
          </div>
        </div>

        {/* 3. Settings Toggles (Admins only) */}
        {isAdmin && (
          <div className="group-details-card">
            <h4>Group Settings</h4>
            <div className="setting-toggle-row">
              <div className="setting-label-block">
                <span>Send Messages</span>
                <p>Only admins can broadcast messages inside this group</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={onlyAdminsCanMessage}
                  onChange={(e) => handleToggleMessageSetting(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        )}

        {/* 4. Participant Directory list */}
        <div className="group-details-card participants-card">
          <div className="card-header" style={{ marginBottom: '0.75rem' }}>
            <h4>{group.participants?.length} Participants</h4>
            {isAdmin && (
              <button 
                className="add-participant-inline-btn" 
                onClick={() => setShowInviteModal(true)}
                title="Add Participants"
              >
                + Add Member
              </button>
            )}
          </div>

          <div className="participants-list-container">
            {group.participants?.map(user => {
              const userIsAdmin = isMemberAdmin(user);
              const userIsMe = user._id === currentUser?.id;
              const onlineStatus = isOnline(user);

              return (
                <div key={user._id} className="participant-row-item">
                  <div className="convo-avatar-wrapper">
                    <div className="convo-avatar contact-text-avatar" style={{ background: '#6366f1' }}>
                      {getMemberInitials(user)}
                    </div>
                    {onlineStatus && <div className="convo-online-indicator"></div>}
                  </div>

                  <div className="participant-info">
                    <div className="participant-name-block">
                      <span className="participant-name">
                        {getMemberName(user)} {userIsMe && <span className="me-badge">(You)</span>}
                      </span>
                      {userIsAdmin && <span className="admin-pill">Admin</span>}
                    </div>
                    <span className="participant-sub">{user.email}</span>
                  </div>

                  {/* Actions Dropdown */}
                  {!userIsMe && (
                    <div className="participant-action-trigger">
                      <button className="member-options-btn" title="Member Actions">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="1"></circle>
                          <circle cx="12" cy="5" r="1"></circle>
                          <circle cx="12" cy="19" r="1"></circle>
                        </svg>
                      </button>

                      <div className="member-actions-dropdown">
                        <button onClick={() => handleSelectPrivateChat(user)}>Message</button>
                        {isAdmin && (
                          <>
                            {userIsAdmin ? (
                              <button onClick={() => handleChangeRole(user._id, false)}>Dismiss as Admin</button>
                            ) : (
                              <button onClick={() => handleChangeRole(user._id, true)}>Make Admin</button>
                            )}
                            <button onClick={() => handleRemoveMember(user._id)} style={{ color: '#ef4444' }}>
                              Remove from Group
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 5. Danger Actions Area */}
        <div className="group-danger-actions-box">
          <button className="btn-danger-outline" onClick={handleLeaveGroup}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Exit Group
          </button>
          
          {isAdmin && (
            <button className="btn-danger-filled" onClick={handleDeleteGroup}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
              Delete Group
            </button>
          )}
        </div>
      </div>

      {/* Invite Member modal picker */}
      {showInviteModal && (
        <div className="group-modal-overlay invite-modal-box">
          <div className="glass-container group-modal-card">
            <div className="modal-header">
              <h3>Add Group Members</h3>
              <button className="close-modal-btn" onClick={() => {
                setShowInviteModal(false);
                setSelectedInviteIds([]);
                setInviteSearchQuery('');
              }}>&times;</button>
            </div>

            <div className="form-group">
              <div className="search-input-container">
                <input
                  type="text"
                  value={inviteSearchQuery}
                  onChange={(e) => setInviteSearchQuery(e.target.value)}
                  className="form-input search-input"
                  placeholder="Search contacts by name or email..."
                  autoFocus
                />
              </div>
            </div>

            <div className="members-select-container" style={{ maxHeight: '200px' }}>
              {inviteSearchResults.length > 0 ? (
                inviteSearchResults.map(user => {
                  const isChecked = selectedInviteIds.includes(user._id);
                  return (
                    <div
                      key={user._id}
                      className={`member-select-item ${isChecked ? 'selected' : ''}`}
                      onClick={() => toggleInviteSelection(user._id)}
                    >
                      <div className="member-avatar">
                        {getMemberInitials(user)}
                      </div>
                      <div className="member-info">
                        <span>{getMemberName(user)}</span>
                        <span className="member-email">{user.email}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="member-checkbox"
                      />
                    </div>
                  );
                })
              ) : (
                <p className="no-members-searched">
                  {inviteSearchQuery ? 'No contacts found' : 'Type to search registered contacts to add'}
                </p>
              )}
            </div>

            {selectedInviteIds.length > 0 && (
              <div className="selected-members-bar">
                Selected: {selectedInviteIds.length} contact(s)
              </div>
            )}

            <button 
              className="btn-submit" 
              onClick={handleInviteMembers}
              disabled={selectedInviteIds.length === 0}
              style={{ marginTop: '1rem' }}
            >
              Add Selected Members
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default GroupInfo;

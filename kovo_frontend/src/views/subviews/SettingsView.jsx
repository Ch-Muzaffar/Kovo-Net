import React, { useState, useRef } from 'react';
import { useAuth, useUI } from '../../context/AppContext';
import Icon from '../../components/Icon';
import { usersApi } from '../../api/users.js';
import { getAvatarGradient, getInitials } from '../../utils/helpers';

export default function SettingsView() {
  const { user, updateUser, deleteAccount } = useAuth();
  const { uploadFileToCloudinary, showToast } = useUI();

  // Settings form local state
  const [settingsForm, setSettingsForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    bio: user?.bio || '',
    department: user?.department || '',
    skills: (user?.skills || []).join(', ')
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef(null);

  // Notification Preferences local state
  const [notificationPrefs, setNotificationPrefs] = useState({
    emailComments: true,
    pushLikes: true,
    weeklyDigest: false
  });

  const togglePref = (key) => {
    setNotificationPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    setSettingsSaving(true);
    const skillsArray = settingsForm.skills.split(',').map(s => s.trim()).filter(Boolean);
    try {
      await usersApi.updateProfile({
        bio: settingsForm.bio,
        master_skills: skillsArray,
      });
      const demoUpdates = {};
      if (settingsForm.firstName && settingsForm.firstName !== user.firstName) demoUpdates.first_name = settingsForm.firstName;
      if (settingsForm.lastName && settingsForm.lastName !== user.lastName) demoUpdates.last_name = settingsForm.lastName;
      if (settingsForm.department && settingsForm.department !== user.department) demoUpdates.profession = settingsForm.department;
      if (Object.keys(demoUpdates).length > 0) {
        await usersApi.updateDemographics(demoUpdates);
      }
      updateUser({
        firstName: settingsForm.firstName,
        lastName: settingsForm.lastName,
        bio: settingsForm.bio,
        department: settingsForm.department,
        skills: skillsArray,
        profileComplete: true
      });
      showToast('Profile updated successfully!', 'success');
    } catch (err) {
      showToast('Failed to save profile: ' + (err.message || ''), 'error');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const ext = file.name.split('.').pop().toLowerCase();
    const allowedExts = ['png', 'jpg', 'jpeg', 'heic', 'heif'];
    const allowedMimes = ['image/png', 'image/jpeg', 'image/heic', 'image/heif'];
    let mimeType = file.type;
    
    if (!mimeType || mimeType === 'application/octet-stream') {
      if (ext === 'heic') mimeType = 'image/heic';
      else if (ext === 'heif') mimeType = 'image/heif';
    }
    
    if (!allowedMimes.includes(mimeType) && !allowedExts.includes(ext)) {
      showToast('Only PNG, JPG, JPEG, and HEIC (iPhone) images are allowed.', 'error');
      if (avatarInputRef.current) avatarInputRef.current.value = '';
      return;
    }
    
    setAvatarUploading(true);
    try {
      const uploaded = await uploadFileToCloudinary(file, file.name);
      await usersApi.updateProfile({ avatar_url: uploaded.url });
      updateUser({ avatar_url: uploaded.url });
      showToast('Profile picture updated successfully!', 'success');
    } catch (err) {
      showToast('Failed to upload profile picture: ' + (err.message || ''), 'error');
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  return (
    <div className="page-enter">
      <h2 className="font-display font-bold text-2xl text-[var(--text-primary)] mb-6">Settings</h2>
      <div className="space-y-6">
        {/* Profile Photo */}
        <div className="card p-6">
          <h3 className="font-display font-semibold text-[var(--text-primary)] mb-4">Profile Photo</h3>
          <div className="flex items-center gap-5">
            <div className="relative">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt="Your avatar"
                  style={{ width: '5rem', height: '5rem', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div className="avatar" style={{ background: getAvatarGradient(user?.username), width: '5rem', height: '5rem', fontSize: '1.5rem' }}>
                  {getInitials((user?.firstName || '') + ' ' + (user?.lastName || ''))}
                </div>
              )}
            </div>
            <div>
              <input
                ref={avatarInputRef}
                type="file"
                id="avatar-upload"
                className="hidden"
                accept="image/png,image/jpeg,.jpg,.jpeg,.png,.heic,.heif,image/heic,image/heif"
                onChange={handleAvatarUpload}
              />
              <button
                type="button"
                className="btn-gradient px-4 py-2 text-sm flex items-center gap-2"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
              >
                {avatarUploading ? (
                  <><div className="spinner-sm" style={{ width: '0.9rem', height: '0.9rem' }} /> Uploading...</>
                ) : (
                  <><Icon icon="lucide:upload" style={{ fontSize: '0.9rem' }} /> Upload Photo</>
                )}
              </button>
              <p className="text-xs text-[var(--text-muted)] mt-1.5">PNG, JPG, JPEG, HEIC (iPhone) · Max 10MB</p>
            </div>
          </div>
        </div>

        {/* Profile Info */}
        <div className="card p-6">
          <h3 className="font-display font-semibold text-[var(--text-primary)] mb-4">Profile Information</h3>
          <form onSubmit={handleSettingsSubmit} noValidate>
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">First Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={settingsForm.firstName}
                  onChange={e => setSettingsForm({ ...settingsForm, firstName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Last Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={settingsForm.lastName}
                  onChange={e => setSettingsForm({ ...settingsForm, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Bio</label>
              <textarea
                className="input-field"
                rows="3"
                placeholder="Tell us about yourself..."
                value={settingsForm.bio}
                onChange={e => setSettingsForm({ ...settingsForm, bio: e.target.value })}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Department / Profession</label>
                <input
                  type="text"
                  className="input-field"
                  value={settingsForm.department}
                  onChange={e => setSettingsForm({ ...settingsForm, department: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Skills (comma-separated)</label>
                <input
                  type="text"
                  className="input-field"
                  value={settingsForm.skills}
                  onChange={e => setSettingsForm({ ...settingsForm, skills: e.target.value })}
                />
              </div>
            </div>
            <button type="submit" className="btn-gradient px-6 py-2.5 text-sm flex items-center gap-2" disabled={settingsSaving}>
              {settingsSaving ? (<><div className="spinner-sm" style={{ width: '0.9rem', height: '0.9rem' }} /> Saving...</>) : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Notification Preferences */}
        <div className="card p-6">
          <h3 className="font-display font-semibold text-[var(--text-primary)] mb-4">Notifications</h3>
          <div className="space-y-4">
            {[
              { label: 'Email notifications for new comments', key: 'emailComments' },
              { label: 'Push notifications for likes', key: 'pushLikes' },
              { label: 'Weekly digest email', key: 'weeklyDigest' },
            ].map(pref => (
              <div key={pref.key} className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-secondary)]">{pref.label}</span>
                <button 
                  className={`toggle-track ${notificationPrefs[pref.key] ? 'active' : ''}`} 
                  onClick={() => togglePref(pref.key)}
                  role="switch" 
                  aria-checked={notificationPrefs[pref.key]} 
                >
                  <div className="toggle-thumb" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="card p-6 border-red-500/20">
          <h3 className="font-display font-semibold text-red-600 mb-2">Danger Zone</h3>
          <p className="text-sm text-[var(--text-muted)] mb-4">Permanently deactivate your account. This will hide your profile from the website, but your data is retained securely in the database.</p>
          <button 
            className="px-5 py-2.5 text-sm font-semibold border border-red-500/30 text-red-500 rounded-lg hover:bg-red-500/10 transition-colors" 
            onClick={() => {
              if (window.confirm('Are you absolutely sure you want to delete your account? This will log you out and deactivate your profile.')) {
                deleteAccount();
              }
            }}
          >
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();

  // Profile fields
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [university, setUniversity] = useState(user?.university || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [semester, setSemester] = useState(user?.semester || '');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // Password
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  // Avatar
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState('');
  const [avatarErr, setAvatarErr] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setBio(user.bio || '');
      setUniversity(user.university || '');
      setDepartment(user.department || '');
      setSemester(user.semester || '');
    }
  }, [user]);

  // Build avatar src — backend returns avatar as { filename, url, ... }
  const avatarSrc = avatarPreview
    ? avatarPreview
    : user?.avatar?.url
      ? `${BACKEND}${user.avatar.url}`
      : null;

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setAvatarErr('File too large. Max 2MB.'); return; }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarErr('');
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) return;
    setAvatarUploading(true); setAvatarMsg(''); setAvatarErr('');
    const formData = new FormData();
    formData.append('avatar', avatarFile);
    try {
      const res = await api.post('/profile/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      // Backend returns { success, data: { avatar: { filename, url, ... } } }
      updateUser({ avatar: res.data.data?.avatar });
      setAvatarMsg('Profile picture updated!');
      setAvatarFile(null);
      setAvatarPreview(null);
    } catch (err) {
      setAvatarErr(err.response?.data?.message || 'Upload failed.');
    } finally { setAvatarUploading(false); }
  };

  const handleRemoveAvatar = async () => {
    if (!window.confirm('Remove your profile picture?')) return;
    try {
      await api.delete('/profile/avatar');
      updateUser({ avatar: { filename: null, url: null, mimetype: null, size: null } });
      setAvatarPreview(null);
      setAvatarMsg('Avatar removed.');
    } catch (err) { setAvatarErr(err.response?.data?.message || 'Failed to remove.'); }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setProfileErr('Name cannot be empty.'); return; }
    setProfileSaving(true); setProfileMsg(''); setProfileErr('');
    try {
      const res = await api.put('/profile', { name, bio, university, department, semester: semester || null });
      updateUser(res.data.data);
      setProfileMsg('Profile updated successfully!');
    } catch (err) { setProfileErr(err.response?.data?.message || 'Failed to update.'); }
    finally { setProfileSaving(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) { setPwdErr('Passwords do not match.'); return; }
    if (newPwd.length < 6) { setPwdErr('New password must be at least 6 characters.'); return; }
    setPwdSaving(true); setPwdMsg(''); setPwdErr('');
    try {
      await api.put('/profile/password', { currentPassword: oldPwd, newPassword: newPwd });
      setPwdMsg('Password changed successfully!');
      setOldPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (err) { setPwdErr(err.response?.data?.message || 'Failed to change password.'); }
    finally { setPwdSaving(false); }
  };

  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 24, color: 'var(--cyan)' }}>◎</span>
          <h1>Profile Settings</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Manage your account information and preferences.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Avatar Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="section-title">Profile Picture</div>

            {/* Avatar display */}
            <div style={{
              width: 100, height: 100, borderRadius: '50%', margin: '0 auto 16px',
              background: avatarSrc ? 'transparent' : 'linear-gradient(135deg, var(--purple), var(--cyan))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, fontWeight: 800, color: '#000',
              border: '3px solid rgba(0,200,255,0.3)',
              overflow: 'hidden',
              boxShadow: '0 0 24px rgba(0,200,255,0.15)',
            }}>
              {avatarSrc
                ? <img src={avatarSrc} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { e.target.style.display = 'none'; }} />
                : initials}
            </div>

            <div style={{ display: 'flex', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{user?.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{user?.email}</div>

            {avatarMsg && <div className="alert alert-success" style={{ marginBottom: 12, fontSize: 12 }}>{avatarMsg}</div>}
            {avatarErr && <div className="alert alert-error" style={{ marginBottom: 12, fontSize: 12 }}>{avatarErr}</div>}

            <input type="file" ref={fileRef} accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleAvatarChange} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => fileRef.current?.click()}>
                📷 Choose Photo
              </button>
              {avatarFile && (
                <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={handleAvatarUpload} disabled={avatarUploading}>
                  {avatarUploading ? <><div className="spinner" style={{ borderTopColor: '#000', borderColor: 'rgba(0,0,0,0.15)' }} /> Uploading...</> : '⬆ Upload Photo'}
                </button>
              )}
              {user?.avatar?.url && (
                <button className="btn btn-danger btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={handleRemoveAvatar}>
                  🗑 Remove Photo
                </button>
              )}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 10 }}>JPEG, PNG, WEBP • Max 2MB</div>
          </div>

          {/* Account info */}
          <div className="card">
            <div className="section-title">Account Info</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Member since', value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—' },
                { label: 'University', value: user?.university || '—' },
                { label: 'Department', value: user?.department || '—' },
                { label: 'Semester', value: user?.semester ? `Semester ${user.semester}` : '—' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right side forms */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Profile Info Form */}
          <div className="card">
            <div className="section-title">Personal Information</div>
            {profileMsg && <div className="alert alert-success" style={{ marginBottom: 16 }}><span>✓</span> {profileMsg}</div>}
            {profileErr && <div className="alert alert-error" style={{ marginBottom: 16 }}><span>⚠</span> {profileErr}</div>}
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="grid-2" style={{ gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input type="email" className="form-input" value={user?.email || ''} disabled style={{ opacity: 0.5 }} />
                </div>
              </div>
              <div className="grid-2" style={{ gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">University / Institution</label>
                  <input type="text" className="form-input" value={university} onChange={e => setUniversity(e.target.value)} placeholder="Your university name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <input type="text" className="form-input" value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Software Engineering" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Semester</label>
                <input type="number" className="form-input" value={semester} onChange={e => setSemester(e.target.value)} min={1} max={12} placeholder="Current semester number" style={{ maxWidth: 200 }} />
              </div>
              <div className="form-group">
                <label className="form-label">Bio</label>
                <textarea className="form-input" value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell us about yourself..." rows={3} maxLength={300} style={{ resize: 'vertical' }} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{bio.length}/300</span>
              </div>
              <div>
                <button type="submit" className="btn btn-primary" disabled={profileSaving}>
                  {profileSaving ? <><div className="spinner" style={{ borderTopColor: '#000', borderColor: 'rgba(0,0,0,0.15)' }} /> Saving...</> : '💾 Save Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Change Password */}
          <div className="card">
            <div className="section-title">Change Password</div>
            {pwdMsg && <div className="alert alert-success" style={{ marginBottom: 16 }}><span>✓</span> {pwdMsg}</div>}
            {pwdErr && <div className="alert alert-error" style={{ marginBottom: 16 }}><span>⚠</span> {pwdErr}</div>}
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input type="password" className="form-input" value={oldPwd} onChange={e => setOldPwd(e.target.value)} required placeholder="Enter current password" />
              </div>
              <div className="grid-2" style={{ gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input type="password" className="form-input" value={newPwd} onChange={e => setNewPwd(e.target.value)} required placeholder="Min. 6 characters" />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input type="password" className="form-input" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required placeholder="Repeat new password" />
                </div>
              </div>
              <div>
                <button type="submit" className="btn btn-secondary" disabled={pwdSaving}>
                  {pwdSaving ? <><div className="spinner" /> Changing...</> : '🔒 Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

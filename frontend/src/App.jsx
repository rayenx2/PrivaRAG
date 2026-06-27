import { useState, useEffect, useRef } from 'react'
import axios from 'axios'

// ─── Config ────────────────────────────────────────────────────────────────────
const BRANDING = {
  clientName: 'PrivaRAG',
  primaryColor: '#7c3aed',
  accentLight: '#c4b5fd',
  accentSurface: '#1e1e2e',
  version: 'v2.0',
  poweredBy: 'Rayen Lassoued',
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const API = axios.create({ baseURL: API_URL })
API.interceptors.request.use(cfg => {
  const t = localStorage.getItem('rag_auth_token')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})
API.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) {
    localStorage.removeItem('rag_auth_token')
    localStorage.removeItem('rag_auth_user')
    window.location.reload()
  }
  return Promise.reject(err)
})

const PROVIDER_CONFIGS = {
  mega:     { label: 'Mega', fields: ['user', 'pass'], placeholders: { user: 'Email', pass: 'Password' }, types: { pass: 'password' } },
  s3:       { label: 'Amazon S3 / MinIO', fields: ['provider', 'access_key_id', 'secret_access_key', 'region', 'endpoint'], placeholders: { provider: 'Provider (AWS, MinIO)', access_key_id: 'Access Key ID', secret_access_key: 'Secret Access Key', region: 'Region (eu-west-1)', endpoint: 'Endpoint URL (for MinIO)' }, types: { secret_access_key: 'password' } },
  drive:    { label: 'Google Drive', fields: ['token'], placeholders: { token: 'OAuth Token JSON (from rclone authorize drive)' } },
  onedrive: { label: 'Microsoft OneDrive', fields: ['token'], placeholders: { token: 'OAuth Token JSON (from rclone authorize onedrive)' } },
  dropbox:  { label: 'Dropbox', fields: ['token'], placeholders: { token: 'OAuth Token JSON (from rclone authorize dropbox)' } },
  webdav:   { label: 'WebDAV (Nextcloud)', fields: ['url', 'user', 'pass'], placeholders: { url: 'WebDAV URL', user: 'Username', pass: 'Password' }, types: { pass: 'password' } },
  ftp:      { label: 'FTP / FTPS', fields: ['host', 'user', 'pass', 'port'], placeholders: { host: 'Hostname', user: 'Username', pass: 'Password', port: 'Port (21)' }, types: { pass: 'password' } },
  sftp:     { label: 'SFTP (SSH)', fields: ['host', 'user', 'pass', 'port'], placeholders: { host: 'Hostname', user: 'Username', pass: 'Password', port: 'Port (22)' }, types: { pass: 'password' } },
  b2:       { label: 'Backblaze B2', fields: ['account', 'key'], placeholders: { account: 'Account ID', key: 'Application Key' }, types: { key: 'password' } },
  pcloud:   { label: 'pCloud', fields: ['token'], placeholders: { token: 'OAuth Token JSON' } },
}

const CRON_PRESETS = [
  { label: 'Every 6 hours',       value: '0 */6 * * *' },
  { label: 'Daily at 2:00 AM',    value: '0 2 * * *' },
  { label: 'Daily at midnight',   value: '0 0 * * *' },
  { label: 'Weekly (Sunday 3 AM)',value: '0 3 * * 0' },
  { label: 'Monthly (1st at 1 AM)',value:'0 1 1 * *' },
]

const formatBytes = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// ─── SVG Icons ─────────────────────────────────────────────────────────────────
const IconPlus = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const IconTrash = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4h6v2"/>
  </svg>
)
const IconMenu = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
)
const IconFile = ({ size = 13, color = '#7c3aed' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
)
const IconSend = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)
const IconAttach = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
  </svg>
)
const IconSettings = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)
const IconChat = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)
const IconEdit = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)
const IconSparkle = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
  </svg>
)

// ─── Helpers ───────────────────────────────────────────────────────────────────
function relativeTime(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ─── TypingDots ────────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '2px 0' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: '50%', background: '#7c3aed',
          animation: 'pulse 1.2s ease-in-out infinite',
          animationDelay: `${i * 0.2}s`,
          display: 'inline-block',
        }} />
      ))}
    </span>
  )
}

// ─── LoginModal ────────────────────────────────────────────────────────────────
function LoginModal({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await API.post('/api/auth/login', { username, password })
      const { access_token, user: userData } = data
      localStorage.setItem('rag_auth_token', access_token)
      localStorage.setItem('rag_auth_user', JSON.stringify(userData))
      onLogin(userData, access_token)
    } catch {
      setError('Invalid credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#1e1e1e', border: '1px solid #3f3f3f', borderRadius: 20, padding: '36px 32px', width: 360, maxWidth: '90vw' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#ececec', marginBottom: 6 }}>PrivaRAG</h2>
          <p style={{ fontSize: 14, color: '#8e8ea0' }}>Sign in to your private AI</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="text" placeholder="Username" value={username}
            onChange={e => setUsername(e.target.value)} required
            style={{ background: '#2f2f2f', border: '1px solid #3f3f3f', borderRadius: 10, padding: '10px 14px', color: '#ececec', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)} required
            style={{ background: '#2f2f2f', border: '1px solid #3f3f3f', borderRadius: 10, padding: '10px 14px', color: '#ececec', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
          />
          {error && <p style={{ color: '#fca5a5', fontSize: 13, background: '#3f1010', border: '1px solid #7f2020', borderRadius: 8, padding: '8px 12px' }}>{error}</p>}
          <button
            type="submit" disabled={loading}
            style={{ background: '#7c3aed', border: 'none', borderRadius: 10, padding: '11px 0', color: 'white', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 4, fontFamily: 'inherit' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #2a2a2a', textAlign: 'center', fontSize: 12, color: '#5a5a6a' }}>
          Default: <span style={{ color: '#c4b5fd', fontFamily: 'monospace' }}>admin</span> / <span style={{ color: '#c4b5fd', fontFamily: 'monospace' }}>admin123456</span>
        </div>
      </div>
    </div>
  )
}

// ─── ChangePasswordModal ────────────────────────────────────────────────────────
function ChangePasswordModal({ onClose }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (next !== confirm) { setError('New passwords do not match.'); return }
    if (next.length < 6) { setError('New password must be at least 6 characters.'); return }
    setError(''); setLoading(true)
    try {
      await API.post('/api/auth/change-password', { old_password: current, new_password: next })
      setSuccess(true)
      setTimeout(onClose, 1500)
    } catch {
      setError('Current password is incorrect.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: '#1e1e1e', border: '1px solid #3f3f3f', borderRadius: 20, padding: '32px 28px', width: 360, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#ececec', marginBottom: 20 }}>🔑 Change Password</h2>
        {success
          ? <p style={{ color: '#4ade80', textAlign: 'center', padding: '16px 0' }}>✓ Password updated successfully</p>
          : <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[['Current password', current, setCurrent], ['New password', next, setNext], ['Confirm new password', confirm, setConfirm]].map(([label, val, setter]) => (
                <input key={label} type="password" placeholder={label} value={val}
                  onChange={e => setter(e.target.value)} required
                  style={{ background: '#2f2f2f', border: '1px solid #3f3f3f', borderRadius: 10, padding: '10px 14px', color: '#ececec', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                />
              ))}
              {error && <p style={{ color: '#fca5a5', fontSize: 13, background: '#3f1010', border: '1px solid #7f2020', borderRadius: 8, padding: '8px 12px' }}>{error}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="button" onClick={onClose} style={{ flex: 1, background: '#2f2f2f', border: '1px solid #3f3f3f', borderRadius: 10, padding: '10px 0', color: '#ececec', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button type="submit" disabled={loading} style={{ flex: 1, background: '#7c3aed', border: 'none', borderRadius: 10, padding: '10px 0', color: 'white', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily: 'inherit' }}>
                  {loading ? 'Saving…' : 'Update'}
                </button>
              </div>
            </form>
        }
      </div>
    </div>
  )
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ user, conversations, currentId, onSelect, onCreate, onDelete, onRename, onLogout, onChangePassword, isMobile, isOpen, onClose }) {
  const [hoveredId, setHoveredId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')

  function startEdit(conv, e) {
    e.stopPropagation()
    setEditingId(conv.id)
    setEditTitle(conv.title)
  }

  function commitEdit(id) {
    if (editTitle.trim()) onRename(id, editTitle.trim())
    setEditingId(null)
  }

  const sidebarStyle = {
    width: 260, minWidth: 260, background: '#171717', display: 'flex',
    flexDirection: 'column', borderRight: '1px solid #2a2a2a', height: '100vh',
    transition: 'transform 300ms ease',
    ...(isMobile ? {
      position: 'fixed', top: 0, left: 0, zIndex: 200,
      transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
      boxShadow: isOpen ? '4px 0 24px rgba(0,0,0,0.5)' : 'none',
    } : {}),
  }

  return (
    <>
      {isMobile && isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 199 }} onClick={onClose} />
      )}
      <div style={sidebarStyle}>
        {/* Brand */}
        <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid #2a2a2a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>🔒</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#ececec', letterSpacing: '-0.3px' }}>PrivaRAG</span>
            <span style={{ marginLeft: 'auto', background: '#14532d', color: '#4ade80', border: '1px solid rgba(22,163,74,0.2)', borderRadius: 999, fontSize: 10, fontWeight: 600, padding: '2px 8px', whiteSpace: 'nowrap' }}>100% Local</span>
          </div>
          <button
            onClick={onCreate}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: '#2f2f2f', border: '1px solid #3f3f3f', borderRadius: 12, padding: '9px 14px', color: '#ececec', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'border-color 150ms', fontFamily: 'inherit' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#7c3aed'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#3f3f3f'}
          >
            <IconPlus size={15} /><span style={{ color: '#8e8ea0' }}>New Chat</span>
          </button>
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {conversations.length > 0 && (
            <div style={{ fontSize: 11, fontWeight: 600, color: '#8e8ea0', textTransform: 'uppercase', letterSpacing: '.08em', padding: '8px 8px 4px' }}>Recent</div>
          )}
          {conversations.map(conv => (
            <div
              key={conv.id}
              onClick={() => { onSelect(conv.id); if (isMobile) onClose() }}
              onMouseEnter={() => setHoveredId(conv.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 10px', borderRadius: 8, cursor: 'pointer',
                marginBottom: 2, position: 'relative',
                background: currentId === conv.id ? '#2f2f2f' : hoveredId === conv.id ? '#222' : 'transparent',
                borderLeft: currentId === conv.id ? '2px solid #7c3aed' : '2px solid transparent',
                transition: 'background 150ms',
              }}
            >
              <IconChat size={14} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingId === conv.id
                  ? <input
                      autoFocus value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onBlur={() => commitEdit(conv.id)}
                      onKeyDown={e => { if (e.key === 'Enter') commitEdit(conv.id); if (e.key === 'Escape') setEditingId(null) }}
                      onClick={e => e.stopPropagation()}
                      style={{ background: '#3f3f3f', border: '1px solid #7c3aed', borderRadius: 6, padding: '2px 6px', color: '#ececec', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'inherit' }}
                    />
                  : <>
                      <div style={{ fontSize: 13, color: currentId === conv.id ? '#ececec' : '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conv.title}</div>
                      <div style={{ fontSize: 11, color: '#5a5a6a', marginTop: 1 }}>{relativeTime(conv.updatedAt || conv.createdAt || Date.now())}</div>
                    </>
                }
              </div>
              {hoveredId === conv.id && editingId !== conv.id && (
                <div style={{ display: 'flex', gap: 2 }}>
                  <button onClick={e => startEdit(conv, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8e8ea0', padding: 3, borderRadius: 4, display: 'flex' }}><IconEdit /></button>
                  <button onClick={e => { e.stopPropagation(); onDelete(conv.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8e8ea0', padding: 3, borderRadius: 4, display: 'flex' }}><IconTrash /></button>
                </div>
              )}
            </div>
          ))}
          {conversations.length === 0 && (
            <div style={{ textAlign: 'center', color: '#5a5a6a', fontSize: 13, padding: '32px 16px' }}>No conversations yet.<br />Start a new chat!</div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: '#7c3aed', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>
            {user?.username?.[0]?.toUpperCase() || '?'}
          </div>
          <span style={{ fontSize: 13, color: '#ececec', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.username}</span>
          <button
            onClick={onChangePassword}
            title="Change password"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8e8ea0', padding: 4, borderRadius: 6, display: 'flex', transition: 'color 150ms' }}
            onMouseEnter={e => e.currentTarget.style.color = '#ececec'}
            onMouseLeave={e => e.currentTarget.style.color = '#8e8ea0'}
          >
            <IconSettings />
          </button>
        </div>
      </div>
    </>
  )
}

// ─── DocChips ──────────────────────────────────────────────────────────────────
function DocChips({ documents, onRemove, uploadProgress, uploading, uploadPhase }) {
  if (documents.length === 0 && !uploading) return null
  return (
    <div style={{ padding: '8px 16px', borderBottom: '1px solid #2a2a2a', background: '#0d0d0d', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {documents.map(doc => (
          <div key={doc.document_id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e1e2e', border: '1px solid #3a3a5c', borderRadius: 999, padding: '4px 10px 4px 8px' }}>
            <IconFile />
            <span style={{ fontSize: 12, color: '#c4b5fd', maxWidth: 130, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.filename}</span>
            <button
              onClick={() => onRemove(doc.document_id)}
              style={{ width: 14, height: 14, background: '#3a3a5c', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5, transition: 'opacity 150ms, background 150ms', padding: 0, color: '#c4b5fd', fontSize: 10, lineHeight: 1, marginLeft: 2 }}
              onMouseEnter={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.background = '#ef4444' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = 0.5; e.currentTarget.style.background = '#3a3a5c' }}
            >×</button>
          </div>
        ))}
      </div>
      {uploading && (
        <div style={{ marginTop: 8 }}>
          <div style={{ height: 4, background: '#2f2f2f', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#7c3aed', borderRadius: 999, width: `${uploadProgress}%`, transition: 'width 200ms ease' }} />
          </div>
          <div style={{ fontSize: 11, color: '#8e8ea0', marginTop: 4 }}>{uploadPhase || `Uploading… ${uploadProgress}%`}</div>
        </div>
      )}
    </div>
  )
}

// ─── EmptyState ────────────────────────────────────────────────────────────────
function EmptyState({ documents, onPrompt, onUploadClick }) {
  const hasDocs = documents.length > 0
  const prompts = hasDocs
    ? ['Summarize this document', 'What are the key points?', 'Find all action items', 'List the main conclusions']
    : []

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{ fontSize: 60, marginBottom: 20, lineHeight: 1 }}>🔒</div>
        <h1 style={{ fontSize: 30, fontWeight: 700, color: '#ececec', marginBottom: 10, letterSpacing: '-0.5px' }}>PrivaRAG</h1>
        <p style={{ fontSize: 16, color: '#8e8ea0', marginBottom: 28, lineHeight: 1.5 }}>Your private AI. Runs 100% on your machine.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32 }}>
          {['🚫 No internet', '📁 Your docs only', '🔐 Zero data sharing'].map(pill => (
            <span key={pill} style={{ background: '#1e1e2e', border: '1px solid #3a3a5c', color: '#c4b5fd', borderRadius: 999, padding: '5px 12px', fontSize: 13, fontWeight: 500 }}>{pill}</span>
          ))}
        </div>
        {!hasDocs
          ? <button
              onClick={onUploadClick}
              style={{ background: '#2f2f2f', border: '1px solid #3a3a5c', borderRadius: 16, padding: '10px 24px', color: '#ececec', fontSize: 14, cursor: 'pointer', transition: 'border-color 150ms', display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#7c3aed'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#3a3a5c'}
            >
              <IconAttach size={16} /> Upload a document to get started
            </button>
          : <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {prompts.map(p => (
                <button key={p} onClick={() => onPrompt(p)}
                  style={{ background: '#2f2f2f', border: '1px solid #3f3f3f', color: '#ececec', borderRadius: 999, padding: '8px 16px', fontSize: 13, cursor: 'pointer', transition: 'border-color 150ms', fontFamily: 'inherit' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#7c3aed'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#3f3f3f'}
                >{p}</button>
              ))}
            </div>
        }
      </div>
    </div>
  )
}

// ─── Message ───────────────────────────────────────────────────────────────────
function Message({ msg, username }) {
  const ts = msg.created_at || msg.timestamp || Date.now()
  const isUser = msg.role === 'user'

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 20 }}>
        <div style={{ maxWidth: '72%' }}>
          <div style={{ background: '#2f2f2f', borderRadius: '18px 18px 4px 18px', padding: '12px 16px', color: '#ececec', fontSize: 14, lineHeight: 1.6, wordBreak: 'break-word' }}>
            {msg.content}
          </div>
          <div style={{ fontSize: 11, color: '#5a5a6a', marginTop: 4, textAlign: 'right' }}>{formatTime(ts)}</div>
        </div>
        <div style={{ width: 32, height: 32, background: '#7c3aed', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0, marginTop: 4 }}>
          {username?.[0]?.toUpperCase() || 'U'}
        </div>
      </div>
    )
  }

  if (msg.error) {
    return (
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 32, height: 32, background: '#3f1010', border: '1px solid #7f2020', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4 }}>
          <span style={{ fontSize: 14 }}>⚠</span>
        </div>
        <div style={{ background: '#3f1010', border: '1px solid #7f2020', color: '#fca5a5', borderRadius: 12, padding: '12px 16px', fontSize: 14, lineHeight: 1.6, maxWidth: '80%' }}>
          {msg.content}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
      <div style={{ width: 32, height: 32, background: '#1e1e2e', border: '1px solid #3a3a5c', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4 }}>
        <IconSparkle />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ borderLeft: '2px solid #7c3aed', paddingLeft: 12, color: '#ececec', fontSize: 14, lineHeight: 1.7, wordBreak: 'break-word' }}>
          <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
        </div>
        {msg.sources?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, paddingLeft: 14 }}>
            {msg.sources.map((src, i) => (
              <span key={i} style={{ background: '#1e1e2e', border: '1px solid #3a3a5c', color: '#c4b5fd', borderRadius: 999, padding: '2px 10px', fontSize: 11 }}>
                📎 {src.filename || src.document_id}{src.page ? ` — p.${src.page}` : ''}
              </span>
            ))}
          </div>
        )}
        <div style={{ fontSize: 11, color: '#5a5a6a', marginTop: 6, paddingLeft: 14 }}>{formatTime(ts)}</div>
      </div>
    </div>
  )
}

// ─── InputBar ──────────────────────────────────────────────────────────────────
function InputBar({ onSend, onUpload, disabled, canUpload }) {
  const [text, setText] = useState('')
  const textareaRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 144) + 'px'
  }, [text])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  return (
    <div style={{ background: '#1e1e1e', borderTop: '1px solid #3f3f3f', padding: '12px 16px 16px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, background: '#2a2a2a', border: '1px solid #3f3f3f', borderRadius: 14, padding: '8px 10px' }}>
        {canUpload && (
          <button
            onClick={() => fileRef.current?.click()}
            title="Attach document"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8e8ea0', padding: 5, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', transition: 'color 150ms, background 150ms' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#c4b5fd'; e.currentTarget.style.background = '#2f2f2f' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#8e8ea0'; e.currentTarget.style.background = 'none' }}
          >
            <IconAttach />
          </button>
        )}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Upload a document first…' : 'Type a message…'}
          rows={1}
          disabled={disabled}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none', color: '#ececec', fontSize: 14, lineHeight: 1.5, fontFamily: 'inherit', padding: '4px 0', maxHeight: 144, overflowY: 'auto', caretColor: '#7c3aed' }}
        />
        <button
          onClick={submit}
          disabled={!text.trim() || disabled}
          style={{ width: 34, height: 34, background: '#7c3aed', border: 'none', borderRadius: '50%', cursor: !text.trim() || disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'opacity 150ms, filter 150ms', opacity: !text.trim() || disabled ? 0.4 : 1 }}
          onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.filter = 'brightness(1.15)' }}
          onMouseLeave={e => e.currentTarget.style.filter = 'none'}
        >
          <IconSend />
        </button>
      </div>
      {canUpload && (
        <input ref={fileRef} type="file" accept=".pdf,.txt,.docx,.md,.doc,.pptx,.xlsx" multiple style={{ display: 'none' }} onChange={e => { onUpload(Array.from(e.target.files)); e.target.value = '' }} />
      )}
      <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: '#5a5a6a' }}>
        PrivaRAG runs entirely on your machine · No data leaves your device
      </div>
    </div>
  )
}

// ─── Admin Panel ───────────────────────────────────────────────────────────────
function AdminPanel({ onClose, adminTab, setAdminTab, fetchAllUsers, fetchBackupData,
  allUsers, loadingUsers, newUserForm, setNewUserForm, handleCreateUser, creatingUser,
  handleDeleteUser, handleChangeUserRole, user,
  backupStatus, backupProviders, backupHistory, localBackups, backupRunning, backupSchedule,
  showAddProvider, setShowAddProvider, newProvider, setNewProvider, handleAddProvider,
  handleRemoveProvider, handleTestProvider, testingProvider,
  scheduleForm, setScheduleForm, handleSetSchedule, handleRunBackup,
  handleDeleteLocalBackup, handleRestore }) {

  const inp = { background: '#2a2a2a', border: '1px solid #3f3f3f', borderRadius: 8, padding: '9px 12px', color: '#ececec', fontSize: 13, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }
  const btn = (bg = '#7c3aed') => ({ background: bg, border: 'none', borderRadius: 8, padding: '9px 16px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 16, width: '100%', maxWidth: 760, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['users', '👥 Users'], ['backup', '💾 Backup']].map(([tab, label]) => (
              <button key={tab} onClick={() => { setAdminTab(tab); tab === 'users' ? fetchAllUsers() : fetchBackupData() }}
                style={{ ...btn(adminTab === tab ? '#2f2f2f' : 'transparent'), border: `1px solid ${adminTab === tab ? '#3f3f3f' : 'transparent'}`, color: adminTab === tab ? '#ececec' : '#8e8ea0' }}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8e8ea0', fontSize: 20, cursor: 'pointer', lineHeight: 1, fontFamily: 'inherit' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {adminTab === 'users' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ background: '#2f2f2f', borderRadius: 12, padding: 20 }}>
                <h3 style={{ color: '#ececec', fontSize: 15, fontWeight: 600, marginBottom: 16 }}>➕ Create New User</h3>
                <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <input type="text" placeholder="Username" value={newUserForm.username} onChange={e => setNewUserForm({ ...newUserForm, username: e.target.value })} style={inp} required />
                  <input type="email" placeholder="Email" value={newUserForm.email} onChange={e => setNewUserForm({ ...newUserForm, email: e.target.value })} style={inp} required />
                  <input type="password" placeholder="Password" value={newUserForm.password} onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })} style={inp} required />
                  <select value={newUserForm.role} onChange={e => setNewUserForm({ ...newUserForm, role: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                    <option value="user">User (read-only)</option>
                    <option value="super_user">Super User (upload/delete)</option>
                    <option value="admin">Admin (user management)</option>
                  </select>
                  <button type="submit" disabled={creatingUser} style={{ ...btn('#16a34a'), gridColumn: '1/-1', opacity: creatingUser ? 0.6 : 1 }}>
                    {creatingUser ? 'Creating…' : 'Create User'}
                  </button>
                </form>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3 style={{ color: '#ececec', fontSize: 15, fontWeight: 600 }}>📋 Users ({allUsers.length})</h3>
                  <button onClick={fetchAllUsers} style={{ background: 'none', border: 'none', color: '#c4b5fd', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>🔄 Refresh</button>
                </div>
                {loadingUsers ? <p style={{ color: '#8e8ea0', textAlign: 'center', padding: '24px 0' }}>Loading…</p>
                  : allUsers.length === 0 ? <p style={{ color: '#8e8ea0', textAlign: 'center', padding: '24px 0' }}>No users found</p>
                  : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {allUsers.map(u => (
                        <div key={u.id} style={{ background: '#2f2f2f', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ color: '#ececec', fontWeight: 600, fontSize: 14 }}>{u.username}</span>
                              <span style={{ background: u.role === 'admin' ? '#dc2626' : u.role === 'super_user' ? '#7c3aed' : '#2563eb', color: 'white', borderRadius: 4, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>
                                {u.role.toUpperCase()}
                              </span>
                            </div>
                            {u.email && <p style={{ color: '#8e8ea0', fontSize: 12, marginTop: 2 }}>{u.email}</p>}
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            {u.id !== user.id
                              ? <>
                                  <select value={u.role} onChange={e => handleChangeUserRole(u.id, e.target.value, u.username)} style={{ ...inp, width: 'auto', padding: '5px 8px', cursor: 'pointer' }}>
                                    <option value="user">User</option>
                                    <option value="super_user">Super User</option>
                                    <option value="admin">Admin</option>
                                  </select>
                                  <button onClick={() => handleDeleteUser(u.id, u.username)} style={{ ...btn('#dc2626'), padding: '5px 12px', fontSize: 12 }}>Delete</button>
                                </>
                              : <span style={{ color: '#8e8ea0', fontSize: 12, fontStyle: 'italic' }}>(You)</span>
                            }
                          </div>
                        </div>
                      ))}
                    </div>
                }
              </div>
            </div>
          )}

          {adminTab === 'backup' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {[['Local Backups', backupStatus?.local_backups || 0], ['Cloud Providers', backupProviders.length]].map(([label, val]) => (
                  <div key={label} style={{ background: '#2f2f2f', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
                    <p style={{ color: '#ececec', fontSize: 22, fontWeight: 700 }}>{val}</p>
                    <p style={{ color: '#8e8ea0', fontSize: 12 }}>{label}</p>
                  </div>
                ))}
                <div style={{ background: '#2f2f2f', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: backupStatus?.rclone_installed ? '#22c55e' : '#ef4444', margin: '0 auto 4px' }} />
                  <p style={{ color: '#8e8ea0', fontSize: 12 }}>{backupStatus?.rclone_installed ? 'rclone OK' : 'rclone Missing'}</p>
                </div>
              </div>

              {/* Quick backup */}
              <div style={{ background: '#2f2f2f', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: backupProviders.length > 0 ? 12 : 0 }}>
                  <h3 style={{ color: '#ececec', fontWeight: 600 }}>Backup Now</h3>
                  <button onClick={() => handleRunBackup()} disabled={backupRunning} style={{ ...btn('#16a34a'), opacity: backupRunning ? 0.6 : 1 }}>
                    {backupRunning ? 'Running…' : 'Local Backup'}
                  </button>
                </div>
                {backupProviders.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {backupProviders.map(p => (
                      <button key={p.name} onClick={() => handleRunBackup(p.name)} disabled={backupRunning} style={{ ...btn('#2563eb'), fontSize: 12, opacity: backupRunning ? 0.6 : 1 }}>
                        Backup → {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Providers */}
              <div style={{ background: '#2f2f2f', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3 style={{ color: '#ececec', fontWeight: 600 }}>Cloud Providers ({backupProviders.length})</h3>
                  <button onClick={() => setShowAddProvider(!showAddProvider)} style={{ ...btn(showAddProvider ? '#374151' : '#2563eb'), fontSize: 12 }}>
                    {showAddProvider ? 'Cancel' : '+ Add Provider'}
                  </button>
                </div>
                {backupProviders.map(p => (
                  <div key={p.name} style={{ background: '#2a2a2a', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <p style={{ color: '#ececec', fontWeight: 600, fontSize: 13 }}>{p.name}</p>
                      <p style={{ color: '#8e8ea0', fontSize: 11 }}>{p.type_name}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => handleTestProvider(p.name)} disabled={testingProvider === p.name} style={{ ...btn('#374151'), fontSize: 11, padding: '4px 10px' }}>
                        {testingProvider === p.name ? 'Testing…' : 'Test'}
                      </button>
                      <button onClick={() => handleRemoveProvider(p.name)} style={{ ...btn('#dc2626'), fontSize: 11, padding: '4px 10px' }}>Remove</button>
                    </div>
                  </div>
                ))}
                {!backupProviders.length && !showAddProvider && <p style={{ color: '#8e8ea0', fontSize: 13 }}>No cloud providers configured yet</p>}
                {showAddProvider && (
                  <form onSubmit={handleAddProvider} style={{ background: '#2a2a2a', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <input type="text" placeholder="Name (e.g. my-mega)" value={newProvider.name} onChange={e => setNewProvider({ ...newProvider, name: e.target.value })} style={inp} required />
                      <select value={newProvider.type} onChange={e => setNewProvider({ ...newProvider, type: e.target.value, config: {} })} style={{ ...inp, cursor: 'pointer' }}>
                        {Object.entries(PROVIDER_CONFIGS).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
                      </select>
                    </div>
                    {PROVIDER_CONFIGS[newProvider.type]?.fields.map(field => (
                      <input key={field} type={PROVIDER_CONFIGS[newProvider.type]?.types?.[field] || 'text'}
                        placeholder={PROVIDER_CONFIGS[newProvider.type]?.placeholders?.[field] || field}
                        value={newProvider.config[field] || ''}
                        onChange={e => setNewProvider({ ...newProvider, config: { ...newProvider.config, [field]: e.target.value } })}
                        style={inp} />
                    ))}
                    <button type="submit" style={btn('#16a34a')}>Add Provider</button>
                  </form>
                )}
              </div>

              {/* Schedule */}
              <div style={{ background: '#2f2f2f', borderRadius: 12, padding: 16 }}>
                <h3 style={{ color: '#ececec', fontWeight: 600, marginBottom: 12 }}>Automatic Schedule</h3>
                <form onSubmit={handleSetSchedule} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ color: '#8e8ea0', fontSize: 11, display: 'block', marginBottom: 4 }}>Frequency</label>
                      <select value={CRON_PRESETS.find(p => p.value === scheduleForm.cron) ? scheduleForm.cron : 'custom'}
                        onChange={e => { if (e.target.value !== 'custom') setScheduleForm({ ...scheduleForm, cron: e.target.value }) }}
                        style={{ ...inp, cursor: 'pointer' }}>
                        {CRON_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        <option value="custom">Custom cron…</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ color: '#8e8ea0', fontSize: 11, display: 'block', marginBottom: 4 }}>Cron Expression</label>
                      <input type="text" value={scheduleForm.cron} onChange={e => setScheduleForm({ ...scheduleForm, cron: e.target.value })} style={{ ...inp, fontFamily: 'monospace' }} />
                    </div>
                    <div>
                      <label style={{ color: '#8e8ea0', fontSize: 11, display: 'block', marginBottom: 4 }}>Upload to</label>
                      <select value={scheduleForm.provider} onChange={e => setScheduleForm({ ...scheduleForm, provider: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                        <option value="">Local only</option>
                        {backupProviders.map(p => <option key={p.name} value={p.name}>{p.name} ({p.type_name})</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ color: '#8e8ea0', fontSize: 11, display: 'block', marginBottom: 4 }}>Keep last N backups</label>
                      <input type="number" min="1" max="100" value={scheduleForm.retention} onChange={e => setScheduleForm({ ...scheduleForm, retention: parseInt(e.target.value) || 5 })} style={inp} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ececec', fontSize: 13, cursor: 'pointer' }}>
                      <input type="checkbox" checked={scheduleForm.enabled} onChange={e => setScheduleForm({ ...scheduleForm, enabled: e.target.checked })} />
                      Enable automatic backup
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {backupSchedule?.next_run && <span style={{ color: '#8e8ea0', fontSize: 12 }}>Next: {new Date(backupSchedule.next_run).toLocaleString()}</span>}
                      <button type="submit" style={btn('#2563eb')}>Save Schedule</button>
                    </div>
                  </div>
                </form>
              </div>

              {/* History */}
              {backupHistory.length > 0 && (
                <div style={{ background: '#2f2f2f', borderRadius: 12, padding: 16 }}>
                  <h3 style={{ color: '#ececec', fontWeight: 600, marginBottom: 12 }}>History ({backupHistory.length})</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                    {[...backupHistory].reverse().slice(0, 10).map((entry, idx) => (
                      <div key={idx} style={{ background: '#2a2a2a', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ background: entry.status === 'success' ? '#16a34a' : '#dc2626', color: 'white', borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>{entry.status === 'success' ? 'OK' : 'ERR'}</span>
                          <span style={{ color: '#ececec', fontSize: 13, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.backup_name || 'N/A'}</span>
                        </div>
                        <span style={{ color: '#8e8ea0', fontSize: 11 }}>{entry.size_bytes ? formatBytes(entry.size_bytes) : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Local backups */}
              {localBackups.length > 0 && (
                <div style={{ background: '#2f2f2f', borderRadius: 12, padding: 16 }}>
                  <h3 style={{ color: '#ececec', fontWeight: 600, marginBottom: 12 }}>Local Backups ({localBackups.length})</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                    {localBackups.map((backup, idx) => (
                      <div key={idx} style={{ background: '#2a2a2a', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                          <p style={{ color: '#ececec', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{backup.name}</p>
                          <p style={{ color: '#8e8ea0', fontSize: 11, marginTop: 2 }}>{formatBytes(backup.size_bytes)} · {new Date(backup.created).toLocaleString()}</p>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => handleRestore(backup.name)} style={{ ...btn('#d97706'), fontSize: 11, padding: '4px 10px' }}>Restore</button>
                          <button onClick={() => handleDeleteLocalBackup(backup.name)} style={{ ...btn('#dc2626'), fontSize: 11, padding: '4px 10px' }}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const [authChecked, setAuthChecked] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)

  // ── UI ──────────────────────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [adminTab, setAdminTab] = useState('users')
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false)

  // ── Admin users ─────────────────────────────────────────────────────────────
  const [allUsers, setAllUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [newUserForm, setNewUserForm] = useState({ username: '', email: '', password: '', role: 'user' })
  const [creatingUser, setCreatingUser] = useState(false)

  // ── Backup ──────────────────────────────────────────────────────────────────
  const [showAddProvider, setShowAddProvider] = useState(false)
  const [newProvider, setNewProvider] = useState({ name: '', type: 'mega', config: {} })
  const [backupProviders, setBackupProviders] = useState([])
  const [backupStatus, setBackupStatus] = useState(null)
  const [backupHistory, setBackupHistory] = useState([])
  const [localBackups, setLocalBackups] = useState([])
  const [backupSchedule, setBackupSchedule] = useState(null)
  const [backupRunning, setBackupRunning] = useState(false)
  const [showAddProviderForm, setShowAddProviderForm] = useState(false)
  const [testingProvider, setTestingProvider] = useState(null)
  const [scheduleForm, setScheduleForm] = useState({ cron: '0 2 * * *', provider: '', remote_path: 'rag-enterprise-backups', retention: 5, enabled: false })

  // ── Backend status ──────────────────────────────────────────────────────────
  const [status, setStatus] = useState('checking')

  // ── Conversations ───────────────────────────────────────────────────────────
  const [conversations, setConversations] = useState([])
  const [currentConversationId, setCurrentConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [querying, setQuerying] = useState(false)
  const [isModelLoading, setIsModelLoading] = useState(false)

  // ── Documents ───────────────────────────────────────────────────────────────
  const [documents, setDocuments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadPhase, setUploadPhase] = useState('')

  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const modelLoadingTimerRef = useRef(null)

  // ── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    const fn = () => { const m = window.innerWidth < 768; setIsMobile(m); if (!m) setSidebarOpen(true) }
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  useEffect(() => {
    const savedToken = localStorage.getItem('rag_auth_token')
    const savedUser = localStorage.getItem('rag_auth_user')
    if (savedToken && savedUser) {
      setToken(savedToken)
      setUser(JSON.parse(savedUser))
      setIsAuthenticated(true)
    }
    setAuthChecked(true)
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      loadConversationsFromStorage()
      checkBackendHealth()
      fetchDocuments()
      const interval = setInterval(checkBackendHealth, 30000)
      return () => clearInterval(interval)
    }
  }, [isAuthenticated])

  // ── Auth functions ───────────────────────────────────────────────────────────
  function handleLogin(userData, accessToken) {
    setToken(accessToken)
    setUser(userData)
    setIsAuthenticated(true)
  }

  function handleLogout() {
    setToken(null)
    setUser(null)
    setIsAuthenticated(false)
    setConversations([])
    setMessages([])
    setCurrentConversationId(null)
    localStorage.removeItem('rag_auth_token')
    localStorage.removeItem('rag_auth_user')
    setShowAdminPanel(false)
  }

  // ── Admin functions ──────────────────────────────────────────────────────────
  const fetchAllUsers = async () => {
    if (!user || user.role !== 'admin') return
    setLoadingUsers(true)
    try {
      const { data } = await API.get('/api/auth/users')
      setAllUsers(data.users || [])
    } catch { alert('Error loading users') }
    finally { setLoadingUsers(false) }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault(); setCreatingUser(true)
    try {
      await API.post('/api/auth/users', newUserForm)
      alert(`✅ User "${newUserForm.username}" created!`)
      setNewUserForm({ username: '', email: '', password: '', role: 'user' })
      fetchAllUsers()
    } catch (err) { alert(`❌ ${err.response?.data?.detail || err.message}`) }
    finally { setCreatingUser(false) }
  }

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`Delete user "${username}"?`)) return
    try { await API.delete(`/api/auth/users/${userId}`); alert('✅ User deleted'); fetchAllUsers() }
    catch (err) { alert(`❌ ${err.response?.data?.detail || err.message}`) }
  }

  const handleChangeUserRole = async (userId, newRole, username) => {
    try { await API.put(`/api/auth/users/${userId}`, { role: newRole }); alert(`✅ Role of "${username}" → "${newRole}"`); fetchAllUsers() }
    catch (err) { alert(`❌ ${err.response?.data?.detail || err.message}`) }
  }

  const toggleAdminPanel = () => {
    const next = !showAdminPanel
    setShowAdminPanel(next)
    if (next) fetchAllUsers()
  }

  // ── Backup functions ─────────────────────────────────────────────────────────
  const fetchBackupData = async () => {
    try {
      const [s, p, h, l, sc] = await Promise.all([
        API.get('/api/admin/backup/status'), API.get('/api/admin/backup/providers'),
        API.get('/api/admin/backup/history'), API.get('/api/admin/backup/local'),
        API.get('/api/admin/backup/schedule'),
      ])
      setBackupStatus(s.data); setBackupProviders(p.data.providers || [])
      setBackupHistory(h.data.history || []); setLocalBackups(l.data.backups || [])
      const sched = sc.data; setBackupSchedule(sched)
      if (sched) setScheduleForm({ cron: sched.cron || '0 2 * * *', provider: sched.provider || '', remote_path: sched.remote_path || 'rag-enterprise-backups', retention: sched.retention || 5, enabled: sched.enabled || false })
    } catch (e) { console.error('Backup data error', e) }
  }

  const handleAddProvider = async (e) => {
    e.preventDefault()
    try { await API.post('/api/admin/backup/providers', newProvider); alert(`Provider "${newProvider.name}" configured!`); setShowAddProvider(false); setNewProvider({ name: '', type: 'mega', config: {} }); fetchBackupData() }
    catch (err) { alert(`Error: ${err.response?.data?.detail || err.message}`) }
  }

  const handleRemoveProvider = async (name) => {
    if (!window.confirm(`Remove provider "${name}"?`)) return
    try { await API.delete(`/api/admin/backup/providers/${name}`); fetchBackupData() }
    catch (err) { alert(`Error: ${err.response?.data?.detail || err.message}`) }
  }

  const handleTestProvider = async (name) => {
    setTestingProvider(name)
    try {
      const { data } = await API.post(`/api/admin/backup/providers/${name}/test`)
      if (data.status === 'ok') { const free = data.free ? ` (${(data.free / 1e9).toFixed(1)} GB free)` : ''; alert(`Connection OK!${free}`) }
      else alert(`Error: ${data.message}`)
    } catch (err) { alert(`Test failed: ${err.response?.data?.detail || err.message}`) }
    finally { setTestingProvider(null) }
  }

  const handleRunBackup = async (provider = null) => {
    setBackupRunning(true)
    try { await API.post('/api/admin/backup/run', { provider: provider || null, remote_path: 'rag-enterprise-backups' }); alert(provider ? `Backup to "${provider}" started!` : 'Local backup started!'); setTimeout(fetchBackupData, 5000) }
    catch (err) { alert(`Backup error: ${err.response?.data?.detail || err.message}`) }
    finally { setBackupRunning(false) }
  }

  const handleSetSchedule = async (e) => {
    e.preventDefault()
    try { await API.post('/api/admin/backup/schedule', scheduleForm); alert('Schedule updated!'); fetchBackupData() }
    catch (err) { alert(`Error: ${err.response?.data?.detail || err.message}`) }
  }

  const handleDeleteLocalBackup = async (filename) => {
    if (!window.confirm(`Delete backup "${filename}"?`)) return
    try { await API.delete(`/api/admin/backup/local/${filename}`); fetchBackupData() }
    catch (err) { alert(`Error: ${err.response?.data?.detail || err.message}`) }
  }

  const handleRestore = async (filename) => {
    if (!window.confirm(`WARNING: This will overwrite current data!\n\nRestore from "${filename}"?`)) return
    try { await API.post('/api/admin/backup/restore', { filename, restore_db: true, restore_uploads: true, restore_qdrant: true }); alert('Restore started!') }
    catch (err) { alert(`Restore error: ${err.response?.data?.detail || err.message}`) }
  }

  // ── Conversation helpers ─────────────────────────────────────────────────────
  const migrateConv = (c) => ({ document_ids: [], ...c })

  const syncConversationsFromServer = async (localConvs) => {
    try {
      const { data } = await API.get('/api/conversations')
      const map = Object.fromEntries(data.map(c => [c.id, c]))
      return localConvs.map(c => ({ ...c, document_ids: map[c.id]?.document_ids ?? c.document_ids ?? [] }))
    } catch { return localConvs }
  }

  const generateSmartTitle = (query) => {
    const stops = ['what is ', 'what are ', 'how does ', 'how do ', 'tell me about ', 'explain ', 'describe ', 'who is ', 'where is ', 'when did ', 'why is ', 'can you ', 'could you ', 'please ']
    let text = query.trim(); const lower = text.toLowerCase()
    for (const p of stops) { if (lower.startsWith(p)) { text = text.slice(p.length).trim(); break } }
    const words = text.split(/\s+/).slice(0, 5).join(' ')
    const title = words.charAt(0).toUpperCase() + words.slice(1)
    if (title.length > 40) { const cut = title.lastIndexOf(' ', 40); return cut > 0 ? title.slice(0, cut) + '…' : title.slice(0, 40) + '…' }
    return title || query.substring(0, 40)
  }

  const saveConversationsToStorage = (convs) => {
    if (!user) return
    localStorage.setItem(`rag_conversations_${user.id}`, JSON.stringify(convs))
  }

  const loadConversationsFromStorage = () => {
    if (!user) return
    try {
      const stored = localStorage.getItem(`rag_conversations_${user.id}`)
      if (stored) {
        const parsed = JSON.parse(stored).map(migrateConv)
        syncConversationsFromServer(parsed).then(merged => {
          setConversations(merged); saveConversationsToStorage(merged)
          const lastId = localStorage.getItem(`rag_current_conversation_${user.id}`)
          const target = (lastId && merged.find(c => c.id === lastId)) ? lastId : merged[0]?.id
          if (target) { setCurrentConversationId(target); setMessages(merged.find(c => c.id === target)?.messages || []); localStorage.setItem(`rag_current_conversation_${user.id}`, target) }
        })
      } else { createNewConversation() }
    } catch { createNewConversation() }
  }

  const createNewConversation = () => {
    const newConv = { id: Date.now().toString(), title: 'New Conversation', messages: [], document_ids: [], createdAt: new Date().toISOString() }
    API.post('/api/conversations', { name: newConv.title, conversation_id: newConv.id }).catch(() => {})
    const updated = [newConv, ...conversations]
    setConversations(updated); saveConversationsToStorage(updated); loadConversation(newConv.id, updated)
  }

  const loadConversation = (convId, convList = conversations) => {
    const conv = convList.find(c => c.id === convId)
    if (conv && user) {
      setCurrentConversationId(convId); setMessages(conv.messages || [])
      localStorage.setItem(`rag_current_conversation_${user.id}`, convId)
    }
  }

  const deleteConversation = (convId) => {
    if (conversations.length === 1) { alert('Cannot delete the last conversation'); return }
    const updated = conversations.filter(c => c.id !== convId)
    setConversations(updated); saveConversationsToStorage(updated)
    if (currentConversationId === convId) loadConversation(updated[0].id, updated)
    API.delete(`/api/conversations/${convId}`).catch(() => {})
  }

  const renameConversation = (convId, newTitle) => {
    const updated = conversations.map(c => c.id === convId ? { ...c, title: newTitle } : c)
    setConversations(updated); saveConversationsToStorage(updated)
    API.patch(`/api/conversations/${convId}`, { name: newTitle }).catch(() => {})
  }

  const updateConversationTitle = (convId, firstMessage) => {
    const newTitle = generateSmartTitle(firstMessage)
    renameConversation(convId, newTitle)
  }

  const updateConversationMessages = (convId, newMessages) => {
    const updated = conversations.map(c => c.id === convId ? { ...c, messages: newMessages } : c)
    setConversations(updated); saveConversationsToStorage(updated)
  }

  // ── Backend functions ────────────────────────────────────────────────────────
  const checkBackendHealth = async () => {
    try { await API.get('/health'); setStatus('ready') }
    catch { setStatus('error') }
  }

  const fetchDocuments = async () => {
    try { const { data } = await API.get('/api/documents'); setDocuments(data.documents || []) }
    catch (e) { console.error('fetchDocuments error', e) }
  }

  const handleFileUploadArray = async (files) => {
    const file = files?.[0]
    if (!file) return
    const fakeEvent = { target: { files: [file], value: '' } }
    Object.defineProperty(fakeEvent.target, 'value', { set() {}, get() { return '' } })
    await handleFileUpload({ target: { files: [file], value: '' }, _file: file })
  }

  const handleFileUpload = async (e) => {
    const file = e._file || e.target?.files?.[0]
    if (!file) return

    const currentConv = conversations.find(c => c.id === currentConversationId)
    const convDocIds = currentConv?.document_ids || []
    const currentConversationDocs = documents.filter(d => convDocIds.includes(d.document_id))
    const isDuplicate = currentConversationDocs.some(d => d.filename === file.name)
    if (isDuplicate && !window.confirm(`"${file.name}" already exists. Upload anyway?`)) return

    const initialCount = documents.length
    setUploading(true); setUploadProgress(0); setUploadPhase('📤 Uploading file…')

    const formData = new FormData()
    formData.append('file', file)
    if (currentConversationId) formData.append('conversation_id', currentConversationId)

    try {
      const { data } = await API.post('/api/documents/upload', formData, {
        onUploadProgress: pe => setUploadProgress(Math.round((pe.loaded * 100) / pe.total))
      })
      setUploadProgress(100); setUploadPhase('🔄 Processing (OCR → Chunking → Embedding)…')

      if (data.document_id && currentConversationId) {
        setConversations(prev => {
          const updated = prev.map(c => c.id === currentConversationId ? { ...c, document_ids: [...(c.document_ids || []), data.document_id] } : c)
          saveConversationsToStorage(updated); return updated
        })
      }

      // Poll until processed
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 2000))
        setUploadPhase(`⏳ Processing… (${(i + 1) * 2}s)`)
        const { data: newDocs } = await API.get('/api/documents')
        if ((newDocs.documents || []).length > initialCount) { setDocuments(newDocs.documents); break }
      }
      await fetchDocuments()
      setUploadPhase('✅ Done!')
      alert(`✅ "${data.filename}" uploaded and ready.`)
    } catch (err) {
      alert(`❌ Upload error: ${err.response?.data?.detail || err.message}`)
    } finally {
      setUploading(false); setUploadProgress(0); setUploadPhase('')
      if (e.target?.value !== undefined) try { e.target.value = '' } catch {}
    }
  }

  const handleQueryDirect = async (text) => {
    if (!text?.trim() || querying) return

    const userMessage = { role: 'user', content: text, timestamp: new Date().toISOString() }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages); updateConversationMessages(currentConversationId, updatedMessages)
    if (updatedMessages.length === 1) updateConversationTitle(currentConversationId, text)

    setQuerying(true); setIsModelLoading(false)
    modelLoadingTimerRef.current = setTimeout(() => setIsModelLoading(true), 5000)

    try {
      const { data } = await API.post('/api/query', { query: text, top_k: 5, conversation_id: currentConversationId || null })
      const assistantMessage = { role: 'assistant', content: data.answer, sources: data.sources || [], timestamp: new Date().toISOString() }
      const finalMessages = [...updatedMessages, assistantMessage]
      setMessages(finalMessages); updateConversationMessages(currentConversationId, finalMessages)
    } catch (err) {
      const errorMessage = { role: 'assistant', content: `❌ Error: ${err.response?.data?.detail || err.message}`, error: true, timestamp: new Date().toISOString() }
      const finalMessages = [...updatedMessages, errorMessage]
      setMessages(finalMessages); updateConversationMessages(currentConversationId, finalMessages)
    } finally {
      clearTimeout(modelLoadingTimerRef.current); setQuerying(false); setIsModelLoading(false)
    }
  }

  const handleDeleteDocument = async (documentId) => {
    if (!window.confirm('Delete this document?')) return
    try {
      await API.delete(`/api/documents/${documentId}`)
      setConversations(prev => {
        const updated = prev.map(c => ({ ...c, document_ids: (c.document_ids || []).filter(id => id !== documentId) }))
        saveConversationsToStorage(updated); return updated
      })
      fetchDocuments()
    } catch (err) { alert(`❌ ${err.response?.data?.detail || err.message}`) }
  }

  // ── Derived state ────────────────────────────────────────────────────────────
  const canUploadDelete = user && (user.role === 'admin' || user.role === 'super_user')
  const isAdmin = user && user.role === 'admin'
  const currentConv = conversations.find(c => c.id === currentConversationId)
  const convDocIds = currentConv?.document_ids || []
  const currentConversationDocs = documents.filter(d => convDocIds.includes(d.document_id))
  const hasDocuments = convDocIds.length > 0

  // ── Loading splash ───────────────────────────────────────────────────────────
  if (!authChecked) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d0d' }}>
        <div style={{ color: '#8e8ea0', fontSize: 14, fontFamily: "'Inter', system-ui, sans-serif" }}>Loading…</div>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', background: '#0d0d0d', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @keyframes pulse { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }
        * { box-sizing: border-box; }
        ::placeholder { color: #8e8ea0; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #0d0d0d; }
        ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 999px; }
        textarea { scrollbar-width: thin; }
        select option { background: #2f2f2f; color: #ececec; }
      `}</style>

      {/* Login */}
      {!isAuthenticated && <LoginModal onLogin={handleLogin} />}

      {/* Admin Panel */}
      {isAuthenticated && isAdmin && showAdminPanel && (
        <AdminPanel
          onClose={toggleAdminPanel}
          adminTab={adminTab} setAdminTab={setAdminTab}
          fetchAllUsers={fetchAllUsers} fetchBackupData={fetchBackupData}
          allUsers={allUsers} loadingUsers={loadingUsers}
          newUserForm={newUserForm} setNewUserForm={setNewUserForm}
          handleCreateUser={handleCreateUser} creatingUser={creatingUser}
          handleDeleteUser={handleDeleteUser} handleChangeUserRole={handleChangeUserRole}
          user={user}
          backupStatus={backupStatus} backupProviders={backupProviders}
          backupHistory={backupHistory} localBackups={localBackups}
          backupRunning={backupRunning} backupSchedule={backupSchedule}
          showAddProvider={showAddProvider} setShowAddProvider={setShowAddProvider}
          newProvider={newProvider} setNewProvider={setNewProvider}
          handleAddProvider={handleAddProvider} handleRemoveProvider={handleRemoveProvider}
          handleTestProvider={handleTestProvider} testingProvider={testingProvider}
          scheduleForm={scheduleForm} setScheduleForm={setScheduleForm}
          handleSetSchedule={handleSetSchedule} handleRunBackup={handleRunBackup}
          handleDeleteLocalBackup={handleDeleteLocalBackup} handleRestore={handleRestore}
        />
      )}

      {/* Change Password */}
      {showChangePasswordModal && (
        <ChangePasswordModal onClose={() => setShowChangePasswordModal(false)} />
      )}

      {/* Main Layout */}
      {isAuthenticated && user && (
        <>
          <Sidebar
            user={user}
            conversations={conversations}
            currentId={currentConversationId}
            onSelect={id => loadConversation(id)}
            onCreate={createNewConversation}
            onDelete={deleteConversation}
            onRename={renameConversation}
            onLogout={handleLogout}
            onChangePassword={() => setShowChangePasswordModal(true)}
            isMobile={isMobile}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', minWidth: 0 }}>

            {/* Topbar */}
            <div style={{ height: 52, background: '#0d0d0d', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0 }}>
              <button
                onClick={() => setSidebarOpen(o => !o)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8e8ea0', padding: 6, borderRadius: 8, display: 'flex', transition: 'color 150ms' }}
                onMouseEnter={e => e.currentTarget.style.color = '#ececec'}
                onMouseLeave={e => e.currentTarget.style.color = '#8e8ea0'}
              >
                <IconMenu />
              </button>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: currentConv ? '#ececec' : '#5a5a6a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentConv?.title || 'PrivaRAG'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <div style={{ background: '#1e1e2e', border: '1px solid #3a3a5c', borderRadius: 999, padding: '3px 10px', fontSize: 12, color: '#c4b5fd', fontWeight: 500 }}>
                  {import.meta.env.VITE_MODEL_NAME || 'llama3.3'}
                </div>
                {hasDocuments && (
                  <div style={{ background: '#14532d', border: '1px solid rgba(22,163,74,0.2)', borderRadius: 999, padding: '3px 10px', fontSize: 12, color: '#4ade80', fontWeight: 500 }}>
                    {convDocIds.length} doc{convDocIds.length !== 1 ? 's' : ''}
                  </div>
                )}
                {isAdmin && (
                  <button onClick={toggleAdminPanel}
                    style={{ background: '#1e1e2e', border: '1px solid #3a3a5c', borderRadius: 8, padding: '5px 10px', fontSize: 12, color: '#c4b5fd', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                    👥 Admin
                  </button>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: status === 'ready' ? '#22c55e' : status === 'error' ? '#ef4444' : '#f59e0b' }} />
                  <span style={{ fontSize: 12, color: '#8e8ea0' }}>{status === 'ready' ? 'Online' : status === 'error' ? 'Offline' : 'Checking…'}</span>
                </div>
              </div>
            </div>

            {/* Doc chips */}
            <DocChips
              documents={currentConversationDocs}
              onRemove={handleDeleteDocument}
              uploading={uploading}
              uploadProgress={uploadProgress}
              uploadPhase={uploadPhase}
            />

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {messages.length === 0
                ? <EmptyState
                    documents={currentConversationDocs}
                    onPrompt={handleQueryDirect}
                    onUploadClick={() => {
                      if (!canUploadDelete) { alert('You need admin or super_user role to upload documents.'); return }
                      const inp = document.querySelector('input[data-role="file-upload"]')
                      inp?.click()
                    }}
                  />
                : <div style={{ padding: '24px 24px 8px', maxWidth: 820, width: '100%', margin: '0 auto' }}>
                    {messages.map((msg, i) => <Message key={i} msg={msg} username={user.username} />)}
                    {querying && (
                      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                        <div style={{ width: 32, height: 32, background: '#1e1e2e', border: '1px solid #3a3a5c', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4 }}>
                          <IconSparkle />
                        </div>
                        <div style={{ borderLeft: '2px solid #7c3aed', paddingLeft: 12, paddingTop: 8 }}>
                          {isModelLoading ? <span style={{ color: '#8e8ea0', fontSize: 14 }}>🧠 Loading model into memory (10–20s)…</span> : <TypingDots />}
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
              }
            </div>

            {/* Input */}
            <InputBar
              onSend={handleQueryDirect}
              onUpload={handleFileUploadArray}
              disabled={querying || !hasDocuments}
              canUpload={canUploadDelete}
            />
          </div>
        </>
      )}

      {/* Hidden file input for InputBar (data-role allows EmptyState to trigger it) */}
      <input
        data-role="file-upload"
        type="file"
        accept=".pdf,.txt,.docx,.md,.doc,.pptx,.xlsx"
        multiple
        style={{ display: 'none' }}
        onChange={e => { handleFileUploadArray(Array.from(e.target.files)); e.target.value = '' }}
      />
    </div>
  )
}

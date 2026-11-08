import { useCallback, useState, type FormEvent } from 'react'
import { Avatar, Empty, ErrorNotice, Icon } from '../../components/ui'
import { navigate } from '../../lib/router'
import { Link } from '../../components/Link'
import { useLiveRefresh } from '../../lib/use-live-refresh'
import { changePassword, fetchStats, logout, removeAvatar, updateProfile, uploadAvatar, type UserStats } from '../auth/auth-api'
import { useSession } from '../auth/session'
import { fetchPersonalBooks } from '../books/book-api'
import type { Book } from '../../types/books'

export function ProfilePage() {
  const { user } = useSession()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [books, setBooks] = useState<Book[]>([])
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const sync = useCallback(async (current: () => boolean) => {
    try { const [counts, list] = await Promise.all([fetchStats(), fetchPersonalBooks('mine', 1)]); if (current()) { setStats(counts); setBooks(list.items.slice(0, 4)); setError('') } }
    catch (cause) { if (current()) setError(cause instanceof Error ? cause.message : '读取资料失败') }
  }, [])
  useLiveRefresh(sync, !!user, revision)
  if (!user) return null
  return <><section className="profile-hero"><div className="profile-top"><Avatar url={user.avatarUrl} name={user.nickname} large/><div className="profile-copy"><h1>{user.nickname}</h1><p>{user.college || '还没有填写院系'}</p><span className="account-badge">{user.role === 'admin' ? '本机管理员' : '校园书友'}</span></div><Link className="icon-button" to="/settings" aria-label="账户设置"><Icon name="settings"/></Link></div><p className="profile-bio">{user.bio || '还没有自我介绍，去编辑资料，和书友打个招呼吧。'}</p><Link className="profile-edit-link" to="/me/edit">编辑个人资料 <Icon name="edit" size={15}/></Link>
    <div className="profile-stats"><Link to="/me/books"><strong>{stats?.published ?? '—'}</strong><span>我的发布</span></Link><Link to="/records"><strong>{stats?.reservations ?? '—'}</strong><span>预约中</span></Link><Link to="/records"><strong>{stats?.completed ?? '—'}</strong><span>已完成</span></Link><div><strong>{stats?.gifts ?? '—'}</strong><span>免费赠出</span></div></div></section>
    <nav className="profile-tabs"><Link className="active" to="/me/books">我的发布</Link><Link to="/me/favorites">我的收藏</Link><Link to="/records">交易记录</Link><Link to="/me/reports">我的反馈</Link></nav>
    {error && <ErrorNotice message={error} retry={() => setRevision((n) => n + 1)}/>}
    <section className="profile-books"><div className="section-heading"><h2>我的书架</h2><Link to="/me/books">查看全部 <Icon name="arrow" size={14}/></Link></div>{books.length ? books.map((book) => <Link key={book.id} className="personal-book" to={`/books/${book.id}`}><div className="mini-cover">{book.coverUrl ? <img src={book.coverUrl} alt=""/> : <Icon name="book"/>}</div><div><h3>{book.title}</h3><strong className="price">{book.category === 'donation' ? '免费赠送' : `¥${book.price.toFixed(2)}`}</strong><small>{book.edition} · {book.condition}</small></div><span className={`status-pill ${book.status}`}>{({ available: '在售', reserved: '已预约', completed: '已完成', offline: '已下架', draft: '草稿' })[book.status]}</span></Link>) : <Empty title="书架还空着">发布第一本书，让它遇见下一位需要的人。</Empty>}{!books.length && <Link className="button primary" to="/publish">发布第一本书</Link>}</section>
    {user.role === 'admin' && <div className="settings-links"><Link to="/admin"><Icon name="shield"/>书籍与操作管理<Icon name="arrow"/></Link><Link to="/admin/reports"><Icon name="records"/>处理举报和争议<Icon name="arrow"/></Link></div>}
  </>
}

export function EditProfilePage() {
  const { user, setUser, notice } = useSession()
  const [nickname, setNickname] = useState(user?.nickname ?? '')
  const [college, setCollege] = useState(user?.college ?? '')
  const [gender, setGender] = useState(user?.gender ?? 'undisclosed')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [contact, setContact] = useState(user?.contact ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!user) return null
  async function avatarAction(action: () => ReturnType<typeof uploadAvatar>) {
    if (busy) return
    setBusy(true); setError('')
    try { setUser(await action()); notice('头像已更新') }
    catch (cause) { setError(cause instanceof Error ? cause.message : '头像更新失败') }
    finally { setBusy(false) }
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return
    setBusy(true); setError('')
    try { setUser(await updateProfile({ nickname: nickname.trim(), college, gender, bio, contact })); notice('资料已保存'); navigate('/me') }
    catch (cause) { setError(cause instanceof Error ? cause.message : '资料保存失败') }
    finally { setBusy(false) }
  }
  return <form className="form-card profile-form" onSubmit={save}><fieldset disabled={busy}><div className="avatar-editor"><Avatar url={user.avatarUrl} name={user.nickname} large/><div><label className="upload-button">更换头像<input type="file" accept="image/jpeg,image/png,image/webp" aria-label="上传头像" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void avatarAction(() => uploadAvatar(file)) }}/></label><small>JPG、PNG、WebP，2MB以内</small>{user.avatarUrl && <button type="button" className="text-button" onClick={() => avatarAction(async () => { await removeAvatar(); return { ...user, avatarUrl: null } })}>移除头像</button>}</div></div>
    <label>账号<input aria-label="账号" value={user.username ?? ''} readOnly/><small className="field-help">账号用于登录，昵称可以自由修改。</small></label><label>昵称<input required maxLength={80} value={nickname} onChange={(e) => setNickname(e.target.value)}/></label><label>性别<select aria-label="性别" value={gender} onChange={(e) => setGender(e.target.value as typeof gender)}><option value="undisclosed">保密</option><option value="female">女</option><option value="male">男</option><option value="other">其他</option></select></label><label>学校 / 院系<input maxLength={120} value={college} onChange={(e) => setCollege(e.target.value)} placeholder="例如：武汉大学 · 数学与统计学院"/></label><label>自我介绍<textarea aria-label="自我介绍" maxLength={500} rows={4} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="喜欢什么书？和大家介绍一下自己吧。"/><small className="field-help">{bio.length} / 500</small></label><label>联系方式<input aria-label="联系方式" maxLength={200} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="例如：你愿意向交易对方提供的微信号"/><small className="field-help">不会出现在公开资料中，仅在接受预约后向交易对方展示。</small></label>{error && <ErrorNotice message={error}/>}<button className="primary-action" disabled={busy}>{busy ? '正在保存…' : '保存个人资料'}</button></fieldset></form>
}

export function SettingsPage() {
  const { user, setUser, notice } = useSession()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <section className="form-card"><h2>账户与资料</h2><p className="muted">当前账号：{user?.username}</p><div className="settings-links"><Link to="/me/edit"><Icon name="user"/>编辑个人资料<Icon name="arrow"/></Link><Link to="/settings/password"><Icon name="shield"/>修改密码<Icon name="arrow"/></Link><Link to="/about"><Icon name="book"/>关于珞珈书桥<Icon name="arrow"/></Link></div>{error && <ErrorNotice message={error}/>}<button className="button danger" disabled={busy} onClick={async () => { setBusy(true); try { await logout(); setUser(null); notice('已退出登录'); navigate('/login') } catch (cause) { setError(cause instanceof Error ? cause.message : '退出失败') } finally { setBusy(false) } }}><Icon name="logout"/>退出登录</button></section>
}

export function PasswordPage() {
  const { setUser, notice } = useSession()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return
    if (newPassword !== confirmation) { setError('两次输入的新密码不一致'); return }
    setBusy(true); setError('')
    try { await changePassword(oldPassword, newPassword); setUser(null); notice('密码已修改，请重新登录'); navigate('/login?next=/me', true) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '修改失败') }
    finally { setBusy(false) }
  }
  return <form className="form-card" onSubmit={submit}><fieldset disabled={busy}><p className="info-note">修改成功后，所有设备上的登录都会退出，请使用新密码重新登录。</p><label>当前密码<input required type="password" autoComplete="current-password" minLength={8} maxLength={128} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)}/></label><label>新密码<input required type="password" autoComplete="new-password" minLength={8} maxLength={128} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}/></label><label>确认新密码<input required type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirmation} onChange={(e) => setConfirmation(e.target.value)}/></label>{error && <ErrorNotice message={error}/>}<button className="primary-action" disabled={busy}>{busy ? '正在修改…' : '确认修改密码'}</button></fieldset></form>
}

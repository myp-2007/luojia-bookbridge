import { useState, type FormEvent } from 'react'
import { navigate } from '../../lib/router'
import { Link } from '../../components/Link'
import { Avatar, Icon } from '../../components/ui'
import { useSession } from './session'
import { register, signIn } from './auth-api'

export function AuthPage({ registering, next }: { registering: boolean; next: string }) {
  const { setUser, notice } = useSession()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [nickname, setNickname] = useState('小珞')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const target = next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') && !next.startsWith('/register') ? next : '/me'
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (registering && password !== confirm) { setError('两次输入的密码不一致'); return }
    setBusy(true); setError('')
    try {
      const user = registering ? await register(username, password, nickname) : await signIn(username, password)
      setUser(user); notice(registering ? '注册成功，欢迎加入书桥' : '欢迎回来')
      navigate(target, true)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '暂时无法登录，请重试') }
    finally { setBusy(false) }
  }
  return <section className="auth-layout"><div className="auth-story"><span className="overline">LUOJIA BOOKBRIDGE</span><h2>一本书，<br/>在珞珈遇见下一位主人。</h2><p>把读过的书交给需要的同学，<br/>把新的故事留在校园里。</p><Icon name="book" size={98}/></div><div className="auth-card">
    <div className="auth-mascot"><Avatar name="小珞" large/><div><small>你好，我是小珞</small><h1>{registering ? '加入珞珈书桥' : '欢迎回来'}</h1></div></div>
    <p className="muted">{registering ? '创建自己的账号，开始整理你的校园书架。' : '登录自己的账号，继续你的读书与分享。'}</p>
    <form onSubmit={submit}><fieldset disabled={busy}>
      {registering && <label>昵称<input value={nickname} onChange={(e) => setNickname(e.target.value)} required maxLength={80} autoComplete="nickname"/></label>}
      <label>账号<input required minLength={3} maxLength={32} pattern="[A-Za-z0-9_.-]+" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="3–32位字母、数字、下划线等" autoComplete="username" autoCapitalize="none" spellCheck={false}/></label>
      <label>密码<input required type={visible ? 'text' : 'password'} minLength={8} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少8位，设置你自己的密码" autoComplete={registering ? 'new-password' : 'current-password'}/></label>
      {registering && <label>确认密码<input required type={visible ? 'text' : 'password'} minLength={8} maxLength={128} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password"/></label>}
      <label className="check-row"><input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)}/>显示密码</label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-action" disabled={busy}>{busy ? '正在处理…' : registering ? '创建账号' : '登录'}</button>
    </fieldset></form>
    <p className="auth-switch">{registering ? '已经有账号？' : '还没有账号？'} <Link to={`${registering ? '/login' : '/register'}?next=${encodeURIComponent(target)}`}>{registering ? '去登录' : '立即注册'}</Link></p>
    <p className="fine-print">账号、资料和书籍保存在站点主机上。请记住自己的账号与密码，当前不提供邮箱找回。</p>
  </div></section>
}

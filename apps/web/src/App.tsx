import { useCallback, useEffect, useRef, useState } from 'react'
import { navigate, useLocation } from './lib/router'
import { Link } from './components/Link'
import { useLiveRefresh } from './lib/use-live-refresh'
import { Empty, ErrorNotice, Icon, PageHeader } from './components/ui'
import { SessionContext, useSession } from './features/auth/session'
import { getMe, setSignedInId, type User } from './features/auth/auth-api'
import { AuthPage } from './features/auth/AuthPage'
import { HomePage, CatalogPage, PersonalBooksPage } from './features/books/CatalogPages'
import { BookDetailPage } from './features/books/BookDetailPage'
import { createBook, fetchBook, updateBook, uploadBookImage } from './features/books/book-api'
import { PublishBookForm } from './features/books/PublishBookForm'
import { BookImagesPage } from './features/books/BookImagesPage'
import { AIRecognitionPage } from './features/ai/AIRecognitionPage'
import { ReservationsPage } from './features/reservations/ReservationsPage'
import { BookReportPage } from './features/reports/BookReportPage'
import { createReport } from './features/reports/report-api'
import { ReportsPage } from './features/reports/ReportsPage'
import { EditProfilePage, PasswordPage, ProfilePage, SettingsPage } from './features/account/ProfilePages'
import { AdminWorkspace } from './features/account/AdminWorkspace'
import type { Book } from './types/books'
import './App.css'

const sectionTitles: Record<string,string> = { '/discover': '发现好书', '/publish': '发布书籍', '/records': '预约与交接', '/me': '我的书桥', '/me/edit': '编辑个人资料', '/me/books': '我的发布', '/me/favorites': '我的收藏', '/me/reports': '我的反馈', '/settings': '账户设置', '/settings/password': '修改密码', '/admin': '书籍与操作管理', '/admin/reports': '处理举报与争议', '/about': '关于珞珈书桥' }
const actionTitles: Record<string,string> = { edit: '编辑书籍', images: '管理书籍图片', recognize: 'AI识别书籍', report: '反馈书籍问题' }

function App() {
  const location = useLocation()
  const separator = location.indexOf('?')
  const path = separator < 0 ? location : location.slice(0, separator)
  const rawSearch = separator < 0 ? '' : location.slice(separator + 1)
  const params = new URLSearchParams(rawSearch)
  const parts = path.split('/').filter(Boolean)
  const [user, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const setUser = useCallback((value: User | null) => { setCurrentUser(value); setSignedInId(value?.id ?? '') }, [])
  const notice = useCallback((message: string) => { clearTimeout(timer.current); setToast(message); timer.current = setTimeout(() => setToast(''), 5000) }, [setToast])
  useEffect(() => {
    let active = true
    const expired = () => setUser(null)
    window.addEventListener('session-expired', expired)
    getMe().then((current) => { if (active) setUser(current) }).catch(() => {}).finally(() => { if (active) setLoading(false) })
    return () => { active = false; window.removeEventListener('session-expired', expired); clearTimeout(timer.current) }
  }, [setUser])
  const protectedPage = path.startsWith('/me') || path.startsWith('/settings') || path.startsWith('/admin') || path === '/publish' || path === '/records' || (parts[0] === 'books' && parts.length > 2)
  useEffect(() => { if (!loading && protectedPage && !user) navigate('/login?next=' + encodeURIComponent(location), true) }, [loading, protectedPage, user, location])
  const title = parts[0] === 'books' ? actionTitles[parts[2]] ?? '书籍详情' : parts[0] === 'users' ? '书友主页' : sectionTitles[path] ?? '珞珈书桥'
  useEffect(() => { document.title = title + ' · 珞珈书桥' }, [title])
  const authPage = path === '/login' || path === '/register'
  const focusPage = authPage || path === '/publish' || (parts[0] === 'books') || path === '/me/edit' || path === '/settings/password'
  async function publish(book: Book, files: File[] = []) {
    const result = await createBook(book)
    let failed = false
    for (const file of files) { try { await uploadBookImage(result.id, file) } catch { failed = true; break } }
    notice(failed ? '书籍已发布，部分图片未完成上传，可在图片管理中补传。' : '发布成功，其他书友现在可以看到你的书了')
    if (window.location.pathname === '/publish') navigate(`/books/${result.id}${failed ? '/images' : ''}`, true)
  }
  let content
  if (loading || (protectedPage && !user)) content = <p className="loading" role="status">正在连接你的书桥…</p>
  else if (authPage) content = <AuthPage key={path} registering={path === '/register'} next={params.get('next') ?? '/me'}/>
  else if (path === '/') content = <HomePage/>
  else if (path === '/discover') content = <CatalogPage key={location} search={rawSearch}/>
  else if (path === '/publish') content = <PublishBookForm onSubmit={publish}/>
  else if (parts[0] === 'books' && parts[1]) content = <BookRoute key={location + ':' + (user?.id ?? '')} id={parts[1]} action={parts[2]}/>
  else if (path === '/records') content = <ReservationsPage onClose={() => navigate('/')} onNotice={notice}/>
  else if (path === '/me') content = <ProfilePage/>
  else if (path === '/me/edit') content = <EditProfilePage/>
  else if (path === '/me/books' || path === '/me/favorites') content = <PersonalBooksPage key={location} kind={path.endsWith('favorites') ? 'favorites' : 'mine'} page={Math.max(1, Number(params.get('page')) || 1)}/>
  else if (parts[0] === 'users' && parts[1]) content = <PersonalBooksPage key={location} kind={parts[1]} page={Math.max(1, Number(params.get('page')) || 1)}/>
  else if (path === '/me/reports') content = <ReportsPage/>
  else if (path === '/settings') content = <SettingsPage/>
  else if (path === '/settings/password') content = <PasswordPage/>
  else if (path === '/admin' || path === '/admin/reports') content = user?.role === 'admin' ? path.endsWith('reports') ? <ReportsPage admin/> : <AdminWorkspace onChanged={() => {}}/> : <Empty title="此页面仅管理员可用" link="/" label="返回首页"/>
  else if (path === '/about') content = <section className="form-card about-page"><h1>珞珈书桥</h1><p>一本书，连接更多珞珈人。</p><p>在这里发布闲置书籍、发现好书、预约线下交接。书籍和个人资料保存在运行本站的主机上，登录后才能管理自己的内容。</p><p>请如实填写版本和品相，在公共地点核对实物，完成交接后由双方确认。本平台不提供在线支付，不以未经核验的学校身份或交易统计作保证。</p><h2>图片来源</h2><p>首页校园摄影：<a href="https://commons.wikimedia.org/wiki/File:Cherry_Blossom_in_Wuhan_University_1.jpg" target="_blank" rel="noreferrer">Zhangmoon618 / Wikimedia Commons</a>，<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">CC BY-SA 3.0</a>，原图本地保存，页面采用裁切显示与渐变叠加。</p><p>旧版导入书籍已在说明中标注样例，封面及书目信息来自高等教育出版社公开目录；正常注册和发布的数据均真实保存。</p></section>
  else content = <Empty title="这个页面不存在" link="/" label="返回首页"/>
  return <SessionContext.Provider value={{ user, loading, setUser, notice }}><div className={`site-shell ${focusPage ? 'focused-page' : ''} ${path === '/' ? 'home-page' : ''}`}>{path !== '/' && <PageHeader title={authPage ? '珞珈书桥' : title} action={!authPage && <Link className="header-home" to="/" aria-label="返回首页"><Icon name="home" size={20}/></Link>}/>}<main key={path} className="page-content">{content}</main>{!focusPage && <nav className="bottom-nav" aria-label="主导航">{[{ path: '/', label: '首页', icon: 'home' }, { path: '/discover', label: '发现', icon: 'search' }, { path: '/publish', label: '发布', icon: 'plus' }, { path: '/records', label: '记录', icon: 'records' }, { path: '/me', label: '我的', icon: 'user' }].map((item) => <Link key={item.path} to={item.path} aria-current={(item.path === '/' ? path === '/' : path.startsWith(item.path)) ? 'page' : undefined} className={item.path === '/publish' ? 'nav-publish' : ''}><span><Icon name={item.icon} size={23}/></span><small>{item.label}</small></Link>)}</nav>}{toast && <div className="toast" role="status">{toast}<button aria-label="关闭提示" onClick={() => setToast('')}>×</button></div>}</div></SessionContext.Provider>
}

function BookRoute({ id, action }: { id: string; action?: string }) {
  const { user, notice } = useSession()
  const [book, setBook] = useState<Book | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const refresh = () => setRevision((n) => n + 1)
  const sync = useCallback(async (current: () => boolean) => { try { const result = await fetchBook(id); if (current()) { setBook(result); setError('') } } catch (cause) { if (current()) setError(cause instanceof Error ? cause.message : '书籍加载失败') } }, [id])
  useLiveRefresh(sync, true, revision)
  if (!book) return error ? <ErrorNotice message={error} retry={refresh}/> : <p role="status" className="loading">正在读取书籍…</p>
  if (action && action !== 'report' && user?.id !== book.sellerId) return <Empty title="只能管理自己发布的书籍" link={`/books/${id}`} label="查看书籍"/>
  if (action && action !== 'report' && (book.isSuspended || !['available','offline','draft'].includes(book.status))) return <Empty title="当前书籍资料已锁定">{book.isSuspended ? book.moderationReason : '预约中和已完成的书籍不能更改资料，请先处理交易。'}</Empty>
  if (action === 'images') return <BookImagesPage book={book} onClose={() => navigate(`/books/${id}`)} onChanged={refresh}/>
  if (action === 'edit') return <PublishBookForm initialBook={book} onSubmit={async (value) => { await updateBook(value); notice('书籍资料已保存'); if (window.location.pathname === `/books/${id}/edit`) navigate(`/books/${id}`, true) }}/>
  if (action === 'recognize') return book.coverUrl ? <AIRecognitionPage book={book} onApplied={refresh} onClose={() => navigate(`/books/${id}`, true)}/> : <Empty title="先上传清晰的书籍封面" link={`/books/${id}/images`} label="上传书籍图片">识别会读取实际图片，核对候选后才会保存到书籍资料。</Empty>
  if (action === 'report') return <BookReportPage onSubmit={async (reason, description) => { await createReport(id, reason, description); notice('反馈已提交，可在我的反馈中查看处理结果'); navigate('/me/reports', true) }}/>
  if (action) return <Empty title="这个书籍页面不存在" link={`/books/${id}`}/>
  return <>{error && <ErrorNotice message={error} retry={refresh}/>}<BookDetailPage book={book} refresh={refresh} onFavorite={(value) => setBook((current) => current ? { ...current, isFavorite: value } : current)}/></>
}
export default App

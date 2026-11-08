import type { ReactNode } from 'react'
import { goBack } from '../lib/router'
import { Link } from './Link'

const paths: Record<string, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  records: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9zM9 11h6M9 15h4"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
  book: <><path d="M3 4h5a5 5 0 0 1 4 2 5 5 0 0 1 4-2h5v16h-5a5 5 0 0 0-4 2 5 5 0 0 0-4-2H3ZM12 6v16"/></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>,
  back: <path d="m15 5-7 7 7 7"/>,
  arrow: <path d="m9 5 7 7-7 7"/>,
  settings: <><path d="m9 3-1 3-3 1v4l-2 1 2 2v4l3 1 1 2h6l1-2 3-1v-4l2-2-2-1V7l-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/></>,
  pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/></>,
  gift: <><rect x="4" y="10" width="16" height="11" rx="1"/><path d="M3 6h18v4H3ZM12 6v15M12 6C7 7 5 4 7 2s5 0 5 4Zm0 0c5 1 7-2 5-4s-5 0-5 4Z"/></>,
  edit: <><path d="m16 3 5 5-12 12-6 1 1-6ZM14 5l5 5"/></>,
  camera: <><path d="M3 7h4l2-3h6l2 3h4v14H3Z"/><circle cx="12" cy="13" r="4"/></>,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/></>,
  logout: <><path d="M9 3H4v18h5M9 12h12m-4-4 4 4-4 4"/></>,
  check: <path d="m5 12 4 4L20 5"/>,
}
export function Icon({ name, size = 22 }: { name: string; size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.book}</svg> }
export function Avatar({ url, name = '小珞', large = false }: { url?: string | null; name?: string; large?: boolean }) { return <span className={`avatar ${large ? 'large' : ''}`}>{url ? <img src={url} alt={`${name}的头像`} /> : <span>{name.slice(0, 1)}</span>}</span> }
export function PageHeader({ title, action }: { title: string; action?: ReactNode }) { return <header className="page-header"><button className="icon-button" onClick={() => goBack()} aria-label="返回"><Icon name="back"/></button><h1>{title}</h1><div className="page-header-action">{action}</div></header> }
export function Empty({ title, children, link, label }: { title: string; children?: ReactNode; link?: string; label?: string }) { return <div className="empty-state"><Icon name="book" size={38}/><h3>{title}</h3>{children && <p>{children}</p>}{link && <Link className="button primary" to={link}>{label ?? '去逛逛'}</Link>}</div> }
export function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) { return <div className="form-error" role="alert">{message}{retry && <button onClick={retry}>重新读取</button>}</div> }
export function Pagination({ page, total, size = 12, onPage }: { page: number; total: number; size?: number; onPage: (page: number) => void }) {
  const count = Math.max(1, Math.ceil(total / size))
  return total > 0 ? <nav className="pagination" aria-label="列表分页"><button disabled={page <= 1} onClick={() => onPage(page - 1)}>上一页</button><span>第 {page} / {count} 页 · 共 {total} 本</span><button disabled={page >= count} onClick={() => onPage(page + 1)}>下一页</button></nav> : null
}

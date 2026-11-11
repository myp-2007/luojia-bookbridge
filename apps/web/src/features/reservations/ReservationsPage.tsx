import { useCallback, useRef, useState } from 'react'
import { fetchBook } from '../books/book-api'
import { changeReservation, fetchContact, fetchMyReservations, reservationUserId } from './reservation-api'
import type { ReservationAction, ReservationRole } from './reservation-api'
import type { Reservation } from '../../types/reservations'
import { useLiveRefresh } from '../../lib/use-live-refresh'
import { PickupMapLink } from '../maps/PlaceSearch'

type RecordItem = Reservation & { bookTitle: string }

const statusLabels: Record<Reservation['status'], string> = {
  pending: '等待卖家接受', confirmed: '等待线下交接', rejected: '卖家已拒绝',
  cancelled: '预约已取消', expired: '预约已过期', completed: '交易已完成', disputed: '争议处理中',
}

function formatTime(value: string | null): string {
  return value ? new Date(value).toLocaleString('zh-CN') : '待双方协商'
}

export function ReservationsPage({ onClose, onNotice }: {
  onClose: () => void
  onNotice: (message: string) => void
}) {
  const [role, setRole] = useState<ReservationRole>('buyer')
  const [items, setItems] = useState<RecordItem[]>([])
  const [loading, setLoading] = useState(true)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [confirmationId, setConfirmationId] = useState<string | null>(null)
  const [contactInfo, setContactInfo] = useState<Record<string, string>>({})
  const [reload, setReload] = useState(0)
  const busy = useRef(false)

  const syncReservations = useCallback(async (isCurrent: () => boolean) => {
    try {
      const records = await fetchMyReservations(role)
      const userId = reservationUserId(role)
      const filtered = records.filter((item) => role === 'buyer' ? item.buyerId === userId : item.buyerId !== userId)
      const enriched = await Promise.all(filtered.map(async (item) => {
        const book = item.bookTitle ? null : await fetchBook(item.bookId).catch(() => null)
        return { ...item, bookTitle: item.bookTitle ?? book?.title ?? `书籍 ${item.bookId.slice(0, 8)}` }
      }))
      if (isCurrent()) { setItems(enriched); setSyncError(null) }
    } catch (cause) {
      if (isCurrent()) setSyncError(cause instanceof Error ? cause.message : '暂时无法读取预约记录')
    } finally {
      if (isCurrent()) setLoading(false)
    }
  }, [role])
  useLiveRefresh(syncReservations, submittingId === null, reload)


  function refresh() {
    setError(null)
    setSyncError(null)
    setLoading(true)
    setConfirmationId(null)
    setReload((value) => value + 1)
  }

  function selectRole(next: ReservationRole) {
    if (next === role || busy.current) return
    setRole(next)
    setConfirmationId(null)
    setError(null)
    setItems([])
    setContactInfo({})
    setSyncError(null)
    setLoading(true)
  }

  async function act(item: RecordItem, action: ReservationAction) {
    if (busy.current) return
    busy.current = true
    setSubmittingId(item.id)
    setError(null)
    try {
      const updated = await changeReservation(item.id, action, role)
      setItems((current) => current.map((record) => record.id === updated.id ? { ...record, ...updated } : record))
      setConfirmationId(null)
      onNotice(updated.status === 'completed' ? '双方已确认，交易完成' : '操作已保存')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败，请刷新后重试')
    } finally {
      busy.current = false
      setSubmittingId(null)
    }
  }

  const pending = items.filter((item) => item.status === 'pending' || item.status === 'confirmed').length

  return (
    <div className="page-section">
      <section className="trade-panel" role="region" aria-labelledby="reservation-title" onMouseDown={(event) => event.stopPropagation()}>
        <span className="section-kicker">我的书桥</span>
        <h2 id="reservation-title">预约与交接</h2>
        <p className="trade-intro">从预约到收书，每一步都有记录。</p>
        <p className="trade-sync-note">每5秒同步预约与交接进度。</p>
        <div className="trade-tabs" aria-label="预约身份">
          <button aria-pressed={role === 'buyer'} disabled={submittingId !== null} onClick={() => selectRole('buyer')}>我买入的</button>
          <button aria-pressed={role === 'seller'} disabled={submittingId !== null} onClick={() => selectRole('seller')}>我卖出的</button>
        </div>
        <div className="trade-summary"><span>{loading ? '读取中' : `${pending} 笔进行中 · ${items.length} 笔记录`}</span>{<button disabled={loading || submittingId !== null} onClick={refresh}>刷新记录</button>}</div>
        {(error || syncError) && <div className="form-error" role="alert">{error || syncError}{<button disabled={submittingId !== null} onClick={refresh}>重新读取</button>}</div>}
        {loading && <p role="status">正在读取预约记录…</p>}
        {!loading && !error && !syncError && !items.length && <div className="empty-state"><strong>暂无{role === 'buyer' ? '买入' : '卖出'}记录</strong><p>{role === 'buyer' ? '找到喜欢的书，发起你的第一笔预约。' : '发布书籍后，收到的预约会显示在这里。'}</p></div>}
        <div className="trade-list">{!loading && items.map((item) => {
          const alreadyConfirmed = role === 'buyer' ? item.buyerConfirmedAt : item.sellerConfirmedAt
          const active = item.status === 'pending' || item.status === 'confirmed'
          return (
            <article className="trade-record" key={item.id}>
              <div className="trade-record-heading"><h3>{item.bookTitle}</h3><span className={`trade-status ${item.status}`}>{statusLabels[item.status]}</span></div>
              <dl><div><dt>交接地点</dt><dd>{item.pickupPoint || '待双方协商'}</dd></div><div><dt>约定时间</dt><dd>{formatTime(item.proposedTime)}</dd></div></dl>
              {item.pickupPoint && <PickupMapLink label={item.pickupPoint}/>}
              {(item.status === 'confirmed' || item.status === 'completed') && <div className="trade-progress" aria-label="双方交接确认进度"><span data-done={!!item.buyerConfirmedAt}>买家{item.buyerConfirmedAt ? '已确认' : '待确认'}</span><span data-done={!!item.sellerConfirmedAt}>卖家{item.sellerConfirmedAt ? '已确认' : '待确认'}</span></div>}
              {item.completedAt && <p className="trade-completed">完成于 {formatTime(item.completedAt)}</p>}
              {item.status === 'confirmed' && alreadyConfirmed && <p className="trade-help">你的交接已确认，等待另一方确认。</p>}
              <div className="trade-actions">
                {role === 'seller' && item.status === 'pending' && <><button disabled={submittingId !== null} onClick={() => act(item, 'confirm')}>接受预约</button><button className="trade-secondary" disabled={submittingId !== null} onClick={() => act(item, 'reject')}>拒绝预约</button></>}
                {role === 'buyer' && active && !item.buyerConfirmedAt && !item.sellerConfirmedAt && <button className="trade-secondary" disabled={submittingId !== null} onClick={() => act(item, 'cancel')}>取消预约</button>}
                {item.status === 'confirmed' && !alreadyConfirmed && <button disabled={submittingId !== null} onClick={() => setConfirmationId(item.id)}>确认{role === 'buyer' ? '已收到书' : '已交出书'}</button>}
                {['confirmed', 'completed', 'disputed'].includes(item.status) && <button className="trade-secondary" disabled={submittingId !== null} onClick={async () => {
                  try { const data = await fetchContact(item.id); setContactInfo((current) => ({ ...current, [item.id]: data.contact || '对方尚未提供联系方式，请按公共交接点约定会面' })) }
                  catch (cause) { setError(cause instanceof Error ? cause.message : '读取失败') }
                }}>查看对方联系方式</button>}
                {item.status === 'confirmed' && <button className="trade-secondary" disabled={submittingId !== null} onClick={() => act(item, 'dispute')}>申请争议处理</button>}
              </div>
              {contactInfo[item.id] && <p className="trade-help">{contactInfo[item.id]}</p>}
              {item.status === 'disputed' && <p className="trade-help">已冻结交易并提交管理员核实，请在“我的反馈”查看处理结果。</p>}
              {confirmationId === item.id && item.status === 'confirmed' && !alreadyConfirmed && <div className="trade-confirmation"><p>请确认已当面核对书籍、完成线下付款和交接。双方确认后，交易将结束。</p><button disabled={submittingId !== null} onClick={() => act(item, role === 'buyer' ? 'buyer-confirm' : 'seller-confirm')}>确认交接完成</button><button disabled={submittingId !== null} onClick={() => setConfirmationId(null)}>暂不确认</button></div>}
              {submittingId === item.id && <p role="status">正在保存，请稍候…</p>}
            </article>
          )
        })}</div>
        <button className="secondary-action" disabled={submittingId !== null} onClick={onClose}>返回书架</button>
      </section>
    </div>
  )
}

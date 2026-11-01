import { useEffect, useState } from 'react'
import { cancelReservation, confirmBuyerHandover, fetchMyReservations } from './reservation-api'
import type { Reservation } from '../../types/reservations'

const statusLabels: Record<Reservation['status'], string> = {
  pending: '等待卖家确认', confirmed: '已确认', rejected: '已拒绝', cancelled: '已取消', expired: '已过期', completed: '已完成', disputed: '争议处理中',
}

export function MyReservationsDialog({ useApi, onClose, onNotice }: { useApi: boolean; onClose: () => void; onNotice: (message: string) => void }) {
  const [items, setItems] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(useApi)
  const [error, setError] = useState<string | null>(null)
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  useEffect(() => {
    if (!useApi) return
    fetchMyReservations().then(setItems).catch(() => setError('暂时无法读取预约记录')).finally(() => setLoading(false))
  }, [useApi])

  const cancel = async (reservationId: string) => {
    try {
      if (useApi) {
        const updated = await cancelReservation(reservationId)
        setItems((current) => current.map((item) => item.id === updated.id ? updated : item))
      }
      onNotice('预约已取消，书籍会恢复为可预约状态')
    } catch {
      onNotice('取消失败，请稍后重试')
    }
  }

  const confirmHandover = async (reservationId: string) => {
    try {
      setSubmittingId(reservationId)
      if (useApi) {
        const updated = await confirmBuyerHandover(reservationId)
        setItems((current) => current.map((item) => item.id === updated.id ? updated : item))
      }
      onNotice('已记录你的交接确认，等待另一方确认')
    } catch {
      onNotice('确认失败，请确认卖家已接受预约')
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="reservation-dialog" role="dialog" aria-modal="true" aria-labelledby="reservation-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="dialog-close" onClick={onClose} aria-label="关闭预约记录">×</button>
        <div className="dialog-title-row"><div><span className="section-kicker">我的记录</span><h2 id="reservation-title">我的预约</h2></div></div>
        {!useApi && <p className="dialog-intro">开启真实 API 后，这里会显示你发起的预约和交易状态。</p>}
        {loading && <p className="api-notice">正在读取预约记录...</p>}
        {error && <p className="form-error">{error}</p>}
        {!loading && !error && useApi && !items.length && <div className="empty-state"><span>⌑</span><strong>还没有预约记录</strong><p>找到合适的书后，预约交接就会显示在这里。</p></div>}
        {!!items.length && <div className="reservation-list">{items.map((item) => <article className="reservation-item" key={item.id}><div><strong>书籍预约</strong><span>{statusLabels[item.status]}</span></div><p>交接地点：{item.pickupPoint || '待确认'}</p><small>{item.proposedTime ? new Date(item.proposedTime).toLocaleString() : '时间待双方确认'}</small>{item.status === 'confirmed' && <div className="handover-progress"><span className={item.buyerConfirmedAt ? 'is-done' : ''}>买家{item.buyerConfirmedAt ? '已确认' : '待确认'}</span><span className={item.sellerConfirmedAt ? 'is-done' : ''}>卖家{item.sellerConfirmedAt ? '已确认' : '待确认'}</span></div>}{item.status === 'confirmed' && !item.buyerConfirmedAt && <button disabled={submittingId === item.id} onClick={() => confirmHandover(item.id)}>{submittingId === item.id ? '提交中…' : '确认已完成交接'}</button>}{['pending', 'confirmed'].includes(item.status) && <button onClick={() => cancel(item.id)}>取消预约</button>}</article>)}</div>}
        <button className="secondary-action" onClick={onClose}>返回书架</button>
      </section>
    </div>
  )
}

import { useState, type FormEvent } from 'react'

export function ReportDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (reason: string, description: string) => void | Promise<void> }) {
  const [reason, setReason] = useState('描述不符')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!description.trim()) { setError('请补充问题说明'); return }
    setSubmitting(true)
    setError(null)
    try { await onSubmit(reason, description.trim()) } catch { setError('提交失败，请稍后重试') } finally { setSubmitting(false) }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="publish-dialog" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="dialog-title-row"><div><span className="section-kicker">问题反馈</span><h2>告诉我们发生了什么</h2></div><button type="button" className="dialog-close" onClick={onClose} aria-label="关闭反馈表单">×</button></div>
        <p className="dialog-intro">项目人员会根据反馈联系相关用户，必要时暂停书籍展示。</p>
        <label>问题类型<select value={reason} onChange={(event) => setReason(event.target.value)}><option>描述不符</option><option>未按时交接</option><option>联系方式问题</option><option>其他问题</option></select></label>
        <label>问题说明<textarea required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="请描述你遇到的情况" rows={5} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-action" type="submit" disabled={submitting}>{submitting ? '正在提交...' : '提交反馈'}</button>
      </form>
    </div>
  )
}

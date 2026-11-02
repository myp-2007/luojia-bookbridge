import { useEffect, useState } from 'react'
import { createAITask, fetchAITask, updateBook, type BookRecognition } from '../books/book-api'
import type { Book } from '../../types/books'

export function AIRecognitionDialog({ book, useApi, onClose, onApplied }: { book: Book; useApi: boolean; onClose: () => void; onApplied: () => void }) {
  const [result, setResult] = useState<BookRecognition | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout>
    async function load() {
      try {
        if (!useApi) {
          if (active) setResult({
            title: { value: book.title, confidence: 0 }, author: { value: book.author, confidence: 0 },
            publisher: { value: book.publisher, confidence: 0 }, edition: { value: book.edition, confidence: 0 },
            provider: 'mock', warnings: ['离线预览仅回显已填写资料，不进行图片识别'],
          })
          return
        }
        const created = await createAITask(book.id)
        async function poll() {
          try {
            const task = await fetchAITask(book.id, created.id)
            if (!active) return
            if (task.status === 'failed') throw new Error(task.error || '识别失败，请手动录入')
            if (task.status === 'succeeded') {
              setResult(task.result); setLoading(false); return
            }
            timer = setTimeout(poll, 1000)
          } catch (cause) {
            if (active) { setError(cause instanceof Error ? cause.message : '识别失败'); setLoading(false) }
          }
        }
        await poll()
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : '识别失败，请手动录入')
      } finally { if (active && !useApi) setLoading(false) }
    }
    void load().catch(() => undefined)
    return () => { active = false; clearTimeout(timer) }
  }, [book.id, book.title, book.author, book.publisher, book.edition, useApi, revision])

  async function apply() {
    if (!result || !confirmed) return
    setSaving(true); setError('')
    try {
      await updateBook({
        ...book, title: result.title.value || book.title, author: result.author.value || book.author,
        publisher: result.publisher.value || book.publisher, edition: result.edition.value || book.edition,
      })
      onApplied(); onClose()
    } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败，请到我的发布中手动修改') }
    finally { setSaving(false) }
  }
  return <div className="dialog-backdrop" onMouseDown={() => { if (!saving) onClose() }}>
    <section className="ai-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="dialog-close" disabled={saving} onClick={onClose} aria-label="关闭 AI 识别">×</button>
      <span className="section-kicker">书籍资料助手</span><h2 id="ai-title">识别候选信息</h2>
      <p className="dialog-intro">识别结果经你核对后才写入书籍资料，低置信度和缺失字段请手动补充。</p>
      {loading && !error && <p role="status">识别任务处理中，请稍候…</p>}
      {error && <div className="form-error" role="alert">{error}<button onClick={() => { setError(''); setLoading(true); setResult(null); setConfirmed(false); setRevision((n) => n + 1) }}>重新识别</button></div>}
      {result && <><p className="ai-provider">{result.provider === 'mock' ? '模拟模式 · 回显已有资料，未调用图片识别' : '模型候选 · 请核对实物'}</p><div className="ai-fields">{(['title', 'author', 'publisher', 'edition'] as const).map((key) => <div className="ai-field" key={key}><div><span>{{ title: '书名', author: '作者', publisher: '出版社', edition: '版本' }[key]}</span><strong>{result[key].value || '未识别'}</strong></div><small>{result.provider === 'mock' ? '模拟' : Math.round(result[key].confidence * 100) + '%'}</small></div>)}</div><div className="ai-warning">{result.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>{useApi && <><label className="dialog-intro"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> 我已对照书籍实物核对这些信息</label><button className="primary-action" disabled={!confirmed || saving} onClick={apply}>{saving ? '保存中…' : '确认并保存资料'}</button></>}</>}
    </section>
  </div>
}

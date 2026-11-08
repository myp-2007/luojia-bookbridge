import { useState, type FormEvent } from 'react'
import { DEFAULT_BOOK_FILTERS, type BookFilters, type BookSort } from './book-api'

export function BookFilterForm({ filters, onApply }: {
  filters: BookFilters
  onApply: (filters: BookFilters) => void
}) {
  const [error, setError] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const priceInCents = (name: string) => {
      const value = String(data.get(name) ?? '')
      return value ? Math.round(Number(value) * 100) : undefined
    }
    const minPriceCents = priceInCents('min')
    const maxPriceCents = priceInCents('max')
    if (minPriceCents !== undefined && maxPriceCents !== undefined && minPriceCents > maxPriceCents) {
      setError('最低价不能高于最高价')
      return
    }
    setError('')
    const notes = data.get('notes')
    onApply({
      minPriceCents,
      maxPriceCents,
      condition: String(data.get('condition') || '') || undefined,
      hasNotes: notes === 'yes' ? true : notes === 'no' ? false : undefined,
      availableOnly: data.has('available'),
      sort: data.get('sort') as BookSort,
    })
  }

  return (
    <form className="catalog-filter-form" onSubmit={submit}>
      <label>最低价（元）<input name="min" type="number" min="0" max="100000" step="0.01" defaultValue={filters.minPriceCents === undefined ? '' : filters.minPriceCents / 100} /></label>
      <label>最高价（元）<input name="max" type="number" min="0" max="100000" step="0.01" defaultValue={filters.maxPriceCents === undefined ? '' : filters.maxPriceCents / 100} /></label>
      <label>书籍品相<select name="condition" defaultValue={filters.condition ?? ''}><option value="">不限品相</option><option>全新</option><option>9成新</option><option>8成新</option><option>7成新及以下</option></select></label>
      <label>笔记情况<select name="notes" defaultValue={filters.hasNotes === undefined ? '' : filters.hasNotes ? 'yes' : 'no'}><option value="">不限笔记</option><option value="yes">有笔记</option><option value="no">无笔记</option></select></label>
      <label>排序方式<select name="sort" defaultValue={filters.sort}><option value="relevance">最匹配</option><option value="newest">最新发布</option><option value="price_asc">价格从低到高</option><option value="price_desc">价格从高到低</option></select></label>
      <label className="catalog-check"><input type="checkbox" name="available" defaultChecked={filters.availableOnly} />仅看可预约</label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="catalog-filter-actions">
        <button type="submit">应用筛选</button>
        <button type="reset" onClick={() => { setError(''); onApply(DEFAULT_BOOK_FILTERS) }}>清除筛选</button>
      </div>
    </form>
  )
}

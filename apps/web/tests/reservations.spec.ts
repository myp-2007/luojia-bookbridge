import { expect, test } from '@playwright/test'
import type { Reservation } from '../src/types/reservations'

test('seller accepts and both parties confirm a handover on mobile', async ({ page }) => {
  const reservation: Reservation = {
    id: 'reservation-1', bookId: 'book-1', buyerId: 'demo-buyer', status: 'pending',
    pickupPoint: '图书馆正门', proposedTime: null, expiresAt: null,
    sellerConfirmedAt: null, buyerConfirmedAt: null, completedAt: null, createdAt: '2026-11-02T00:00:00Z',
  }
  const book = {
    id: 'book-1', sellerId: 'demo-seller', title: '高等数学', author: '同济大学', publisher: '高等教育出版社',
    edition: '第七版', condition: '九成新', price: 22, hasNotes: false, description: null,
    category: 'textbook', status: 'reserved', pickupPoint: '图书馆正门', aiStatus: 'not_started', createdAt: reservation.createdAt,
  }
  const actions: string[] = []
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/reservations/mine')) return route.fulfill({ json: [reservation] })
    if (path.endsWith('/books/book-1')) return route.fulfill({ json: book })
    if (path.endsWith('/books')) return route.fulfill({ json: { items: [book], page: 1, pageSize: 20, total: 1 } })
    const action = path.split('/').at(-1)!
    actions.push(action)
    const actor = route.request().headers()['x-user-id']
    if (action === 'confirm') {
      expect(actor).toBe('demo-seller')
      reservation.status = 'confirmed'
    }
    if (action === 'buyer-confirm') {
      expect(actor).toBe('demo-buyer')
      reservation.buyerConfirmedAt = '2026-11-02T01:00:00Z'
    }
    if (action === 'seller-confirm') {
      expect(actor).toBe('demo-seller')
      reservation.sellerConfirmedAt = '2026-11-02T01:01:00Z'
    }
    if (reservation.buyerConfirmedAt && reservation.sellerConfirmedAt) {
      reservation.status = 'completed'
      reservation.completedAt = reservation.sellerConfirmedAt
    }
    await route.fulfill({ json: reservation })
  })
  await page.goto('/')
  await page.getByRole('button', { name: /我的$/ }).click()
  const panel = page.getByRole('dialog')
  await expect(panel.getByRole('heading', { name: '高等数学' })).toBeVisible()
  await expect(panel.getByRole('button', { name: '接受预约' })).toHaveCount(0)
  await panel.getByRole('button', { name: '我卖出的' }).click()
  await panel.getByRole('button', { name: '接受预约' }).click()
  await expect(panel.getByText('等待线下交接', { exact: true })).toBeVisible()
  await panel.getByRole('button', { name: '我买入的' }).click()
  await panel.getByRole('button', { name: '确认已收到书' }).click()
  expect(actions).toEqual(['confirm'])
  await panel.getByRole('button', { name: '确认交接完成', exact: true }).click()
  await expect(panel.getByText('买家已确认', { exact: true })).toBeVisible()
  await panel.getByRole('button', { name: '我卖出的' }).click()
  await panel.getByRole('button', { name: '确认已交出书' }).click()
  await panel.getByRole('button', { name: '确认交接完成', exact: true }).click()
  await expect(panel.getByText('交易已完成', { exact: true })).toBeVisible()
  await expect(panel.getByRole('button', { name: '确认已交出书' })).toHaveCount(0)
  await page.screenshot({ path: 'test-results/reservations-mobile.png' })
  expect(actions).toEqual(['confirm', 'buyer-confirm', 'seller-confirm'])
})

test('failed requests show an error and can be retried', async ({ page }) => {
  let fail = true
  await page.route('**/api/v1/**', async (route) => {
    if (route.request().url().endsWith('/reservations/mine')) {
      if (fail) return route.fulfill({ status: 503, json: { detail: '服务暂时不可用' } })
      return route.fulfill({ json: [] })
    }
    return route.fulfill({ json: { items: [], page: 1, pageSize: 20, total: 0 } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: /我的$/ }).click()
  await expect(page.getByRole('alert')).toContainText('服务暂时不可用')
  fail = false
  await page.getByRole('button', { name: '重新读取' }).click()
  await expect(page.getByText('暂无买入记录')).toBeVisible()
})


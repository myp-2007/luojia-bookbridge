import { expect, test, type Page } from '@playwright/test'

async function loginUI(page: Page, name: string) {
  await page.goto('/')
  await page.getByRole('button', { name: /我的$/ }).click()
  await page.getByRole('button', { name: new RegExp(name) }).click()
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
  await page.getByRole('button', { name: '关闭个人中心' }).click()
}
async function openTrades(page: Page) {
  await page.getByRole('button', { name: /我的$/ }).click()
  await page.getByRole('button', { name: '查看我的预约与交接 →' }).click()
}

test('real API: publish, reserve, accept and complete across two browser sessions', async ({ page, browser }) => {
  await page.addInitScript(() => { Object.defineProperty(window.crypto, 'randomUUID', { value: undefined }) })
  const title = `浏览器实测教材-${Date.now()}`
  await loginUI(page, '小珞')
  await page.getByRole('button', { name: /发布$/ }).click()
  const form = page.getByRole('dialog')
  await form.getByLabel('书名', { exact: true }).fill(title)
  await form.getByLabel('作者', { exact: true }).fill('演示作者')
  await form.getByLabel('出版社', { exact: true }).fill('演示出版社')
  await form.getByLabel('版本', { exact: true }).fill('第二版')
  await form.getByLabel('价格（元）', { exact: true }).fill('12.34')
  await form.getByLabel('交接地点', { exact: true }).fill('图书馆正门')
  await form.getByRole('button', { name: '保存并发布' }).click()
  await expect(form).toHaveCount(0)
  const buyer = await browser.newContext({ viewport: { width: 390, height: 844 }, baseURL: 'http://127.0.0.1:5174' })
  try {
    const buyerPage = await buyer.newPage()
    await loginUI(buyerPage, '小桥')
    await buyerPage.getByRole('button', { name: `查看${title}详情` }).click()
    await buyerPage.getByRole('button', { name: '预约交接', exact: true }).click()
    await openTrades(buyerPage)
    await expect(buyerPage.getByText('等待卖家接受', { exact: true })).toBeVisible()
    await openTrades(page)
    await page.getByRole('button', { name: '我卖出的' }).click()
    const sellerRecord = page.getByRole('article').filter({ hasText: title })
    await sellerRecord.getByRole('button', { name: '接受预约', exact: true }).click()
    await expect(sellerRecord.getByText('等待线下交接', { exact: true })).toBeVisible({ timeout: 12000 })
    const buyerRecord = buyerPage.getByRole('article').filter({ hasText: title })
    await buyerRecord.getByRole('button', { name: '确认已收到书' }).click({ timeout: 12000 })
    await buyerRecord.getByRole('button', { name: '确认交接完成', exact: true }).click()
    await expect(buyerRecord.getByText('买家已确认', { exact: true })).toBeVisible()
    await sellerRecord.getByRole('button', { name: '确认已交出书' }).click()
    await sellerRecord.getByRole('button', { name: '确认交接完成', exact: true }).click()
    await expect(sellerRecord.getByText('交易已完成', { exact: true })).toBeVisible()
    await page.screenshot({ path: 'test-results/local-demo-mobile.png' })
    await expect(buyerRecord.getByText('交易已完成', { exact: true })).toBeVisible({ timeout: 12000 })
  } finally { await buyer.close() }
})

test('session survives refresh, profile is editable, failed trade reads can retry', async ({ page }) => {
  await loginUI(page, '小书')
  await page.reload()
  await page.getByRole('button', { name: /我的$/ }).click()
  await expect(page.getByRole('heading', { name: '小书', exact: true })).toBeVisible()
  await page.getByText('昵称与联系方式', { exact: true }).click()
  await page.getByLabel('自愿提供的联系方式').fill('仅演示联系信息')
  await page.getByRole('button', { name: '保存资料', exact: true }).click()
  await expect.poll(async () => (await page.request.get('/api/v1/me')).json().then((data) => data.contact)).toBe('仅演示联系信息')
  let fail = true
  await page.route('**/api/v1/reservations/mine', async (route) => {
    if (fail) return route.fulfill({ status: 503, json: { message: '服务暂时不可用' } })
    return route.continue()
  })
  await page.getByRole('button', { name: '查看我的预约与交接 →' }).click()
  await expect(page.getByRole('alert')).toContainText('服务暂时不可用')
  fail = false
  await page.getByRole('button', { name: '重新读取' }).click()
  await expect(page.getByText('暂无买入记录')).toBeVisible()
})

test('admin resolves a real dispute and an ordinary user cannot access admin API', async ({ page }) => {
  const api = page.request
  await api.post('/api/v1/auth/dev-login', { data: { userId: 'demo-seller' } })
  const book = await (await api.post('/api/v1/books', { data: { title: `争议教材-${Date.now()}`, priceCents: 1000 } })).json()
  await api.post('/api/v1/auth/dev-login', { data: { userId: 'demo-buyer' } })
  expect((await api.get('/api/v1/reports/admin')).status()).toBe(403)
  const reservation = await (await api.post(`/api/v1/books/${book.id}/reservations`, { data: {} })).json()
  await api.post('/api/v1/auth/dev-login', { data: { userId: 'demo-seller' } })
  await api.post(`/api/v1/reservations/${reservation.id}/confirm`)
  await api.post('/api/v1/auth/dev-login', { data: { userId: 'demo-buyer' } })
  expect((await api.post(`/api/v1/reservations/${reservation.id}/dispute`)).status()).toBe(200)
  await api.post('/api/v1/auth/logout')
  await loginUI(page, '演示管理员')
  await page.getByRole('button', { name: /我的$/ }).click()
  await page.getByRole('button', { name: '处理举报', exact: true }).click()
  const report = page.getByRole('article').filter({ hasText: '交接争议' }).first()
  await report.getByLabel('核实说明').fill('双方同意取消，已核实')
  await report.getByRole('combobox').selectOption('cancel')
  await report.getByRole('button', { name: '保存处理结果' }).click()
  await expect(report.getByText('已处理', { exact: true })).toBeVisible()
  expect((await (await api.get(`/api/v1/books/${book.id}`)).json()).status).toBe('available')
})

test('my books supports editing, offline/publish and valid image uploads', async ({ page }) => {
  await page.request.post('/api/v1/auth/dev-login', { data: { userId: 'demo-seller' } })
  const title = `可管理教材-${Date.now()}`
  const book = await (await page.request.post('/api/v1/books', { data: { title, priceCents: 1500 } })).json()
  await page.goto('/')
  await page.getByRole('button', { name: /我的$/ }).click()
  const record = page.getByRole('article').filter({ hasText: title })
  await record.getByRole('button', { name: '编辑', exact: true }).click()
  await page.getByLabel('价格（元）', { exact: true }).fill('9.99')
  await page.getByLabel('交接地点', { exact: true }).fill('教学楼大厅')
  await page.getByRole('button', { name: '保存修改', exact: true }).click()
  await expect(record).toContainText('9.99')
  await record.getByRole('button', { name: '下架', exact: true }).click()
  await expect(record.getByRole('button', { name: '重新发布', exact: true })).toBeVisible()
  await record.getByRole('button', { name: '重新发布', exact: true }).click()
  await record.locator('input[type=file]').setInputFiles('src/assets/hero.png')
  await expect.poll(async () => (await (await page.request.get(`/api/v1/books/${book.id}`)).json()).coverUrl).toBeTruthy()
})

test('AI candidates require manual confirmation before saving', async ({ page }) => {
  await page.request.post('/api/v1/auth/dev-login', { data: { userId: 'demo-seller' } })
  const title = `识别教材-${Date.now()}`
  await page.request.post('/api/v1/books', { data: { title, priceCents: 2000 } })
  await page.goto('/')
  await page.getByRole('button', { name: `查看${title}详情` }).click()
  await page.getByRole('button', { name: '查看 AI 候选信息' }).click()
  const panel = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: '识别候选信息' }) })
  const save = panel.getByRole('button', { name: '确认并保存资料' })
  await expect(save).toBeDisabled()
  await panel.getByRole('checkbox').check()
  await save.click()
  await expect(panel).toHaveCount(0)
})

test('five independent users receive shared books and reservations without reloading', async ({ browser }) => {
  const users = ['demo-seller', 'demo-buyer', 'demo-reader', 'demo-fourth', 'demo-admin']
  const contexts = await Promise.all(users.map(() => browser.newContext({ baseURL: 'http://127.0.0.1:5174', viewport: { width: 390, height: 844 } })))
  try {
    const pages = await Promise.all(contexts.map(async (context, index) => {
      if (index === 4) await context.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false }))
      const response = await context.request.post('/api/v1/auth/dev-login', { data: { userId: users[index] } })
      expect(response.ok()).toBeTruthy()
      const page = await context.newPage()
      await page.goto('/')
      await expect(page.getByText(/共享书架 · 每5秒同步/)).toBeVisible()
      return page
    }))
    const title = `五人共享教材-${Date.now()}`
    const book = await (await contexts[0].request.post('/api/v1/books', { data: { title, priceCents: 2400, pickupPoint: '图书馆正门' } })).json()
    for (const page of pages) {
      await expect(page.getByRole('button', { name: `查看${title}详情` })).toBeVisible({ timeout: 12000 })
    }
    await openTrades(pages[0])
    await pages[0].getByRole('button', { name: '我卖出的' }).click()
    await pages[2].getByRole('button', { name: `查看${title}详情` }).click()
    const reservation = await contexts[1].request.post(`/api/v1/books/${book.id}/reservations`, { data: {} })
    expect(reservation.status()).toBe(201)
    await expect(pages[0].getByRole('article').filter({ hasText: title }).getByText('等待卖家接受', { exact: true })).toBeVisible({ timeout: 12000 })
    await expect(pages[2].getByRole('button', { name: '暂不可预约', exact: true })).toBeDisabled({ timeout: 12000 })
    const second = await contexts[3].request.post(`/api/v1/books/${book.id}/reservations`, { data: {} })
    expect(second.status()).toBe(409)
    for (let index = 0; index < contexts.length; index++) {
      expect((await (await contexts[index].request.get('/api/v1/me')).json()).id).toBe(users[index])
    }
    await pages[0].screenshot({ path: 'test-results/lan-shared-records.png' })
  } finally { await Promise.all(contexts.map((context) => context.close())) }
})

test('a temporary host failure preserves shared data and recovers automatically', async ({ page }) => {
  const title = `恢复教材-${Date.now()}`
  await page.request.post('/api/v1/auth/dev-login', { data: { userId: 'demo-seller' } })
  await page.request.post('/api/v1/books', { data: { title, priceCents: 2000 } })
  let fail = false
  await page.route('**/api/v1/books*', async (route) => {
    if (fail && route.request().method() === 'GET') return route.fulfill({ status: 503, json: { message: '临时中断' } })
    return route.continue()
  })
  await page.goto('/')
  const card = page.getByRole('button', { name: `查看${title}详情` })
  await expect(card).toBeVisible()
  fail = true
  await expect(page.getByRole('alert')).toContainText('保留上次读取的内容', { timeout: 12000 })
  await expect(card).toBeVisible()
  fail = false
  await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 12000 })
  await expect(card).toBeVisible()
})

test('hidden views pause polling and resync immediately when visible', async ({ page }) => {
  await page.addInitScript(() => {
    let hidden = false
    Object.defineProperty(document, 'visibilityState', { get: () => hidden ? 'hidden' : 'visible' })
    const controls = window as unknown as { setTestHidden: (value: boolean) => void }
    controls.setTestHidden = (value) => { hidden = value; document.dispatchEvent(new Event('visibilitychange')) }
  })
  let reads = 0
  await page.route('**/api/v1/books*', async (route) => { if (route.request().method() === 'GET') reads++; await route.continue() })
  await page.request.post('/api/v1/auth/dev-login', { data: { userId: 'demo-seller' } })
  await page.goto('/')
  await expect(page.getByText(/共享书架 · 每5秒同步/)).toBeVisible()
  await page.evaluate(() => (window as unknown as { setTestHidden: (value: boolean) => void }).setTestHidden(true))
  const before = reads
  const title = `切回同步-${Date.now()}`
  await page.request.post('/api/v1/books', { data: { title, priceCents: 1000 } })
  await page.waitForTimeout(5500)
  expect(reads).toBe(before)
  await expect(page.getByRole('button', { name: `查看${title}详情` })).toHaveCount(0)
  await page.evaluate(() => (window as unknown as { setTestHidden: (value: boolean) => void }).setTestHidden(false))
  await expect(page.getByRole('button', { name: `查看${title}详情` })).toBeVisible()
})

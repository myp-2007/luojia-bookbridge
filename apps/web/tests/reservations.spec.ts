import { expect, test, type Page, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'

const password = 'CampusBooks_2026'
const users = { admin: 'e2e_owner', seller: 'e2e_seller', buyer: 'e2e_buyer', reader: 'e2e_reader', fourth: 'e2e_fourth' }
const covers = ['../../seed/demo-books/covers/calculus-1.jpg', '../../seed/demo-books/covers/linear-algebra.jpg']

test.beforeAll(async ({ request }) => {
  for (const [role, username] of Object.entries(users)) {
    const result = await request.post('/api/v1/auth/register', { data: { username, password, nickname: ({ admin: '站点管理员', seller: '小珞', buyer: '小桥', reader: '小书', fourth: '小林' } as Record<string,string>)[role] } })
    expect([201, 409]).toContain(result.status())
    const account = result.status() === 201 ? await result.json() : await (await request.post('/api/v1/auth/login', { data: { username, password } })).json()
    expect(account.role).toBe(role === 'admin' ? 'admin' : 'student')
  }
})
async function loginAPI(api: APIRequestContext, username: string) { expect((await api.post('/api/v1/auth/login', { data: { username, password } })).ok()).toBeTruthy() }
async function loginUI(page: Page, username = users.seller) {
  await page.goto('/login')
  await page.getByLabel('账号', { exact: true }).fill(username)
  await page.getByLabel('密码', { exact: true }).fill(password)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/me$/)
}
async function createBook(api: APIRequestContext, title: string, extra = {}) {
  const response = await api.post('/api/v1/books', { data: { title, priceCents: 2200, condition: '9成新', pickupPoint: '图书馆正门', ...extra } })
  expect(response.status()).toBe(201)
  return response.json()
}
async function openBook(page: Page, title: string) {
  await page.goto('/discover?q=' + encodeURIComponent(title))
  await page.getByRole('link', { name: `查看${title}详情`, exact: true }).click()
  await expect(page).toHaveURL(/\/books\//)
}

test('registration is a real account and login has one form, no account selector', async ({ page }) => {
  await page.goto('/me')
  await expect(page).toHaveURL(/\/login\?next=/)
  await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible()
  expect((await page.request.get('/api/v1/auth/demo-accounts')).status()).toBe(404)
  await expect(page.getByRole('button', { name: /同学账号|演示管理员/ })).toHaveCount(0)
  await page.screenshot({ path: 'test-results/real-login-mobile.png', fullPage: true })
  await page.getByRole('link', { name: '立即注册', exact: true }).click()
  const username = 'newuser_' + Date.now()
  await page.getByLabel('昵称', { exact: true }).fill('真正的新书友')
  await page.getByLabel('账号', { exact: true }).fill(username)
  await page.getByLabel('密码', { exact: true }).fill(password)
  await page.getByLabel('确认密码', { exact: true }).fill(password)
  await page.getByRole('button', { name: '创建账号', exact: true }).click()
  await expect(page.getByRole('heading', { name: '真正的新书友', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: '真正的新书友', exact: true })).toBeVisible()
  expect((await (await page.request.get('/api/v1/me')).json()).username).toBe(username)
})

test('home has local covers, explicit search, aliases, filters and browser history', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '校园新上架', exact: true })).toBeVisible()
  await expect(page.locator('.book-card').first()).toBeVisible()
  const coverImages = page.locator('.book-cover img')
  for (let index = 0; index < await coverImages.count(); index++) {
    await coverImages.nth(index).scrollIntoViewIfNeeded()
    await expect.poll(() => coverImages.nth(index).evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: 'test-results/real-home-mobile.png', fullPage: true })
  await page.getByRole('searchbox', { name: '搜索书籍' }).fill('高数')
  await page.getByRole('button', { name: '搜索', exact: true }).click()
  await expect(page).toHaveURL(/\/discover\?q=/)
  await expect(page.locator('.book-list .book-card')).toHaveCount(2)
  await page.screenshot({ path: 'test-results/real-search-mobile.png', fullPage: true })
  await page.getByText('筛选价格、品相与笔记', { exact: true }).click()
  await page.getByLabel('最高价（元）').fill('21')
  await page.getByRole('button', { name: '应用筛选', exact: true }).click()
  await expect(page.locator('.book-list .book-card')).toHaveCount(1)
  await page.reload()
  await expect(page.locator('.book-list .book-card')).toHaveCount(1)
  await page.getByRole('link', { name: '查看高等数学（第七版）（下册）详情', exact: true }).click()
  await expect(page.getByRole('heading', { name: '高等数学（第七版）（下册）', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '返回', exact: true }).click()
  await expect(page.getByRole('searchbox')).toHaveValue('高数')
  await expect(page.locator('.book-list .book-card')).toHaveCount(1)
})

test('new users publish multiple real images, another user searches, both complete handover', async ({ page, browser }) => {
  await loginUI(page)
  await page.getByRole('link', { name: '发布', exact: true }).click()
  await expect(page).toHaveURL(/\/publish$/)
  const title = `高等数学跨账号-${Date.now()}`
  await page.getByLabel('书名', { exact: true }).fill(title)
  await page.getByLabel('作者', { exact: true }).fill('同济大学数学系')
  await page.getByLabel('出版社', { exact: true }).fill('高等教育出版社')
  await page.getByLabel('版本', { exact: true }).fill('第七版')
  await page.getByLabel('价格（元）').fill('12.34')
  await page.getByLabel('交接地点', { exact: true }).fill('图书馆正门')
  await page.getByLabel('上传书籍照片', { exact: true }).setInputFiles(covers)
  await page.screenshot({ path: 'test-results/real-publish-mobile.png', fullPage: true })
  await page.getByRole('button', { name: '发布书籍', exact: true }).click()
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  const bookId = page.url().split('/books/')[1]
  await page.reload()
  await page.getByRole('button', { name: '查看图片2', exact: true }).click()
  await expect(page.getByRole('button', { name: '查看图片2', exact: true })).toHaveAttribute('aria-pressed','true')
  await page.screenshot({ path: 'test-results/real-detail-mobile.png', fullPage: true })
  const buyer = await browser.newContext({ baseURL: 'http://127.0.0.1:5174', viewport: { width: 390, height: 844 } })
  try {
    await loginAPI(buyer.request, users.buyer)
    const other = await buyer.newPage()
    await openBook(other, title)
    await other.getByRole('button', { name: '预约交接', exact: true }).click()
    await other.getByRole('button', { name: '确认预约', exact: true }).click()
    await expect(other).toHaveURL(/\/records$/)
    await page.goto('/records')
    await page.getByRole('button', { name: '我卖出的', exact: true }).click()
    const sell = page.getByRole('article').filter({ hasText: title })
    const buy = other.getByRole('article').filter({ hasText: title })
    await sell.getByRole('button', { name: '接受预约', exact: true }).click()
    await buy.getByRole('button', { name: '查看对方联系方式', exact: true }).click({ timeout: 12000 })
    await expect(buy).toContainText('对方尚未提供联系方式')
    await buy.getByRole('button', { name: '确认已收到书', exact: true }).click()
    await buy.getByRole('button', { name: '确认交接完成', exact: true }).click()
    await sell.getByRole('button', { name: '确认已交出书', exact: true }).click()
    await sell.getByRole('button', { name: '确认交接完成', exact: true }).click()
    await expect(buy.getByText('交易已完成', { exact: true })).toBeVisible({ timeout: 12000 })
    expect((await (await page.request.get(`/api/v1/books/${bookId}`)).json()).status).toBe('completed')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  } finally { await buyer.close() }
})

test('profile avatar, gender, bio and private contact survive refresh and are not public', async ({ page }) => {
  await loginUI(page, users.reader)
  for (let index = 0; index < 2; index++) {
    const book = await createBook(page.request, ['线性代数与思考','我的高等数学笔记'][index])
    expect((await page.request.post(`/api/v1/books/${book.id}/images`, { multipart: { file: { name: 'cover.jpg', mimeType: 'image/jpeg', buffer: readFileSync(covers[index]) } } })).status()).toBe(201)
  }
  await page.getByRole('link', { name: '编辑个人资料', exact: true }).click()
  await page.getByLabel('上传头像').setInputFiles(covers[0])
  await expect.poll(async () => (await (await page.request.get('/api/v1/me')).json()).avatarUrl).toBeTruthy()
  await page.getByLabel('昵称', { exact: true }).fill('爱数学的小书')
  await page.getByLabel('性别').selectOption('female')
  await page.getByLabel('学校 / 院系').fill('武汉大学 · 数学与统计学院')
  await page.getByLabel('自我介绍').fill('喜欢数学，也喜欢旧书上的读书笔记。')
  await page.getByLabel('联系方式', { exact: true }).fill('private-contact-only')
  await page.getByRole('button', { name: '保存个人资料', exact: true }).click()
  await expect(page).toHaveURL(/\/me$/)
  await page.reload()
  await expect(page.getByRole('heading', { name: '爱数学的小书', exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: '爱数学的小书的头像' })).toBeVisible()
  await expect(page.getByText('喜欢数学，也喜欢旧书上的读书笔记。', { exact: true })).toBeVisible()
  await expect(page.locator('.profile-stats strong').first()).not.toHaveText('—')
  await expect(page.locator('.personal-book')).toHaveCount(2)
  await page.screenshot({ path: 'test-results/real-profile-mobile.png', fullPage: true })
  const me = await (await page.request.get('/api/v1/me')).json()
  const publicProfile = await (await page.request.get(`/api/v1/users/${me.id}`)).json()
  expect(publicProfile.contact).toBeUndefined()
  expect(publicProfile.gender).toBeUndefined()
  expect(me.gender).toBe('female')
})

test('all five primary navigation entries are pages, protected publish returns after login', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: '发布', exact: true }).click()
  await expect(page).toHaveURL(/\/login\?next=/)
  await page.getByLabel('账号', { exact: true }).fill(users.fourth)
  await page.getByLabel('密码', { exact: true }).fill(password)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/publish$/)
  await page.getByRole('button', { name: '返回', exact: true }).click()
  await page.goto('/')
  for (const [label, path] of [['发现','/discover'],['记录','/records'],['我的','/me'],['首页','/']]) {
    await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: label, exact: true }).click()
    await expect.poll(() => new URL(page.url()).pathname).toBe(path)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }
})

test('favorites are stored per account and persist across reload', async ({ page }) => {
  await loginAPI(page.request, users.buyer)
  await page.goto('/discover?q=线代')
  const card = page.locator('.book-card').first()
  const title = await card.getByRole('heading').innerText()
  await card.getByRole('button', { name: new RegExp('^收藏') }).click()
  await expect(card.getByRole('button', { name: new RegExp('^取消收藏') })).toHaveAttribute('aria-pressed','true')
  await page.goto('/me/favorites')
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  await page.getByRole('button', { name: `取消收藏${title}`, exact: true }).click()
  await page.reload()
  await expect(page.getByText('还没有收藏好书', { exact: true })).toBeVisible()
})

test('own book edit, visibility, image cover and AI confirmation work on separate pages', async ({ page }) => {
  await loginAPI(page.request, users.seller)
  const book = await createBook(page.request, '可编辑书籍-' + Date.now())
  await page.goto('/me/books')
  const own = page.getByRole('article').filter({ hasText: book.title })
  await own.getByRole('link', { name: '编辑资料', exact: true }).click()
  await page.getByLabel('价格（元）').fill('9.99')
  await page.getByRole('button', { name: '保存修改', exact: true }).click()
  await page.getByRole('link', { name: '管理图片', exact: true }).click()
  for (let i = 0; i < 2; i++) { await page.getByLabel('添加书籍图片').setInputFiles(covers[i]); await expect(page.locator('.media-item')).toHaveCount(i + 1) }
  await page.getByRole('button', { name: '设为封面', exact: true }).nth(1).click()
  await page.locator('.media-item').first().getByRole('button', { name: '删除图片', exact: true }).click()
  await page.getByRole('button', { name: '确认删除', exact: true }).click()
  await expect(page.locator('.media-item')).toHaveCount(1)
  await page.goto(`/books/${book.id}/recognize`)
  const save = page.getByRole('button', { name: '确认并保存资料', exact: true })
  await expect(save).toBeDisabled()
  await page.getByRole('checkbox').check()
  await save.click()
  await expect(page).toHaveURL(new RegExp('/books/' + book.id + '$'))
  await page.goto('/me/books')
  await own.getByRole('button', { name: '下架', exact: true }).click()
  await expect(own.getByRole('button', { name: '重新发布', exact: true })).toBeVisible()
  await own.getByRole('button', { name: '重新发布', exact: true }).click()
  expect((await (await page.request.get(`/api/v1/books/${book.id}`)).json()).priceCents).toBe(999)
})

test('book feedback is submitted on a page and admin results return to the user', async ({ page, browser }) => {
  await loginAPI(page.request, users.seller)
  const book = await createBook(page.request, '反馈书籍-' + Date.now())
  await loginAPI(page.request, users.fourth)
  await page.goto(`/books/${book.id}/report`)
  const description = '封面需要核对-' + Date.now()
  await page.getByLabel('问题说明').fill(description)
  await page.getByRole('button', { name: '提交反馈', exact: true }).click()
  await expect(page).toHaveURL(/\/me\/reports$/)
  const own = page.getByRole('article').filter({ hasText: description })
  await expect(own).toContainText('待处理')
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5174' })
  try {
    await loginAPI(context.request, users.admin)
    const admin = await context.newPage(); await admin.goto('/admin/reports')
    const record = admin.getByRole('article').filter({ hasText: description })
    await record.getByLabel('核实说明').fill('已核实资料并联系发布者')
    await record.getByRole('button', { name: '保存处理结果', exact: true }).click()
    await expect(own).toContainText('已核实资料并联系发布者', { timeout: 12000 })
  } finally { await context.close() }
})

test('admin moderation is preserved and owner cannot bypass a restriction', async ({ page, browser }) => {
  await loginAPI(page.request, users.seller)
  const book = await createBook(page.request, '审核书籍-' + Date.now())
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5174' })
  try {
    await loginAPI(context.request, users.admin)
    const admin = await context.newPage(); await admin.goto('/admin')
    await admin.getByLabel('查找书籍').fill(book.title)
    await admin.getByRole('button', { name: '搜索书籍', exact: true }).click()
    const record = admin.getByRole('article').filter({ hasText: book.title })
    await record.getByLabel('处理说明').fill('图片需核实')
    await record.getByRole('button', { name: '限制书籍展示', exact: true }).click()
    await page.goto('/me/books')
    const own = page.getByRole('article').filter({ hasText: book.title })
    await expect(own).toContainText('管理限制中')
    expect((await page.request.post(`/api/v1/books/${book.id}/publish`)).status()).toBe(409)
    await record.getByLabel('处理说明').fill('核实通过')
    await record.getByRole('button', { name: '解除书籍限制', exact: true }).click()
    await own.getByRole('button', { name: '重新发布', exact: true }).click({ timeout: 12000 })
    await admin.getByRole('button', { name: '操作记录', exact: true }).click()
    await expect(admin.getByRole('article').filter({ hasText: '核实通过' })).toBeVisible()
  } finally { await context.close() }
})

test('free gift publishing enforces zero price', async ({ page }) => {
  await loginAPI(page.request, users.seller); await page.goto('/publish')
  const title = '免费赠书-' + Date.now()
  await page.getByLabel('书名', { exact: true }).fill(title)
  await page.getByLabel('分类', { exact: true }).selectOption('donation')
  await expect(page.getByLabel('价格（元）')).toHaveValue('0')
  await expect(page.getByLabel('价格（元）')).toBeDisabled()
  await page.getByLabel('交接地点', { exact: true }).fill('图书馆正门')
  await page.getByRole('button', { name: '发布书籍', exact: true }).click()
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  await expect(page.locator('.detail-price')).toHaveText('免费赠送')
})

test('host outage retains books then recovers and hidden views pause polling', async ({ page }) => {
  let failed = false; let reads = 0
  await page.addInitScript(() => { let hidden = false; Object.defineProperty(document,'visibilityState',{ get: () => hidden ? 'hidden' : 'visible' }); (window as unknown as { setHidden: (value: boolean) => void }).setHidden = (value) => { hidden = value; document.dispatchEvent(new Event('visibilitychange')) } })
  await page.route('**/api/v1/books?**', async (route) => { reads++; if (failed) return route.fulfill({ status: 503, json: { message: '连接暂时中断' } }); return route.continue() })
  await page.goto('/discover?q=高数')
  await expect(page.locator('.book-card').first()).toBeVisible()
  const before = await page.locator('.book-card').count()
  failed = true
  await expect(page.getByRole('alert')).toContainText('连接暂时中断', { timeout: 12000 })
  await expect(page.locator('.book-card')).toHaveCount(before)
  failed = false
  await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 12000 })
  await page.evaluate(() => (window as unknown as { setHidden: (value: boolean) => void }).setHidden(true))
  const count = reads; await page.waitForTimeout(5300); expect(reads).toBe(count)
  await page.evaluate(() => (window as unknown as { setHidden: (value: boolean) => void }).setHidden(false))
  await expect.poll(() => reads).toBeGreaterThan(count)
})

test('password change logs out every session and old password cannot log in', async ({ page }) => {
  const username = 'password_' + Date.now()
  expect((await page.request.post('/api/v1/auth/register', { data: { username, password } })).status()).toBe(201)
  await page.goto('/settings/password')
  await page.getByLabel('当前密码', { exact: true }).fill(password)
  await page.getByLabel('新密码', { exact: true }).fill('NewCampusBooks_2026')
  await page.getByLabel('确认新密码', { exact: true }).fill('NewCampusBooks_2026')
  await page.getByRole('button', { name: '确认修改密码', exact: true }).click()
  await expect(page).toHaveURL(/\/login/)
  expect((await page.request.post('/api/v1/auth/login', { data: { username, password } })).status()).toBe(401)
  await page.getByLabel('账号', { exact: true }).fill(username)
  await page.getByLabel('密码', { exact: true }).fill('NewCampusBooks_2026')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/me$/)
  await page.getByRole('link', { name: '账户设置', exact: true }).click()
  await page.getByRole('button', { name: '退出登录', exact: true }).click()
  await expect(page).toHaveURL(/\/login/)
  expect((await page.request.get('/api/v1/me')).status()).toBe(401)
})

test('desktop layout remains usable with no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '校园新上架', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  await expect(page.locator('.book-card').first()).toBeVisible()
  const images = page.locator('.book-cover img')
  for (let index = 0; index < await images.count(); index++) {
    await images.nth(index).scrollIntoViewIfNeeded()
    await expect.poll(() => images.nth(index).evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: 'test-results/real-home-desktop.png', fullPage: true })
})


test('five real sessions share new publications and reservation state without reload', async ({ browser }) => {
  const accounts = [users.seller, users.buyer, users.reader, users.fourth, users.admin]
  const title = '五人共享新书-' + Date.now()
  const contexts = await Promise.all(accounts.map(() => browser.newContext({ baseURL: 'http://127.0.0.1:5174', viewport: { width: 390, height: 844 } })))
  try {
    const pages = await Promise.all(contexts.map(async (context, index) => {
      await loginAPI(context.request, accounts[index])
      const page = await context.newPage(); await page.goto('/discover?q=' + encodeURIComponent(title))
      await expect(page.getByText('暂时没有找到这本书', { exact: true })).toBeVisible()
      return page
    }))
    const book = await createBook(contexts[0].request, title)
    for (const page of pages) await expect(page.getByRole('link', { name: `查看${title}详情`, exact: true })).toBeVisible({ timeout: 12000 })
    expect((await contexts[1].request.post(`/api/v1/books/${book.id}/reservations`, { data: {} })).status()).toBe(201)
    for (const page of pages) await expect(page.locator('.book-card').getByText('9成新 · 已预约', { exact: true })).toBeVisible({ timeout: 12000 })
    expect((await contexts[2].request.post(`/api/v1/books/${book.id}/reservations`, { data: {} })).status()).toBe(409)
  } finally { await Promise.all(contexts.map((context) => context.close())) }
})

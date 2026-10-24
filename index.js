/**
 * prompt-copilot — Host 半边。
 *
 * 每条 AI 回复结束（turn/end）后：
 *   1. 一次模型调用，同时产出「人话摘要」和「下一条 prompt 的候选」；
 *   2. 用 appendPluginRecord 写一条可重放的会话记录（前端靠投影读它）；
 *   3. 追加一行到本地 JSONL 库。
 * 全程不写 command、不加工具、不产生可见的对话行。
 */
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { readFile } from 'node:fs/promises'
import { createDb } from './db.js'

export const name = 'prompt-copilot'
export const inject = ['llm', 'sessionProjections', 'sessions']

const DEFAULTS = {
  provider: 'deepseek-official',
  model: 'deepseek-flash',
  count: 3,
  maxInputChars: 6000,
  dbPath: '',
  logSent: false,
  timeoutMs: 60000,
}

/** 注册表只对这个对象调用 parse()；用它省掉 zod 依赖。 */
const passthrough = { parse: (value) => value }

const SYSTEM = [
  '你是一个「副驾驶」，读最近几轮对话，输出 JSON，不要任何解释。',
  '格式：{"summary":"...","next":[{"title":"短标题","prompt":"完整用户提示词"},{"title":"短标题","prompt":"完整用户提示词"},{"title":"短标题","prompt":"完整用户提示词"}]}',
  'summary：用 3-5 句大白话复述最后一条 AI 回复——在回答什么、结论是什么、有哪些动作或风险。不要复述原文，不要用「本文」「该回复」。',
  '口吻：参考真实用户近期原话，像用户平时说话一样简短、直接、口语化。不要写成详细任务书或替用户做需求扩写。',
  '边界：只延续用户明确表达的意图；不要把AI自己提出的建议、假设、路径或约束当成用户要求。不要新增用户没说过的输出格式、目录、数量、步骤、验收标准、禁止事项或其他限制。无需重复上下文已经清楚的背景。方向不确定就用简短追问，不能替用户承诺一整套方案。',
  'next：生成3个不同的、用户可能接着发给AI的完整prompt（不是AI的回答）。紧扣当前需求，直接可用，按有用程度排序。',
  '优先选择有明显差异的下一步方向，但差异不是硬指标；不要同义改写凑数，不要为求不同跑题、编造需求或建议无意义操作。确实没有3个有效方向时宁可少给。',
  '每项title用一句短话概括对应prompt的意图，不能用候选一之类空标题。标题严格少于15个计数单位：一个汉字计1，一个英语单词计1；混合相加，标点和空格不计。尽量控制在6到10个单位。prompt只表达一个主要意图，通常1到2句，优先15到60个计数单位，绝对少于150个单位；150是上限，不是目标。',
].join('\n')

function defaultDbPath() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, 'prompt-copilot', 'db.jsonl')
}

export function textOfMessage(message) {
  const content = message?.content
  if (!Array.isArray(content)) return ''
  return content
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
    .trim()
}

function eventsOf(session) {
  if (Array.isArray(session?.log)) return session.log
  if (Array.isArray(session?.events)) return session.events
  return []
}

/** 最近几轮的 user/assistant 文本，按时间正序。 */
function recentTurns(session, maxChars) {
  const events = eventsOf(session)
  const lines = []
  for (let i = events.length - 1; i >= 0 && lines.length < 8; i -= 1) {
    const event = events[i]
    if (event?.type === 'user/message' && !isUserMessage(event.data?.message ?? event.data)) continue
    if (event?.type === 'user/message' || event?.type === 'assistant/message') {
      const text = textOfMessage(event.data?.message ?? event.data)
      if (text !== '') lines.push((event.type === 'user/message' ? '用户：' : 'AI：') + text)
    }
  }
  return lines.reverse().join('\n\n').slice(-maxChars)
}

function lastAssistantText(session) {
  const events = eventsOf(session)
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i]?.type !== 'assistant/message') continue
    const text = textOfMessage(events[i].data?.message ?? events[i].data)
    if (text !== '') return text
  }
  return ''
}

/** 从可能带围栏或废话的输出里救出 JSON。 */
function extractJson(raw) {
  const text = String(raw ?? '').trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

export function titleUnits(text) {
  return String(text).match(/\p{Script=Han}|[A-Za-z]+(?:['’][A-Za-z]+)*|[0-9]+|[^\p{Script=Han}\p{P}\p{Z}\sA-Za-z0-9]/gu) ?? []
}
export function normalize(parsed, count = 3) {
  if (parsed === null || typeof parsed !== 'object') return null
  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : ''
  const next = [], titles = [], seen = new Set()
  for (const item of Array.isArray(parsed.next) ? parsed.next : []) {
    if (!item || typeof item.prompt !== 'string' || typeof item.title !== 'string') return null
    const prompt = item.prompt.trim(), title = item.title.trim()
    if (!prompt || titleUnits(prompt).length >= 150 || !title || titleUnits(title).length === 0 || titleUnits(title).length >= 15) return null
    const identity = prompt.replace(/\s+/g, '').toLowerCase()
    if (seen.has(identity)) continue
    seen.add(identity); next.push(prompt); titles.push(title)
    if (next.length >= Math.min(3, Math.max(1, count))) break
  }
  if (!summary || !next.length) return null
  return { summary, next, titles }
}

async function streamCompletion(ctx, settings, prompt, signal) {
  let text = ''
  const stream = ctx.llm.stream({
    provider: settings.provider,
    model: settings.model,
    messages: [
      { role: 'system', content: [{ type: 'text', text: SYSTEM }] },
      { role: 'user', content: [{ type: 'text', text: prompt }] },
    ],
    signal,
  })
  for await (const chunk of stream) {
    if (chunk.type === 'text-delta') text += chunk.text
  }
  return text
}

export async function complete(ctx, settings, prompt, signal) {
  const controller = new AbortController()
  let timer, onAbort
  const interrupted = new Promise((_, reject) => {
    onAbort = () => { controller.abort(); reject(new Error('Generation cancelled')) }
    if (signal.aborted) onAbort()
    else signal.addEventListener('abort', onAbort, { once: true })
    timer = setTimeout(() => { controller.abort(); reject(new Error('生成超时，请检查模型服务')) }, settings.timeoutMs)
  })
  try {
    if (signal.aborted) return await interrupted
    return await Promise.race([streamCompletion(ctx, settings, prompt, controller.signal), interrupted])
  } finally { clearTimeout(timer); signal.removeEventListener('abort', onAbort) }
}

export function validateConfig(config = {}) {
  const settings = { ...DEFAULTS, ...config }
  for (const key of ['provider', 'model']) if (typeof settings[key] !== 'string' || !settings[key].trim()) throw new Error(key + ' must be a nonempty string')
  for (const [key, min, max] of [['count', 1, 3], ['maxInputChars', 500, 24000], ['timeoutMs', 1000, 180000]]) {
    if (!Number.isInteger(settings[key]) || settings[key] < min || settings[key] > max) throw new Error(key + ' is outside the supported range')
  }
  if (typeof settings.logSent !== 'boolean' || typeof settings.dbPath !== 'string') throw new Error('Invalid logging configuration')
  return settings
}
export function apply(ctx, config) {
  const settings = validateConfig(config)
  const db = createDb(settings.dbPath || defaultDbPath())

  // Resolve against the running Desktop distribution, never the stale profile SDK.
  const recordReady = loadSessionModule().then((mod) => {
    if (typeof mod.appendPluginRecord !== 'function') throw new Error('当前 DSH 缺少摘要发布接口')
    return mod.appendPluginRecord
  })
  const cached = new Map()
  const cacheReady = readFile(db.path, 'utf8').then((raw) => {
    for (const line of raw.split('\n')) {
      try {
        const row = JSON.parse(line)
        if (row.t === 'predicted' && row.sessionId && (!cached.has(row.sessionId) || row.at > cached.get(row.sessionId).at)) cached.set(row.sessionId, row)
      } catch { /* tolerate an interrupted final JSONL line */ }
    }
  }).catch((error) => { if (error.code !== 'ENOENT') ctx.logger.warn(String(error)) })
  const report = (error, sessionId) => {
    ctx.logger.warn('prompt-copilot: ' + String(error?.message ?? error))
    void db.append({ t: 'error', sessionId, at: Date.now(), message: String(error?.message ?? error) }).catch(() => {})
  }
  recordReady.catch((error) => report(error))
  async function publish(session, payload) {
    const append = await recordReady
    append(session, 'plugin:prompt-copilot/turn', payload)
  }
  const running = new Map()
  const lastPrediction = new Map()

  ctx.sessionProjections.register({
    key: 'prompt-copilot',
    stateSchema: passthrough,
    stateVersion: 2,
    init: () => null,
    apply: (state, event) => event.type === 'plugin:prompt-copilot/turn' ? event.data : event.type === 'assistant/message' || event.type === 'turn/start' ? null : state,
    wire: { viewSchema: passthrough, view: (state) => state },
  })

  let disposed = false
  async function restore(session) {
    await cacheReady
    if (disposed || running.has(session.id)) return
    const row = cached.get(session.id)
    const reply = lastAssistantEvent(session)
    if (!row || !reply || row.at < reply.time) return
    if (eventsOf(session).some((event) => event.type === 'user/message' && isUserMessage(event.data) && event.time > row.at)) return
    const existing = ctx.sessionProjections.stateOf(session, 'prompt-copilot')
    if (existing?.at >= row.at) {
      lastPrediction.set(session.id, existing)
      if (existing.status === 'ready' && (existing.titles?.length !== existing.next?.length || existing.promptStyleVersion !== 1)) await generate(session, reply.data.turn)
      return
    }
    const payload = { summary: row.summary, next: row.next, titles: row.titles ?? [], promptStyleVersion: row.promptStyleVersion ?? 0, at: row.at, sourceSeq: reply.seq, status: 'ready' }
    await publish(session, payload)
    lastPrediction.set(session.id, payload)
    await db.append({ t: 'restored', sessionId: session.id, at: Date.now(), sourceSeq: reply.seq })
    if (payload.titles.length !== payload.next.length || payload.promptStyleVersion !== 1) await generate(session, reply.data.turn)
  }
  ctx.on('session/created', (session) => { void restore(session).catch((e) => report(e, session.id)) })
  void recordReady.then(() => Promise.all(ctx.sessions.list().map(restore))).catch((e) => report(e))

  ctx.effect(() => () => {
    disposed = true
    for (const controller of running.values()) controller.abort()
    running.clear()
    lastPrediction.clear()
  })

  async function generate(session, completedTurn) {
    const sessionId = session?.id ?? session?.sessionId ?? 'unknown'
    const source = lastAssistantEvent(session)
    if (!source || source.data?.turn !== completedTurn) return
    const reply = lastAssistantText(session)
    if (reply === '') return
    const context = recentTurns(session, settings.maxInputChars)
    const userStyle = eventsOf(session).filter((e) => e.type === 'user/message' && isUserMessage(e.data?.message ?? e.data)).slice(-3).map((e) => textOfMessage(e.data?.message ?? e.data).slice(0, 400)).join('\n')
    if (context === '') return

    running.get(sessionId)?.abort()
    const controller = new AbortController()
    running.set(sessionId, controller)

    try {
      await publish(session, { status: 'pending', summary: '', next: [], at: Date.now(), sourceSeq: source.seq })
      let parsed = null
      for (let attempt = 0; attempt < 2 && parsed === null; attempt += 1) {
        const raw = await complete(ctx, settings, '用户近期原话（参考其口吻，勿扩写要求）：\n' + userStyle + '\n\n最近对话：\n' + context + (attempt ? '\n请重新检查JSON、标题少于15、prompt少于150个混合计数单位；简短直接，不补充用户未提出的要求。' : ''), controller.signal)
        parsed = normalize(extractJson(raw), settings.count)
      }
      if (parsed === null) throw new Error('模型没有返回有效的摘要和候选句')
      if (controller.signal.aborted || disposed || lastAssistantEvent(session)?.seq !== source.seq) return

      const payload = {
        status: 'ready',
        promptStyleVersion: 1,
        sourceSeq: source.seq,
        summary: parsed.summary,
        next: parsed.next,
        titles: parsed.titles,
        at: Date.now(),
        turn: completedTurn,
      }
      await publish(session, payload)
      lastPrediction.set(sessionId, payload)
      await db.append({ t: 'predicted', sessionId, at: payload.at, summary: payload.summary, next: payload.next, titles: payload.titles, promptStyleVersion: payload.promptStyleVersion })
    } catch (error) {
      if (!controller.signal.aborted && !disposed) {
        report(error, sessionId)
        await publish(session, { status: 'error', summary: '', next: [], at: Date.now(), error: String(error?.message ?? error) }).catch(() => {})
      }
    } finally {
      if (running.get(sessionId) === controller) running.delete(sessionId)
    }
  }

  ctx.on('session/event', (session, event) => {
    if (event?.type === 'turn/start') running.get(session.id)?.abort()
    if (event?.type === 'user/message') {
      if (!isUserMessage(event.data?.message ?? event.data)) return
      running.get(session.id)?.abort()
      const text = textOfMessage(event.data?.message ?? event.data)
      if (text !== '' && settings.logSent) {
        const sessionId = session?.id ?? session?.sessionId ?? 'unknown'
        void db.append({ t: 'sent', sessionId, at: event.time ?? Date.now(), text, predicted: lastPrediction.get(sessionId)?.next?.[0] ?? null }).catch((e) => report(e, sessionId))
      }
      return
    }
    if (event?.type === 'turn/end') void generate(session, event.data?.turn)
  })

  void db.append({ t: 'boot', version: '0.5.0-beta.1', at: Date.now(), pid: process.pid }).catch((e) => report(e))
  ctx.logger.info('prompt-copilot ready -> ' + db.path)
}

export function isUserMessage(message) {
  return message?.source?.kind === 'user'
}
function lastAssistantEvent(session) {
  return eventsOf(session).findLast((e) => e.type === 'assistant/message' && textOfMessage(e.data?.message ?? e.data))
}
export async function loadSessionModule() {
  const resources = process.resourcesPath || join(dirname(process.execPath), 'resources')
  const runtimeRequire = createRequire(join(resources, 'app.asar', 'dsh', 'package.json'))
  let resolved
  try { resolved = runtimeRequire.resolve('@deepseek-ai/dsh-session') }
  catch { return import('@deepseek-ai/dsh-session') }
  return import(pathToFileURL(resolved).href)
}

import { Context } from '@deepseek-ai/cordis'
import { mountAgentLoopTestDependencies, mountAgentLoopTestHarness } from '@deepseek-ai/dsh-agent-loop-testkit'
import { brandString } from '@deepseek-ai/dsh-brand'
import * as webContext from '@deepseek-ai/dsh-harness-dev-context'
import { createUserMessage, LlmAdapter, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import type { SessionId } from '@deepseek-ai/dsh-session'
import SystemPrompt, { type PromptPresentation } from '@deepseek-ai/dsh-system-prompt'
import { expect, it, onTestFinished } from 'vitest'
import * as plugin from '../index.js'

const identity = 'You are an AI agent powered by DeepSeek Harness.'
const newIdentity = 'You are a coding assistant running in DeepSeek Harness.'
const browser = 'The browser provides no implicit DOM, route, or screenshot context.'
const newBrowser = 'The browser does not automatically supply DOM data, routing details, or screenshots.'

class RecordingProvider extends LlmAdapter {
  requests: GenerateOptions[] = []

  async resolveModel(provider: string, model: string) {
    return { provider, id: model, name: model }
  }

  async *stream(request: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(request)
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

it('changes only the two built-in sentences in the request received by the provider', async () => {
  const user = createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: identity + browser }] })

  async function request(enabled: boolean) {
    const ctx = new Context()
    onTestFinished(() => ctx.fiber.dispose())
    ctx.provide('webApp', { getAdvertisedUrl: () => 'http://web.example.test' })
    await mountAgentLoopTestDependencies(ctx)
    await ctx.plugin(webContext)
    if (enabled) await ctx.plugin(plugin)
    ctx.systemPrompt.tools(() => ({ schemas: [{ name: 'inspect', description: browser, parameters: {} }] }))
    const provider = new RecordingProvider()
    ctx.llm.registerAdapter(['custom-route'], provider)
    const loop = await mountAgentLoopTestHarness(ctx)
    const agent = await loop.create(brandString<SessionId>('compat-test'), { provider: 'custom-route', model: 'test' })
    agent.followup(user)
    await agent.whenIdle()
    expect(provider.requests).toHaveLength(1)
    const { messages, signal, ...options } = provider.requests[0]
    expect(signal).toBeInstanceOf(AbortSignal)
    return {
      ...options,
      // Each independent session assigns fresh IDs to its system and context messages.
      messages: messages.map(message => {
        if (!('id' in message)) return message
        const { id, ...content } = message
        expect(typeof id).toBe('string')
        return content
      }),
    }
  }

  const off = await request(false)
  const on = await request(true)
  expect(off.tools).toEqual([expect.objectContaining({ name: 'inspect', description: browser })])
  expect(off.messages.some(m => m.role === 'user' && m.content.some(b => b.type === 'text' && b.text === identity + browser))).toBe(true)
  expect(off.messages.some(m => m.role === 'user' && JSON.stringify(m.content).includes('http://web.example.test'))).toBe(true)
  const expected = structuredClone(off)
  const system = expected.messages.filter(m => m.role === 'system')
  expect(system).toHaveLength(1)
  const block = system[0].content[0]
  expect(block.type).toBe('text')
  if (block.type !== 'text') throw new Error('expected a system text block')
  expect(block.text).toContain(identity)
  expect(block.text).toContain(browser)
  block.text = block.text.replace(identity, newIdentity).replace(browser, newBrowser)
  expect(on).toEqual(expected)
})

it('preserves downstream edits, section metadata and references on repeated assembly', async () => {
  const ctx = new Context()
  onTestFinished(() => ctx.fiber.dispose())
  await ctx.plugin(SystemPrompt)
  const fiber = ctx.plugin(plugin)
  await fiber
  let downstream: PromptPresentation = {
    sections: [
      { name: 'custom', text: identity + browser },
      { name: 'harness:identity', text: identity + ' Custom identity.' },
      { name: 'app:web-surface', text: [browser, 'Other guidance.', browser].join(' '), interpolate: false },
    ],
    contexts: [{ name: 'app:web-surface', text: browser }],
    variables: { identity },
  }
  let observed: PromptPresentation | undefined
  ctx.on('system-prompt/assemble', async (_assembly, _context, next) => {
    observed = await next()
    return observed
  }, true)
  let calls = 0
  ctx.on('system-prompt/assemble', async () => { calls++; return downstream })
  await ctx.systemPrompt.assemble()
  expect(calls).toBe(1)
  expect(observed?.sections[0]).toBe(downstream.sections[0])
  expect(observed?.sections[1]).toBe(downstream.sections[1])
  expect(observed?.sections[2]).toEqual({ ...downstream.sections[2], text: [newBrowser, 'Other guidance.', newBrowser].join(' ') })
  expect(downstream.sections[2].text).toContain(browser)
  expect(observed?.contexts).toBe(downstream.contexts)
  expect(observed?.variables).toBe(downstream.variables)
  downstream = observed!
  await ctx.systemPrompt.assemble()
  expect(observed).toBe(downstream)
  await fiber.dispose()
  downstream = { ...downstream, sections: [{ name: 'harness:identity', text: identity }] }
  await ctx.systemPrompt.assemble()
  expect(observed).toBe(downstream)
})

it('respects a complete system prompt supplied by the user', async () => {
  const ctx = new Context()
  onTestFinished(() => ctx.fiber.dispose())
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(plugin)
  ctx.systemPrompt.section({ name: 'app:web-surface', order: 0, complete: true, text: browser })
  const result = await ctx.systemPrompt.assemble()
  expect(result.sections).toEqual([expect.objectContaining({ name: 'app:web-surface', text: browser })])
})

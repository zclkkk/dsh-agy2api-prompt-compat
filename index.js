/** @import { Context } from '@deepseek-ai/cordis' */
/** @import { AssembledSection } from '@deepseek-ai/dsh-system-prompt' */

export const name = 'dsh-agy2api-prompt-compat'
export const inject = ['systemPrompt']

/** @param {AssembledSection} section */
function rewriteSection(section) {
  let text = section.text
  if (section.name === 'harness:identity' && text === 'You are an AI agent powered by DeepSeek Harness.') {
    text = 'You are a coding assistant running in DeepSeek Harness.'
  } else if (section.name === 'app:web-surface') {
    text = text.replaceAll(
      'The browser provides no implicit DOM, route, or screenshot context.',
      'The browser does not automatically supply DOM data, routing details, or screenshots.',
    )
  }
  return text === section.text ? section : { ...section, text }
}

/** @param {Context} ctx */
export function apply(ctx) {
  ctx.on('system-prompt/assemble', async (_assembly, _context, next) => {
    const prompt = await next()
    const sections = prompt.sections.map(rewriteSection)
    return sections.some((section, i) => section !== prompt.sections[i]) ? { ...prompt, sections } : prompt
  })
}

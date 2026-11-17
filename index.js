/** @import { Context } from '@deepseek-ai/cordis' */
/** @import { AssembledSection } from '@deepseek-ai/dsh-system-prompt' */

export const name = 'dsh-agy2api-prompt-compat'
export const inject = ['systemPrompt']

const fileReferencePrompt = 'Tokens prefixed with @ are paths the user explicitly referenced. '
  + 'Relative paths resolve from the workspace root; absolute paths identify files or directories on the host. '
  + 'A trailing slash marks a directory: list it when its contents matter. '
  + 'Anything else is a file: use the read tool when its contents are needed, and do not claim to have inspected it before reading. '
  + '@"..." quotes a path containing spaces.'

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
  } else if (section.name === 'context:file-reference' && text === fileReferencePrompt) {
    // Wording from https://github.com/magpie-community/plugins/issues/1028
    text = 'When the user writes @ followed by a path, they are pointing at that file or folder. '
      + 'Relative paths start at the workspace root; absolute paths are host paths. '
      + 'A path ending in a slash is a folder, so list it if its contents matter; otherwise it is a file, so open it with the read tool before relying on it. '
      + 'Paths with spaces appear as @"...".'
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

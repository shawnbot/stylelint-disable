const anymatch = require('anymatch')
const postcss = require('postcss')
const stylelint = require('stylelint')

const DISABLE_PRAGMA_LINE = 'stylelint-disable-line'
const DISABLE_PRAGMA_NEXT_LINE = 'stylelint-disable-next-line'
const DISABLE_COMMENT_PATTERN = new RegExp(`(${DISABLE_PRAGMA_LINE}|${DISABLE_PRAGMA_NEXT_LINE}) +(.+)`)

module.exports = function stylelintDisable(options) {
  const {rules = '*'} = options
  const hasRule = anymatch(rules)
  return stylelint.lint(options).then(data => {
    const results = []

    for (const {source, _postcssResult: result} of data.results) {
      const {root} = result
      const nodes = new Set()
      let disabled = 0
      for (const {rule, node, line} of result.warnings()) {
        if (hasRule(rule)) {
          console.warn(`+ disabling violation of ${rule} on ${source}:${line}`)
          if (node.disables) {
            node.disables.add(rule)
          } else {
            node.disables = new Set([rule])
          }
          disabled++
          nodes.add(node)
        } else {
          console.warn(`- skipping violation of ${rule} on ${source}:${line}`)
        }
      }

      if (nodes.size) {
        for (const node of nodes) {
          addDisableComment(node, node.disables)
        }
        results.push({
          source,
          root,
          disabled
        })
      }
    }

    return results
  })
}

function addDisableComment(node, rules) {
  const {nodes} = node.parent
  const previous = nodes[nodes.indexOf(node) - 1]
  if (previous && previous.type === 'comment') {
    const match = previous.text.match(DISABLE_COMMENT_PATTERN)
    if (match) {
      const [, pragma, existingRules] = match
      const ruleSet = new Set(existingRules.split(/ *, */).concat(rules))
      previous.text = `${pragma} ${Array.from(ruleSet).join(', ')}`
      // console.warn(`updated comment: "${previous.text}"`)
      return
    } else {
      // console.warn(`previous comment is not a disable: "${previous.text}"`)
    }
  }
  const inline = node.parent.source.start.line < node.source.start.line
  const pragma = inline ? DISABLE_PRAGMA_NEXT_LINE : DISABLE_PRAGMA_LINE
  const comment = postcss.comment({
    text: `${pragma} ${Array.from(rules).join(', ')}${inline ? '' : ' '}`,
    raws: {
      inline,
      before: node.raws.before
    }
  })
  if (inline) {
    node.parent.insertBefore(node, comment)
  } else {
    node.parent.insertAfter(node, comment)
  }
}

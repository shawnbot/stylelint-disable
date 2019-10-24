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
  const {parent} = node
  const sameLine = parent.source && parent.source.start.line === node.source.start.line
  let comment = previousSiblingComment(node)
  if (comment) {
    const match = comment.text.match(DISABLE_COMMENT_PATTERN)
    if (match) {
      const [, pragma, existingRuleString] = match
      const existingRules = existingRuleString.split(/ *, */).map(trim)
      const ruleSet = new Set(existingRules.concat(rules).map(trim))
      comment.text = `${pragma} ${Array.from(ruleSet).join(', ')}`
      // console.warn(`updated comment: "${previous.text}"`)
      return
    } else {
      console.warn(`adjacent comment is not a disable: "${comment.text}"`)
    }
  }

  const pragma = DISABLE_PRAGMA_NEXT_LINE
  const ruleString = Array.from(rules).join(', ')
  comment = postcss.comment({
    text: `${pragma} ${ruleString}${sameLine ? ' ' : ''}`,
    raws: {
      inline: true,
      before: sameLine ? parent.raws.before : node.raws.before,
      after: sameLine ? ' ' : ''
    }
  })
  console.warn(`inserting: "${comment.text}"`)
  if (sameLine) {
    parent.parent.insertBefore(parent, comment)
  } else {
    node.parent.insertBefore(node, comment)
  }
}

function previousSiblingComment(node) {
  const {nodes} = node.parent
  const previous = nodes[nodes.indexOf(node) - 1]
  return previous && previous.type === 'comment' ? previous : undefined
}

function trim(str) {
  return str.trim()
}

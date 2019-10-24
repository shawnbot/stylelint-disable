#!/usr/bin/env node
const minimist = require('minimist')
const {writeFileSync} = require('fs')
const stylelintDisable = require('.')

const args = process.argv.slice(2)
const options = minimist(args, {
  '--': true,
  boolean: ['dry-run', 'help'],
  alias: {
    n: 'dry-run',
    h: 'help'
  }
})

if (options.help) {
  showUsage()
}

const rules = options._
const files = options['--'] || []

const dryRun = options['dry-run']

if (rules.length === 0) {
  console.warn(`No rules provided; disabling all rules!`)
  rules.push('*')
}

if (files.length === 0) {
  console.warn(`You must provide one or more files after "--" in the arguments list.`)
  showUsage()
}

stylelintDisable({rules, files}).then(results => {
  for (const {source, root, disabled} of results) {
    console.warn(`Writing ${disabled} disables to ${source}...`)
    if (!dryRun) {
      let css = root.toString()
      // XXX: this is a fix for some trailing spaces in comments that show up
      // even though we set {raws: {after: ''}} in the comment node
      // :thinking_face:
      css = css.replace(/ +\n/g, '\n')
      writeFileSync(source, css, 'utf8')
    }
  }
})

function showUsage() {
  const $0 = 'stylelint-only'
  console.log(`
${$0} [options] [rules] -- files

Disable one or more rules by adding the requisite stylelint-disable comments.
`)
  process.exit(0)
}

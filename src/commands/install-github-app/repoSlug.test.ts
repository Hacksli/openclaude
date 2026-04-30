import assert from 'node:assert/strict'
import test from 'node:test'

import { extractGitHubRepoSlug } from './repoSlug.ts'

test('keeps owner/repo input as-is', () => {
  assert.equal(extractGitHubRepoSlug('Hacksli/nnc'), 'Hacksli/nnc')
})

test('extracts slug from https GitHub URLs', () => {
  assert.equal(
    extractGitHubRepoSlug('https://github.com/Hacksli/nnc'),
    'Hacksli/nnc',
  )
  assert.equal(
    extractGitHubRepoSlug('https://www.github.com/Hacksli/nnc.git'),
    'Hacksli/nnc',
  )
})

test('extracts slug from ssh GitHub URLs', () => {
  assert.equal(
    extractGitHubRepoSlug('git@github.com:Hacksli/nnc.git'),
    'Hacksli/nnc',
  )
  assert.equal(
    extractGitHubRepoSlug('ssh://git@github.com/Hacksli/nnc'),
    'Hacksli/nnc',
  )
})

test('rejects malformed or non-GitHub URLs', () => {
  assert.equal(extractGitHubRepoSlug('https://gitlab.com/Hacksli/nnc'), null)
  assert.equal(extractGitHubRepoSlug('https://github.com/Hacksli'), null)
  assert.equal(extractGitHubRepoSlug('not actually github.com/Hacksli/nnc'), null)
  assert.equal(
    extractGitHubRepoSlug('https://evil.example/?next=github.com/Hacksli/nnc'),
    null,
  )
  assert.equal(
    extractGitHubRepoSlug('https://github.com.evil.example/Hacksli/nnc'),
    null,
  )
  assert.equal(
    extractGitHubRepoSlug('https://example.com/github.com/Hacksli/nnc'),
    null,
  )
})

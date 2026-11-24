import { describe, expect, it } from 'vitest'
import { lintSchemaSet } from 'deepspace/worker'
import { schemas } from './schemas'

describe('collection schemas', () => {
  it('pass the SDK schema linter', () => {
    expect(lintSchemaSet(schemas)).toEqual([])
  })
})

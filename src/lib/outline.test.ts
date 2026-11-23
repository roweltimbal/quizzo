import { describe, expect, it } from 'vitest'
import { chapterRange, cleanOutline, isJunkTitle, rangeError, type OutlineEntry } from './outline'

const entries = (...items: [string, number][]): OutlineEntry[] =>
  items.map(([title, startPage]) => ({ title, startPage }))

describe('cleanOutline', () => {
  it('treats the CKSci cover/SR bookmarks as no outline', () => {
    const outline = entries(
      ['CKSci_G5Ecosystems_FrontCover', 1],
      ['CKSci_G5Ecosystems_SR', 2],
      ['CKSci_G5Ecosystems_SR_Back_Cover', 40],
    )
    expect(cleanOutline(outline)).toEqual([])
  })

  it('treats a lone Word "_GoBack" bookmark as no outline', () => {
    expect(cleanOutline(entries(['_GoBack', 3]))).toEqual([])
  })

  it('keeps real chapters, including one-word entries, and drops junk among them', () => {
    const outline = entries(
      ['_Toc123', 1],
      ['Chapter 1: The Rise of Early American Civilizations', 7],
      ['Chapter 2: Golden Age of the Maya', 13],
      ['Glossary', 84],
    )
    expect(cleanOutline(outline).map((e) => e.title)).toEqual([
      'Chapter 1: The Rise of Early American Civilizations',
      'Chapter 2: Golden Age of the Maya',
      'Glossary',
    ])
  })

  it('treats an outline whose entries all start on the same page as no outline', () => {
    expect(cleanOutline(entries(['Title page', 1], ['Copyright', 1], ['Contents', 1]))).toEqual([])
  })

  it('treats fewer than 2 entries as no outline', () => {
    expect(cleanOutline(entries(['Chapter 1', 5]))).toEqual([])
    expect(cleanOutline([])).toEqual([])
  })
})

describe('isJunkTitle', () => {
  it('flags identifier-like bookmark names', () => {
    expect(isJunkTitle('_GoBack')).toBe(true)
    expect(isJunkTitle('Chapter_1_Start')).toBe(true)
    expect(isJunkTitle('CKSci_G5Ecosystems_FrontCover')).toBe(true)
  })

  it('keeps real titles', () => {
    expect(isJunkTitle('Glossary')).toBe(false)
    expect(isJunkTitle('Chapter 3: Hidden Secrets in the Rainforest')).toBe(false)
    expect(isJunkTitle('Snake_case in a sentence title')).toBe(false)
  })
})

describe('chapterRange', () => {
  const outline = entries(['Ch 1', 7], ['Ch 2', 13], ['Glossary', 84])

  it('ends one page before the next chapter', () => {
    expect(chapterRange(outline, 0, 93)).toEqual({ start: 7, end: 12 })
  })

  it('runs the last chapter to the last page', () => {
    expect(chapterRange(outline, 2, 93)).toEqual({ start: 84, end: 93 })
  })

  it('uses page order, not outline order', () => {
    const shuffled = entries(['Ch 2', 13], ['Ch 1', 7], ['Glossary', 84])
    expect(chapterRange(shuffled, 1, 93)).toEqual({ start: 7, end: 12 })
  })

  it('handles two entries on the same page', () => {
    const same = entries(['Part I', 7], ['Ch 1', 7], ['Ch 2', 13])
    expect(chapterRange(same, 0, 93)).toEqual({ start: 7, end: 12 })
  })
})

describe('rangeError', () => {
  it('accepts a valid range up to 40 pages', () => {
    expect(rangeError(7, 12, 93)).toBeNull()
    expect(rangeError(1, 40, 93)).toBeNull()
  })

  it('rejects start after end, out-of-bounds pages, and more than 40 pages', () => {
    expect(rangeError(12, 7, 93)).toMatch(/before/)
    expect(rangeError(0, 5, 93)).toMatch(/between 1 and 93/)
    expect(rangeError(90, 94, 93)).toMatch(/between 1 and 93/)
    expect(rangeError(1, 41, 93)).toMatch(/41 pages/)
    expect(rangeError(1.5, 3, 93)).toMatch(/whole/)
  })
})

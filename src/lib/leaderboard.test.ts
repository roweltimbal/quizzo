import { describe, expect, it } from 'vitest'
import { buildLeaderboard, labelPlayers, rankEntries } from './leaderboard'

const players = [
  { userId: 'a', displayName: 'Ana' },
  { userId: 'b', displayName: 'Ben' },
  { userId: 'c', displayName: 'Cy' },
]

describe('buildLeaderboard', () => {
  it('one point per correct closed question; unanswered is 0; ties keep join order', () => {
    const board = buildLeaderboard(
      players,
      [
        { userId: 'a', questionIndex: 0, graded: true, isCorrect: false },
        { userId: 'b', questionIndex: 0, graded: true, isCorrect: true },
        { userId: 'c', questionIndex: 0, graded: true, isCorrect: true },
        // Question 1 is still open: not counted, not pending.
        { userId: 'a', questionIndex: 1, graded: false },
      ],
      1,
    )
    expect(board).toEqual([
      { userId: 'b', displayName: 'Ben', score: 1, pending: false },
      { userId: 'c', displayName: 'Cy', score: 1, pending: false },
      { userId: 'a', displayName: 'Ana', score: 0, pending: false },
    ])
  })

  it('an ungraded row of a closed question is pending', () => {
    const board = buildLeaderboard(players.slice(0, 1), [{ userId: 'a', questionIndex: 1, graded: false }], 2)
    expect(board[0]).toMatchObject({ score: 0, pending: true })
  })
})

describe('rankEntries', () => {
  it('ties share a rank and the next rank skips (1, 1, 3)', () => {
    expect(rankEntries([{ score: 5 }, { score: 5 }, { score: 3 }, { score: 0 }]).map((e) => e.rank)).toEqual([1, 1, 3, 4])
  })
})

describe('labelPlayers', () => {
  it('first names when they are unique', () => {
    expect(labelPlayers([{ userId: '1', name: 'Drew Smith' }, { userId: '2', name: 'Jen' }]).map((p) => p.displayName)).toEqual([
      'Drew',
      'Jen',
    ])
  })

  it('a shared first name gets last initials for everyone with it', () => {
    const labels = labelPlayers([
      { userId: '1', name: 'Rowel Timbal' },
      { userId: '2', name: 'Jen Lee' },
      { userId: '3', name: 'rowel mendoza' },
    ]).map((p) => p.displayName)
    expect(labels).toEqual(['Rowel T.', 'Jen', 'rowel M.'])
  })

  it('numbers them when initials match or are missing', () => {
    expect(labelPlayers([{ userId: '1', name: 'Rowel Timbal' }, { userId: '2', name: 'Rowel Tan' }]).map((p) => p.displayName)).toEqual([
      'Rowel',
      'Rowel 2',
    ])
    expect(labelPlayers([{ userId: '1', name: 'Rowel' }, { userId: '2', name: 'Rowel Tan' }]).map((p) => p.displayName)).toEqual([
      'Rowel',
      'Rowel 2',
    ])
  })

  it('never stores a full name; no profile name becomes "Player"', () => {
    const out = labelPlayers([{ userId: '1', name: undefined }])
    expect(out).toEqual([{ userId: '1', displayName: 'Player' }])
  })
})

/**
 * Live-room scoring and names (docs/SPEC.md § Live quiz, Result), shared by
 * the server actions, the grading job and the Result screen. Pure functions.
 *
 * Scores are whole numbers: one point per correct question. A short answer
 * counts as correct at SHORT_PASS_SCORE or above, the same rule as solo.
 */

import { playerDisplayName, type RoomPlayer } from './room'

export interface LeaderboardEntry {
  userId: string
  displayName: string
  score: number
  /** A closed question of theirs is still being graded (the short answer). */
  pending: boolean
}

/** The fields of an answer row that scoring needs. */
export interface ScoredAnswer {
  userId: string
  questionIndex: number
  graded: boolean
  isCorrect?: boolean | null
}

/**
 * One entry per player, highest score first; ties keep join order.
 * Questions before `closedCount` are closed, so an ungraded row there is
 * `pending`. A player with no row for a question scores 0 for it.
 */
export function buildLeaderboard(
  players: readonly RoomPlayer[],
  answers: readonly ScoredAnswer[],
  closedCount: number,
): LeaderboardEntry[] {
  const entries = players.map((p, order) => {
    const mine = answers.filter((a) => a.userId === p.userId && a.questionIndex < closedCount)
    return {
      order,
      entry: {
        userId: p.userId,
        displayName: p.displayName,
        score: mine.filter((a) => a.graded && a.isCorrect === true).length,
        pending: mine.some((a) => !a.graded),
      },
    }
  })
  entries.sort((a, b) => b.entry.score - a.entry.score || a.order - b.order)
  return entries.map((e) => e.entry)
}

/** Standard competition ranking: 5, 5, 3 → ranks 1, 1, 3. Expects score order. */
export function rankEntries<T extends { score: number }>(entries: readonly T[]): (T & { rank: number })[] {
  return entries.map((e, i) => {
    const firstWithScore = entries.findIndex((x) => x.score === e.score)
    return { ...e, rank: (firstWithScore === -1 ? i : firstWithScore) + 1 }
  })
}

/**
 * Names shown in a room. Normally the first name only. When players share
 * a first name, all of them get a last initial ("Rowel T.", "Rowel M.");
 * if initials are missing or also match, they're numbered in join order
 * ("Rowel", "Rowel 2"). Only these labels are stored, never full names.
 */
export function labelPlayers(entries: readonly { userId: string; name: unknown }[]): RoomPlayer[] {
  const parsed = entries.map((e) => {
    const first = playerDisplayName(e.name)
    const words = typeof e.name === 'string' ? e.name.trim().split(/\s+/) : []
    const initial = words.length > 1 ? words[words.length - 1].charAt(0).toUpperCase() : ''
    return { userId: e.userId, first, initial }
  })

  const groups = new Map<string, typeof parsed>()
  for (const p of parsed) {
    const key = p.first.toLowerCase()
    groups.set(key, [...(groups.get(key) ?? []), p])
  }

  const labels = new Map<string, string>()
  for (const group of groups.values()) {
    if (group.length === 1) {
      labels.set(group[0].userId, group[0].first)
      continue
    }
    const initials = group.map((p) => p.initial)
    const useInitials = initials.every((i) => /^\p{L}$/u.test(i)) && new Set(initials).size === initials.length
    group.forEach((p, n) => {
      labels.set(p.userId, useInitials ? `${p.first} ${p.initial}.` : n === 0 ? p.first : `${p.first} ${n + 1}`)
    })
  }

  return parsed.map((p) => ({ userId: p.userId, displayName: labels.get(p.userId) ?? p.first }))
}

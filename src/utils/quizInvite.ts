import { fetchQuizInvite } from '@/api/quiz'
import { useAuthStore } from '@/store/authStore'
import type { Activity, QuizInvitePayload } from '@/types'

/** 演出结果中挑选可挂答题邀请的项目（演示：海豚表演） */
export async function resolveShowQuizInvite(
  activities: Activity[],
): Promise<QuizInvitePayload | undefined> {
  const auth = useAuthStore()
  if (!auth.personaId) return undefined

  const withQuiz = activities.find(
    (item) => item.category === 'show' && item.quizId && item.name.includes('海豚'),
  )
  if (!withQuiz?.quizId) return undefined

  try {
    const { data: res } = await fetchQuizInvite(withQuiz.quizId)
    if (res.code === 200 && res.data) return res.data
  } catch {
    // ignore
  }
  return undefined
}

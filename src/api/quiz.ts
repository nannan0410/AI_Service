import request from '@/api/request'
import { toQuerySafeText } from '@/utils/queryText'
import type {
  ApiResponse,
  QuizAnswerResult,
  QuizCardPayload,
  QuizInvitePayload,
  QuizSet,
  ScenicStar,
} from '@/types'

export function fetchStars() {
  return request.get<ApiResponse<ScenicStar[]>>('/api/stars')
}

export function matchStar(q: string) {
  return request.get<
    ApiResponse<(ScenicStar & { quizInvite?: QuizInvitePayload }) | null>
  >('/api/stars/match', { params: { q: toQuerySafeText(q) } })
}

export function fetchQuizInvite(quizId: string) {
  return request.get<ApiResponse<QuizInvitePayload | null>>('/api/quiz/invite', {
    params: { quizId },
  })
}

export function fetchQuizDetail(quizId: string) {
  return request.get<ApiResponse<QuizSet & { completed?: boolean }>>('/api/quiz/detail', {
    params: { quizId },
  })
}

export function startQuiz(quizId: string) {
  return request.post<ApiResponse<QuizCardPayload>>('/api/quiz/start', { quizId })
}

export function submitQuizAnswer(body: {
  quizId: string
  questionIndex: number
  optionKey: string
}) {
  return request.post<ApiResponse<QuizAnswerResult>>('/api/quiz/answer', body)
}

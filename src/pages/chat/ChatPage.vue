<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  showConfirmDialog,
  showLoadingToast,
  showToast,
  closeToast,
} from "vant";
import { useAuthStore } from "@/store/authStore";
import { useChatStore } from "@/store/chatStore";
import { useAssistantStore } from "@/store/assistantStore";
import { useAiExecutionStore } from "@/store/aiExecutionStore";
import { useSkillStore } from "@/store/skillStore";
import { useBusinessConfigStore } from "@/store/businessConfigStore";
import { sendChatMessage } from "@/ai/llm";
import {
  runOrderQueryWorkflow,
  runNewGuestCouponWorkflow,
  runTicketPurchaseWorkflow,
  continueTicketPurchaseWorkflow,
  answerTicketEligibility,
  runTravelGuideWorkflow,
  runParkingPayWorkflow,
  runShowScheduleWorkflow,
  runInvoiceServiceWorkflow,
  runReviewServiceWorkflow,
  runCheckinWorkflow,
  runQueueRecommendWorkflow,
  runProactiveMarketingWorkflow,
  runMemberOfferWorkflow,
  runStarIntroWorkflow,
  runWeatherSuitabilityWorkflow,
  shouldRunNewGuestCouponWorkflow,
  shouldRunParkingPayWorkflow,
  shouldRunShowScheduleWorkflow,
  shouldRunStarIntroWorkflow,
  shouldRunWeatherSuitabilityWorkflow,
  shouldRunInvoiceWorkflow,
  shouldRunReviewWorkflow,
  shouldRunCheckinWorkflow,
  shouldRunQueueRecommendWorkflow,
  shouldRunProactiveMarketingWorkflow,
  shouldRunMemberOfferWorkflow,
  shouldRunOrderQueryWorkflow,
  shouldRunProjectQueryWorkflow,
  runProjectQueryWorkflow,
  shouldRunMapGuideWorkflow,
  runMapGuideWorkflow,
} from "@/ai/workflow";
import { isLikelyGeneralMessage } from "@/ai/nlu/isLikelyGeneralMessage";
import {
  shouldRunTicketWorkflowFromRoute,
  shouldRunTravelGuideWorkflowFromRoute,
  shouldRunOrderQueryWorkflowFromRoute,
  shouldRunParkingPayWorkflowFromRoute,
  shouldRunShowScheduleWorkflowFromRoute,
  shouldRunStarIntroWorkflowFromRoute,
  shouldRunInvoiceWorkflowFromRoute,
  shouldRunReviewWorkflowFromRoute,
  shouldRunCheckinWorkflowFromRoute,
  shouldRunQueueRecommendWorkflowFromRoute,
  shouldRunProactiveMarketingWorkflowFromRoute,
  shouldRunMemberOfferWorkflowFromRoute,
  shouldRunProjectQueryWorkflowFromRoute,
  shouldRunMapGuideWorkflowFromRoute,
} from "@/ai/nlu/skillWorkflowGate";
import { shouldInterruptPurchaseSession } from "@/utils/ticketPurchaseIntent";
import {
  createOrderDraft,
  fetchCoupons,
  fetchMemberInfo,
  fetchOrders,
  postAiChatTag,
  submitCheckin,
  submitReview,
  shareScenicReview,
} from "@/api/business";
import {
  REVIEW_SHARE_DEMO_TOAST,
  scenicDayKey,
} from "@/utils/scenicReviewAccess";
import { markScenicReviewedToday } from "@/utils/scenicReviewClient";
import {
  buildAiChatTagConfirmText,
  isAiChatPreferencePrimary,
  matchAiChatPreference,
} from "@/utils/aiChatTagIntent";
import { upsertAiChatTag } from "@/utils/aiChatTagRuntime";
import { startQuiz, submitQuizAnswer } from "@/api/quiz";
import {
  buildCouponCardPayload,
  buildMergedCouponMessage,
} from "@/utils/couponRecommend";
import { usePurchaseStore } from "@/store/purchaseStore";
import { useFeedbackStore } from "@/store/feedbackStore";
import MessageBubble from "@/components/chat/MessageBubble.vue";
import ToolProcessPanel from "@/components/chat/ToolProcessPanel.vue";
import WelcomeHero from "@/components/welcome/WelcomeHero.vue";
import WelcomeRecommendList from "@/components/welcome/WelcomeRecommendList.vue";
import WelcomeQuickServices from "@/components/welcome/WelcomeQuickServices.vue";
import WelcomeAiStatus from "@/components/welcome/WelcomeAiStatus.vue";
import ScenicPickerSheet from "@/components/scenic/ScenicPickerSheet.vue";
import { MAX_QUICK_SERVICES } from "@/utils/welcomeLayout";
import { withBaseUrl } from "@/utils/publicUrl";
import {
  isChunkLoadError,
  reloadOnceForChunkError,
} from "@/utils/chunkLoad";
import { useScenicStore } from "@/store/scenicStore";
import { useConversationStore } from "@/store/conversationStore";
import {
  formatScenicWeatherLine,
  getScenicWeather,
} from "@/utils/scenicWeather";
import {
  formatScenicCrowdLine,
  pickRandomCrowdLevel,
  type CrowdLevel,
} from "@/utils/scenicCrowd";
import { detectDeviceCoords } from "@/utils/scenicCity";
import { shouldShowInParkSelfReport } from "@/utils/inParkSelfReport";
import type {
  ChatMessageDraft,
  Coupon,
  FeedbackRouteSource,
  LlmMessage,
  MemberInfo,
  MessageFeedbackMeta,
  Order,
  OrderCardPayload,
  PageGuideCardPayload,
  PersonaId,
  QuizCardPayload,
  RecommendEntry,
  ReviewShareChannel,
  ReviewSubmitDraft,
  TicketCardPayload,
  TicketEligibilityCardPayload,
  VisitorPickPayload,
} from "@/types";
import type { WelcomeQuestionConfig } from "@/types/businessConfig";

/** 欢迎态：快捷服务 ← recommend_entries；游游推荐 ← welcome_questions（规则过滤） */

const authStore = useAuthStore();
const chatStore = useChatStore();
const assistantStore = useAssistantStore();
const aiStore = useAiExecutionStore();
const skillStore = useSkillStore();
const businessConfigStore = useBusinessConfigStore();
const scenicStore = useScenicStore();
const conversationStore = useConversationStore();
const purchaseStore = usePurchaseStore();
const feedbackStore = useFeedbackStore();
const route = useRoute();
const router = useRouter();

const input = ref("");
const listRef = ref<HTMLElement | null>(null);
const pendingPrompt = ref<string | null>(null);
const confirmedVisitorSessions = ref(new Set<string>());
const submittedReviewOrders = ref(new Set<string>());
const completedScenicReviews = ref<
  Record<
    string,
    {
      reviewId: string;
      shareHint?: string;
      sharedChannels: ReviewShareChannel[];
    }
  >
>({});
const answeredQuizMessageIds = ref(new Set<string>());
const answeredEligibilityMessageIds = ref(new Set<string>());
const userCoupons = ref<Coupon[]>([]);
const userOrders = ref<Order[]>([]);
const memberInfo = ref<MemberInfo | null>(null);
/** 欢迎页 / 聊天窗口视图（与本地聊天记录独立，进入 /chat 默认欢迎页） */
const showWelcomePanel = ref(true);
const scenicPickerVisible = ref(false);
const scenicPickerRequired = ref(false);
/** null=探测中；true=定位成功；false=未授权/失败 */
const locationAuthorized = ref<boolean | null>(null);
/** null=未答；true/false=自报在园/未到园 */
const selfReportedInPark = ref<boolean | null>(null);

const pageStyle = computed(() => {
  const bg = assistantStore.uiConfig?.chatBackgroundUrl;
  return bg
    ? {
        "--chat-bg-image": `url(${bg})`,
      }
    : {};
});

const assistantNickname = computed(() => assistantStore.assistantNickname);
const assistantTitle = computed(() => assistantStore.dialogTitle);
const avatarUrl = computed(() => assistantStore.assistantAvatarUrl);
const characterUrl = computed(() => assistantStore.defaultImageUrl);
const currentScenicName = computed(() => scenicStore.currentScenicName);
const weatherLine = computed(() =>
  formatScenicWeatherLine(
    getScenicWeather(scenicStore.currentScenicId),
    scenicStore.currentScenicName || undefined
  )
);
/** 欢迎页客流：每次进入欢迎态随机一档 */
const crowdLevel = ref<CrowdLevel>(pickRandomCrowdLevel());
const crowdLine = computed(() => formatScenicCrowdLine(crowdLevel.value));

function refreshCrowdStatus() {
  crowdLevel.value = pickRandomCrowdLevel();
}

const inputPlaceholder = computed(() => {
  if (!scenicStore.hasScenicSelected) return "请先选择服务景区";
  return `有问题，问${assistantNickname.value}吧~`;
});

function urlScenicId(): string | null {
  const raw = route.query.scenicId;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === "string" && raw[0].trim()) {
    return raw[0].trim();
  }
  return null;
}

/** 解析并应用当前景区 + 会话；返回是否已选中景区 */
function applyScenicFromEntry(options?: {
  forceNewConversation?: boolean;
}): boolean {
  if (authStore.memberId) {
    scenicStore.bindMember(authStore.memberId);
    conversationStore.bindMember(authStore.memberId);
    feedbackStore.bindMember(authStore.memberId);
    feedbackStore.loadPersisted();
  }
  scenicStore.loadCatalog();
  conversationStore.loadPersisted();

  const resolved = scenicStore.resolveScenicId(
    urlScenicId(),
    conversationStore.scenicId
  );

  if (!resolved.scenicId) {
    scenicStore.clearCurrentScenic();
    conversationStore.clear();
    scenicPickerRequired.value = true;
    scenicPickerVisible.value = true;
    return false;
  }

  scenicStore.selectScenic(resolved.scenicId);

  const scenicChanged =
    conversationStore.scenicId != null &&
    conversationStore.scenicId !== resolved.scenicId;
  /** URL 换景区，或记忆景区与旧会话不一致 → 新会话 */
  const forceNew =
    options?.forceNewConversation === true ||
    (resolved.source === "url" && scenicChanged) ||
    (resolved.source === "memory" && scenicChanged);

  conversationStore.ensureConversation(resolved.scenicId, {
    personaId: authStore.personaId,
    forceNew,
  });

  if (authStore.memberId) {
    chatStore.loadForUser(
      authStore.memberId,
      assistantNickname.value,
      resolved.scenicId
    );
  }

  scenicPickerRequired.value = false;
  scenicPickerVisible.value = false;
  return true;
}

function openScenicPicker() {
  scenicPickerRequired.value = !scenicStore.hasScenicSelected;
  scenicPickerVisible.value = true;
}

const pickerInitialCityId = computed(() =>
  scenicStore.resolvePickerCityId(scenicStore.currentScenicId)
);

function onPickerCityChange(cityId: string) {
  try {
    scenicStore.selectCity(cityId, { persist: true });
  } catch {
    /* ignore invalid */
  }
}

async function onScenicPicked(scenicId: string) {
  const prevId = scenicStore.currentScenicId;
  if (prevId === scenicId) {
    scenicPickerVisible.value = false;
    scenicPickerRequired.value = false;
    if (
      !conversationStore.hasConversation ||
      conversationStore.scenicId !== scenicId
    ) {
      conversationStore.ensureConversation(scenicId, {
        personaId: authStore.personaId,
      });
    }
    return;
  }

  if (!showWelcomePanel.value && prevId) {
    try {
      await showConfirmDialog({
        title: "切换服务景区？",
        message: "切换后将开启新对话，当前聊天记录不会带入新会话。",
        confirmButtonText: "确认切换",
        cancelButtonText: "取消",
      });
    } catch {
      return;
    }
  }

  scenicStore.selectScenic(scenicId);
  conversationStore.startNew(scenicId, authStore.personaId);
  scenicPickerVisible.value = false;
  scenicPickerRequired.value = false;

  if (urlScenicId() && urlScenicId() !== scenicId) {
    const nextQuery = { ...route.query, scenicId };
    router.replace({ path: "/chat", query: nextQuery });
  }

  if (authStore.memberId) {
    chatStore.loadForUser(
      authStore.memberId,
      assistantNickname.value,
      scenicId
    );
  }
  clearChatAndReturnWelcome();
  await loadUserCoupons();
}

function ensureScenicSelected(): boolean {
  if (scenicStore.hasScenicSelected) {
    if (
      !conversationStore.hasConversation ||
      conversationStore.scenicId !== scenicStore.currentScenicId
    ) {
      conversationStore.ensureConversation(scenicStore.currentScenicId!, {
        personaId: authStore.personaId,
      });
    }
    return true;
  }
  scenicPickerRequired.value = true;
  scenicPickerVisible.value = true;
  showToast("请先选择服务景区");
  return false;
}
const welcomeTemplateContext = computed(() => ({
  nickname: memberInfo.value?.nickname ?? authStore.userInfo?.nickname ?? "",
  orders: userOrders.value,
  scenicId: scenicStore.currentScenicId,
  scenicName: scenicStore.currentScenicName || undefined,
  inPark:
    selfReportedInPark.value === null ? undefined : selfReportedInPark.value,
}));
const resolvedWelcomeTemplate = computed(() => {
  const personaId = (authStore.personaId || "demo_new") as PersonaId;
  return businessConfigStore.getResolvedWelcomeTemplate(
    personaId,
    welcomeTemplateContext.value
  );
});
const welcomeRecommendSubtitle = computed(
  () => resolvedWelcomeTemplate.value?.subtitle?.trim() || "试试这些热门问题"
);
const welcomeCouponFilterCtx = computed(() => ({
  personaId: authStore.personaId,
  coupons: userCoupons.value,
  registeredAt: memberInfo.value?.registeredAt,
}));
const suggestedQuestions = computed(() => {
  const personaId = (authStore.personaId || "demo_new") as PersonaId;
  return businessConfigStore.getSuggestedQuestions(
    personaId,
    welcomeCouponFilterCtx.value,
    welcomeTemplateContext.value
  );
});
const recommendEntries = computed(() => {
  const personaId = (authStore.personaId || "demo_new") as PersonaId;
  return businessConfigStore
    .getActiveRecommendEntries(personaId, {
      coupons: userCoupons.value,
      orders: userOrders.value,
      registeredAt: memberInfo.value?.registeredAt,
      nickname: memberInfo.value?.nickname,
      memberLevel: memberInfo.value?.level,
      scenicId: scenicStore.currentScenicId,
      inPark:
        selfReportedInPark.value === null
          ? undefined
          : selfReportedInPark.value,
    })
    .slice(0, MAX_QUICK_SERVICES);
});

const showInParkAsk = computed(() =>
  shouldShowInParkSelfReport({
    scenicOrderCount: userOrders.value.length,
    locationAuthorized: locationAuthorized.value,
    answered: selfReportedInPark.value !== null,
  })
);

async function refreshLocationAuth() {
  locationAuthorized.value = null;
  const coords = await detectDeviceCoords();
  locationAuthorized.value = coords != null;
}

function resetInParkSelfReport() {
  selfReportedInPark.value = null;
}

function onInParkSelfReport(inPark: boolean) {
  selfReportedInPark.value = inPark;
  showToast(inPark ? "已切换为在园推荐" : "好的，先为您保留出行前推荐");
}
function onRecommendEntryClick(entry: RecommendEntry) {
  if (!ensureScenicSelected()) return;
  if (entry.target === "page" && entry.targetPath) {
    router.push(entry.targetPath);
    return;
  }
  if (entry.target === "chat" && entry.promptHint) {
    onStartChat(entry.promptHint);
    return;
  }
  showToast("暂不支持该入口");
}

function onWelcomeRecommendSelect(question: WelcomeQuestionConfig) {
  if (!ensureScenicSelected()) return;
  const target = question.target || "chat";
  const path = question.targetPath?.trim();

  if ((target === "page" || target === "mini_program") && path) {
    router.push(path);
    return;
  }
  if (target === "h5" && path) {
    if (/^https?:\/\//i.test(path)) {
      window.open(path, "_blank", "noopener,noreferrer");
    } else {
      router.push(path);
    }
    return;
  }

  const prompt = question.prompt?.trim();
  if (prompt) {
    onStartChat(prompt);
    return;
  }
  showToast("暂不支持该推荐");
}

async function loadUserCoupons() {
  if (!authStore.personaId) {
    userCoupons.value = [];
    userOrders.value = [];
    memberInfo.value = null;
    return;
  }
  try {
    const [{ data: couponRes }, { data: memberRes }, { data: orderRes }] =
      await Promise.all([fetchCoupons(), fetchMemberInfo(), fetchOrders()]);
    if (couponRes.code === 200) userCoupons.value = couponRes.data;
    if (memberRes.code === 200) memberInfo.value = memberRes.data;
    if (orderRes.code === 200) userOrders.value = orderRes.data;
  } catch {
    userCoupons.value = [];
    userOrders.value = [];
    memberInfo.value = null;
  }
}

onMounted(async () => {
  applyScenicFromEntry();
  void scenicStore.refreshLocatedCity();
  await Promise.all([
    assistantStore.loadConfig(true),
    skillStore.loadSkills(),
    businessConfigStore.loadAll(true),
    loadUserCoupons(),
  ]);
  if (authStore.memberId && scenicStore.currentScenicId) {
    chatStore.loadForUser(
      authStore.memberId,
      assistantNickname.value,
      scenicStore.currentScenicId
    );
  }
  showWelcomePanel.value = true;
  refreshCrowdStatus();
  void refreshLocationAuth();
  assistantStore.setMotion("wave", 2200);
});

onBeforeUnmount(() => {
  chatStore.cancelPresent();
});

watch(
  () => authStore.personaId,
  async (personaId) => {
    if (!personaId) return;
    applyScenicFromEntry();
    resetInParkSelfReport();
    await businessConfigStore.loadRecommendEntries(true);
    await loadUserCoupons();
    void refreshLocationAuth();
  }
);

watch(showWelcomePanel, (visible) => {
  if (visible) {
    refreshCrowdStatus();
    loadUserCoupons();
    void refreshLocationAuth();
  }
});

watch(
  () => scenicStore.currentScenicId,
  () => {
    resetInParkSelfReport();
    if (showWelcomePanel.value) refreshCrowdStatus();
    void loadUserCoupons();
    void refreshLocationAuth();
  }
);

watch(
  () => [route.path, route.query.scenicId] as const,
  ([path]) => {
    if (path !== "/chat") return;
    applyScenicFromEntry();
    loadUserCoupons();
  }
);

function enterChatView() {
  if (showWelcomePanel.value) {
    showWelcomePanel.value = false;
    scrollToBottom();
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (listRef.value) {
      listRef.value.scrollTop = listRef.value.scrollHeight;
    }
  });
}

async function onConfirmClearChat() {
  try {
    await showConfirmDialog({
      title: "是否清除当前聊天记录？",
      message: "仅清除本景区聊天时间线，不会删除收藏记录。",
      confirmButtonText: "确认清除",
      cancelButtonText: "我再想想",
      className: "chat-clear-dialog",
    });
    clearChatAndReturnWelcome();
  } catch {
    /* 用户点击「我再想想」 */
  }
}

function returnToWelcome() {
  input.value = "";
  pendingPrompt.value = null;
  chatStore.sending = false;
  assistantStore.setMotion("wave", 2200);
  showWelcomePanel.value = true;
}

function clearChatAndReturnWelcome() {
  input.value = "";
  pendingPrompt.value = null;
  confirmedVisitorSessions.value = new Set();
  submittedReviewOrders.value = new Set();
  completedScenicReviews.value = {};
  purchaseStore.clearSession();
  chatStore.sending = false;
  chatStore.clearMessages(assistantNickname.value);
  assistantStore.setMotion("wave", 2200);
  showWelcomePanel.value = true;
}

function isVisitorPickDisabled(message: { type: string; payload?: unknown }) {
  if (message.type !== "visitor_pick") return false;
  const sessionId = (message.payload as VisitorPickPayload | undefined)
    ?.sessionId;
  return sessionId ? confirmedVisitorSessions.value.has(sessionId) : false;
}

function isTicketConfirmDisabled(message: { type: string; payload?: unknown }) {
  const payload = message.payload as TicketCardPayload | undefined;
  if (!payload?.sessionId) return true;

  if (purchaseStore.isConfirmed(payload.sessionId)) return true;

  if (message.type !== "ticket" && message.type !== "ticket_confirm")
    return false;

  const active = purchaseStore.session;
  if (!active || active.sessionId !== payload.sessionId) {
    return true;
  }
  if (
    payload.quoteToken &&
    active.quoteToken &&
    payload.quoteToken !== active.quoteToken
  ) {
    return true;
  }
  return false;
}

function isReviewDisabled(message: { type: string; id?: string }) {
  if (message.type !== "review") return false;
  if (message.id && completedScenicReviews.value[message.id]) return true;
  return false;
}

function getReviewCompleted(messageId: string) {
  return completedScenicReviews.value[messageId] ?? null;
}

async function onReviewSubmit(draft: ReviewSubmitDraft, messageId: string) {
  if (chatStore.sending || completedScenicReviews.value[messageId]) {
    showToast("今日点评已提交");
    return;
  }

  chatStore.sending = true;
  assistantStore.setMotion("thinking");

  try {
    const { data: res } = await submitReview({
      rating: draft.rating,
      tags: draft.tags.length ? draft.tags : undefined,
      content: draft.content || undefined,
      imageIds: draft.imageIds.length ? draft.imageIds : undefined,
      recommendedActivityIds: draft.recommendedActivityIds?.length
        ? draft.recommendedActivityIds
        : undefined,
      inParkOverride:
        selfReportedInPark.value === true
          ? true
          : selfReportedInPark.value === false
            ? false
            : undefined,
    });

    if (res.code !== 200 || !res.data) {
      throw new Error(res.message || "提交评价失败");
    }

    completedScenicReviews.value = {
      ...completedScenicReviews.value,
      [messageId]: {
        reviewId: res.data.reviewId,
        shareHint: res.data.shareHint,
        sharedChannels: [],
      },
    };

    const memberId = authStore.memberId || memberInfo.value?.memberId;
    const scenicId = scenicStore.currentScenicId;
    if (memberId && scenicId) {
      markScenicReviewedToday({
        memberId,
        scenicId,
        dayKey: scenicDayKey(),
      });
    }

    assistantStore.setMotion("nod");
    showToast("评价已提交");
    scrollToBottom();
  } catch (e) {
    assistantStore.setMotion("shake");
    showToast(e instanceof Error ? e.message : "提交评价失败");
  } finally {
    chatStore.sending = false;
  }
}

async function onReviewShare(channel: ReviewShareChannel, messageId: string) {
  const completed = completedScenicReviews.value[messageId];
  if (!completed?.reviewId || chatStore.sending) return;

  chatStore.sending = true;
  try {
    const { data: res } = await shareScenicReview({
      reviewId: completed.reviewId,
      channel,
    });
    if (res.code !== 200 || !res.data) {
      throw new Error(res.message || "分享失败");
    }

    showToast(res.data.message || REVIEW_SHARE_DEMO_TOAST);

    const channels = new Set(completed.sharedChannels);
    channels.add(channel);
    completedScenicReviews.value = {
      ...completedScenicReviews.value,
      [messageId]: {
        ...completed,
        sharedChannels: Array.from(channels),
      },
    };

    if (res.data.rewardIssued && res.data.rewardCoupons?.length) {
      await loadUserCoupons();
      chatStore.addAssistantCards([
        buildMergedCouponMessage(
          "分享成功！已为您发放餐饮折扣券（3 个月有效）和当日停车券。",
          res.data.rewardCoupons,
        ),
      ]);
    }
    scrollToBottom();
  } catch (e) {
    showToast(e instanceof Error ? e.message : "分享失败");
  } finally {
    chatStore.sending = false;
  }
}


function isQuizDisabled(message: {
  type: string;
  id?: string;
  payload?: unknown;
}) {
  if (message.type !== "quiz") return false;
  if (message.id && answeredQuizMessageIds.value.has(message.id)) return true;
  const payload = message.payload as QuizCardPayload | undefined;
  return payload?.status !== "active";
}

async function onQuizStart(quizId: string) {
  if (chatStore.sending || !quizId) return;
  chatStore.sending = true;
  assistantStore.setMotion("thinking");
  try {
    const { data: res } = await startQuiz(quizId);
    if (res.code !== 200 || !res.data) {
      throw new Error(res.message || "无法开始答题");
    }
    const payload: QuizCardPayload = {
      ...res.data,
      status: "active",
    };
    chatStore.addAssistantCards([
      {
        type: "quiz",
        role: "assistant",
        content: "开始答题啦！请直接点选选项作答，答错将结束本轮挑战。",
        payload,
      },
    ]);
    assistantStore.setMotion("point");
  } catch (e) {
    assistantStore.setMotion("shake");
    showToast(e instanceof Error ? e.message : "开始答题失败");
  } finally {
    chatStore.sending = false;
    scrollToBottom();
  }
}

async function onQuizAnswer(
  payload: QuizCardPayload,
  optionKey: string,
  messageId: string
) {
  if (
    chatStore.sending ||
    payload.status !== "active" ||
    answeredQuizMessageIds.value.has(messageId)
  ) {
    return;
  }

  chatStore.sending = true;
  answeredQuizMessageIds.value.add(messageId);
  assistantStore.setMotion("thinking");

  try {
    const { data: res } = await submitQuizAnswer({
      quizId: payload.quizId,
      questionIndex: payload.questionIndex,
      optionKey,
    });
    if (res.code !== 200 || !res.data) {
      throw new Error(res.message || "提交答案失败");
    }

    const result = res.data;
    chatStore.patchMessage(messageId, {
      payload: {
        ...payload,
        selectedKey: optionKey,
        status: result.correct
          ? result.finished
            ? "finished"
            : "finished"
          : "wrong",
      } satisfies QuizCardPayload,
    });

    if (!result.correct) {
      chatStore.addAssistantCards([
        {
          type: "text",
          role: "assistant",
          content: result.message,
        },
      ]);
      assistantStore.setMotion("shake");
      return;
    }

    if (result.finished) {
      if (result.coupon) {
        chatStore.addAssistantCards([
          {
            type: "coupon",
            role: "assistant",
            content: result.message,
            payload: buildCouponCardPayload(result.coupon, "view", false),
          },
        ]);
      } else {
        chatStore.addAssistantCards([
          {
            type: "text",
            role: "assistant",
            content: result.message,
          },
        ]);
      }
      await loadUserCoupons();
      assistantStore.setMotion("nod");
      return;
    }

    if (result.nextQuestion) {
      const nextPayload: QuizCardPayload = {
        quizId: payload.quizId,
        title: payload.title,
        questionIndex: result.nextQuestion.questionIndex,
        totalQuestions: payload.totalQuestions,
        questionId: result.nextQuestion.questionId,
        question: result.nextQuestion.question,
        options: result.nextQuestion.options,
        status: "active",
      };
      chatStore.addAssistantCards([
        {
          type: "quiz",
          role: "assistant",
          content: result.message,
          payload: nextPayload,
        },
      ]);
      assistantStore.setMotion("point");
    }
  } catch (e) {
    answeredQuizMessageIds.value.delete(messageId);
    assistantStore.setMotion("shake");
    showToast(e instanceof Error ? e.message : "提交失败");
  } finally {
    chatStore.sending = false;
    scrollToBottom();
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function onCheckinConfirm(
  payload: PageGuideCardPayload,
  messageId: string
) {
  if (chatStore.sending || payload.actionDone || !payload.spotId) return;

  chatStore.sending = true;
  assistantStore.setMotion("thinking");
  showLoadingToast({
    message: "正在识别您的位置…",
    forbidClick: true,
    duration: 0,
  });

  try {
    await delay(900);
    const { data: res } = await submitCheckin(payload.spotId);
    closeToast();
    if (res.code !== 200 || !res.data) {
      throw new Error(res.message || "打卡失败");
    }

    const msg = chatStore.messages.find((item) => item.id === messageId);
    if (msg?.type === "page_guide" && msg.payload) {
      const guide = msg.payload as PageGuideCardPayload;
      guide.actionDone = true;
      guide.buttonLabel = "已打卡";
      chatStore.persist();
    }

    await loadUserCoupons();
    const parts = [
      `已为您完成「${res.data.spotName}」打卡，+${res.data.rewardPoints} 积分（当前 ${res.data.pointsTotal}）。`,
    ];
    if (res.data.coupon) {
      parts.push(`并已发放「${res.data.coupon.title}」。`);
      chatStore.addAssistantCards([
        buildMergedCouponMessage(parts.join(""), [res.data.coupon]),
      ]);
    } else {
      chatStore.addAssistantMessage(parts.join(""));
    }
    assistantStore.setMotion("nod");
    showToast("打卡成功");
    scrollToBottom();
  } catch (e) {
    closeToast();
    assistantStore.setMotion("shake");
    showToast(e instanceof Error ? e.message : "打卡失败");
  } finally {
    chatStore.sending = false;
  }
}

async function onTicketConfirm(payload: TicketCardPayload) {
  if (
    chatStore.sending ||
    !payload.sessionId ||
    purchaseStore.isConfirmed(payload.sessionId)
  ) {
    return;
  }

  const active = purchaseStore.session;
  if (
    active?.sessionId === payload.sessionId &&
    payload.quoteToken &&
    active.quoteToken &&
    payload.quoteToken !== active.quoteToken
  ) {
    showToast("推荐已更新，请点击最新推荐卡确认");
    return;
  }

  chatStore.sending = true;
  assistantStore.setMotion("thinking");

  try {
    const { data: res } = await createOrderDraft({
      productId: payload.productId,
      ticketType: payload.ticketType,
      couponId: payload.couponId,
      visitDate: payload.visitDate,
      quantity: payload.quantity,
      originalAmount: payload.originalAmount,
      visitorIdNumbers: [],
      items: payload.items?.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
      })),
    });
    if (res.code !== 200 || !res.data) {
      throw new Error(res.message || "创建订单草稿失败");
    }

    purchaseStore.markConfirmed(payload.sessionId);
    purchaseStore.clearSession();

    const draft = res.data;
    const orderCard: ChatMessageDraft = {
      type: "order",
      role: "assistant",
      content: "订单草稿已生成，请前往提交订单页选择实名出行人并完成支付。",
      payload: {
        orderId: draft.draftId,
        draftId: draft.draftId,
        ticketName: draft.ticketName,
        items:
          draft.items?.length
            ? draft.items.map((line) => ({
                name: line.productName,
                qty: line.purchaseCount,
                price: line.lineAmount,
              }))
            : [
                {
                  name: draft.ticketName,
                  qty: draft.quantity.adult + draft.quantity.child,
                  price: draft.totalAmount,
                },
              ],
        totalAmount: draft.totalAmount,
        status: "pending",
        source: "self",
        createdAt: draft.createdAt,
      } satisfies OrderCardPayload,
    };
    chatStore.addAssistantCards([orderCard]);
    assistantStore.setMotion("nod");
    showToast("订单草稿已生成");
    try {
      await router.push({
        path: "/order/submit",
        query: { draftId: draft.draftId },
      });
    } catch (navError) {
      if (isChunkLoadError(navError) && reloadOnceForChunkError()) return;
      showToast("打开提交订单页失败，请刷新后重试");
    }
  } catch (e) {
    assistantStore.setMotion("shake");
    showToast(e instanceof Error ? e.message : "创建订单失败");
  } finally {
    chatStore.sending = false;
    scrollToBottom();
  }
}

function isTicketEligibilityDisabled(message: {
  type: string;
  id?: string;
  payload?: unknown;
}) {
  if (message.type !== "ticket_eligibility") return false;
  if (message.id && answeredEligibilityMessageIds.value.has(message.id)) {
    return true;
  }
  const payload = message.payload as TicketEligibilityCardPayload | undefined;
  if (!payload || payload.status !== "active") return true;
  const active = purchaseStore.session;
  if (!active || active.sessionId !== payload.sessionId) return true;
  return false;
}

async function onTicketEligibilityAnswer(
  payload: TicketEligibilityCardPayload,
  ok: boolean,
  messageId: string
) {
  if (
    chatStore.sending ||
    payload.status !== "active" ||
    answeredEligibilityMessageIds.value.has(messageId)
  ) {
    return;
  }
  if (!purchaseStore.session || purchaseStore.session.sessionId !== payload.sessionId) {
    showToast("购票会话已结束，请重新发起购票");
    return;
  }

  chatStore.sending = true;
  answeredEligibilityMessageIds.value.add(messageId);
  assistantStore.setMotion("thinking");
  aiStore.startPipeline();
  aiStore.markIntentDone();
  aiStore.addSkillStep("智能购票");

  chatStore.patchMessage(messageId, {
    payload: {
      ...payload,
      status: "answered",
      selected: ok,
    } satisfies TicketEligibilityCardPayload,
  });

  chatStore.addUserMessage(ok ? payload.yesLabel : payload.noLabel);

  const personaId = (authStore.personaId || "demo_new") as PersonaId;
  const workflowCallbacks = {
    onToolStart: (toolName: string, label: string) => {
      aiStore.addToolStep(toolName, label);
    },
    onToolDone: (toolName: string, success: boolean) => {
      aiStore.completeToolStep(toolName, success);
    },
  };

  try {
    const result = await answerTicketEligibility(
      purchaseStore.session,
      payload.kind,
      ok,
      personaId,
      workflowCallbacks
    );
    aiStore.beginCompose();
    await chatStore.presentAssistantReply(result.content, result.cards, {
      onItem: scrollToBottom,
      feedbackMeta: {
        userText: ok ? payload.yesLabel : payload.noLabel,
        skillId: "ticket_purchase",
        routeSource: "workflow" as FeedbackRouteSource,
      },
    });
    if (
      result.cards?.some((card) => {
        if (card.type === "coupon" || card.type === "scene_recommend") return true;
        if (card.type === "ticket") {
          const p = card.payload as TicketCardPayload | undefined;
          return Boolean(p?.offerCoupon);
        }
        return false;
      })
    ) {
      await loadUserCoupons();
    }
    aiStore.finish(true);
    assistantStore.setMotion("nod");
  } catch (e) {
    answeredEligibilityMessageIds.value.delete(messageId);
    chatStore.patchMessage(messageId, {
      payload: { ...payload, status: "active", selected: undefined },
    });
    aiStore.finish(false);
    assistantStore.setMotion("shake");
    showToast(e instanceof Error ? e.message : "确认失败，请重试");
  } finally {
    chatStore.sending = false;
    scrollToBottom();
  }
}

/** 兼容历史 visitor_pick 消息 */
async function onVisitorConfirm(
  payload: VisitorPickPayload,
  visitorIdNumbers: string[]
) {
  if (
    chatStore.sending ||
    confirmedVisitorSessions.value.has(payload.sessionId)
  ) {
    return;
  }
  chatStore.sending = true;
  try {
    const { data: res } = await createOrderDraft({
      productId: payload.productId,
      ticketType: payload.ticketType,
      couponId: payload.couponId,
      quantity: payload.quantity,
      originalAmount: payload.totalAmount + (payload.discountAmount ?? 0),
      visitorIdNumbers,
    });
    if (res.code !== 200 || !res.data)
      throw new Error(res.message || "创建订单草稿失败");
    confirmedVisitorSessions.value.add(payload.sessionId);
    try {
      await router.push({
        path: "/order/submit",
        query: { draftId: res.data.draftId },
      });
    } catch (navError) {
      if (isChunkLoadError(navError) && reloadOnceForChunkError()) return;
      showToast("打开提交订单页失败，请刷新后重试");
    }
  } catch (e) {
    showToast(e instanceof Error ? e.message : "创建订单失败");
  } finally {
    chatStore.sending = false;
  }
}

function buildHistory(): LlmMessage[] {
  return chatStore.messages
    .filter(
      (m) =>
        m.type === "text" &&
        (m.role === "user" || m.role === "assistant") &&
        m.content
    )
    .slice(-10)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content!,
    }));
}

function feedbackContext() {
  return {
    scenicId: scenicStore.currentScenicId,
    scenicName: scenicStore.currentScenicName || undefined,
    personaId: authStore.personaId || undefined,
  };
}

function onFeedbackLike(messageId: string) {
  const message = chatStore.messages.find((item) => item.id === messageId);
  if (!message) return;
  const next = feedbackStore.setReaction(message, "like", feedbackContext());
  chatStore.patchMessage(messageId, { reaction: next.reaction });
  showToast(next.reaction === "like" ? "已点赞" : "已取消赞");
}

function onFeedbackDislike(messageId: string) {
  const message = chatStore.messages.find((item) => item.id === messageId);
  if (!message) return;
  const next = feedbackStore.setReaction(message, "dislike", feedbackContext());
  chatStore.patchMessage(messageId, { reaction: next.reaction });
  showToast(
    next.reaction === "dislike"
      ? "已记录反馈，感谢帮助改进"
      : "已取消踩",
  );
}

function onFeedbackFavorite(messageId: string) {
  const message = chatStore.messages.find((item) => item.id === messageId);
  if (!message) return;
  if (feedbackStore.isFavorited(messageId)) {
    feedbackStore.removeFavoriteByMessageId(
      messageId,
      message,
      feedbackContext(),
    );
    chatStore.patchMessage(messageId, { favorited: false });
    showToast("已取消收藏");
    return;
  }
  feedbackStore.addFavorite(message, feedbackContext());
  chatStore.patchMessage(messageId, { favorited: true });
  showToast("已收藏");
}

function resolveFeedbackRouteSource(options: {
  usedWorkflow: boolean;
  skillRouteSource: string;
}): FeedbackRouteSource {
  if (options.usedWorkflow) return "workflow";
  if (options.skillRouteSource === "llm") return "llm";
  if (options.skillRouteSource === "keyword") return "keyword";
  return "general";
}

async function onStartChat(prompt?: string) {
  if (!ensureScenicSelected()) return;
  enterChatView();
  if (prompt) {
    pendingPrompt.value = prompt;
    await nextTick();
    input.value = prompt;
    await onSend();
  }
}

async function onSend() {
  if (!ensureScenicSelected()) return;
  const text = (pendingPrompt.value || input.value).trim();
  pendingPrompt.value = null;
  if (!text || chatStore.sending) return;

  conversationStore.touch();
  enterChatView();
  chatStore.addUserMessage(text);
  input.value = "";
  scrollToBottom();

  chatStore.sending = true;

  aiStore.startPipeline();

  const skillRouteCallbacks = {
    onToolStart: (toolName: string, label: string) => {
      aiStore.addToolStep(toolName, label);
    },
    onToolDone: (toolName: string, success: boolean) => {
      aiStore.completeToolStep(toolName, success);
    },
  };

  const skillRoute = await skillStore.resolveSkillAsync(
    text,
    skillRouteCallbacks
  );
  const { skill, source: skillRouteSource } = skillRoute;
  skillStore.setActiveSkill(skill?.skillId ?? null);

  if (skill?.linkedMotions?.onStart) {
    assistantStore.setMotion(skill.linkedMotions.onStart);
  } else {
    assistantStore.setMotion("thinking");
  }

  aiStore.markIntentDone();
  if (skill) {
    const skillLabel =
      skillRouteSource === "llm" ? `${skill.name}（语义识别）` : skill.name;
    aiStore.addSkillStep(skillLabel);
  } else {
    aiStore.markIntentDoneAndStartModel();
  }

  try {
    const personaId = (authStore.personaId || "demo_new") as PersonaId;

    // 演示版 AI 智能标签：固定词「刺激 / 拍照|出片 / 休闲」写回封闭目录
    const aiPrefMatch = matchAiChatPreference(text);
    if (aiPrefMatch) {
      const evidence = `对话：${aiPrefMatch.keyword}`;
      try {
        await postAiChatTag({
          tagId: aiPrefMatch.tagId,
          evidence,
          confidence: 0.75,
        });
      } catch {
        /* mock 不可用时仍写本地，保证同页推荐可读 */
      }
      upsertAiChatTag(personaId, aiPrefMatch.tagId, evidence, 0.75);

      if (isAiChatPreferencePrimary(text)) {
        aiStore.beginCompose();
        chatStore.addAssistantMessage(buildAiChatTagConfirmText(aiPrefMatch), {
          feedbackMeta: {
            userText: text,
            skillId: "general",
            routeSource: "general",
          },
        });
        aiStore.finish(true);
        assistantStore.setMotion("nod");
        return;
      }
    }

    const useNewGuestCouponWorkflow = shouldRunNewGuestCouponWorkflow(text);
    const useTicketWorkflow = shouldRunTicketWorkflowFromRoute(
      skillRoute,
      text,
      purchaseStore.session !== null
    );
    const useTravelGuideWorkflow = shouldRunTravelGuideWorkflowFromRoute(
      skillRoute,
      text
    );
    const useOrderQueryWorkflow =
      shouldRunOrderQueryWorkflow(text) ||
      shouldRunOrderQueryWorkflowFromRoute(skillRoute, text);
    const useParkingPayWorkflow =
      shouldRunParkingPayWorkflow(text) ||
      shouldRunParkingPayWorkflowFromRoute(skillRoute, text);
    const useShowScheduleWorkflow =
      !shouldRunStarIntroWorkflow(text) &&
      (shouldRunShowScheduleWorkflow(text) ||
        shouldRunShowScheduleWorkflowFromRoute(skillRoute, text));
    const useStarIntroWorkflow =
      shouldRunStarIntroWorkflow(text) ||
      shouldRunStarIntroWorkflowFromRoute(skillRoute, text);
    const useInvoiceWorkflow =
      shouldRunInvoiceWorkflow(text) ||
      shouldRunInvoiceWorkflowFromRoute(skillRoute, text);
    const useReviewWorkflow =
      shouldRunReviewWorkflow(text) ||
      shouldRunReviewWorkflowFromRoute(skillRoute, text);
    const useCheckinWorkflow =
      shouldRunCheckinWorkflow(text) ||
      shouldRunCheckinWorkflowFromRoute(skillRoute, text);
    const useQueueRecommendWorkflow =
      shouldRunQueueRecommendWorkflow(text) ||
      shouldRunQueueRecommendWorkflowFromRoute(skillRoute, text);
    const useProactiveMarketingWorkflow =
      shouldRunProactiveMarketingWorkflow(text) ||
      shouldRunProactiveMarketingWorkflowFromRoute(skillRoute, text);
    const useMemberOfferWorkflow =
      shouldRunMemberOfferWorkflow(text) ||
      shouldRunMemberOfferWorkflowFromRoute(skillRoute, text);
    const useWeatherSuitabilityWorkflow =
      shouldRunWeatherSuitabilityWorkflow(text);
    const useProjectQueryWorkflow =
      shouldRunProjectQueryWorkflow(text) ||
      shouldRunProjectQueryWorkflowFromRoute(skillRoute, text);
    const useMapGuideWorkflow =
      !useProjectQueryWorkflow &&
      (shouldRunMapGuideWorkflow(text) ||
        shouldRunMapGuideWorkflowFromRoute(skillRoute, text));

    // 明确其它业务意图时结束购票会话，避免续跑劫持
    if (purchaseStore.session && shouldInterruptPurchaseSession(text)) {
      purchaseStore.clearSession();
    }

    const workflowCallbacks = {
      onToolStart: (toolName: string, label: string) => {
        aiStore.addToolStep(toolName, label);
      },
      onToolDone: (toolName: string, success: boolean) => {
        aiStore.completeToolStep(toolName, success);
      },
    };

    const usedWorkflow =
      useNewGuestCouponWorkflow ||
      useParkingPayWorkflow ||
      useQueueRecommendWorkflow ||
      useStarIntroWorkflow ||
      useShowScheduleWorkflow ||
      useProactiveMarketingWorkflow ||
      useProjectQueryWorkflow ||
      useMapGuideWorkflow ||
      useWeatherSuitabilityWorkflow ||
      useTravelGuideWorkflow ||
      useTicketWorkflow ||
      useMemberOfferWorkflow ||
      useInvoiceWorkflow ||
      useCheckinWorkflow ||
      useReviewWorkflow ||
      useOrderQueryWorkflow;

    // 明确攻略优先于购票；虚拟排队优先于宽泛园内路线；演出场次优先于游玩攻略；会员选品优先于泛查券
    const result = useNewGuestCouponWorkflow
      ? await runNewGuestCouponWorkflow(text, workflowCallbacks)
      : useParkingPayWorkflow
      ? await runParkingPayWorkflow(text, workflowCallbacks)
      : useQueueRecommendWorkflow
      ? await runQueueRecommendWorkflow(text, workflowCallbacks)
      : useStarIntroWorkflow
      ? await runStarIntroWorkflow(text, workflowCallbacks)
      : useShowScheduleWorkflow
      ? await runShowScheduleWorkflow(text, workflowCallbacks)
      : useProactiveMarketingWorkflow
      ? await runProactiveMarketingWorkflow(text, workflowCallbacks)
      : useProjectQueryWorkflow
      ? await runProjectQueryWorkflow(text, workflowCallbacks)
      : useMapGuideWorkflow
      ? await runMapGuideWorkflow(text, workflowCallbacks)
      : useWeatherSuitabilityWorkflow
      ? await runWeatherSuitabilityWorkflow(text, workflowCallbacks)
      : useTravelGuideWorkflow
      ? await runTravelGuideWorkflow(text, personaId, workflowCallbacks)
      : useTicketWorkflow
      ? purchaseStore.session
        ? await continueTicketPurchaseWorkflow(
            text,
            personaId,
            purchaseStore.session,
            workflowCallbacks
          )
        : await (() => {
            purchaseStore.startSession();
            return runTicketPurchaseWorkflow(
              text,
              personaId,
              workflowCallbacks,
              purchaseStore.session
            );
          })()
      : useMemberOfferWorkflow
      ? await (() => {
          if (!purchaseStore.session) purchaseStore.startSession();
          return runMemberOfferWorkflow(
            text,
            purchaseStore.session!,
            workflowCallbacks
          );
        })()
      : useInvoiceWorkflow
      ? await runInvoiceServiceWorkflow(text, workflowCallbacks)
      : useCheckinWorkflow
      ? await runCheckinWorkflow(text, workflowCallbacks)
      : useReviewWorkflow
      ? await runReviewServiceWorkflow(text, workflowCallbacks, {
          inPark: selfReportedInPark.value === true ? true : undefined,
        })
      : useOrderQueryWorkflow
      ? await runOrderQueryWorkflow(text, workflowCallbacks)
      : await sendChatMessage(buildHistory(), text, assistantStore.uiConfig, {
          skill,
          toolNames:
            skill != null
              ? skillStore.getToolNamesForSkill(skill)
              : isLikelyGeneralMessage(text)
              ? []
              : skillStore.getToolNamesForSkill(null),
          onToolStart: (toolName, label) => {
            aiStore.addToolStep(toolName, label);
          },
          onToolDone: (toolName, success) => {
            aiStore.completeToolStep(toolName, success);
          },
        });

    const feedbackMeta: MessageFeedbackMeta = {
      userText: text,
      skillId: result.skillId ?? skill?.skillId ?? undefined,
      routeSource: resolveFeedbackRouteSource({
        usedWorkflow,
        skillRouteSource,
      }),
    };

    aiStore.beginCompose();
    await chatStore.presentAssistantReply(result.content, result.cards, {
      onItem: scrollToBottom,
      feedbackMeta,
    });
    if (
      result.cards?.some((card) => {
        if (card.type === "coupon" || card.type === "scene_recommend") return true;
        if (card.type === "ticket") {
          const payload = card.payload as TicketCardPayload | undefined;
          return Boolean(payload?.offerCoupon);
        }
        return false;
      })
    ) {
      await loadUserCoupons();
    }
    aiStore.finish(true);
    if (skill?.linkedMotions?.onSuccess) {
      assistantStore.setMotion(skill.linkedMotions.onSuccess);
    } else {
      assistantStore.setMotion("nod");
    }
  } catch (e) {
    aiStore.finish(false);
    if (skill?.linkedMotions?.onFail) {
      assistantStore.setMotion(skill.linkedMotions.onFail);
    } else {
      assistantStore.setMotion("shake");
    }
    showToast(e instanceof Error ? e.message : "发送失败");
  } finally {
    chatStore.sending = false;
    scrollToBottom();
  }
}
</script>

<template>
  <div class="chat-page" :style="pageStyle">
    <header class="chat-page__topbar">
      <button class="chat-page__back" type="button" @click="$router.back()">
        <van-icon name="arrow-left" size="20" />
      </button>

      <div v-if="!showWelcomePanel" class="chat-page__top-actions">
        <button
          class="chat-page__top-action"
          type="button"
          aria-label="收藏记录"
          @click="router.push('/favorites')"
        >
          <van-icon name="star-o" size="20" />
        </button>
        <button
          class="chat-page__top-action"
          type="button"
          aria-label="返回欢迎页"
          @click="returnToWelcome"
        >
          <van-icon name="home-o" size="20" />
        </button>
        <button
          class="chat-page__top-action"
          type="button"
          aria-label="清除聊天记录"
          @click="onConfirmClearChat"
        >
          <img
            :src="withBaseUrl('/restore.svg')"
            alt=""
            class="chat-page__restore-icon"
          />
        </button>
      </div>

      <div class="chat-page__brand">
        <div class="chat-page__avatar-shell">
          <img
            :key="avatarUrl"
            :src="avatarUrl"
            :alt="assistantNickname"
            class="chat-page__avatar"
          />
        </div>
        <div class="chat-page__brand-text">
          <div class="chat-page__name-row">
            <strong>{{ assistantNickname }}</strong>
            <span>✨</span>
          </div>
          <button
            type="button"
            class="chat-page__scenic-btn"
            :aria-label="
              currentScenicName
                ? `当前景区 ${currentScenicName}`
                : '选择服务景区'
            "
            @click="openScenicPicker"
          >
            <span class="chat-page__scenic-name">
              {{ currentScenicName || "选择服务景区" }}
            </span>
            <van-icon name="arrow-down" size="12" />
          </button>
          <p class="chat-page__meta">
            <span class="chat-page__online-dot" aria-hidden="true" />
            <span>{{ assistantTitle }} 实时在线</span>
          </p>
        </div>
      </div>
    </header>

    <ScenicPickerSheet
      v-model:show="scenicPickerVisible"
      :cities="scenicStore.enabledCities"
      :scenics="scenicStore.enabledScenics"
      :current-scenic-id="scenicStore.currentScenicId"
      :initial-city-id="pickerInitialCityId"
      :required="scenicPickerRequired"
      @select="onScenicPicked"
      @update:city-id="onPickerCityChange"
    />

    <main v-if="showWelcomePanel" class="chat-page__welcome">
      <WelcomeHero
        :nickname="assistantNickname"
        :character-url="characterUrl"
        :weather-line="weatherLine"
        :crowd-line="crowdLine"
        :crowd-level="crowdLevel"
      />
      <WelcomeRecommendList
        :questions="suggestedQuestions"
        :subtitle="welcomeRecommendSubtitle"
        :show-in-park-ask="showInParkAsk"
        @select="onWelcomeRecommendSelect"
        @in-park-answer="onInParkSelfReport"
      />
    </main>

    <template v-else>
      <ToolProcessPanel />

      <div ref="listRef" class="chat-page__messages">
        <MessageBubble
          v-for="msg in chatStore.messages"
          :key="msg.id"
          :message="msg"
          :visitor-pick-disabled="isVisitorPickDisabled(msg)"
          :ticket-confirm-disabled="isTicketConfirmDisabled(msg)"
          :review-disabled="isReviewDisabled(msg)"
          :review-completed="getReviewCompleted(msg.id)"
          :quiz-disabled="isQuizDisabled(msg)"
          :ticket-eligibility-disabled="isTicketEligibilityDisabled(msg)"
          :favorited="feedbackStore.isFavorited(msg.id) || msg.favorited"
          @visitor-confirm="onVisitorConfirm"
          @ticket-confirm="onTicketConfirm"
          @ticket-eligibility-answer="onTicketEligibilityAnswer"
          @review-submit="onReviewSubmit"
          @review-share="onReviewShare"
          @checkin-confirm="onCheckinConfirm"
          @quiz-start="onQuizStart"
          @quiz-answer="onQuizAnswer"
          @feedback-like="onFeedbackLike"
          @feedback-dislike="onFeedbackDislike"
          @feedback-favorite="onFeedbackFavorite"
        />
      </div>
    </template>

    <footer
      class="chat-page__footer"
      :class="{ 'chat-page__footer--welcome': showWelcomePanel }"
    >
      <template v-if="showWelcomePanel">
        <WelcomeQuickServices
          :entries="recommendEntries"
          @select="onRecommendEntryClick"
        />
        <WelcomeAiStatus />
      </template>
      <div class="chat-page__input-bar">
        <van-field
          v-model="input"
          :placeholder="inputPlaceholder"
          :disabled="chatStore.sending"
          @keyup.enter="onSend"
        >
          <template #left-icon>
            <van-icon name="smile-o" />
          </template>
          <template #button>
            <button
              type="button"
              class="chat-page__send-btn"
              :disabled="chatStore.sending"
              @click="onSend"
            >
              <van-loading v-if="chatStore.sending" size="16" color="#fff" />
              <van-icon v-else name="guide-o" size="22" />
            </button>
          </template>
        </van-field>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.chat-page {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  /* 底栏：输入框 + 安全区 */
  --chat-input-height: 48px;
  --chat-footer-pad-bottom: calc(env(safe-area-inset-bottom) + 10px);
  --chat-input-footer-height: calc(
    var(--chat-input-height) + var(--chat-footer-pad-bottom)
  );
  /* 聊天态底栏：消息区与输入框间距 16px + 输入框 + 安全区 */
  --chat-full-footer-height: calc(16px + var(--chat-input-footer-height));
  background-color: #f6fbff;
  background-image: var(--chat-bg-image, none);
  background-size: cover;
  background-position: center top;
  color: #202124;
  font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
}

.chat-page::before {
  position: absolute;
  inset: 0;
  z-index: 0;
  content: "";
  background: radial-gradient(
      circle at 18% 10%,
      rgba(255, 255, 255, 0.9),
      transparent 28%
    ),
    linear-gradient(
      180deg,
      rgba(215, 241, 255, 0.76) 0%,
      rgba(255, 248, 237, 0.92) 62%,
      #fffaf1 100%
    );
  pointer-events: none;
}

.chat-page__topbar {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 10px;
  height: auto;
  min-height: 74px;
  padding: calc(env(safe-area-inset-top) + 10px) 18px 10px;
  background: rgba(255, 255, 255, 0.22);
  backdrop-filter: blur(10px);
}

.chat-page__back {
  width: 34px;
  height: 34px;
  padding: 0;
  border: none;
  border-radius: 14px;
  color: #222;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 8px 22px rgba(58, 87, 112, 0.12);
}

.chat-page__back:active {
  opacity: 0.88;
}

.chat-page__top-actions {
  position: absolute;
  right: 15px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
}

.chat-page__top-action {
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 50%;
  color: #323233;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 8px 22px rgba(58, 87, 112, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-page__restore-icon {
  width: 23px;
  height: 23px;
}

.chat-page__top-action:active {
  opacity: 0.88;
}

.chat-page__brand {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 10px;
  padding-right: 44px; /* 预留右侧“新对话”按钮空间 */
}

.chat-page__avatar-shell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  overflow: hidden;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 4px 14px rgba(58, 87, 112, 0.12);
}

.chat-page__avatar {
  width: 44px;
  height: 44px;
  object-fit: cover;
  border-radius: 50%;
}

.chat-page__brand-text {
  min-width: 0;
}

.chat-page__name-row {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 16px;
  line-height: 1.2;
  color: #111;
}

.chat-page__scenic-btn {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  max-width: 100%;
  margin: 3px 0 0;
  padding: 0;
  border: none;
  background: transparent;
  color: #5c6670;
  font-size: 12px;
  line-height: 1.2;
  cursor: pointer;
}

.chat-page__scenic-btn:active {
  opacity: 0.75;
}

.chat-page__scenic-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.chat-page__brand-text p {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 1.2;
  color: #414a53;
}

.chat-page__meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 3px 0 0;
  font-size: 11px;
  color: #2d8f57;
  line-height: 1.2;
}

.chat-page__online-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #07c160;
  box-shadow: 0 0 0 2px rgba(7, 193, 96, 0.2);
  animation: chat-online-pulse 2s ease-in-out infinite;
}

@keyframes chat-online-pulse {
  0%,
  100% {
    opacity: 0.65;
    transform: scale(0.92);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}

.chat-page__welcome {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 20px 18px 8px;
  -webkit-overflow-scrolling: touch;
}

.chat-page__messages {
  position: relative;
  z-index: 1;
  flex: 1;
  overflow-y: auto;
  padding: 12px 0 var(--chat-full-footer-height);
}

.chat-page__messages :deep(.bubble-row:last-child) {
  margin-bottom: 0;
}

.chat-page__footer {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 3;
  padding: 0 18px var(--chat-footer-pad-bottom);
  background: linear-gradient(
    180deg,
    rgba(255, 250, 241, 0),
    rgba(255, 250, 241, 0.96) 20%,
    #fffaf1 100%
  );
}

.chat-page__footer--welcome {
  position: relative;
  flex-shrink: 0;
  padding-top: 8px;
}

.chat-page__input-bar {
  overflow: hidden;
  background: #fff;
  border-radius: 23px;
  box-shadow: 0 10px 24px rgba(73, 85, 100, 0.14);
}

.chat-page__input-bar :deep(.van-cell) {
  align-items: center;
  padding: 3px 8px 3px 13px;
  background: transparent;
}

.chat-page__input-bar :deep(.van-field__left-icon) {
  margin-right: 8px;
  color: var(--chat-primary);
  font-size: 22px;
}

.chat-page__input-bar :deep(.van-field__control) {
  font-size: 13px;
  color: #333;
}

.chat-page__input-bar :deep(.van-field__control::placeholder) {
  color: #acacac;
}

.chat-page__send-btn {
  margin: 1px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 35px;
  height: 35px;
  padding: 0;
  border: none;
  border-radius: 50%;
  color: #fff;
  background: var(--action-color, var(--chat-primary));
  box-shadow: 0 8px 18px rgba(255, 126, 69, 0.15);
}

.chat-page__send-btn:disabled {
  opacity: 0.72;
}

@media (max-width: 390px) {
  .chat-page__welcome {
    padding: 20px 14px 6px;
  }
}
</style>

<style>
.chat-clear-dialog .van-dialog {
  width: 280px !important;
  max-width: 280px;
  border-radius: 12px;
  overflow: hidden;
}

.chat-clear-dialog .van-dialog__header {
  padding: 26px 16px 22px;
  font-size: 16px;
  font-weight: 500;
  line-height: 1.4;
  color: #323233;
  text-align: center;
}

.chat-clear-dialog .van-dialog__footer {
  display: flex;
  overflow: hidden;
  border-top: 1px solid #ebedf0;
}

.chat-clear-dialog .van-dialog__cancel,
.chat-clear-dialog .van-dialog__confirm {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  margin: 0;
  padding: 0;
  border: none !important;
  border-radius: 0;
  text-align: center;
  font-weight: 500;
}

.chat-clear-dialog .van-dialog__confirm {
  border-left: 1px solid #ebedf0 !important;
  color: #323233;
}

.chat-clear-dialog .van-dialog__cancel {
  color: var(--chat-primary, #07c160) !important;
}
</style>

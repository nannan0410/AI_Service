<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { showConfirmDialog, showToast } from "vant";
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
  runTravelGuideWorkflow,
  runParkingPayWorkflow,
  runShowScheduleWorkflow,
  runInvoiceServiceWorkflow,
  runReviewServiceWorkflow,
  runProactiveMarketingWorkflow,
  shouldRunNewGuestCouponWorkflow,
  shouldRunParkingPayWorkflow,
  shouldRunShowScheduleWorkflow,
  shouldRunInvoiceWorkflow,
  shouldRunReviewWorkflow,
  shouldRunProactiveMarketingWorkflow,
  shouldRunOrderQueryWorkflow,
} from "@/ai/workflow";
import { isLikelyGeneralMessage } from "@/ai/nlu/isLikelyGeneralMessage";
import {
  shouldRunTicketWorkflowFromRoute,
  shouldRunTravelGuideWorkflowFromRoute,
  shouldRunOrderQueryWorkflowFromRoute,
  shouldRunParkingPayWorkflowFromRoute,
  shouldRunShowScheduleWorkflowFromRoute,
  shouldRunInvoiceWorkflowFromRoute,
  shouldRunReviewWorkflowFromRoute,
  shouldRunProactiveMarketingWorkflowFromRoute,
} from "@/ai/nlu/skillWorkflowGate";
import { shouldInterruptPurchaseSession } from "@/utils/ticketPurchaseIntent";
import { createOrderDraft, fetchCoupons, fetchMemberInfo, fetchOrders, submitReview } from "@/api/business";
import { buildMergedCouponMessage } from "@/utils/couponRecommend";
import { qualifiesReviewReward } from "@/utils/reviewForm";
import { usePurchaseStore } from "@/store/purchaseStore";
import MessageBubble from "@/components/chat/MessageBubble.vue";
import ToolProcessPanel from "@/components/chat/ToolProcessPanel.vue";
import WelcomeHero from "@/components/welcome/WelcomeHero.vue";
import WelcomeRecommendList from "@/components/welcome/WelcomeRecommendList.vue";
import WelcomeQuickServices from "@/components/welcome/WelcomeQuickServices.vue";
import WelcomeAiStatus from "@/components/welcome/WelcomeAiStatus.vue";
import { MAX_QUICK_SERVICES } from "@/utils/welcomeLayout";
import type {
  ChatMessageDraft,
  Coupon,
  LlmMessage,
  MemberInfo,
  Order,
  OrderCardPayload,
  PersonaId,
  RecommendEntry,
  ReviewCardPayload,
  ReviewSubmitDraft,
  TicketCardPayload,
  VisitorPickPayload,
} from "@/types";

/** 欢迎态：快捷服务 ← recommend_entries；游游推荐 ← welcome_templates */

const authStore = useAuthStore();
const chatStore = useChatStore();
const assistantStore = useAssistantStore();
const aiStore = useAiExecutionStore();
const skillStore = useSkillStore();
const businessConfigStore = useBusinessConfigStore();
const route = useRoute();
const router = useRouter();
const purchaseStore = usePurchaseStore();

const input = ref("");
const listRef = ref<HTMLElement | null>(null);
const pendingPrompt = ref<string | null>(null);
const confirmedVisitorSessions = ref(new Set<string>());
const submittedReviewOrders = ref(new Set<string>());
const userCoupons = ref<Coupon[]>([]);
const userOrders = ref<Order[]>([]);
const memberInfo = ref<MemberInfo | null>(null);
/** 欢迎页 / 聊天窗口视图（与本地聊天记录独立，进入 /chat 默认欢迎页） */
const showWelcomePanel = ref(true);

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
const inputPlaceholder = computed(
  () => `有问题，问${assistantNickname.value}吧~`
);
const welcomeTemplateContext = computed(() => ({
  nickname:
    memberInfo.value?.nickname ?? authStore.userInfo?.nickname ?? "",
  orders: userOrders.value.length > 0 ? userOrders.value : undefined,
}));
const resolvedWelcomeTemplate = computed(() => {
  const personaId = (authStore.personaId || "demo_new") as PersonaId;
  return businessConfigStore.getResolvedWelcomeTemplate(
    personaId,
    welcomeTemplateContext.value,
  );
});
const welcomeRecommendSubtitle = computed(
  () => resolvedWelcomeTemplate.value?.subtitle?.trim() || "试试这些热门问题",
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
    welcomeTemplateContext.value,
  );
});
const recommendEntries = computed(() => {
  const personaId = (authStore.personaId || "demo_new") as PersonaId;
  return businessConfigStore
    .getActiveRecommendEntries(personaId)
    .slice(0, MAX_QUICK_SERVICES);
});

function onRecommendEntryClick(entry: RecommendEntry) {
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
  await Promise.all([
    assistantStore.loadConfig(true),
    skillStore.loadSkills(),
    businessConfigStore.loadAll(true),
    loadUserCoupons(),
  ]);
  if (authStore.memberId) {
    chatStore.loadForUser(authStore.memberId, assistantNickname.value);
  }
  showWelcomePanel.value = true;
  assistantStore.setMotion("wave", 2200);
});

watch(
  () => authStore.personaId,
  async (personaId) => {
    if (!personaId) return;
    await businessConfigStore.loadRecommendEntries(true);
    await loadUserCoupons();
  },
);

watch(showWelcomePanel, (visible) => {
  if (visible) loadUserCoupons();
});

watch(
  () => route.path,
  (path) => {
    if (path === "/chat") loadUserCoupons();
  },
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
  purchaseStore.clearSession();
  chatStore.sending = false;
  chatStore.clearMessages(assistantNickname.value);
  assistantStore.setMotion("wave", 2200);
  showWelcomePanel.value = true;
}

function isVisitorPickDisabled(message: { type: string; payload?: unknown }) {
  if (message.type !== "visitor_pick") return false;
  const sessionId = (message.payload as VisitorPickPayload | undefined)?.sessionId;
  return sessionId ? confirmedVisitorSessions.value.has(sessionId) : false;
}

function isTicketConfirmDisabled(message: { type: string; payload?: unknown }) {
  const payload = message.payload as TicketCardPayload | undefined;
  if (!payload?.sessionId) return true;

  if (purchaseStore.isConfirmed(payload.sessionId)) return true;

  if (message.type !== "ticket" && message.type !== "ticket_confirm") return false;

  const active = purchaseStore.session;
  if (!active || active.sessionId !== payload.sessionId) {
    return true;
  }
  if (payload.quoteToken && active.quoteToken && payload.quoteToken !== active.quoteToken) {
    return true;
  }
  return false;
}

function isReviewDisabled(message: { type: string; payload?: unknown }) {
  if (message.type !== "review") return false;
  const payload = message.payload as ReviewCardPayload | undefined;
  if (!payload?.orders.length) return true;
  return payload.orders.every((order) => submittedReviewOrders.value.has(order.orderId));
}

async function onReviewSubmit(draft: ReviewSubmitDraft) {
  if (chatStore.sending || submittedReviewOrders.value.has(draft.orderId)) {
    showToast("该订单已评价");
    return;
  }

  chatStore.sending = true;
  assistantStore.setMotion("thinking");

  try {
    const { data: res } = await submitReview({
      orderId: draft.orderId,
      rating: draft.rating,
      tags: draft.tags.length ? draft.tags : undefined,
      content: draft.content || undefined,
      imageIds: draft.imageIds.length ? draft.imageIds : undefined,
    });

    if (res.code !== 200 || !res.data) {
      throw new Error(res.message || "提交评价失败");
    }

    submittedReviewOrders.value.add(res.data.orderId);
    await loadUserCoupons();

    const rewardCoupons = res.data.rewardCoupons ?? [];
    const hadRewardHint = qualifiesReviewReward(draft.content, draft.imageIds.length);

    let successText = "感谢您的评价，我们已收到反馈。";
    if (res.data.rewardIssued && rewardCoupons.length) {
      successText =
        "感谢您的优质评价！已为您发放餐饮折扣券（3 个月有效）和当日停车券。";
      chatStore.addAssistantCards([
        buildMergedCouponMessage(successText, rewardCoupons),
      ]);
    } else {
      if (hadRewardHint && !res.data.rewardIssued) {
        successText = "评价已提交。优质赠券需文案超过 20 字且上传至少 2 张图片。";
      }
      chatStore.addAssistantMessage(successText);
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
        items: [
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
    router.push({ path: "/order/submit", query: { draftId: draft.draftId } });
  } catch (e) {
    assistantStore.setMotion("shake");
    showToast(e instanceof Error ? e.message : "创建订单失败");
  } finally {
    chatStore.sending = false;
    scrollToBottom();
  }
}

/** 兼容历史 visitor_pick 消息 */
async function onVisitorConfirm(
  payload: VisitorPickPayload,
  visitorIdNumbers: string[],
) {
  if (chatStore.sending || confirmedVisitorSessions.value.has(payload.sessionId)) {
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
    if (res.code !== 200 || !res.data) throw new Error(res.message || "创建订单草稿失败");
    confirmedVisitorSessions.value.add(payload.sessionId);
    router.push({ path: "/order/submit", query: { draftId: res.data.draftId } });
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

async function onStartChat(prompt?: string) {
  enterChatView();
  if (prompt) {
    pendingPrompt.value = prompt;
    await nextTick();
    input.value = prompt;
    await onSend();
  }
}

async function onSend() {
  const text = (pendingPrompt.value || input.value).trim();
  pendingPrompt.value = null;
  if (!text || chatStore.sending) return;

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
    skillRouteCallbacks,
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
    const useNewGuestCouponWorkflow = shouldRunNewGuestCouponWorkflow(text);
    const useTicketWorkflow = shouldRunTicketWorkflowFromRoute(
      skillRoute,
      text,
      purchaseStore.session !== null,
    );
    const useTravelGuideWorkflow = shouldRunTravelGuideWorkflowFromRoute(
      skillRoute,
      text,
    );
    const useOrderQueryWorkflow =
      shouldRunOrderQueryWorkflow(text) ||
      shouldRunOrderQueryWorkflowFromRoute(skillRoute, text);
    const useParkingPayWorkflow =
      shouldRunParkingPayWorkflow(text) ||
      shouldRunParkingPayWorkflowFromRoute(skillRoute, text);
    const useShowScheduleWorkflow =
      shouldRunShowScheduleWorkflow(text) ||
      shouldRunShowScheduleWorkflowFromRoute(skillRoute, text);
    const useInvoiceWorkflow =
      shouldRunInvoiceWorkflow(text) ||
      shouldRunInvoiceWorkflowFromRoute(skillRoute, text);
    const useReviewWorkflow =
      shouldRunReviewWorkflow(text) ||
      shouldRunReviewWorkflowFromRoute(skillRoute, text);
    const useProactiveMarketingWorkflow =
      shouldRunProactiveMarketingWorkflow(text) ||
      shouldRunProactiveMarketingWorkflowFromRoute(skillRoute, text);

    // 明确其它业务意图时结束购票会话，避免续跑劫持
    if (
      purchaseStore.session &&
      shouldInterruptPurchaseSession(text)
    ) {
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

    // 明确攻略优先于购票；餐饮营销优先于宽泛攻略
    const result = useNewGuestCouponWorkflow
      ? await runNewGuestCouponWorkflow(text, workflowCallbacks)
      : useParkingPayWorkflow
        ? await runParkingPayWorkflow(text, workflowCallbacks)
      : useTravelGuideWorkflow
        ? await runTravelGuideWorkflow(text, personaId, workflowCallbacks)
      : useTicketWorkflow
      ? purchaseStore.session
        ? await continueTicketPurchaseWorkflow(
            text,
            personaId,
            purchaseStore.session,
            workflowCallbacks,
          )
        : await (() => {
            purchaseStore.startSession();
            return runTicketPurchaseWorkflow(
              text,
              personaId,
              workflowCallbacks,
              purchaseStore.session,
            );
          })()
      : useProactiveMarketingWorkflow
        ? await runProactiveMarketingWorkflow(text, workflowCallbacks)
      : useShowScheduleWorkflow
        ? await runShowScheduleWorkflow(text, workflowCallbacks)
      : useInvoiceWorkflow
        ? await runInvoiceServiceWorkflow(text, workflowCallbacks)
      : useReviewWorkflow
        ? await runReviewServiceWorkflow(text, workflowCallbacks)
        : useOrderQueryWorkflow
          ? await runOrderQueryWorkflow(text, workflowCallbacks)
          : await sendChatMessage(
          buildHistory(),
          text,
          assistantStore.uiConfig,
          {
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
          }
        );
    aiStore.beginCompose();
    if (!result.content?.trim() && result.cards?.length) {
      chatStore.addAssistantCards(result.cards);
    } else {
      chatStore.addAssistantReply(result.content, result.cards);
    }
    if (result.cards?.some((card) => card.type === "coupon" || card.type === "scene_recommend")) {
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
          <img src="/restore.svg" alt="" class="chat-page__restore-icon" />
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
          <p class="chat-page__subtitle">{{ assistantTitle }}</p>
          <p class="chat-page__online">
            <span class="chat-page__online-dot" aria-hidden="true" />
            实时在线
          </p>
        </div>
      </div>
    </header>

    <main v-if="showWelcomePanel" class="chat-page__welcome">
      <WelcomeHero
        :nickname="assistantNickname"
        :character-url="characterUrl"
      />
      <WelcomeRecommendList
        :questions="suggestedQuestions"
        :subtitle="welcomeRecommendSubtitle"
        @select="onStartChat"
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
          :submitted-review-order-ids="Array.from(submittedReviewOrders)"
          @visitor-confirm="onVisitorConfirm"
          @ticket-confirm="onTicketConfirm"
          @review-submit="onReviewSubmit"
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
  --chat-full-footer-height: calc(
    16px + var(--chat-input-footer-height)
  );
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

.chat-page__brand-text p {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 1.2;
  color: #414a53;
}

.chat-page__online {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 4px 0 0;
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

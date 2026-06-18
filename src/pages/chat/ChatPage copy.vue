<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { showToast } from "vant";
import { useAuthStore } from "@/store/authStore";
import { useChatStore } from "@/store/chatStore";
import { useAssistantStore } from "@/store/assistantStore";
import { useAiExecutionStore } from "@/store/aiExecutionStore";
import { sendChatMessage } from "@/ai/llm";
import { createOrder, fetchCoupons, fetchTicketCatalog } from "@/api/business";
import MessageBubble from "@/components/chat/MessageBubble.vue";
import ToolProcessPanel from "@/components/chat/ToolProcessPanel.vue";
import welcomeTemplates from "@/mock/assistant/welcome_templates.json";
import demoMid from "@/mock/users/demo_mid.json";
import demoNew from "@/mock/users/demo_new.json";
import demoVip from "@/mock/users/demo_vip.json";
import type {
  CommonVisitor,
  Coupon,
  LlmMessage,
  PersonaId,
  TicketCatalogItem,
} from "@/types";

interface WelcomeAction {
  id: string;
  icon: string;
  text: string;
  prompt: string;
  color?: string;
}

type PurchaseStep =
  | "idle"
  | "coupon"
  | "count"
  | "date"
  | "ticket"
  | "visitors"
  | "confirm";

interface PurchaseState {
  step: PurchaseStep;
  count: number | null;
  dateLabel: string;
  dateValue: string;
  ticket: TicketCatalogItem | null;
  coupon: Coupon | null;
  selectedVisitorIds: string[];
  visitorOptions: CommonVisitor[];
}

interface VisitorPickerPayload {
  visitors: CommonVisitor[];
  selectedIds: string[];
  expectedCount: number;
}

interface GuidePayload {
  title: string;
  route: string[];
  traffic: string;
  entry: string;
  projects: string[];
}

interface WelcomeQuestion {
  id: string;
  icon: string;
  text: string;
  prompt: string;
  badgeColor?: string;
}

interface ChatWelcomeTemplate {
  personaId: PersonaId;
  title: string;
  subtitle: string;
  body: string;
  highlights: string[];
  suggestedQuestions?: WelcomeQuestion[];
  quickActions?: WelcomeAction[];
}

const authStore = useAuthStore();
const chatStore = useChatStore();
const assistantStore = useAssistantStore();
const aiStore = useAiExecutionStore();

const input = ref("");
const listRef = ref<HTMLElement | null>(null);
const pendingPrompt = ref<string | null>(null);
const templates = welcomeTemplates as ChatWelcomeTemplate[];
const purchaseState = ref<PurchaseState>({
  step: "idle",
  count: null,
  dateLabel: "",
  dateValue: "",
  ticket: null,
  coupon: null,
  selectedVisitorIds: [],
  visitorOptions: [],
});
const showOrderPopup = ref(false);
const orderTermsAccepted = ref(false);
const orderPaying = ref(false);

const pageStyle = computed(() => {
  const bg = assistantStore.uiConfig?.chatBackgroundUrl;
  return bg
    ? {
        "--chat-bg-image": `url(${bg})`,
      }
    : {};
});

const todayKey = computed(() => new Date().toDateString());
const assistantNickname = computed(() => assistantStore.assistantNickname);
const assistantTitle = computed(() => assistantStore.dialogTitle);
const avatarUrl = computed(() => assistantStore.assistantAvatarUrl);
const characterUrl = computed(() => assistantStore.defaultImageUrl);
const inputPlaceholder = computed(
  () => `有问题，问${assistantNickname.value}吧~`
);
const currentWelcomeTemplate = computed(() => {
  const personaId = authStore.personaId || "demo_new";
  return templates.find((item) => item.personaId === personaId) ?? templates[0];
});
const welcomeBody = computed(() => {
  const fallbackBody = assistantStore.uiConfig.greeting.trim();
  const templateBody = currentWelcomeTemplate.value?.body?.trim();
  return (fallbackBody || templateBody).replace(
    /\{\{\s*(nickname|assistantNickname)\s*\}\}/g,
    assistantNickname.value
  );
});
const suggestedQuestions = computed(
  () => currentWelcomeTemplate.value?.suggestedQuestions ?? []
);
const quickActions = computed(
  () => currentWelcomeTemplate.value?.quickActions ?? []
);
const activeQuickActions = computed<WelcomeAction[]>(() => {
  if (purchaseState.value.step === "confirm" || showOrderPopup.value) return [];

  if (purchaseState.value.step === "coupon") {
    return [
      createQuickAction("use_coupon_ticket", "🎫", "用券买票", "用券买票"),
      createQuickAction("view_my_coupon", "💰", "看我的券", "看我的券"),
    ];
  }

  if (purchaseState.value.step === "count") {
    return [
      createQuickAction("count_1", "👤", "1位", "1位"),
      createQuickAction("count_2", "👥", "2位", "2位"),
      createQuickAction("count_3", "👨‍👩‍👧", "3位", "3位"),
    ];
  }

  if (purchaseState.value.step === "date") {
    return [
      createQuickAction("date_today", "📅", "今天", "今天"),
      createQuickAction("date_tomorrow", "📅", "明天", "明天"),
      createQuickAction("date_sat", "📅", "本周六", "本周六"),
      createQuickAction("date_sun", "📅", "本周日", "本周日"),
    ];
  }

  if (purchaseState.value.step === "ticket" && purchaseState.value.ticket) {
    return [createQuickAction("select_ticket", "🎟️", "选这张", "选这张")];
  }

  if (purchaseState.value.step === "visitors") return [];

  return quickActions.value;
});
const hasTodayConversation = computed(() =>
  chatStore.messages.some((message) => {
    if (message.type !== "text") return false;
    if (message.role !== "user" && message.role !== "assistant") return false;
    return new Date(message.createdAt).toDateString() === todayKey.value;
  })
);
const showWelcome = computed(() => !hasTodayConversation.value);
const orderSummary = computed(() => {
  const ticket = purchaseState.value.ticket;
  const coupon = purchaseState.value.coupon;
  const ticketAmount = ticket
    ? calculateTicketAmount(ticket, purchaseState.value.count || 1)
    : 0;
  const couponAmount = coupon?.value || 0;
  const payableAmount = Math.max(ticketAmount - couponAmount, 0);

  return {
    ticketAmount,
    couponAmount,
    payableAmount,
  };
});

onMounted(async () => {
  await assistantStore.loadConfig(true);
  if (authStore.memberId) {
    chatStore.loadForUser(authStore.memberId, assistantNickname.value);
  }
  assistantStore.setMotion("wave", 2200);
});

function createQuickAction(
  id: string,
  icon: string,
  text: string,
  prompt: string
): WelcomeAction {
  return {
    id,
    icon,
    text,
    prompt,
    color: "var(--chat-primary)",
  };
}

function createMessageId(prefix = "msg") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function addAssistantText(content: string) {
  chatStore.addMessage({
    id: createMessageId("assistant"),
    type: "text",
    role: "assistant",
    content,
    createdAt: new Date().toISOString(),
  });
}

function addSystemText(content: string) {
  chatStore.addMessage({
    id: createMessageId("system"),
    type: "system",
    role: "system",
    content,
    createdAt: new Date().toISOString(),
  });
}

function addVisitorPickerMessage() {
  const payload: VisitorPickerPayload = {
    visitors: purchaseState.value.visitorOptions,
    selectedIds: [...purchaseState.value.selectedVisitorIds],
    expectedCount: purchaseState.value.count || 1,
  };

  chatStore.addMessage({
    id: createMessageId("visitor"),
    type: "visitor_picker",
    role: "assistant",
    payload,
    createdAt: new Date().toISOString(),
  });
}

function addGuideMessage(options?: { dateLabel?: string }) {
  const dateLabel =
    options?.dateLabel || purchaseState.value.dateLabel || "出行日";
  const payload: GuidePayload = {
    title: `${dateLabel}轻松游玩攻略`,
    route: ["东门入园", "欢乐花车", "亲子漂流", "梦幻剧场"],
    traffic: "建议提前 40 分钟到达，停车后从东门入园",
    entry: "带好身份证件，刷码入园更快",
    projects: ["欢乐花车", "亲子漂流", "梦幻剧场"],
  };

  chatStore.addMessage({
    id: createMessageId("guide"),
    type: "guide",
    role: "assistant",
    payload,
    createdAt: new Date().toISOString(),
  });
}

function buildGuideRouteText() {
  return "**东门入园** → **欢乐花车** → **亲子漂流** → **梦幻剧场**";
}

function getVisitorPickerPayload(payload: unknown): VisitorPickerPayload {
  return payload as VisitorPickerPayload;
}

function getGuidePayload(payload: unknown): GuidePayload {
  return payload as GuidePayload;
}

function getCurrentVisitorSnapshot() {
  const personaId = authStore.personaId || "demo_new";
  if (personaId === "demo_mid") return demoMid.visitorState;
  if (personaId === "demo_vip") return demoVip.visitorState;
  return demoNew.visitorState;
}

function getFallbackVisitors() {
  const nickname = authStore.userInfo?.nickname || "本人";
  return [
    createVisitor(nickname, "成人", "1234"),
    createVisitor("李女士", "成人", "5678"),
    createVisitor("小宝", "儿童", "9012"),
  ];
}

function createVisitor(
  name: string,
  label: string,
  suffix: string
): CommonVisitor {
  return {
    name,
    idType: "id_card",
    idNumber: `440***********${suffix}`,
    birthDate: label === "儿童" ? "2018-03-15" : "1990-05-01",
    gender: "unknown",
    mobile: "13800000000",
  };
}

function getVisitorId(visitor: CommonVisitor) {
  return visitor.idNumber || `${visitor.name}-${visitor.mobile}`;
}

function getVisitorLabel(visitor: CommonVisitor) {
  const birthYear = Number(visitor.birthDate?.slice(0, 4));
  if (birthYear && new Date().getFullYear() - birthYear < 12) return "儿童";
  return "成人";
}

function prepareVisitorOptions() {
  const snapshotVisitors =
    (getCurrentVisitorSnapshot().commonVisitors as
      | CommonVisitor[]
      | undefined) || [];
  const visitors = snapshotVisitors.length
    ? snapshotVisitors
    : getFallbackVisitors();
  const expectedCount = purchaseState.value.count || 1;

  purchaseState.value.visitorOptions = visitors;
  purchaseState.value.selectedVisitorIds = visitors
    .slice(0, expectedCount)
    .map((visitor) => getVisitorId(visitor));
}

function calculateTicketAmount(ticket: TicketCatalogItem, count: number) {
  if (ticket.id === "family_bundle") return ticket.price;
  if (ticket.unit === "adult") return ticket.price * count;
  return ticket.price;
}

function parseCount(text: string) {
  if (/两大一小|2大1小|三位|3位|3人/.test(text)) return 3;
  if (/双人|两位|2位|2人/.test(text)) return 2;
  if (/一位|1位|1人/.test(text)) return 1;   
  return null;
}

function parseDateChoice(text: string) {
  const today = new Date();
  const result = new Date(today);

  if (/明天/.test(text)) {
    result.setDate(today.getDate() + 1);
    return { label: "明天", value: result.toISOString().slice(0, 10) };
  }

  if (/本周六|周六/.test(text)) {
    result.setDate(today.getDate() + ((6 - today.getDay() + 7) % 7 || 7));
    return { label: "本周六", value: result.toISOString().slice(0, 10) };
  }

  if (/本周日|周日/.test(text)) {
    result.setDate(today.getDate() + ((7 - today.getDay()) % 7 || 7));
    return { label: "本周日", value: result.toISOString().slice(0, 10) };
  }

  if (/今天|今日/.test(text)) {
    return { label: "今天", value: today.toISOString().slice(0, 10) };
  }

  return null;
}

function isCouponQueryIntent(text: string) {
  return /优惠券|领券|新客券|我的券|有什么券|看我的券|领新客券|查券|可用券|有什么优惠/.test(
    text
  );
}

function isTicketIntent(text: string) {
  return /买票|购票|门票|订票|用券买票|首次购票|下单|两大一小|怎么买|买划算/.test(
    text
  );
}

function isGuideIntent(text: string) {
  return /攻略|路线|先玩什么|游玩攻略|订单攻略|规划.*路线/.test(text);
}

function isInPurchaseFlow() {
  return ["count", "date", "ticket", "visitors", "confirm"].includes(
    purchaseState.value.step
  );
}

function maskCouponTitle(coupon: Coupon | null) {
  return coupon?.title || "新客专享 20 元券";
}

async function ensureCoupon() {
  if (purchaseState.value.coupon) return purchaseState.value.coupon;

  const { data: res } = await fetchCoupons("available");
  const coupon = res.code === 200 ? res.data[0] : null;
  purchaseState.value.coupon =
    coupon ||
    ({
      couponId: "cpn_mock_001",
      title: "新客专享 20 元券",
      type: "cash",
      value: 20,
      condition: "满 200 可用",
      expireAt: "2026-12-31",
      status: "available",
    } as Coupon);
  return purchaseState.value.coupon;
}

async function recommendTicket() {
  const { data: res } = await fetchTicketCatalog();
  const tickets = res.code === 200 ? res.data : [];
  const count = purchaseState.value.count || 1;
  const ticket =
    count >= 3
      ? tickets.find((item) => item.id === "family_bundle") || tickets[0]
      : tickets.find((item) => item.id === "adult") || tickets[0];

  purchaseState.value.ticket = ticket;
  purchaseState.value.step = "ticket";

  const amount = calculateTicketAmount(ticket, count);
  addAssistantText(
    `好眼光~ 推荐 **${ticket.name}**\n**优惠价** ¥${amount}，很适合你~`
  );
}

async function startCouponFlow() {
  const coupon = await ensureCoupon();
  purchaseState.value.step = "coupon";
  addAssistantText(
    `查到啦~ 你有 **${maskCouponTitle(coupon)}**\n要用 **优惠券** 买票吗？`
  );
}

function askCount() {
  purchaseState.value.step = "count";
  addAssistantText("真棒~ 购票交给我\n先确认 **几位游客**？");
}

function askDate() {
  purchaseState.value.step = "date";
  addAssistantText("收到~ 人数记好啦\n你们 **哪天出行**？");
}

async function askVisitors() {
  await ensureCoupon();
  prepareVisitorOptions();
  purchaseState.value.step = "visitors";
  const couponTitle = maskCouponTitle(purchaseState.value.coupon);
  addAssistantText(
    `嘘~ 悄悄告诉你\n一会还能用上 **${couponTitle}**，现在选 **游客** 就很划算~`
  );
  addVisitorPickerMessage();
}

function replyGuideRoute() {
  purchaseState.value.step = "idle";
  addAssistantText(`好呀~ 给你一条省脑路线~\n${buildGuideRouteText()}`);
  addGuideMessage();
}

async function handlePurchaseText(text: string) {
  if (isGuideIntent(text) && !isTicketIntent(text) && !isInPurchaseFlow()) {
    replyGuideRoute();
    return true;
  }

  if (
    isCouponQueryIntent(text) &&
    !isTicketIntent(text) &&
    !isInPurchaseFlow()
  ) {
    await startCouponFlow();
    return true;
  }

  if (/看我的券/.test(text) && purchaseState.value.step === "coupon") {
    const coupon = await ensureCoupon();
    addAssistantText(
      `你名下有 **${maskCouponTitle(coupon)}**\n随时都能 **用券买票** 哦~`
    );
    return true;
  }

  if (
    /用券买票/.test(text) ||
    (isTicketIntent(text) && !isCouponQueryIntent(text))
  ) {
    if (!purchaseState.value.count) {
      askCount();
      return true;
    }
  }

  const count = parseCount(text);
  if (count && (isInPurchaseFlow() || purchaseState.value.step === "count")) {
    purchaseState.value.count = count;
    askDate();
    return true;
  }

  const dateChoice = parseDateChoice(text);
  if (dateChoice && purchaseState.value.step === "date") {
    purchaseState.value.dateLabel = dateChoice.label;
    purchaseState.value.dateValue = dateChoice.value;
    await recommendTicket();
    return true;
  }

  if (
    /选这张|就这张|选它|确认票/.test(text) &&
    purchaseState.value.step === "ticket"
  ) {
    await askVisitors();
    return true;
  }

  if (purchaseState.value.step === "count") {
    askCount();
    return true;
  }

  if (purchaseState.value.step === "date") {
    askDate();
    return true;
  }

  return false;
}

function onToggleVisitor(visitorId: string) {
  const selected = purchaseState.value.selectedVisitorIds;
  const index = selected.indexOf(visitorId);

  if (index >= 0) {
    selected.splice(index, 1);
    return;
  }

  if (selected.length >= (purchaseState.value.count || 1)) {
    showToast(`最多选择 ${purchaseState.value.count || 1} 位游客`);
    return;
  }

  selected.push(visitorId);
}

async function onConfirmVisitors() {
  const expectedCount = purchaseState.value.count || 1;
  if (purchaseState.value.selectedVisitorIds.length !== expectedCount) {
    showToast(`请勾选 ${expectedCount} 位游客`);
    return;
  }

  await ensureCoupon();
  purchaseState.value.step = "confirm";
  orderTermsAccepted.value = false;
  addAssistantText(
    `真棒~ 有个 **惊喜**\n已带上 **${maskCouponTitle(
      purchaseState.value.coupon
    )}**，去 **确认下单** 吧~`
  );
  showOrderPopup.value = true;
}

async function onPayOrder() {
  if (!purchaseState.value.ticket || !orderTermsAccepted.value) return;

  orderPaying.value = true;
  try {
    await createOrder({
      ticketType: purchaseState.value.ticket.id,
      ticketName: purchaseState.value.ticket.name,
      totalAmount: orderSummary.value.payableAmount,
      quantity: {
        adult: purchaseState.value.count || 1,
        child: purchaseState.value.ticket.composition?.child || 0,
      },
    });
    showOrderPopup.value = false;
    addSystemText("H5 模拟支付成功");
    addAssistantText("太棒啦~ **支付** 成功！\n祝你玩得开心~");
    addGuideMessage();
    purchaseState.value.step = "idle";
    assistantStore.setMotion("nod", 2000);
  } finally {
    orderPaying.value = false;
  }
}

function onSaveGuideImage() {
  showToast("攻略图已保存到本地（演示）");
}

function scrollToBottom() {
  nextTick(() => {
    if (listRef.value) {
      listRef.value.scrollTop = listRef.value.scrollHeight;
    }
  });
}

function onRestoreChat() {
  input.value = "";
  pendingPrompt.value = null;
  chatStore.sending = false;
  purchaseState.value = {
    step: "idle",
    count: null,
    dateLabel: "",
    dateValue: "",
    ticket: null,
    coupon: null,
    selectedVisitorIds: [],
    visitorOptions: [],
  };
  showOrderPopup.value = false;
  chatStore.clearMessages(assistantNickname.value);
  assistantStore.setMotion("wave", 2200);
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

  chatStore.addUserMessage(text);
  input.value = "";
  scrollToBottom();

  chatStore.sending = true;
  assistantStore.setMotion("thinking");
  aiStore.start(["理解用户意图", "调用 AI 模型", "组织回复"]);

  try {
    aiStore.completeStep(0);
    const handledByWorkflow = await handlePurchaseText(text);
    if (handledByWorkflow) {
      aiStore.completeStep(1);
      aiStore.completeStep(2);
      aiStore.finish(true);
      assistantStore.setMotion("nod");
      return;
    }

    const reply = await sendChatMessage(
      buildHistory(),
      text,
      assistantStore.uiConfig
    );
    aiStore.completeStep(1);
    aiStore.completeStep(2);
    chatStore.addAssistantMessage(reply);
    aiStore.finish(true);
    assistantStore.setMotion("nod");
  } catch (e) {
    aiStore.finish(false);
    assistantStore.setMotion("shake");
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

      <button
        v-if="!showWelcome"
        class="chat-page__restore"
        type="button"
        aria-label="一键开启新对话"
        @click="onRestoreChat"
      >
        <img src="/restore.svg" alt="" class="chat-page__restore-icon" />
      </button>

      <div class="chat-page__brand">
        <div class="chat-page__avatar-shell">
          <img
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
          <p>{{ assistantTitle }}</p>
        </div>
      </div>
    </header>

    <main v-if="showWelcome" class="chat-page__welcome">
      <section class="chat-page__hero" aria-label="欢迎介绍">
        <div class="chat-page__cloud">
          <p>{{ welcomeBody }}</p>
        </div>
        <img
          :src="characterUrl"
          :alt="`${assistantNickname}导游形象`"
          class="chat-page__character"
        />
      </section>

      <section class="chat-page__suggest-card">
        <div class="chat-page__section-title">
          <strong>猜你想问</strong>
          <span>💡</span>
        </div>
        <button
          v-for="(item, index) in suggestedQuestions"
          :key="item.id"
          type="button"
          class="chat-page__question"
          @click="onStartChat(item.prompt)"
        >
          <span
            class="chat-page__question-index"
            :style="{ background: item.badgeColor }"
          >
            {{ index + 1 }}
          </span>
          <span class="chat-page__question-text">{{ item.text }}</span>
          <span class="chat-page__question-icon">{{ item.icon }}</span>
          <van-icon name="arrow" color="#888" size="14" />
        </button>
      </section>
    </main>

    <template v-else>
      <ToolProcessPanel />

      <div ref="listRef" class="chat-page__messages">
        <template v-for="msg in chatStore.messages" :key="msg.id">
          <MessageBubble
            v-if="msg.type !== 'visitor_picker' && msg.type !== 'guide'"
            :message="msg"
          />

          <section
            v-else-if="msg.type === 'visitor_picker'"
            class="chat-page__business-card chat-page__visitor-card"
          >
            <header class="chat-page__card-header">🧍 选择出行游客</header>
            <button
              v-for="visitor in getVisitorPickerPayload(msg.payload).visitors"
              :key="getVisitorId(visitor)"
              type="button"
              class="chat-page__visitor-row"
              @click="onToggleVisitor(getVisitorId(visitor))"
            >
              <van-checkbox
                :model-value="
                  purchaseState.selectedVisitorIds.includes(
                    getVisitorId(visitor)
                  )
                "
                shape="square"
                @click.stop="onToggleVisitor(getVisitorId(visitor))"
              />
              <span>
                <strong>{{ visitor.name }}</strong>
                <small>
                  {{ getVisitorLabel(visitor) }} · {{ visitor.idNumber }}
                </small>
              </span>
            </button>
            <div class="chat-page__coupon-row">
              <span>🎁 已默认带上</span>
              <strong>{{ maskCouponTitle(purchaseState.coupon) }}</strong>
            </div>
            <button
              type="button"
              class="chat-page__primary-card-btn"
              @click="onConfirmVisitors"
            >
              确认并下单
            </button>
          </section>

          <section
            v-else
            class="chat-page__business-card chat-page__guide-card"
          >
            <header class="chat-page__card-header">
              🗺️ {{ getGuidePayload(msg.payload).title }}
            </header>
            <p>
              🧭 推荐路线：{{ getGuidePayload(msg.payload).route.join(" → ") }}
            </p>
            <p>🚗 {{ getGuidePayload(msg.payload).traffic }}</p>
            <p>✅ {{ getGuidePayload(msg.payload).entry }}</p>
            <p>
              🌟 推荐项目：{{
                getGuidePayload(msg.payload).projects.join("、")
              }}
            </p>
            <button
              type="button"
              class="chat-page__primary-card-btn"
              @click="onSaveGuideImage"
            >
              保存攻略图
            </button>
          </section>
        </template>
      </div>
    </template>

    <van-popup
      v-model:show="showOrderPopup"
      round
      position="bottom"
      class="chat-page__order-popup"
      :close-on-click-overlay="false"
    >
      <section class="chat-page__order-sheet">
        <header class="chat-page__order-header">
          <strong>确认订单</strong>
          <button type="button" @click="showOrderPopup = false">×</button>
        </header>

        <div class="chat-page__order-row">
          <span>门票信息</span>
          <strong>{{ purchaseState.ticket?.name }}</strong>
        </div>
        <div class="chat-page__order-row">
          <span>出行日期</span>
          <strong>{{ purchaseState.dateLabel }}</strong>
        </div>
        <div class="chat-page__order-row">
          <span>出行游客</span>
          <strong>{{ purchaseState.selectedVisitorIds.length }} 位</strong>
        </div>
        <div class="chat-page__order-row">
          <span>票面金额</span>
          <strong>¥{{ orderSummary.ticketAmount }}</strong>
        </div>
        <div class="chat-page__order-row chat-page__order-row--discount">
          <span>优惠券</span>
          <strong>-¥{{ orderSummary.couponAmount }}</strong>
        </div>
        <div class="chat-page__order-row chat-page__order-row--total">
          <span>实付</span>
          <strong>¥{{ orderSummary.payableAmount }}</strong>
        </div>

        <van-checkbox v-model="orderTermsAccepted" icon-size="16px">
          <span class="terms-text">
            我已阅读并同意<a
              href="/terms"
              target="_blank"
              class="terms-name-text"
            >
              《购票服务条款》</a
            >与
            <a href="/notice" target="_blank" class="terms-name-text"
              >《入园须知》</a
            >
          </span>
        </van-checkbox>

        <button
          type="button"
          class="chat-page__pay-btn"
          :disabled="!orderTermsAccepted || orderPaying"
          @click="onPayOrder"
        >
          <van-loading v-if="orderPaying" size="16" color="#fff" />
          <span v-else>立即支付</span>
        </button>
      </section>
    </van-popup>

    <footer class="chat-page__footer">
      <div v-if="activeQuickActions.length" class="chat-page__quick-actions">
        <button
          v-for="action in activeQuickActions"
          :key="action.id"
          type="button"
          class="chat-page__quick-action"
          :style="{ '--action-color': action.color }"
          @click="onStartChat(action.prompt)"
        >
          <span class="chat-page__quick-action-icon">{{ action.icon }}</span>
          <span class="chat-page__quick-action-text">{{ action.text }}</span>
        </button>
      </div>

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
  height: 74px;
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
.chat-page__restore {
  position: absolute;
  right: 15px;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 50%;
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
.chat-page__restore:active {
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
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.2;
  color: #414a53;
}

.chat-page__welcome {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 18px 100px;
}
.chat-page__hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 26%) minmax(0, 74%);
  align-items: start;
  flex: 1;
  min-height: 0;
  padding: 8px 0 0;
}
.chat-page__cloud {
  position: relative;
  top: 10px;
  width: 160px;
  z-index: 1;
  padding: 16px;
  color: #202124;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 26px 26px 10px 26px;
  box-shadow: 0 12px 30px rgba(95, 112, 132, 0.13);
  backdrop-filter: blur(10px);
}
.chat-page__cloud::after {
  position: absolute;
  right: -10px;
  bottom: 28px;
  width: 22px;
  height: 22px;
  content: "";
  background: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  box-shadow: 12px 10px 0 rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(10px);
}
.chat-page__cloud p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
}
.chat-page__character {
  position: relative;
  z-index: 2;
  align-self: end;
  justify-self: end;
  width: 260px;
  object-fit: contain;
  margin: 18px -26px 0 0;
  filter: drop-shadow(0 14px 22px rgba(145, 103, 68, 0.16));
  animation: youyou-wave 2.2s ease-in-out 0.25s 2;
  transform-origin: 50% 100%;
}

.chat-page__suggest-card {
  z-index: 9 !important;
  position: relative;
  z-index: 1;
  margin-top: -12px;
  padding: 13px 13px 10px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 18px;
  box-shadow: 0 14px 32px rgba(77, 95, 117, 0.12);
  backdrop-filter: blur(10px);
}
.chat-page__section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  padding-left: 4px;
  font-size: 14px;
  color: #333;
}
.chat-page__question {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) 28px 14px;
  align-items: center;
  width: 100%;
  height: 36px;
  line-height: 36px;
  padding: 0 10px;
  border: none;
  border-radius: 14px;
  color: #333;
  text-align: left;
  background: transparent;
  border-bottom: 1px solid #f6f6f6;
}
.chat-page__question:last-child {
  border-bottom: none;
}
.chat-page__question-index {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: #fff;
  font-size: 12px;
  border-radius: 50%;
}
.chat-page__question-text {
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
}
.chat-page__question-icon {
  font-size: 16px;
  text-align: center;
}

.chat-page__messages {
  position: relative;
  z-index: 1;
  flex: 1;
  overflow-y: auto;
  padding: 12px 0 118px;
}

.chat-page__business-card {
  width: calc(100% - 72px);
  margin: 0 18px 14px 54px;
  overflow: hidden;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 10px 24px rgba(73, 85, 100, 0.12);
}
.chat-page__card-header {
  padding: 12px 14px;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  background: var(--chat-primary);
}
.chat-page__visitor-row {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 12px 14px;
  border: none;
  border-bottom: 1px solid #f1eee9;
  color: #333;
  text-align: left;
  background: #fff;
}
.chat-page__visitor-row strong,
.chat-page__visitor-row small {
  display: block;
}
.chat-page__visitor-row strong {
  font-size: 14px;
}
.chat-page__visitor-row small {
  margin-top: 2px;
  color: #888;
  font-size: 11px;
}
.chat-page__coupon-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px;
  color: #8a5a00;
  font-size: 12px;
  background: #fff7e6;
}
.chat-page__coupon-row strong {
  color: #ff5a3c;
}
.chat-page__primary-card-btn {
  display: block;
  width: calc(100% - 28px);
  height: 40px;
  margin: 14px;
  border: none;
  border-radius: 20px;
  font-size: 15px;
  color: #fff;
  font-weight: 700;
  background: var(--chat-primary);
}
.chat-page__guide-card {
  padding-bottom: 1px;
}
.chat-page__guide-card p {
  margin: 10px 14px;
  color: #4a4a4a;
  font-size: 13px;
  line-height: 1.45;
}

.chat-page__order-popup {
  overflow: hidden;
  border-radius: 24px 24px 0 0;
}
.chat-page__order-sheet {
  padding: 20px 20px calc(env(safe-area-inset-bottom) + 18px);
  background: #fff;
}
.chat-page__order-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.chat-page__order-header strong {
  font-size: 18px;
}
.chat-page__order-header button {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  color: #999;
  font-size: 24px;
  line-height: 28px;
  background: #f4f1ed;
}
.chat-page__order-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f3eee8;
  color: #666;
  font-size: 13px;
}
.chat-page__order-row strong {
  color: #333;
}
.chat-page__order-row--discount strong,
.chat-page__order-row--total strong {
  color: #ff5a3c;
}
.chat-page__order-row--total {
  align-items: baseline;
  margin-bottom: 12px;
  border-bottom: none;
}
.chat-page__order-row--total strong {
  font-size: 24px;
}
.terms-text {
  font-size: 12px;
  color: #666;
}
.terms-name-text {
  font-size: 12px;
  color: var(--chat-primary);
}
.chat-page__pay-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 40px;
  margin-top: 10px;
  border: none;
  border-radius: 22px;
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  background: var(--chat-primary);
}
.chat-page__pay-btn:disabled {
  background: #d8d0c8;
}

.chat-page__footer {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 3;
  padding: 8px 18px calc(env(safe-area-inset-bottom) + 10px);
  background: linear-gradient(
    180deg,
    rgba(255, 250, 241, 0),
    rgba(255, 250, 241, 0.96) 20%,
    #fffaf1 100%
  );
}
.chat-page__quick-actions {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}
.chat-page__quick-actions::-webkit-scrollbar {
  display: none;
}
.chat-page__quick-action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1px;
  padding: 4px 7px;
  border: none;
  border-radius: 14px;
  color: #fff;
  white-space: nowrap;
  background: var(--action-color, var(--chat-primary));
}
.chat-page__quick-action-icon {
  flex-shrink: 0;
  font-size: 13px;
}
.chat-page__quick-action-text {
  font-size: 11px;
  line-height: 17px;
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

@keyframes youyou-wave {
  0%,
  100% {
    transform: rotate(0deg) translateY(0);
  }
  25% {
    transform: rotate(-4deg) translateY(-2px);
  }
  50% {
    transform: rotate(4deg) translateY(0);
  }
  75% {
    transform: rotate(-3deg) translateY(-1px);
  }
}
@media (max-width: 390px) {
  .chat-page__welcome {
    padding-right: 14px;
    padding-left: 14px;
  }
  .chat-page__cloud {
    padding: 17px 15px;
  }
  .chat-page__quick-actions {
    gap: 6px;
  }
  .chat-page__quick-action strong {
    font-size: 11px;
  }
}
</style>

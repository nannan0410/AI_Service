<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { showToast } from "vant";
import type {
  ActivityCardPayload,
  ChatMessage,
  ContentCardPayload,
  CouponCardPayload,
  CouponRecommendPayload,
  OrderCardPayload,
  QuizCardPayload,
  SceneRecommendPayload,
  StarIntroPayload,
  TicketCardPayload,
  TicketFallbackPayload,
  PageGuideCardPayload,
  MapActionCardPayload,
  ReviewCardPayload,
  ReviewSubmitDraft,
  TravelGuidePayload,
  VisitorPickPayload,
} from "@/types";
import MemberAvatar from "@/components/member/MemberAvatar.vue";
import AssistantAvatar from "@/components/assistant/AssistantAvatar.vue";
import TicketCard from "@/components/chat/cards/TicketCard.vue";
import TicketConfirmCard from "@/components/chat/cards/TicketConfirmCard.vue";
import TicketFallbackCard from "@/components/chat/cards/TicketFallbackCard.vue";
import PageGuideCard from "@/components/chat/cards/PageGuideCard.vue";
import ReviewCard from "@/components/chat/cards/ReviewCard.vue";
import CouponCard from "@/components/chat/cards/CouponCard.vue";
import OrderCard from "@/components/chat/cards/OrderCard.vue";
import ContentCard from "@/components/chat/cards/ContentCard.vue";
import ActivityCard from "@/components/chat/cards/ActivityCard.vue";
import GuideCard from "@/components/chat/cards/GuideCard.vue";
import VisitorPicker from "@/components/chat/cards/VisitorPicker.vue";
import QuizCard from "@/components/chat/cards/QuizCard.vue";
import StarIntroCard from "@/components/chat/cards/StarIntroCard.vue";
import MapActionCard from "@/components/chat/cards/MapActionCard.vue";
import MessageFeedbackBar from "@/components/chat/MessageFeedbackBar.vue";
import { isCouponRecommendPayload } from "@/utils/couponRecommend";
import { ACTIVITY_CATEGORY_LABELS } from "@/utils/activityDisplay";
import { resolveRevealCount } from "@/utils/cardReveal";

const props = defineProps<{
  message: ChatMessage;
  visitorPickDisabled?: boolean;
  ticketConfirmDisabled?: boolean;
  reviewDisabled?: boolean;
  quizDisabled?: boolean;
  submittedReviewOrderIds?: string[];
  favorited?: boolean;
}>();

const emit = defineEmits<{
  visitorConfirm: [payload: VisitorPickPayload, idNumbers: string[]];
  ticketConfirm: [payload: TicketCardPayload];
  reviewSubmit: [draft: ReviewSubmitDraft];
  checkinConfirm: [payload: PageGuideCardPayload, messageId: string];
  quizStart: [quizId: string];
  quizAnswer: [payload: QuizCardPayload, optionKey: string, messageId: string];
  feedbackLike: [messageId: string];
  feedbackDislike: [messageId: string];
  feedbackFavorite: [messageId: string];
}>();

const showFeedbackBar = computed(
  () => props.message.role === "assistant" && props.message.type !== "system",
);

const router = useRouter();

const scenePayload = computed(() =>
  props.message.type === "scene_recommend"
    ? asSceneRecommend(props.message.payload)
    : null,
);

const sceneReveal = computed(() => {
  const payload = scenePayload.value;
  if (!payload) {
    return {
      showCoupon: false,
      activities: [] as ActivityCardPayload[],
      showQuiz: false,
    };
  }
  const couponSlot = payload.coupon ? 1 : 0;
  const activityCount = payload.activities?.length ?? 0;
  const quizSlot = payload.quizInvite ? 1 : 0;
  const total = couponSlot + activityCount + quizSlot;
  const revealed = resolveRevealCount(props.message.revealCount, total);

  let cursor = 0;
  const showCoupon = Boolean(payload.coupon) && revealed > cursor;
  if (payload.coupon) cursor += 1;

  const activityStart = cursor;
  const activityEnd = cursor + activityCount;
  const activities = (payload.activities ?? []).slice(
    0,
    Math.max(0, Math.min(activityCount, revealed - activityStart)),
  );
  cursor = activityEnd;

  const showQuiz = Boolean(payload.quizInvite) && revealed > cursor;

  return { showCoupon, activities, showQuiz };
});

const couponRecommendItems = computed(() => {
  if (
    props.message.type !== "coupon" ||
    !isCouponRecommendPayload(props.message.payload)
  ) {
    return [] as CouponCardPayload[];
  }
  const items = asCouponRecommend(props.message.payload).items;
  const revealed = resolveRevealCount(props.message.revealCount, items.length);
  return items.slice(0, revealed);
});

const showCouponRecommendAction = computed(() => {
  if (!isCouponRecommendPayload(props.message.payload)) return false;
  if (!showCouponRecommendViewButton(props.message.payload)) return false;
  const total = asCouponRecommend(props.message.payload).items.length;
  const revealed = resolveRevealCount(props.message.revealCount, total);
  return revealed >= total && total > 0;
});

const ticketPayload = computed(() =>
  props.message.type === "ticket" ? asTicket(props.message.payload) : null,
);

const ticketReveal = computed(() => {
  const payload = ticketPayload.value;
  if (!payload) {
    return { showCoupon: false, showTicket: true };
  }
  const total = payload.offerCoupon ? 2 : 1;
  const revealed = resolveRevealCount(props.message.revealCount, total);
  if (!payload.offerCoupon) {
    return { showCoupon: false, showTicket: revealed >= 1 };
  }
  return {
    showCoupon: revealed >= 1,
    showTicket: revealed >= 2,
  };
});

function asVisitorPick(payload: unknown): VisitorPickPayload {
  return payload as VisitorPickPayload;
}

function asTicket(payload: unknown): TicketCardPayload {
  return payload as TicketCardPayload;
}

function asTicketFallback(payload: unknown): TicketFallbackPayload {
  return payload as TicketFallbackPayload;
}

function asCoupon(payload: unknown): CouponCardPayload {
  return payload as CouponCardPayload;
}

function asCouponRecommend(payload: unknown): CouponRecommendPayload {
  return payload as CouponRecommendPayload;
}

function showCouponViewButton(payload: CouponCardPayload): boolean {
  return payload.action === "view";
}

function showCouponRecommendViewButton(payload: unknown): boolean {
  if (!isCouponRecommendPayload(payload)) return false;
  return payload.action === "view";
}

function showTicketConfirmButton(message: ChatMessage): boolean {
  if (message.type !== "ticket") return false;
  const payload = asTicket(message.payload);
  if (!(payload.status === "quote" || payload.status === "confirm")) return false;
  if (payload.offerCoupon) {
    const revealed = resolveRevealCount(message.revealCount, 2);
    if (revealed < 2) return false;
  }
  return true;
}

function onTicketCardConfirm(message: ChatMessage) {
  emit("ticketConfirm", asTicket(message.payload));
}

function openCouponPage() {
  router.push("/coupon");
}

function openTicketList(path: string) {
  router.push(path);
}

function asOrder(payload: unknown): OrderCardPayload {
  return payload as OrderCardPayload;
}

function asContent(payload: unknown): ContentCardPayload {
  return payload as ContentCardPayload;
}

function asActivity(payload: unknown): ActivityCardPayload {
  return payload as ActivityCardPayload;
}

function asSceneRecommend(payload: unknown): SceneRecommendPayload {
  return payload as SceneRecommendPayload;
}

function onSceneActivityView() {
  showToast("跳转到店铺购物车或介绍页面");
}

function queueActionLabel(item: ActivityCardPayload): string | null {
  if (item.queueAction?.label) return item.queueAction.label;
  return null;
}

function onQueueAction(item: ActivityCardPayload) {
  const path = item.queueAction?.path;
  if (!path) {
    showToast("暂无法取号");
    return;
  }
  router.push(path);
}

function activityTagLabel(item: ActivityCardPayload): string {
  if (item.category && ACTIVITY_CATEGORY_LABELS[item.category]) {
    return ACTIVITY_CATEGORY_LABELS[item.category];
  }
  return "项目";
}

function asGuide(payload: unknown): TravelGuidePayload {
  return payload as TravelGuidePayload;
}

function asPageGuide(payload: unknown): PageGuideCardPayload {
  return payload as PageGuideCardPayload;
}

function asMapAction(payload: unknown): MapActionCardPayload {
  return payload as MapActionCardPayload;
}

function onMapActionOpen(path: string) {
  openPage(path);
}

function onActivityMapAction(item: ActivityCardPayload) {
  const path = item.mapActions?.[0]?.path;
  if (!path) {
    showToast("暂无法打开地图");
    return;
  }
  openPage(path);
}

function onInParkCardAction(item: ActivityCardPayload, key: string) {
  const action = item.inParkActions?.find((a) => a.key === key);
  if (!action) return;
  if (action.key === "checkin") {
    showToast("跳转到打卡页");
    return;
  }
  if (action.key === "reserve") {
    showToast("跳转到项目详情页面并进行预约");
    return;
  }
  if (action.key === "map" || action.key === "queue") {
    if (!action.path) {
      showToast(action.key === "map" ? "暂无法打开地图" : "暂无法取号");
      return;
    }
    openPage(action.path);
  }
}

function onStarDetailIntro() {
  showToast("跳转到知识图片详情页");
}

function asReview(payload: unknown): ReviewCardPayload {
  return payload as ReviewCardPayload;
}

function asStarIntro(payload: unknown): StarIntroPayload {
  return payload as StarIntroPayload;
}

function asQuiz(payload: unknown): QuizCardPayload {
  return payload as QuizCardPayload;
}

function openPage(path: string) {
  router.push(path);
}

function onPageGuideCheckin(payload: PageGuideCardPayload) {
  emit("checkinConfirm", payload, props.message.id);
}

function onQuizInvite(quizId: string) {
  emit("quizStart", quizId);
}

function onQuizOption(optionKey: string) {
  emit("quizAnswer", asQuiz(props.message.payload), optionKey, props.message.id);
}

const cardTypes = new Set([
  "ticket",
  "ticket_confirm",
  "ticket_fallback",
  "page_guide",
  "review",
  "coupon",
  "order",
  "content",
  "activity",
  "scene_recommend",
  "visitor_pick",
  "guide",
  "star_intro",
  "quiz",
]);
</script>

<template>
  <div
    class="bubble-row"
    :class="{
      'bubble-row--user': message.role === 'user',
      'bubble-row--system': message.role === 'system',
      'bubble-row--card': cardTypes.has(message.type),
    }"
  >
    <AssistantAvatar v-if="message.role === 'assistant'" :size="36" />
    <MemberAvatar v-if="message.role === 'user'" :size="36" />

    <div
      class="bubble-stack"
      :class="{
        'bubble-stack--assistant': message.role === 'assistant',
        'bubble-stack--with-feedback': showFeedbackBar,
      }"
    >
    <div
      v-if="message.type === 'text' || message.type === 'system'"
      class="bubble"
      :class="{
        'bubble--user': message.role === 'user',
        'bubble--assistant': message.role === 'assistant',
        'bubble--system': message.role === 'system',
      }"
    >
      <span v-if="message.role === 'assistant'" class="bubble__icon">🤖</span>
      {{ message.content }}
    </div>

    <div v-else-if="message.type === 'ticket'" class="bubble bubble--assistant bubble-card-box">
      <p v-if="message.content" class="bubble-card-box__caption">{{ message.content }}</p>
      <template v-if="ticketReveal.showCoupon && ticketPayload?.offerCoupon">
        <div class="bubble-card-box__reveal-item">
          <p
            v-if="ticketPayload.offerCouponHint"
            class="bubble-card-box__sub-caption"
          >
            {{ ticketPayload.offerCouponHint }}
          </p>
          <CouponCard :payload="ticketPayload.offerCoupon" embedded />
          <van-button
            v-if="ticketPayload.offerCoupon.action === 'view' || ticketPayload.offerCoupon.action === 'use'"
            size="small"
            type="primary"
            plain
            round
            block
            class="bubble-card-box__action"
            @click="openCouponPage"
          >
            点击查看
          </van-button>
        </div>
      </template>
      <template v-if="ticketReveal.showTicket && ticketPayload">
        <div class="bubble-card-box__reveal-item">
          <TicketCard :payload="ticketPayload" embedded />
          <p v-if="ticketPayload.footerHint" class="bubble-card-box__footer">
            {{ ticketPayload.footerHint }}
          </p>
          <van-button
            v-if="showTicketConfirmButton(message)"
            type="primary"
            size="small"
            round
            block
            class="bubble-card-box__action bubble-card-box__action--ticket"
            :disabled="ticketConfirmDisabled"
            @click="onTicketCardConfirm(message)"
          >
            {{ ticketConfirmDisabled ? "已生成订单" : "确认并生成订单" }}
          </van-button>
        </div>
      </template>
    </div>

    <div v-else-if="message.type === 'ticket_confirm'" class="bubble bubble--assistant bubble-card-box">
      <p v-if="message.content" class="bubble-card-box__caption">{{ message.content }}</p>
      <TicketConfirmCard
        :payload="asTicket(message.payload)"
        :disabled="ticketConfirmDisabled"
        @confirm="(payload) => emit('ticketConfirm', payload)"
      />
    </div>

    <div
      v-else-if="message.type === 'ticket_fallback'"
      class="bubble bubble--assistant bubble-card-box"
    >
      <p v-if="message.content" class="bubble-card-box__caption">{{ message.content }}</p>
      <TicketFallbackCard
        :payload="asTicketFallback(message.payload)"
        embedded
        @open-list="openTicketList"
      />
    </div>

    <div
      v-else-if="message.type === 'page_guide'"
      class="bubble bubble--assistant bubble-card-box"
    >
      <p v-if="message.content" class="bubble-card-box__caption">{{ message.content }}</p>
      <PageGuideCard
        :payload="asPageGuide(message.payload)"
        embedded
        @open="openPage"
        @checkin="onPageGuideCheckin"
      />
    </div>

    <div
      v-else-if="message.type === 'map_action'"
      class="bubble bubble--assistant bubble-card-box"
    >
      <p v-if="message.content" class="bubble-card-box__caption">{{ message.content }}</p>
      <MapActionCard
        :payload="asMapAction(message.payload)"
        embedded
        @open="onMapActionOpen"
      />
    </div>

    <div
      v-else-if="message.type === 'review'"
      class="bubble bubble--assistant bubble-card-box"
    >
      <p v-if="message.content" class="bubble-card-box__caption">{{ message.content }}</p>
      <ReviewCard
        :payload="asReview(message.payload)"
        :disabled="reviewDisabled"
        :submitted-order-ids="submittedReviewOrderIds"
        @submit="(draft) => emit('reviewSubmit', draft)"
      />
    </div>

    <div v-else-if="message.type === 'coupon'" class="bubble bubble--assistant bubble-card-box">
      <p v-if="message.content" class="bubble-card-box__caption">{{ message.content }}</p>
      <template v-if="isCouponRecommendPayload(message.payload)">
        <div class="bubble-card-box__coupon-list">
          <CouponCard
            v-for="(item, index) in couponRecommendItems"
            :key="item.couponId || index"
            :payload="item"
            embedded
            class="bubble-card-box__reveal-item"
          />
        </div>
        <van-button
          v-if="showCouponRecommendAction"
          size="small"
          type="primary"
          plain
          round
          block
          class="bubble-card-box__action"
          @click="openCouponPage"
        >
          点击查看
        </van-button>
      </template>
      <template v-else>
        <CouponCard :payload="asCoupon(message.payload)" embedded />
        <van-button
          v-if="showCouponViewButton(asCoupon(message.payload))"
          size="small"
          type="primary"
          plain
          round
          block
          class="bubble-card-box__action"
          @click="openCouponPage"
        >
          点击查看
        </van-button>
      </template>
    </div>

    <div v-else-if="message.type === 'order'" class="bubble bubble--assistant bubble-card">
      <p v-if="message.content" class="bubble-card__caption">{{ message.content }}</p>
      <OrderCard :payload="asOrder(message.payload)" />
    </div>

    <div v-else-if="message.type === 'content'" class="bubble bubble--assistant bubble-card">
      <ContentCard :payload="asContent(message.payload)" />
    </div>

    <div v-else-if="message.type === 'activity'" class="bubble bubble--assistant bubble-card-box">
      <p v-if="message.content" class="bubble-card-box__caption">{{ message.content }}</p>
      <ActivityCard :payload="asActivity(message.payload)" embedded />
      <div
        v-if="asActivity(message.payload).inParkActions?.length"
        class="bubble-card-box__actions-row"
      >
        <van-button
          v-for="action in asActivity(message.payload).inParkActions"
          :key="action.key"
          size="small"
          type="primary"
          plain
          round
          class="bubble-card-box__action-inline"
          @click="onInParkCardAction(asActivity(message.payload), action.key)"
        >
          {{ action.label }}
        </van-button>
      </div>
      <van-button
        v-else-if="asActivity(message.payload).mapActions?.length"
        size="small"
        type="primary"
        plain
        round
        block
        class="bubble-card-box__action"
        @click="onActivityMapAction(asActivity(message.payload))"
      >
        {{ asActivity(message.payload).mapActions![0].label }}
      </van-button>
    </div>

    <div
      v-else-if="message.type === 'scene_recommend'"
      class="bubble bubble--assistant bubble-card-box"
    >
      <p v-if="message.content" class="bubble-card-box__caption">{{ message.content }}</p>
      <template v-if="sceneReveal.showCoupon && scenePayload?.coupon">
        <div class="bubble-card-box__reveal-item">
          <CouponCard :payload="scenePayload.coupon" embedded />
          <van-button
            size="small"
            type="primary"
            plain
            round
            block
            class="bubble-card-box__action"
            @click="openCouponPage"
          >
            点击查看
          </van-button>
        </div>
      </template>
      <div
        v-for="item in sceneReveal.activities"
        :key="item.activityId"
        class="bubble-card-box__scene-item bubble-card-box__reveal-item"
      >
        <ActivityCard :payload="item" :tag="activityTagLabel(item)" embedded />
        <div
          v-if="item.inParkActions?.length"
          class="bubble-card-box__actions-row"
        >
          <van-button
            v-for="action in item.inParkActions"
            :key="action.key"
            size="small"
            type="primary"
            plain
            round
            class="bubble-card-box__action-inline"
            @click="onInParkCardAction(item, action.key)"
          >
            {{ action.label }}
          </van-button>
        </div>
        <van-button
          v-else-if="item.mapActions?.length"
          size="small"
          type="primary"
          plain
          round
          block
          class="bubble-card-box__action"
          @click="onActivityMapAction(item)"
        >
          {{ item.mapActions[0].label }}
        </van-button>
        <van-button
          v-else-if="scenePayload?.scene === 'queue' && queueActionLabel(item)"
          size="small"
          type="primary"
          plain
          round
          block
          class="bubble-card-box__action"
          @click="onQueueAction(item)"
        >
          {{ queueActionLabel(item) }}
        </van-button>
        <van-button
          v-else-if="
            scenePayload?.scene !== 'show' &&
            scenePayload?.scene !== 'queue' &&
            scenePayload?.scene !== 'nearby'
          "
          size="small"
          type="primary"
          plain
          round
          block
          class="bubble-card-box__action"
          @click="onSceneActivityView"
        >
          查看
        </van-button>
      </div>
      <template v-if="sceneReveal.showQuiz && scenePayload?.quizInvite">
        <div class="bubble-card-box__reveal-item">
          <p class="bubble-card-box__quiz-hint">
            {{ scenePayload.quizInvite.hint }}
          </p>
          <van-button
            size="small"
            type="primary"
            round
            block
            class="bubble-card-box__action"
            @click="onQuizInvite(scenePayload.quizInvite.quizId)"
          >
            {{ scenePayload.quizInvite.buttonLabel }}
          </van-button>
        </div>
      </template>
    </div>

    <div
      v-else-if="message.type === 'star_intro'"
      class="bubble bubble--assistant bubble-card-box"
    >
      <p v-if="message.content" class="bubble-card-box__caption">{{ message.content }}</p>
      <StarIntroCard :payload="asStarIntro(message.payload)" />
      <div
        class="bubble-card-box__actions-row"
        :class="{
          'bubble-card-box__actions-row--single': !asStarIntro(message.payload).quizInvite,
        }"
      >
        <van-button
          size="small"
          type="primary"
          plain
          round
          class="bubble-card-box__action-inline"
          :class="{ 'bubble-card-box__action-inline--full': !asStarIntro(message.payload).quizInvite }"
          @click="onStarDetailIntro"
        >
          详细介绍
        </van-button>
        <van-button
          v-if="asStarIntro(message.payload).quizInvite"
          size="small"
          type="primary"
          round
          class="bubble-card-box__action-inline"
          @click="onQuizInvite(asStarIntro(message.payload).quizInvite!.quizId)"
        >
          {{ asStarIntro(message.payload).quizInvite!.buttonLabel }}
        </van-button>
      </div>
      <p
        v-if="asStarIntro(message.payload).quizInvite"
        class="bubble-card-box__quiz-hint"
      >
        {{ asStarIntro(message.payload).quizInvite!.hint }}
      </p>
    </div>

    <div v-else-if="message.type === 'quiz'" class="bubble bubble--assistant bubble-card-box">
      <p v-if="message.content" class="bubble-card-box__caption">{{ message.content }}</p>
      <QuizCard
        :payload="asQuiz(message.payload)"
        :disabled="quizDisabled"
        @answer="onQuizOption"
      />
    </div>

    <div v-else-if="message.type === 'guide'" class="bubble bubble--assistant bubble-card-box">
      <p v-if="message.content" class="bubble-card-box__caption">{{ message.content }}</p>
      <GuideCard :payload="asGuide(message.payload)" embedded />
    </div>

    <div v-else-if="message.type === 'visitor_pick'" class="bubble bubble--assistant bubble-card">
      <VisitorPicker
        :payload="asVisitorPick(message.payload)"
        :disabled="visitorPickDisabled"
        @confirm="(ids) => emit('visitorConfirm', asVisitorPick(message.payload), ids)"
      />
    </div>

    <MessageFeedbackBar
      v-if="showFeedbackBar"
      :message="message"
      :favorited="favorited"
      @like="emit('feedbackLike', message.id)"
      @dislike="emit('feedbackDislike', message.id)"
      @favorite="emit('feedbackFavorite', message.id)"
    />
    </div>
  </div>
</template>

<style scoped>
.bubble-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 12px;
  padding: 0 12px;
  --bubble-radius: 12px;
  --bubble-tail-size: 6px;
  --bubble-tail-top: 16px;
  --chat-side-pad: 12px;
  --chat-avatar-size: 36px;
  --chat-gap: 8px;
  /* 游客消息气泡右缘距行右缘 = 边距 + 头像 + 间距 */
  --chat-visitor-edge: calc(var(--chat-side-pad) + var(--chat-avatar-size) + var(--chat-gap));
  /* 客服气泡右缘 = 游客右缘 + 20px；左右起始对称，故 max = 100% - 2×visitor-edge - 20 + 2×side-pad */
  --chat-assistant-bubble-max: calc(
    100% - 2 * var(--chat-visitor-edge) - 20px + 2 * var(--chat-side-pad)
  );
}

.bubble-row--user {
  flex-direction: row-reverse;
}

.bubble-row--system {
  justify-content: center;
}

.bubble-row--card {
  align-items: flex-start;
}

.bubble-row:not(.bubble-row--user):not(.bubble-row--system) > .bubble-stack--assistant {
  max-width: var(--chat-assistant-bubble-max);
  min-width: 0;
  box-sizing: border-box;
}

.bubble-stack {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-width: 0;
  max-width: 100%;
}

.bubble-stack--assistant > .bubble,
.bubble-stack--assistant > .bubble-card,
.bubble-stack--assistant > .bubble-card-box {
  max-width: 100%;
}

/* 反馈图标在消息框内：外层统一白底，子气泡去掉独立阴影 */
.bubble-stack--with-feedback {
  position: relative;
  padding: 10px 12px 8px;
  border-radius: var(--bubble-radius);
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  box-sizing: border-box;
}

.bubble-stack--with-feedback::before {
  content: "";
  position: absolute;
  top: var(--bubble-tail-top);
  left: calc(-1 * var(--bubble-tail-size));
  width: 0;
  height: 0;
  border-top: var(--bubble-tail-size) solid transparent;
  border-bottom: var(--bubble-tail-size) solid transparent;
  border-right: var(--bubble-tail-size) solid #fff;
  filter: drop-shadow(-1px 1px 1px rgba(0, 0, 0, 0.05));
}

.bubble-stack--with-feedback > .bubble--assistant,
.bubble-stack--with-feedback > .bubble-card,
.bubble-stack--with-feedback > .bubble-card-box {
  background: transparent;
  box-shadow: none;
  padding: 0;
  border-radius: 0;
}

.bubble-stack--with-feedback > .bubble--assistant::before {
  display: none;
}

.bubble-stack--with-feedback > .bubble-card-box {
  gap: 10px;
}

.bubble-row:not(.bubble-row--user):not(.bubble-row--system) > .bubble,
.bubble-row:not(.bubble-row--user):not(.bubble-row--system) > .bubble-card,
.bubble-row:not(.bubble-row--user):not(.bubble-row--system) > .bubble-card-box {
  max-width: var(--chat-assistant-bubble-max);
  min-width: 0;
  box-sizing: border-box;
}

.bubble {
  padding: 10px 12px;
  border-radius: var(--bubble-radius);
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.bubble-row--user > .bubble-stack {
  max-width: 75%;
}

.bubble-row--user > .bubble-stack > .bubble {
  max-width: 100%;
}

.bubble__icon {
  margin-right: 3px;
}

.bubble--user {
  position: relative;
  background: var(--chat-primary);
  color: #fff;
}

.bubble--user::after {
  content: "";
  position: absolute;
  top: var(--bubble-tail-top);
  right: calc(-1 * var(--bubble-tail-size));
  width: 0;
  height: 0;
  border-top: var(--bubble-tail-size) solid transparent;
  border-bottom: var(--bubble-tail-size) solid transparent;
  border-left: var(--bubble-tail-size) solid var(--chat-primary);
}

.bubble--assistant {
  position: relative;
  background: #fff;
  color: #333;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  white-space: pre-line;
}

.bubble--assistant::before {
  content: "";
  position: absolute;
  top: var(--bubble-tail-top);
  left: calc(-1 * var(--bubble-tail-size));
  width: 0;
  height: 0;
  border-top: var(--bubble-tail-size) solid transparent;
  border-bottom: var(--bubble-tail-size) solid transparent;
  border-right: var(--bubble-tail-size) solid #fff;
  filter: drop-shadow(-1px 1px 1px rgba(0, 0, 0, 0.05));
}

.bubble--system {
  background: #f6f6f6;
  color: #888;
  font-size: 11px;
  max-width: 90%;
  padding: 8px 12px;
}

.bubble-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bubble-card__caption {
  margin: 0;
  font-size: 13px;
  color: #646566;
  line-height: 1.4;
  white-space: pre-line;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.bubble-card__action {
  align-self: flex-start;
  margin-top: 2px;
}

.bubble-card-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
}

.bubble-card-box__caption {
  margin: 0;
  font-size: 14px;
  color: #333;
  line-height: 1.5;
  white-space: pre-line;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.bubble-card-box__footer {
  margin: 0;
  font-size: 13px;
  color: #646566;
  line-height: 1.5;
  white-space: pre-line;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.bubble-card-box__sub-caption {
  margin: 0 0 8px;
  font-size: 12px;
  color: #646566;
  line-height: 1.4;
}

.bubble-card-box__coupon-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bubble-card-box__scene-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bubble-card-box__reveal-item {
  animation: bubble-card-reveal 280ms ease-out;
}

@keyframes bubble-card-reveal {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.bubble-card-box__action {
  margin-top: 2px;
}

.bubble-card-box__actions-row {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  margin-top: 2px;
  width: 100%;
}

.bubble-card-box__action-inline {
  flex: 1;
  min-width: 0;
  margin-top: 0;
}

.bubble-card-box__action-inline--full {
  flex: 1 1 100%;
}

.bubble-card-box__actions-row--single .bubble-card-box__action-inline {
  width: 100%;
}

.bubble-card-box__quiz-hint {
  margin: 10px 0 4px;
  font-size: 13px;
  line-height: 1.45;
  color: #646566;
}

.bubble-card-box__action--ticket {
  margin-top: 8px;
  background: var(--chat-primary, #07c160);
  border-color: var(--chat-primary, #07c160);
}

.bubble-card-box :deep(.chat-card) {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  background: #f7f8fa;
  box-shadow: none;
  padding: 10px;
}

.bubble-card-box :deep(.chat-card__title),
.bubble-card-box :deep(.chat-card__body),
.bubble-card :deep(.chat-card__title),
.bubble-card :deep(.chat-card__body) {
  word-break: break-word;
  overflow-wrap: anywhere;
}

.bubble-card :deep(.chat-card) {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
</style>

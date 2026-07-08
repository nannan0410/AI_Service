<script setup lang="ts">
import { useRouter } from "vue-router";
import type {
  ActivityCardPayload,
  ChatMessage,
  ContentCardPayload,
  CouponCardPayload,
  CouponRecommendPayload,
  OrderCardPayload,
  TicketCardPayload,
  TicketFallbackPayload,
  PageGuideCardPayload,
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
import { isCouponRecommendPayload } from "@/utils/couponRecommend";

defineProps<{
  message: ChatMessage;
  visitorPickDisabled?: boolean;
  ticketConfirmDisabled?: boolean;
  reviewDisabled?: boolean;
  submittedReviewOrderIds?: string[];
}>();

const emit = defineEmits<{
  visitorConfirm: [payload: VisitorPickPayload, idNumbers: string[]];
  ticketConfirm: [payload: TicketCardPayload];
  reviewSubmit: [draft: ReviewSubmitDraft];
}>();

const router = useRouter();

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
  return payload.status === "quote" || payload.status === "confirm";
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

function asGuide(payload: unknown): TravelGuidePayload {
  return payload as TravelGuidePayload;
}

function asPageGuide(payload: unknown): PageGuideCardPayload {
  return payload as PageGuideCardPayload;
}

function asReview(payload: unknown): ReviewCardPayload {
  return payload as ReviewCardPayload;
}

function openPage(path: string) {
  router.push(path);
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
  "visitor_pick",
  "guide",
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
      <TicketCard :payload="asTicket(message.payload)" embedded />
      <p v-if="asTicket(message.payload).footerHint" class="bubble-card-box__footer">
        {{ asTicket(message.payload).footerHint }}
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
            v-for="(item, index) in asCouponRecommend(message.payload).items"
            :key="item.couponId || index"
            :payload="item"
            embedded
          />
        </div>
        <van-button
          v-if="showCouponRecommendViewButton(message.payload)"
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

    <div v-else-if="message.type === 'activity'" class="bubble bubble--assistant bubble-card">
      <ActivityCard :payload="asActivity(message.payload)" />
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

.bubble-row--user > .bubble {
  max-width: 75%;
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

.bubble-card-box__coupon-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bubble-card-box__action {
  margin-top: 2px;
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

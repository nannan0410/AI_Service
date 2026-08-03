<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { fetchTicketProducts } from "@/api/business";
import type { TicketProduct } from "@/types";

const router = useRouter();
const loading = ref(true);
const products = ref<TicketProduct[]>([]);

function formatComposition(product: TicketProduct): string | null {
  const composition = product.composition;
  if (!composition) return null;
  const parts: string[] = [];
  if (composition.adult) parts.push(`${composition.adult} 成人`);
  if (composition.child) parts.push(`${composition.child} 儿童`);
  return parts.length ? parts.join(" · ") : null;
}

onMounted(async () => {
  try {
    const { data: res } = await fetchTicketProducts("self");
    if (res.code === 200) {
      products.value = res.data.filter((item) => item.status === "on");
    }
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="tickets-page">
    <van-nav-bar
      title="购票列表"
      left-arrow
      class="tickets-page__nav"
      @click-left="router.back()"
    />

    <van-notice-bar
      left-icon="info-o"
      text="演示版列表仅供选购参考；组合购票请按票种说明自行搭配。"
    />

    <van-loading v-if="loading" class="tickets-page__loading" size="24px" vertical>
      加载中…
    </van-loading>

    <div v-else class="tickets-page__list">
      <article
        v-for="item in products"
        :key="item.productId"
        class="tickets-page__card"
      >
        <div class="tickets-page__card-head">
          <h3>{{ item.name }}</h3>
          <strong>¥{{ item.price }}</strong>
        </div>
        <p v-if="formatComposition(item)" class="tickets-page__composition">
          含 {{ formatComposition(item) }}
        </p>
        <p v-if="item.tags?.length" class="tickets-page__tags">
          {{ item.tags.join(" · ") }}
        </p>
      </article>
    </div>
  </div>
</template>

<style scoped>
.tickets-page {
  min-height: 100vh;
  background: #f7f8fa;
}

.tickets-page__nav {
  position: sticky;
  top: 0;
  z-index: 100;
}

.tickets-page__loading {
  display: flex;
  justify-content: center;
  padding: 48px 0;
}

.tickets-page__list {
  padding: 12px 16px 24px;
}

.tickets-page__card {
  margin-bottom: 12px;
  padding: 14px 16px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
}

.tickets-page__card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.tickets-page__card-head h3 {
  margin: 0;
  font-size: 16px;
  color: #222;
}

.tickets-page__card-head strong {
  font-size: 18px;
  color: #ee0a24;
}

.tickets-page__composition,
.tickets-page__tags {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: #666;
}
</style>

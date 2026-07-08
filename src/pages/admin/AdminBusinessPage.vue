<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { showConfirmDialog } from "vant";
import { appToast } from "@/utils/toast";
import { useAssistantStore } from "@/store/assistantStore";
import { useBusinessConfigStore } from "@/store/businessConfigStore";
import { useSkillStore } from "@/store/skillStore";
import { toolRegistry } from "@/ai/tools";
import { STAGE2_SKILL_IDS } from "@/ai/skills/utils";
import {
  DEMO_PERSONA_OPTIONS,
  buildDemoCouponFilterCtx,
  buildDemoRuleContext,
} from "@/utils/demoRuleContext";
import { previewRecommendEntries } from "@/utils/recommendEntries";
import {
  cloneWelcomeTemplates,
  flattenWelcomeQuestions,
  resolveSuggestedQuestions,
  unflattenWelcomeQuestions,
} from "@/utils/welcomeQuestions";
import { MAX_QUICK_SERVICES, MAX_WELCOME_RECOMMEND } from "@/utils/welcomeLayout";
import { resetDemoBusinessData } from "@/api/business";
import { clearDemoClientStorage } from "@/utils/demoReset";
import type { AssistantSkillConfig, PersonaId, RecommendEntry } from "@/types";
import type {
  FieldCatalogItem,
  RecommendEntryConfig,
  RuleExpression,
  SkillSubIntentDef,
  WelcomeTemplateConfig,
} from "@/types/businessConfig";
import { getSkillSubIntents, isLockedKeyword } from "@/utils/skillIntentCatalog";
import {
  findKeywordOwnerSkillId,
  formatSkillKeywordValidationErrors,
  mergeLockedKeywordsIntoTriggerKeywords,
  normalizeSkillsTriggerKeywords,
  validateSkillTriggerKeywords,
} from "@/utils/skillKeywordValidation";

const router = useRouter();
const assistantStore = useAssistantStore();
const businessConfigStore = useBusinessConfigStore();
const skillStore = useSkillStore();

const activeTab = ref<"skill" | "entry">("skill");
const workingSkills = ref<AssistantSkillConfig[]>([]);
const workingEntries = ref<RecommendEntryConfig[]>([]);
const workingWelcomeTemplates = ref<WelcomeTemplateConfig[]>([]);

const skillEditorVisible = ref(false);
const entryEditorVisible = ref(false);
const questionEditorVisible = ref(false);
const editingSkillIndex = ref(-1);
const editingEntryIndex = ref(-1);
const editingQuestionFlatIndex = ref(-1);
const keywordInput = ref("");
const iconPickerVisible = ref(false);
const questionIconPickerVisible = ref(false);

const ENTRY_ICON_PRESETS = [
  "shopping-cart-o",
  "coupon-o",
  "location-o",
  "orders-o",
  "notes-o",
  "gem-o",
  "bill-o",
  "chat-o",
  "photograph",
  "logistics",
];

const QUESTION_ICON_PRESETS = ["👨‍👩‍👧", "⭐", "⏰", "🗺️", "💰", "🎢", "🎫", "📍"];

const TARGET_OPTIONS: Array<{
  value: RecommendEntry["target"];
  label: string;
}> = [
  { value: "chat", label: "打开对话" },
  { value: "page", label: "跳转页面" },
  { value: "h5", label: "H5 页" },
];

const editSkillForm = ref({
  skillId: "",
  name: "",
  description: "",
  enabled: false,
  triggerKeywords: [] as string[],
  tools: [] as string[],
  promptAddon: "",
});

const editEntryForm = ref({
  entryId: "",
  title: "",
  icon: "",
  enabled: true,
  priority: 5,
  target: "chat" as RecommendEntry["target"],
  targetPath: "",
  skillId: "",
  promptHint: "",
  ruleField: "personaId",
  ruleValue: "demo_new" as string | boolean,
});

const editQuestionForm = ref({
  id: "",
  personaId: "demo_new" as PersonaId,
  text: "",
  desc: "",
  prompt: "",
  icon: "",
  badgeColor: "#54c783",
  enabled: true,
  priority: 10,
});

const BADGE_COLOR_PRESETS = ["#54c783", "#4aa3ff", "#ffb020", "#ff6b6b"];

const workingQuestions = computed(() =>
  flattenWelcomeQuestions(workingWelcomeTemplates.value),
);

const primaryColor = computed(() => assistantStore.primaryColor);
const themeVars = computed(() => ({
  "--admin-primary": primaryColor.value,
  "--admin-primary-light":
    assistantStore.uiConfig.primaryColorLight ?? "#e8f8ef",
  "--admin-primary-dark": assistantStore.primaryColorDark,
}));

const toolOptions = computed(() =>
  toolRegistry.map((tool) => ({ name: tool.name, label: tool.label }))
);

const skillOptions = computed(() =>
  businessConfigStore.skills.map((s) => ({
    value: s.skillId,
    label: s.name,
  }))
);

const ruleEligibleFields = computed(() =>
  businessConfigStore.fieldCatalog.fields.filter((f) => f.ruleEligible)
);

const selectedRuleFieldMeta = computed((): FieldCatalogItem | undefined =>
  ruleEligibleFields.value.find((f) => f.fieldId === editEntryForm.value.ruleField)
);

const editSkillSubIntents = computed((): SkillSubIntentDef[] =>
  getSkillSubIntents(editSkillForm.value.skillId),
);

const editSkillLockedKeywordSet = computed(
  () => new Set(editSkillSubIntents.value.flatMap((item) => item.keywords)),
);

const editSkillExtensionKeywords = computed(() =>
  editSkillForm.value.triggerKeywords.filter(
    (word) => !editSkillLockedKeywordSet.value.has(word),
  ),
);

function buildContextSummary(personaId: (typeof DEMO_PERSONA_OPTIONS)[number]["value"]) {
  const ctx = buildDemoRuleContext(personaId);
  return [
    `在园 ${ctx.inPark ? "是" : "否"}`,
    `有待出行 ${ctx.hasPendingVisitOrder ? "是" : "否"}`,
    ctx.hasVisitToday ? "今日出行" : ctx.nextVisitDate ? `最近 ${ctx.nextVisitDate}` : "无待出行",
    `可开票 ${ctx.hasInvoiceableOrders ? "是" : "否"}`,
    `可评价 ${ctx.hasReviewableOrders ? "是" : "否"}`,
    `阶段 ${ctx.visitorPhase}`,
    `标签 ${ctx.tags.join(", ") || "无"}`,
  ].join(" · ");
}

const personaPreviews = computed(() =>
  DEMO_PERSONA_OPTIONS.map((opt) => {
    const { matched, unmatched } = previewRecommendEntries(
      workingEntries.value,
      opt.value,
    );
    return {
      personaId: opt.value,
      label: opt.label,
      contextSummary: buildContextSummary(opt.value),
      quickServices: matched.slice(0, MAX_QUICK_SERVICES),
      unmatched,
      welcomeRecommend: resolveSuggestedQuestions(
        workingWelcomeTemplates.value,
        opt.value,
        buildDemoCouponFilterCtx(opt.value),
      ),
    };
  }),
);

const stage2Set = new Set<string>(STAGE2_SKILL_IDS);

function cloneSkills(skills: AssistantSkillConfig[]): AssistantSkillConfig[] {
  return skills.map((skill) => ({
    ...skill,
    tools: [...skill.tools],
    triggerKeywords: [...(skill.triggerKeywords ?? [])],
  }));
}

function cloneEntries(
  entries: RecommendEntryConfig[]
): RecommendEntryConfig[] {
  return entries.map((entry) => ({
    ...entry,
    rules: entry.rules?.length
      ? entry.rules.map((rule) => ({ ...rule }))
      : [],
  }));
}

function personaLabel(personaId: PersonaId) {
  return DEMO_PERSONA_OPTIONS.find((item) => item.value === personaId)?.label ?? personaId;
}

function isStage2(skillId: string) {
  return stage2Set.has(skillId);
}

function skillStatusLabel(skill: AssistantSkillConfig) {
  if (!skill.enabled) return "已关闭";
  if (isStage2(skill.skillId)) return "阶段二 · 可路由";
  return "已启用 · 待接入";
}

function entryRuleSummary(entry: RecommendEntryConfig) {
  const rule = entry.rules[0];
  if (!rule || rule.op !== "eq") return "未配置规则";
  return `${rule.field} = ${String(rule.value)}`;
}

function buildEntryRule(): RuleExpression {
  const { ruleField, ruleValue } = editEntryForm.value;
  return { op: "eq", field: ruleField, value: ruleValue };
}

function syncRuleValueForField(fieldId: string) {
  const meta = ruleEligibleFields.value.find((f) => f.fieldId === fieldId);
  if (!meta) return;
  if (meta.valueType === "boolean") {
    editEntryForm.value.ruleValue = true;
  } else if (meta.valueType === "enum" && meta.enumOptions?.length) {
    editEntryForm.value.ruleValue = meta.enumOptions[0].value;
  } else {
    editEntryForm.value.ruleValue = "";
  }
}

watch(
  () => editEntryForm.value.ruleField,
  (fieldId) => syncRuleValueForField(fieldId)
);

onMounted(async () => {
  await Promise.all([
    assistantStore.loadConfig(),
    businessConfigStore.loadAll(true),
  ]);
  workingSkills.value = normalizeSkillsTriggerKeywords(
    cloneSkills(businessConfigStore.skills),
  );
  workingEntries.value = cloneEntries(businessConfigStore.recommendEntries);
  workingWelcomeTemplates.value = cloneWelcomeTemplates(
    businessConfigStore.welcomeTemplates,
  );
});

function openSkillEditor(index: number) {
  editingSkillIndex.value = index;
  const skill = workingSkills.value[index];
  const mergedKeywords = mergeLockedKeywordsIntoTriggerKeywords(skill);
  editSkillForm.value = {
    skillId: skill.skillId,
    name: skill.name,
    description: skill.description,
    enabled: skill.enabled,
    triggerKeywords: mergedKeywords,
    tools: [...skill.tools],
    promptAddon: skill.promptAddon,
  };
  keywordInput.value = "";
  skillEditorVisible.value = true;
}

function closeSkillEditor() {
  skillEditorVisible.value = false;
  editingSkillIndex.value = -1;
}

function addKeyword() {
  const word = keywordInput.value.trim();
  if (!word) return;
  if (editSkillForm.value.triggerKeywords.includes(word)) {
    appToast("关键词已存在");
    return;
  }
  const ownerSkillId = findKeywordOwnerSkillId(
    workingSkills.value,
    word,
    editSkillForm.value.skillId,
  );
  if (ownerSkillId) {
    const owner = workingSkills.value.find((s) => s.skillId === ownerSkillId);
    appToast(`「${word}」已在「${owner?.name ?? ownerSkillId}」中使用`);
    return;
  }
  editSkillForm.value.triggerKeywords.push(word);
  keywordInput.value = "";
}

function removeKeyword(word: string) {
  if (isLockedKeyword(editSkillForm.value.skillId, word)) {
    appToast("子意图关键词不可移除");
    return;
  }
  editSkillForm.value.triggerKeywords =
    editSkillForm.value.triggerKeywords.filter((item) => item !== word);
}

function buildSkillDraftFromEditor(): AssistantSkillConfig | null {
  if (editingSkillIndex.value < 0) return null;
  const current = workingSkills.value[editingSkillIndex.value];
  return {
    ...current,
    name: editSkillForm.value.name.trim() || current.name,
    description: editSkillForm.value.description.trim(),
    enabled: editSkillForm.value.enabled,
    triggerKeywords: mergeLockedKeywordsIntoTriggerKeywords({
      skillId: editSkillForm.value.skillId,
      triggerKeywords: [...editSkillForm.value.triggerKeywords],
    }),
    tools: [...editSkillForm.value.tools],
    promptAddon: editSkillForm.value.promptAddon,
  };
}

async function confirmSkillEditor() {
  const draft = buildSkillDraftFromEditor();
  if (!draft || editingSkillIndex.value < 0) return;

  const nextSkills = normalizeSkillsTriggerKeywords(
    workingSkills.value.map((skill, index) =>
      index === editingSkillIndex.value ? draft : skill,
    ),
  );
  const validation = validateSkillTriggerKeywords(nextSkills);
  if (!validation.ok) {
    await showConfirmDialog({
      title: "触发关键词校验未通过",
      message: formatSkillKeywordValidationErrors(validation, nextSkills),
      showCancelButton: false,
    });
    return;
  }

  workingSkills.value[editingSkillIndex.value] = draft;
  closeSkillEditor();
  appToast("Skill 已更新到待保存列表");
}

function onToggleSkillEnabled(index: number, enabled: boolean) {
  workingSkills.value[index] = { ...workingSkills.value[index], enabled };
}

function openEntryEditor(index: number) {
  editingEntryIndex.value = index;
  const entry = workingEntries.value[index];
  const rule = entry.rules[0];
  editEntryForm.value = {
    entryId: entry.entryId,
    title: entry.title,
    icon: entry.icon,
    enabled: entry.enabled !== false,
    priority: entry.priority,
    target: entry.target,
    targetPath: entry.targetPath ?? "",
    skillId: entry.skillId ?? "",
    promptHint: entry.promptHint ?? "",
    ruleField:
      rule && rule.op === "eq" ? String(rule.field) : "personaId",
    ruleValue:
      rule && rule.op === "eq"
        ? (rule.value as string | boolean)
        : "demo_new",
  };
  entryEditorVisible.value = true;
}

function closeEntryEditor() {
  entryEditorVisible.value = false;
  editingEntryIndex.value = -1;
}

function confirmEntryEditor() {
  if (editingEntryIndex.value < 0) return;
  const current = workingEntries.value[editingEntryIndex.value];
  workingEntries.value[editingEntryIndex.value] = {
    ...current,
    title: editEntryForm.value.title.trim() || current.title,
    icon: editEntryForm.value.icon.trim() || current.icon,
    enabled: editEntryForm.value.enabled,
    priority: Number(editEntryForm.value.priority) || current.priority,
    target: editEntryForm.value.target,
    targetPath: editEntryForm.value.targetPath.trim() || undefined,
    skillId: editEntryForm.value.skillId.trim() || undefined,
    promptHint: editEntryForm.value.promptHint.trim() || undefined,
    rules: [buildEntryRule()],
  };
  closeEntryEditor();
  appToast("入口已更新到待保存列表");
}

function onToggleEntryEnabled(index: number, enabled: boolean) {
  workingEntries.value[index] = {
    ...workingEntries.value[index],
    enabled,
  };
}

function openQuestionEditor(flatIndex: number) {
  editingQuestionFlatIndex.value = flatIndex;
  const question = workingQuestions.value[flatIndex];
  editQuestionForm.value = {
    id: question.id,
    personaId: question.personaId,
    text: question.text,
    desc: question.desc ?? "",
    prompt: question.prompt,
    icon: question.icon,
    badgeColor: question.badgeColor ?? "#54c783",
    enabled: question.enabled !== false,
    priority: question.priority ?? 10,
  };
  questionEditorVisible.value = true;
}

function closeQuestionEditor() {
  questionEditorVisible.value = false;
  editingQuestionFlatIndex.value = -1;
}

function applyFlatQuestions(nextFlat: ReturnType<typeof flattenWelcomeQuestions>) {
  workingWelcomeTemplates.value = unflattenWelcomeQuestions(
    workingWelcomeTemplates.value,
    nextFlat,
  );
}

function confirmQuestionEditor() {
  if (editingQuestionFlatIndex.value < 0) return;
  const current = workingQuestions.value[editingQuestionFlatIndex.value];
  const nextFlat = workingQuestions.value.map((item, index) =>
    index === editingQuestionFlatIndex.value
      ? {
          ...current,
          id: editQuestionForm.value.id.trim() || current.id,
          personaId: editQuestionForm.value.personaId,
          text: editQuestionForm.value.text.trim() || current.text,
          desc: editQuestionForm.value.desc.trim() || undefined,
          prompt: editQuestionForm.value.prompt.trim() || current.prompt,
          icon: editQuestionForm.value.icon.trim() || current.icon,
          badgeColor: editQuestionForm.value.badgeColor.trim() || current.badgeColor,
          enabled: editQuestionForm.value.enabled,
          priority: Number(editQuestionForm.value.priority) || current.priority || 0,
        }
      : item,
  );
  applyFlatQuestions(nextFlat);
  closeQuestionEditor();
  appToast("游游推荐已更新到待保存列表");
}

function onToggleQuestionEnabled(flatIndex: number, enabled: boolean) {
  const nextFlat = workingQuestions.value.map((item, index) =>
    index === flatIndex ? { ...item, enabled } : item,
  );
  applyFlatQuestions(nextFlat);
}

function pickQuestionIcon(icon: string) {
  editQuestionForm.value.icon = icon;
  questionIconPickerVisible.value = false;
}

function pickIcon(icon: string) {
  editEntryForm.value.icon = icon;
  iconPickerVisible.value = false;
}

function onPickQuestionIconAction(action: { name: string }) {
  pickQuestionIcon(action.name);
}

function onPickIconAction(action: { name: string }) {
  pickIcon(action.name);
}

async function persistAll(successMessage = "已保存") {
  workingSkills.value = normalizeSkillsTriggerKeywords(workingSkills.value);
  const validation = validateSkillTriggerKeywords(workingSkills.value);
  if (!validation.ok) {
    await showConfirmDialog({
      title: "触发关键词校验未通过",
      message: formatSkillKeywordValidationErrors(validation, workingSkills.value),
      showCancelButton: false,
    });
    return;
  }

  businessConfigStore.saveSkillsOverride(cloneSkills(workingSkills.value));
  businessConfigStore.saveRecommendEntriesOverride(
    cloneEntries(workingEntries.value)
  );
  businessConfigStore.saveWelcomeTemplatesOverride(
    cloneWelcomeTemplates(workingWelcomeTemplates.value),
  );
  await skillStore.loadSkills(true);
  appToast(successMessage);
}

async function onSave() {
  await persistAll("已保存，聊天页将使用新配置");
}

async function onReset() {
  await showConfirmDialog({
    title: "恢复默认配置？",
    message: "将清除本地 Skill、快捷服务与游游推荐覆盖并读取 JSON 默认项",
  });
  businessConfigStore.clearAdminPatch();
  await Promise.all([
    skillStore.loadSkills(true),
    businessConfigStore.loadWelcomeTemplates(true),
  ]);
  workingSkills.value = normalizeSkillsTriggerKeywords(
    cloneSkills(businessConfigStore.skills),
  );
  workingEntries.value = cloneEntries(businessConfigStore.recommendEntries);
  workingWelcomeTemplates.value = cloneWelcomeTemplates(
    businessConfigStore.welcomeTemplates,
  );
  appToast("已恢复默认");
}

async function onClearDemoData() {
  await showConfirmDialog({
    title: "清除演示信息？",
    message:
      "将重置全部演示账号的优惠券、订单、订单草稿、绑定车牌（Mock），并清除小票上传记录。不含聊天记录与上方 Skill/入口配置。",
  });
  try {
    const { data: res } = await resetDemoBusinessData();
    if (res.code !== 200) {
      appToast(res.message || "清除失败");
      return;
    }
    clearDemoClientStorage();
    appToast("演示业务数据已清除");
  } catch {
    appToast("清除失败，请确认开发服务已启动");
  }
}

function goPreviewChat() {
  persistAll("已保存，正在打开聊天页…").then(() => {
    setTimeout(() => router.push("/chat"), 400);
  });
}
</script>

<template>
  <div class="admin-ui" :style="themeVars">
    <van-notice-bar
      left-icon="info-o"
      text="演示版：配置保存在浏览器 LocalStorage；右上角「AI 客服 H5」直接预览，未保存的修改不会生效"
    />

    <van-tabs v-model:active="activeTab" class="admin-business__tabs">
      <van-tab title="Skill 场景" name="skill">
        <section class="admin-ui__block">
          <p class="admin-ui__block-title">
            Skill 场景（{{ workingSkills.length }}）
          </p>
          <div class="admin-ui__panel admin-ui__panel--card">
            <van-cell
              v-for="(skill, index) in workingSkills"
              :key="skill.skillId"
              :title="skill.name"
              :label="`${skill.skillId} · ${skillStatusLabel(skill)}`"
              is-link
              @click="openSkillEditor(index)"
            >
              <template #value>
                <van-switch
                  :model-value="skill.enabled"
                  size="20px"
                  @click.stop
                  @update:model-value="onToggleSkillEnabled(index, $event)"
                />
              </template>
            </van-cell>
          </div>
        </section>

        <section class="admin-ui__block">
          <p class="admin-ui__block-title">卡片展示配置（只读）</p>
          <div class="admin-ui__panel admin-ui__panel--card">
            <van-cell
              v-for="view in businessConfigStore.cardViews"
              :key="view.cardType"
              :title="view.label"
              :label="`${view.cardType} · 最多 ${view.maxItems ?? '-'} 条`"
            />
          </div>
        </section>
      </van-tab>

      <van-tab title="欢迎页入口" name="entry">
        <section class="admin-ui__block">
          <p class="admin-ui__block-title">
            快捷服务（{{ workingEntries.length }}，展示最多 {{ MAX_QUICK_SERVICES }} 个）
          </p>
          <div class="admin-ui__panel admin-ui__panel--card">
            <van-cell
              v-for="(entry, index) in workingEntries"
              :key="entry.entryId"
              :title="entry.title"
              :label="`${entry.entryId} · 优先级 ${entry.priority} · ${entryRuleSummary(entry)}`"
              is-link
              @click="openEntryEditor(index)"
            >
              <template #value>
                <van-switch
                  :model-value="entry.enabled !== false"
                  size="20px"
                  @click.stop
                  @update:model-value="onToggleEntryEnabled(index, $event)"
                />
              </template>
            </van-cell>
          </div>
        </section>

        <section class="admin-ui__block">
          <p class="admin-ui__block-title">
            游游推荐（{{ workingQuestions.length }}，每账号最多 {{ MAX_WELCOME_RECOMMEND }} 条）
          </p>
          <div class="admin-ui__panel admin-ui__panel--card">
            <van-cell
              v-for="(question, index) in workingQuestions"
              :key="`${question.personaId}-${question.id}`"
              :title="question.text"
              :label="`${personaLabel(question.personaId)} · ${question.id} · 优先级 ${question.priority ?? 0}`"
              is-link
              @click="openQuestionEditor(index)"
            >
              <template #value>
                <van-switch
                  :model-value="question.enabled !== false"
                  size="20px"
                  @click.stop
                  @update:model-value="onToggleQuestionEnabled(index, $event)"
                />
              </template>
            </van-cell>
          </div>
        </section>

        <section class="admin-ui__block">
          <p class="admin-ui__block-title">规则预览（三个演示账号）</p>
          <p class="admin-business__hint admin-business__hint--block">
            同时展示各账号在当前配置下的命中结果，无需切换账号。
          </p>
          <div
            v-for="preview in personaPreviews"
            :key="preview.personaId"
            class="admin-ui__panel admin-ui__panel--card admin-business__preview admin-business__preview-panel"
          >
            <p class="admin-business__preview-persona">{{ preview.label }}</p>
            <p class="admin-business__hint admin-business__hint--ctx">
              {{ preview.contextSummary }}
            </p>
            <p class="admin-business__preview-label">
              快捷服务（按顺序，最多 {{ MAX_QUICK_SERVICES }} 个）
            </p>
            <van-cell
              v-for="entry in preview.quickServices"
              :key="entry.entryId"
              :title="entry.title"
              :label="`${entry.target}${entry.skillId ? ' · ' + entry.skillId : ''} · 优先级 ${entry.priority}`"
            />
            <van-empty
              v-if="!preview.quickServices.length"
              description="暂无快捷服务"
              image-size="56"
            />
            <p class="admin-business__preview-label">
              游游推荐（最多 {{ MAX_WELCOME_RECOMMEND }} 条）
            </p>
            <van-cell
              v-for="question in preview.welcomeRecommend"
              :key="`${preview.personaId}-${question.id}`"
              :title="question.text"
              :label="question.desc || question.prompt"
            />
            <van-empty
              v-if="!preview.welcomeRecommend.length"
              description="暂无游游推荐"
              image-size="56"
            />
            <p
              v-if="preview.unmatched.length"
              class="admin-business__preview-label admin-business__preview-label--muted"
            >
              未命中（已启用）
            </p>
            <van-cell
              v-for="entry in preview.unmatched"
              :key="'u-' + preview.personaId + '-' + entry.entryId"
              :title="entry.title"
              :label="entryRuleSummary(entry)"
              class="admin-business__unmatched"
            />
          </div>
        </section>

        <section class="admin-ui__block">
          <p class="admin-ui__block-title">规则字段目录（只读）</p>
          <div class="admin-ui__panel admin-ui__panel--card">
            <van-cell
              v-for="field in ruleEligibleFields"
              :key="field.fieldId"
              :title="field.label"
              :label="`${field.fieldId} · ${field.valueType}`"
            />
          </div>
        </section>
      </van-tab>
    </van-tabs>

    <div class="admin-ui__actions">
      <button
        type="button"
        class="admin-ui__btn admin-ui__btn--primary"
        @click="onSave"
      >
        保存配置
      </button>
      <button
        type="button"
        class="admin-ui__btn admin-ui__btn--light"
        @click="goPreviewChat"
      >
        保存并预览聊天页
      </button>
      <button
        type="button"
        class="admin-ui__btn admin-ui__btn--outline"
        @click="onReset"
      >
        恢复 JSON 默认
      </button>
      <button
        type="button"
        class="admin-ui__btn admin-ui__btn--warn"
        @click="onClearDemoData"
      >
        清除演示信息
      </button>
    </div>

    <!-- Skill 编辑 -->
    <van-popup
      v-model:show="skillEditorVisible"
      position="bottom"
      round
      :style="{ height: '88%' }"
    >
      <div class="admin-business__editor">
        <header class="admin-business__editor-head">
          <span>{{ editSkillForm.name || "编辑 Skill" }}</span>
          <van-button size="small" type="primary" round @click="confirmSkillEditor">
            确定
          </van-button>
        </header>
        <div class="admin-business__editor-body">
          <van-field v-model="editSkillForm.name" label="名称" />
          <van-field
            v-model="editSkillForm.description"
            label="描述"
            type="textarea"
            rows="2"
            autosize
          />
          <van-cell title="启用">
            <template #value>
              <van-switch v-model="editSkillForm.enabled" size="20px" />
            </template>
          </van-cell>
          <div v-if="editSkillSubIntents.length" class="admin-business__section">
            <p class="admin-business__section-title">子意图（Workflow 分流 · 只读）</p>
            <p class="admin-business__hint admin-business__hint--section">
              子意图识别关键词自动并入下方触发词，且不可删除。修改子意图请改代码目录
              skill_intent_catalog.json。
            </p>
            <div
              v-for="intent in editSkillSubIntents"
              :key="intent.intentId"
              class="admin-business__sub-intent"
            >
              <p class="admin-business__sub-intent-label">{{ intent.label }}</p>
              <p v-if="intent.description" class="admin-business__sub-intent-desc">
                {{ intent.description }}
              </p>
              <div class="admin-business__tags admin-business__tags--nested">
                <van-tag
                  v-for="word in intent.keywords"
                  :key="`${intent.intentId}-${word}`"
                  type="primary"
                  plain
                  size="medium"
                  class="admin-business__tag--locked"
                >
                  🔒 {{ word }}
                </van-tag>
              </div>
            </div>
          </div>
          <div class="admin-business__section">
            <p class="admin-business__section-title">触发关键词</p>
            <p class="admin-business__hint admin-business__hint--section">
              须包含全部子意图词；扩展词在全站 Skill 间不可重复。
            </p>
            <div v-if="editSkillLockedKeywordSet.size" class="admin-business__keyword-group">
              <p class="admin-business__keyword-group-label">子意图必选</p>
              <div class="admin-business__tags">
                <van-tag
                  v-for="word in editSkillForm.triggerKeywords.filter((w) =>
                    editSkillLockedKeywordSet.has(w),
                  )"
                  :key="`locked-${word}`"
                  type="primary"
                  size="medium"
                  class="admin-business__tag--locked"
                >
                  🔒 {{ word }}
                </van-tag>
              </div>
            </div>
            <div class="admin-business__keyword-group">
              <p class="admin-business__keyword-group-label">Skill 扩展</p>
              <div class="admin-business__tags">
                <van-tag
                  v-for="word in editSkillExtensionKeywords"
                  :key="word"
                  closeable
                  type="success"
                  size="medium"
                  @close="removeKeyword(word)"
                >
                  {{ word }}
                </van-tag>
                <span
                  v-if="!editSkillExtensionKeywords.length"
                  class="admin-business__keyword-empty"
                >
                  暂无扩展词
                </span>
              </div>
            </div>
            <div class="admin-business__keyword-row">
              <van-field
                v-model="keywordInput"
                placeholder="输入关键词后点添加"
                @keyup.enter="addKeyword"
              />
              <van-button size="small" type="primary" @click="addKeyword">
                添加
              </van-button>
            </div>
          </div>
          <div class="admin-business__section">
            <p class="admin-business__section-title">绑定工具</p>
            <van-checkbox-group v-model="editSkillForm.tools">
              <van-cell
                v-for="tool in toolOptions"
                :key="tool.name"
                :title="tool.label"
                :label="tool.name"
                clickable
                @click="
                  editSkillForm.tools = editSkillForm.tools.includes(tool.name)
                    ? editSkillForm.tools.filter((n) => n !== tool.name)
                    : [...editSkillForm.tools, tool.name]
                "
              >
                <template #right-icon>
                  <van-checkbox :name="tool.name" @click.stop />
                </template>
              </van-cell>
            </van-checkbox-group>
          </div>
          <div class="admin-business__section">
            <p class="admin-business__section-title">场景专属指令</p>
            <van-field
              v-model="editSkillForm.promptAddon"
              type="textarea"
              rows="5"
              autosize
              maxlength="800"
              show-word-limit
            />
          </div>
        </div>
      </div>
    </van-popup>

    <!-- 入口编辑 -->
    <van-popup
      v-model:show="entryEditorVisible"
      position="bottom"
      round
      :style="{ height: '92%' }"
    >
      <div class="admin-business__editor">
        <header class="admin-business__editor-head">
          <span>{{ editEntryForm.title || "编辑入口" }}</span>
          <van-button size="small" type="primary" round @click="confirmEntryEditor">
            确定
          </van-button>
        </header>
        <div class="admin-business__editor-body">
          <van-field v-model="editEntryForm.title" label="标题" />
          <van-field
            v-model="editEntryForm.priority"
            label="优先级"
            type="digit"
            placeholder="数字越大越靠前"
          />
          <van-cell title="启用">
            <template #value>
              <van-switch v-model="editEntryForm.enabled" size="20px" />
            </template>
          </van-cell>

          <div class="admin-business__section">
            <p class="admin-business__section-title">图标</p>
            <van-cell
              title="当前图标"
              :value="editEntryForm.icon"
              is-link
              @click="iconPickerVisible = true"
            />
            <van-field
              v-model="editEntryForm.icon"
              label="手动输入"
              placeholder="Vant 图标名，如 location-o"
            />
          </div>

          <div class="admin-business__section">
            <p class="admin-business__section-title">跳转配置</p>
            <van-cell title="目标类型">
              <template #value>
                <select v-model="editEntryForm.target" class="admin-business__select">
                  <option
                    v-for="opt in TARGET_OPTIONS"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </option>
                </select>
              </template>
            </van-cell>
            <van-field
              v-if="editEntryForm.target === 'page' || editEntryForm.target === 'h5'"
              v-model="editEntryForm.targetPath"
              label="页面路径"
              placeholder="/orders"
            />
            <van-cell v-if="editEntryForm.target === 'chat'" title="关联 Skill">
              <template #value>
                <select v-model="editEntryForm.skillId" class="admin-business__select">
                  <option value="">不关联</option>
                  <option
                    v-for="opt in skillOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </option>
                </select>
              </template>
            </van-cell>
            <van-field
              v-if="editEntryForm.target === 'chat'"
              v-model="editEntryForm.promptHint"
              label="对话提示语"
              type="textarea"
              rows="2"
              autosize
            />
          </div>

          <div class="admin-business__section">
            <p class="admin-business__section-title">触发规则（单条 eq）</p>
            <van-cell title="条件字段">
              <template #value>
                <select
                  v-model="editEntryForm.ruleField"
                  class="admin-business__select"
                >
                  <option
                    v-for="field in ruleEligibleFields"
                    :key="field.fieldId"
                    :value="field.fieldId"
                  >
                    {{ field.label }}
                  </option>
                </select>
              </template>
            </van-cell>
            <van-cell
              v-if="selectedRuleFieldMeta?.valueType === 'boolean'"
              title="条件值"
            >
              <template #value>
                <van-switch
                  :model-value="editEntryForm.ruleValue === true"
                  size="20px"
                  @update:model-value="editEntryForm.ruleValue = $event"
                />
              </template>
            </van-cell>
            <van-cell
              v-else-if="selectedRuleFieldMeta?.valueType === 'enum'"
              title="条件值"
            >
              <template #value>
                <select v-model="editEntryForm.ruleValue" class="admin-business__select">
                  <option
                    v-for="opt in selectedRuleFieldMeta.enumOptions ?? []"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </option>
                </select>
              </template>
            </van-cell>
            <van-field
              v-else
              :model-value="String(editEntryForm.ruleValue ?? '')"
              label="条件值"
              @update:model-value="editEntryForm.ruleValue = $event"
            />
          </div>
        </div>
      </div>
    </van-popup>

    <!-- 游游推荐编辑 -->
    <van-popup
      v-model:show="questionEditorVisible"
      position="bottom"
      round
      :style="{ height: '88%' }"
    >
      <div class="admin-business__editor">
        <header class="admin-business__editor-head">
          <span>{{ editQuestionForm.text || "编辑游游推荐" }}</span>
          <van-button size="small" type="primary" round @click="confirmQuestionEditor">
            确定
          </van-button>
        </header>
        <div class="admin-business__editor-body">
          <van-field v-model="editQuestionForm.text" label="卡片标题" />
          <van-field
            v-model="editQuestionForm.desc"
            label="卡片副标题"
            placeholder="如：首次入园游客最常咨询的问题"
          />
          <van-field
            v-model="editQuestionForm.prompt"
            label="点击 prompt"
            type="textarea"
            rows="3"
            autosize
          />
          <van-field
            v-model="editQuestionForm.priority"
            label="优先级"
            type="digit"
            placeholder="数字越大越靠前"
          />
          <van-cell title="启用">
            <template #value>
              <van-switch v-model="editQuestionForm.enabled" size="20px" />
            </template>
          </van-cell>
          <van-cell title="演示账号">
            <template #value>
              <select v-model="editQuestionForm.personaId" class="admin-business__select">
                <option
                  v-for="opt in DEMO_PERSONA_OPTIONS"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>
            </template>
          </van-cell>
          <van-field v-model="editQuestionForm.id" label="条目 ID" readonly />
          <div class="admin-business__section">
            <p class="admin-business__section-title">图标（emoji）</p>
            <van-cell
              title="当前图标"
              :value="editQuestionForm.icon"
              is-link
              @click="questionIconPickerVisible = true"
            />
            <van-field
              v-model="editQuestionForm.icon"
              label="手动输入"
              placeholder="如 🎢"
            />
          </div>
          <div class="admin-business__section">
            <p class="admin-business__section-title">序号圆点颜色</p>
            <div class="admin-business__color-row">
              <button
                v-for="color in BADGE_COLOR_PRESETS"
                :key="color"
                type="button"
                class="admin-business__color-swatch"
                :class="{ 'admin-business__color-swatch--active': editQuestionForm.badgeColor === color }"
                :style="{ background: color }"
                @click="editQuestionForm.badgeColor = color"
              />
            </div>
            <van-field v-model="editQuestionForm.badgeColor" label="色值" placeholder="#54c783" />
          </div>
        </div>
      </div>
    </van-popup>

    <van-action-sheet
      v-model:show="iconPickerVisible"
      title="选择图标"
      :actions="ENTRY_ICON_PRESETS.map((name) => ({ name, color: primaryColor }))"
      @select="onPickIconAction"
    />
    <van-action-sheet
      v-model:show="questionIconPickerVisible"
      title="选择 emoji 图标"
      :actions="QUESTION_ICON_PRESETS.map((name) => ({ name }))"
      @select="onPickQuestionIconAction"
    />
  </div>
</template>

<style scoped>
.admin-ui {
  min-height: 100%;
  padding-bottom: 32px;
  background: #f5f6f8;
}

.admin-business__tabs :deep(.van-tabs__wrap) {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.admin-ui__block {
  margin: 12px 16px 10px;
}

.admin-ui__block-title {
  margin: 14px 0 10px;
  padding-left: 4px;
  font-size: 16px;
  font-weight: 600;
  color: #646566;
  line-height: 1.4;
}

.admin-ui__panel {
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.08);
}

.admin-ui__panel--card {
  background: #fff;
}

.admin-ui__panel--card :deep(.van-cell),
.admin-ui__panel--card :deep(.van-field) {
  font-size: 14px;
  line-height: 1.5;
  background: #fff;
}

.admin-business__hint {
  margin: 0;
  padding: 12px 16px 4px;
  font-size: 12px;
  color: #969799;
  line-height: 1.5;
}

.admin-business__hint--block {
  padding: 0 4px 8px;
}

.admin-business__preview-panel {
  margin-bottom: 12px;
}

.admin-business__preview-panel:last-child {
  margin-bottom: 0;
}

.admin-business__preview-persona {
  margin: 0;
  padding: 14px 16px 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--admin-primary, #07c160);
  border-bottom: 1px solid #f0f1f3;
}

.admin-business__hint--ctx {
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f1f3;
}

.admin-business__preview-label {
  margin: 12px 16px 4px;
  font-size: 13px;
  font-weight: 600;
  color: #323233;
}

.admin-business__preview-label--muted {
  color: #969799;
  margin-top: 16px;
}

.admin-business__unmatched :deep(.van-cell__title) {
  color: #969799;
}

.admin-business__select {
  max-width: 160px;
  padding: 4px 8px;
  font-size: 13px;
  border: 1px solid #ebedf0;
  border-radius: 6px;
  background: #fff;
  color: #323233;
}

.admin-ui__actions {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-ui__btn {
  display: block;
  width: 100%;
  height: 36px;
  padding: 0 16px;
  border: none;
  border-radius: 19px;
  font-size: 14px;
  font-weight: 500;
  line-height: 36px;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.09);
}

.admin-ui__btn:active {
  opacity: 0.88;
}

.admin-ui__btn--primary {
  background: var(--admin-primary);
  color: #fff;
}

.admin-ui__btn--light {
  background: var(--admin-primary-light, #e8f8ef);
  color: var(--admin-primary);
  border: 1px solid var(--admin-primary);
}

.admin-ui__btn--outline {
  background: #fff;
  color: #646566;
  border: 1px solid #dcdee0;
}

.admin-ui__btn--warn {
  background: #fff;
  color: #ee0a24;
  border: 1px solid #ee0a24;
}

.admin-business__editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f5f6f8;
}

.admin-business__editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  font-size: 16px;
  font-weight: 600;
  background: #fff;
  border-bottom: 1px solid #ebedf0;
}

.admin-business__editor-body {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 24px;
}

.admin-business__section {
  margin-top: 10px;
  background: #fff;
  border-radius: 14px;
  margin-left: 12px;
  margin-right: 12px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.admin-business__hint--section {
  padding: 0 16px 8px;
  margin: 0;
}

.admin-business__sub-intent {
  padding: 0 16px 12px;
  border-bottom: 1px dashed #ebedf0;
}

.admin-business__sub-intent:last-child {
  border-bottom: none;
  padding-bottom: 14px;
}

.admin-business__sub-intent-label {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 600;
  color: #323233;
}

.admin-business__sub-intent-desc {
  margin: 0 0 6px;
  font-size: 12px;
  color: #969799;
  line-height: 1.45;
}

.admin-business__tags--nested {
  padding: 0;
}

.admin-business__tag--locked {
  opacity: 0.92;
}

.admin-business__keyword-group {
  padding: 0 16px 10px;
}

.admin-business__keyword-group-label {
  margin: 0 0 6px;
  font-size: 12px;
  color: #969799;
}

.admin-business__keyword-empty {
  font-size: 12px;
  color: #c8c9cc;
}

.admin-business__section-title {
  margin: 0;
  padding: 12px 16px 8px;
  font-size: 14px;
  font-weight: 600;
  color: #646566;
}

.admin-business__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 16px 10px;
}

.admin-business__keyword-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px 12px;
}

.admin-business__keyword-row :deep(.van-field) {
  flex: 1;
  padding: 8px 12px;
  background: #f7f8fa;
  border-radius: 8px;
}

.admin-business__color-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 0 16px 10px;
}

.admin-business__color-swatch {
  width: 28px;
  height: 28px;
  border: 2px solid transparent;
  border-radius: 50%;
}

.admin-business__color-swatch--active {
  border-color: #323233;
  box-shadow: 0 0 0 2px #fff inset;
}
</style>

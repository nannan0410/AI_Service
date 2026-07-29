<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { showConfirmDialog } from "vant";
import { appToast } from "@/utils/toast";
import { useAssistantStore } from "@/store/assistantStore";
import { useBusinessConfigStore } from "@/store/businessConfigStore";
import { useSkillStore } from "@/store/skillStore";
import { toolRegistry } from "@/ai/tools";
import { STAGE2_SKILL_IDS } from "@/ai/skills/utils";
import {
  buildDemoCouponFilterCtx,
  buildDemoRuleContext,
  DEMO_PERSONA_OPTIONS,
} from "@/utils/demoRuleContext";
import { previewRecommendEntries } from "@/utils/recommendEntries";
import { useScenicStore } from "@/store/scenicStore";
import ScenicPickerSheet from "@/components/scenic/ScenicPickerSheet.vue";
import {
  cloneWelcomeQuestions,
  cloneWelcomeTemplates,
  findQuestionIndex,
  resolveSuggestedQuestions,
} from "@/utils/welcomeQuestions";
import { MAX_QUICK_SERVICES, MAX_WELCOME_RECOMMEND } from "@/utils/welcomeLayout";
import { postDemoOps, resetDemoBusinessData, type DemoOpsAction } from "@/api/business";
import { clearDemoClientStorage } from "@/utils/demoReset";
import { useAuthStore } from "@/store/authStore";
import { matchesScenicScope } from "@/utils/scenicScope";
import type { AssistantSkillConfig, PersonaId, RecommendEntry } from "@/types";
import type {
  FieldCatalogItem,
  RecommendEntryConfig,
  RuleExpression,
  SkillSubIntentDef,
  WelcomeQuestionConfig,
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
import { listIntentExclusionRules } from "@/utils/intentExclusionCatalog";

const router = useRouter();
const assistantStore = useAssistantStore();
const businessConfigStore = useBusinessConfigStore();
const skillStore = useSkillStore();
const authStore = useAuthStore();
const scenicStore = useScenicStore();

const currentPersonaLabel = computed(() => {
  const id = authStore.personaId;
  if (!id) return "未登录";
  return DEMO_PERSONA_OPTIONS.find((item) => item.value === id)?.label ?? id;
});

const previewScenicId = computed(
  () => scenicStore.currentScenicId ?? scenicStore.enabledScenics[0]?.scenicId ?? null,
);

const previewScenicName = computed(
  () =>
    scenicStore.currentScenicName ||
    scenicStore.enabledScenics.find((s) => s.scenicId === previewScenicId.value)?.name ||
    "未选景区",
);

const previewCityName = computed(() => {
  const scenic = scenicStore.enabledScenics.find(
    (s) => s.scenicId === previewScenicId.value,
  );
  if (!scenic) return scenicStore.currentCityName || "";
  return (
    scenicStore.enabledCities.find((c) => c.cityId === scenic.cityId)?.name || ""
  );
});

const previewScenicLive = computed(() => ({
  scenicId: previewScenicId.value,
}));

const scenicPickerVisible = ref(false);
/** false：列表只显示当前预览景区相关项；true：显示全部 */
const listShowAllScenics = ref(false);

const activeTab = ref<"skill" | "entry">("skill");
/** 各 tab 下模块折叠：默认全部收起（空数组） */
const skillSectionOpen = ref<string[]>([]);
const entrySectionOpen = ref<string[]>([]);
const workingSkills = ref<AssistantSkillConfig[]>([]);
/** 路由排他规则（只读展示，不可编辑） */
const exclusionRules = listIntentExclusionRules();

function skillNameById(skillId: string) {
  return (
    workingSkills.value.find((s) => s.skillId === skillId)?.name ?? skillId
  );
}

function openRouteConflictCheck() {
  router.push("/config/route-check");
}
const workingEntries = ref<RecommendEntryConfig[]>([]);
const workingWelcomeTemplates = ref<WelcomeTemplateConfig[]>([]);
const workingQuestions = ref<WelcomeQuestionConfig[]>([]);

const skillEditorVisible = ref(false);
const entryEditorVisible = ref(false);
const questionEditorVisible = ref(false);
const editingSkillIndex = ref(-1);
const editingEntryIndex = ref(-1);
const editingQuestionIndex = ref(-1);
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
  /** 空 = 全景区通用 */
  scenicIds: [] as string[],
  ruleField: "personaId",
  /** eq 单值；boolean / enum / string */
  ruleValue: "demo_new" as string | boolean,
  /** personaId 多选时写入 in 规则 */
  rulePersonaValues: ["demo_new"] as string[],
  /** 附加 AND 条件（如：有待出行 且 非今日出行） */
  andRuleEnabled: false,
  andRuleField: "hasVisitToday",
  andRuleValue: false as boolean,
});

const editQuestionForm = ref({
  id: "",
  text: "",
  desc: "",
  prompt: "",
  icon: "",
  badgeColor: "#54c783",
  enabled: true,
  priority: 10,
  pinTop: false,
  target: "chat" as RecommendEntry["target"],
  targetPath: "",
  scenicIds: [] as string[],
  ruleField: "personaId",
  ruleValue: "demo_new" as string | boolean,
  rulePersonaValues: ["demo_new"] as string[],
  andRuleEnabled: false,
  andRuleField: "hasVisitToday",
  andRuleValue: false as boolean,
});

const BADGE_COLOR_PRESETS = ["#54c783", "#4aa3ff", "#ffb020", "#ff6b6b"];

/** 配置列表按优先级降序（与预览 / 聊天页一致） */
const sortedWorkingEntries = computed(() =>
  [...workingEntries.value].sort((a, b) => b.priority - a.priority),
);

const sortedWorkingQuestions = computed(() =>
  [...workingQuestions.value].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
  ),
);

const displayWorkingEntries = computed(() => {
  const sorted = sortedWorkingEntries.value;
  if (listShowAllScenics.value || !previewScenicId.value) return sorted;
  return sorted.filter((entry) => matchesScenicScope(entry, previewScenicId.value));
});

const displayWorkingQuestions = computed(() => {
  const sorted = sortedWorkingQuestions.value;
  if (listShowAllScenics.value || !previewScenicId.value) return sorted;
  return sorted.filter((question) =>
    matchesScenicScope(question, previewScenicId.value),
  );
});

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

const selectedQuestionRuleFieldMeta = computed((): FieldCatalogItem | undefined =>
  ruleEligibleFields.value.find((f) => f.fieldId === editQuestionForm.value.ruleField)
);

const andRuleFieldOptions = computed(() =>
  ruleEligibleFields.value.filter(
    (f) =>
      f.valueType === "boolean" && f.fieldId !== editEntryForm.value.ruleField,
  ),
);

const andQuestionRuleFieldOptions = computed(() =>
  ruleEligibleFields.value.filter(
    (f) =>
      f.valueType === "boolean" &&
      f.fieldId !== editQuestionForm.value.ruleField,
  ),
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
  const ctx = buildDemoRuleContext(personaId, previewScenicLive.value);
  return [
    `景区 ${ctx.scenicId || "未选"}`,
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
    const live = previewScenicLive.value;
    const { matched, unmatched } = previewRecommendEntries(
      workingEntries.value,
      opt.value,
      live,
    );
    return {
      personaId: opt.value,
      label: opt.label,
      contextSummary: buildContextSummary(opt.value),
      quickServices: matched.slice(0, MAX_QUICK_SERVICES),
      unmatched,
      welcomeRecommend: resolveSuggestedQuestions(
        workingQuestions.value,
        opt.value,
        buildDemoCouponFilterCtx(opt.value),
        {
          scenicId: live.scenicId,
          scenicName:
            scenicStore.enabledScenics.find((s) => s.scenicId === live.scenicId)?.name,
        },
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
  return entries
    .map((entry) => ({
      ...entry,
      scenicIds: entry.scenicIds ? [...entry.scenicIds] : undefined,
      rules: (entry.rules ?? []).map((rule) => {
        if (rule.op === "in") {
          return { op: "in" as const, field: rule.field, values: [...(rule.values ?? [])] };
        }
        if (rule.op === "and" || rule.op === "or") {
          return {
            op: rule.op,
            rules: rule.rules.map((child) => ({ ...child })),
          };
        }
        return { ...rule };
      }),
    }))
    .sort((a, b) => b.priority - a.priority);
}

function scenicNameById(scenicId: string) {
  return (
    scenicStore.enabledScenics.find((item) => item.scenicId === scenicId)?.name ??
    scenicId
  );
}

function allEnabledScenicIds(): string[] {
  return scenicStore.enabledScenics.map((s) => s.scenicId);
}

/** 配置项景区作用域摘要（无 scenicIds = 视为全部启用景区） */
function scenicScopeSummary(item: {
  scenicId?: string;
  scenicIds?: string[];
}) {
  if (item.scenicIds?.length) {
    return item.scenicIds.map(scenicNameById).join("、");
  }
  if (item.scenicId) return scenicNameById(item.scenicId);
  return allEnabledScenicIds().map(scenicNameById).join("、") || "全景区";
}

/** 编辑表单：缺省/全景区 → 默认勾选全部启用景区 */
function resolveItemScenicIds(item: {
  scenicId?: string;
  scenicIds?: string[];
}): string[] {
  if (item.scenicIds?.length) return [...item.scenicIds];
  if (item.scenicId) return [item.scenicId];
  return allEnabledScenicIds();
}

function toggleEntryScenicId(scenicId: string) {
  const current = editEntryForm.value.scenicIds;
  if (current.includes(scenicId)) {
    editEntryForm.value.scenicIds = current.filter((id) => id !== scenicId);
  } else {
    editEntryForm.value.scenicIds = [...current, scenicId];
  }
}

function toggleQuestionScenicId(scenicId: string) {
  const current = editQuestionForm.value.scenicIds;
  if (current.includes(scenicId)) {
    editQuestionForm.value.scenicIds = current.filter((id) => id !== scenicId);
  } else {
    editQuestionForm.value.scenicIds = [...current, scenicId];
  }
}

function onConfigScenicPicked(scenicId: string) {
  scenicStore.selectScenic(scenicId);
  scenicPickerVisible.value = false;
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

function formatSingleRuleSummary(rule: RuleExpression): string {
  if (rule.op === "eq") {
    const fieldMeta = ruleEligibleFields.value.find((f) => f.fieldId === rule.field);
    const fieldLabel = fieldMeta?.label ?? rule.field;
    if (typeof rule.value === "boolean") {
      return `${fieldLabel} = ${rule.value ? "是" : "否"}`;
    }
    if (rule.field === "personaId") {
      return `${fieldLabel} = ${personaLabel(rule.value as PersonaId)}`;
    }
    return `${fieldLabel} = ${String(rule.value)}`;
  }
  if (rule.op === "in") {
    const fieldMeta = ruleEligibleFields.value.find((f) => f.fieldId === rule.field);
    const fieldLabel = fieldMeta?.label ?? rule.field;
    const values = rule.values ?? [];
    if (rule.field === "personaId") {
      return `${fieldLabel} ∈ ${values.map((v) => personaLabel(v as PersonaId)).join("、")}`;
    }
    return `${fieldLabel} ∈ ${values.map(String).join("、")}`;
  }
  if (rule.op === "and" || rule.op === "or") {
    const joiner = rule.op === "and" ? " 且 " : " 或 ";
    return (rule.rules ?? []).map(formatSingleRuleSummary).join(joiner);
  }
  return "复杂规则";
}

function entryRuleSummary(
  entry: Pick<RecommendEntryConfig | WelcomeQuestionConfig, "rules">,
) {
  const rules = entry.rules ?? [];
  if (!rules.length) return "无规则（始终展示）";
  return rules.map(formatSingleRuleSummary).join(" 且 ");
}

function questionRuleSummary(question: WelcomeQuestionConfig) {
  return entryRuleSummary(question);
}

function defaultRuleValueForField(fieldId: string): string | boolean {
  const meta = ruleEligibleFields.value.find((f) => f.fieldId === fieldId);
  if (!meta) return "";
  if (meta.valueType === "boolean") return true;
  if (meta.valueType === "enum" && meta.enumOptions?.length) {
    return meta.enumOptions[0].value;
  }
  return "";
}

/** 仅在用户切换字段时重置条件值，避免打开编辑器时覆盖已有规则 */
function onRuleFieldChange(fieldId: string) {
  editEntryForm.value.ruleField = fieldId;
  const next = defaultRuleValueForField(fieldId);
  editEntryForm.value.ruleValue = next;
  if (fieldId === "personaId") {
    editEntryForm.value.rulePersonaValues = [
      typeof next === "string" ? next : "demo_new",
    ];
  } else {
    editEntryForm.value.rulePersonaValues = [];
  }
}

function onQuestionRuleFieldChange(fieldId: string) {
  editQuestionForm.value.ruleField = fieldId;
  const next = defaultRuleValueForField(fieldId);
  editQuestionForm.value.ruleValue = next;
  if (fieldId === "personaId") {
    editQuestionForm.value.rulePersonaValues = [
      typeof next === "string" ? next : "demo_new",
    ];
  } else {
    editQuestionForm.value.rulePersonaValues = [];
  }
}

function buildRuleFromForm(form: {
  ruleField: string;
  ruleValue: string | boolean;
  rulePersonaValues: string[];
}): RuleExpression {
  const { ruleField, ruleValue, rulePersonaValues } = form;
  if (ruleField === "personaId") {
    const values = rulePersonaValues.length
      ? [...rulePersonaValues]
      : [typeof ruleValue === "string" ? ruleValue : "demo_new"];
    if (values.length > 1) {
      return { op: "in", field: "personaId", values };
    }
    return { op: "eq", field: "personaId", value: values[0] };
  }
  return { op: "eq", field: ruleField, value: ruleValue };
}

function buildRulesFromForm(form: {
  ruleField: string;
  ruleValue: string | boolean;
  rulePersonaValues: string[];
  andRuleEnabled: boolean;
  andRuleField: string;
  andRuleValue: boolean;
}): RuleExpression[] {
  const primary = buildRuleFromForm(form);
  if (
    !form.andRuleEnabled ||
    !form.andRuleField ||
    form.andRuleField === form.ruleField
  ) {
    return [primary];
  }
  return [
    primary,
    { op: "eq", field: form.andRuleField, value: form.andRuleValue },
  ];
}

function buildEntryRules(): RuleExpression[] {
  return buildRulesFromForm(editEntryForm.value);
}

function buildQuestionRules(): RuleExpression[] {
  return buildRulesFromForm(editQuestionForm.value);
}

function togglePersonaRuleValue(personaId: string) {
  const current = editEntryForm.value.rulePersonaValues;
  if (current.includes(personaId)) {
    if (current.length <= 1) return;
    editEntryForm.value.rulePersonaValues = current.filter((id) => id !== personaId);
  } else {
    editEntryForm.value.rulePersonaValues = [...current, personaId];
  }
}

function toggleQuestionPersonaRuleValue(personaId: string) {
  const current = editQuestionForm.value.rulePersonaValues;
  if (current.includes(personaId)) {
    if (current.length <= 1) return;
    editQuestionForm.value.rulePersonaValues = current.filter(
      (id) => id !== personaId,
    );
  } else {
    editQuestionForm.value.rulePersonaValues = [...current, personaId];
  }
}

function flattenSimpleRules(rules: RuleExpression[] | undefined): RuleExpression[] {
  const out: RuleExpression[] = [];
  for (const rule of rules ?? []) {
    if (rule.op === "and") {
      out.push(...flattenSimpleRules(rule.rules));
    } else {
      out.push(rule);
    }
  }
  return out;
}

function parseRuleIntoForm(rules: RuleExpression[] | undefined): {
  ruleField: string;
  ruleValue: string | boolean;
  rulePersonaValues: string[];
  andRuleEnabled: boolean;
  andRuleField: string;
  andRuleValue: boolean;
} {
  const flat = flattenSimpleRules(rules);
  const rule = flat[0];
  const andRule = flat[1];
  const allPersonaIds = DEMO_PERSONA_OPTIONS.map((item) => item.value);
  let ruleField = "personaId";
  let ruleValue: string | boolean = "demo_new";
  /** 无规则 = 始终展示：编辑器勾选全部演示账号，避免误显示成「仅新客」 */
  let rulePersonaValues: string[] = [...allPersonaIds];
  let andRuleEnabled = false;
  let andRuleField = "hasVisitToday";
  let andRuleValue = false;

  if (rule?.op === "eq") {
    ruleField = String(rule.field);
    ruleValue = rule.value as string | boolean;
    if (ruleField === "personaId" && typeof ruleValue === "string") {
      rulePersonaValues = [ruleValue];
    } else if (ruleField !== "personaId") {
      rulePersonaValues = [];
    }
  } else if (rule?.op === "in") {
    ruleField = String(rule.field);
    const values = (rule.values ?? []).map(String);
    if (ruleField === "personaId" && values.length) {
      rulePersonaValues = values;
      ruleValue = values[0];
    } else if (values.length) {
      ruleValue = values[0];
      rulePersonaValues = [];
    }
  }

  if (andRule?.op === "eq" && typeof andRule.value === "boolean") {
    andRuleEnabled = true;
    andRuleField = String(andRule.field);
    andRuleValue = andRule.value;
  }

  return {
    ruleField,
    ruleValue,
    rulePersonaValues,
    andRuleEnabled,
    andRuleField,
    andRuleValue,
  };
}

onMounted(async () => {
  if (authStore.memberId) scenicStore.bindMember(authStore.memberId);
  scenicStore.loadCatalog();
  if (!scenicStore.currentScenicId && scenicStore.enabledScenics[0]) {
    scenicStore.selectScenic(scenicStore.enabledScenics[0].scenicId, {
      persist: false,
    });
  }
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
  workingQuestions.value = cloneWelcomeQuestions(
    businessConfigStore.welcomeQuestions,
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

function openEntryEditor(entryId: string) {
  const index = workingEntries.value.findIndex((item) => item.entryId === entryId);
  if (index < 0) return;
  editingEntryIndex.value = index;
  const entry = workingEntries.value[index];
  const {
    ruleField,
    ruleValue,
    rulePersonaValues,
    andRuleEnabled,
    andRuleField,
    andRuleValue,
  } = parseRuleIntoForm(entry.rules);

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
    scenicIds: resolveItemScenicIds(entry),
    ruleField,
    ruleValue,
    rulePersonaValues,
    andRuleEnabled,
    andRuleField,
    andRuleValue,
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
  const parsedPriority = Number(editEntryForm.value.priority);
  const scopedScenicIds = editEntryForm.value.scenicIds.filter(Boolean);
  if (!scopedScenicIds.length) {
    appToast("请至少选择一个适用景区");
    return;
  }
  if (
    editEntryForm.value.ruleField === "personaId" &&
    !editEntryForm.value.rulePersonaValues.length
  ) {
    appToast("请至少选择一个适用演示账号");
    return;
  }
  workingEntries.value[editingEntryIndex.value] = {
    ...current,
    title: editEntryForm.value.title.trim() || current.title,
    icon: editEntryForm.value.icon.trim() || current.icon,
    enabled: editEntryForm.value.enabled,
    priority: Number.isFinite(parsedPriority) ? parsedPriority : current.priority,
    target: editEntryForm.value.target,
    targetPath: editEntryForm.value.targetPath.trim() || undefined,
    skillId: editEntryForm.value.skillId.trim() || undefined,
    promptHint: editEntryForm.value.promptHint.trim() || undefined,
    scenicId: undefined,
    scenicIds: scopedScenicIds,
    rules: buildEntryRules(),
  };
  // 保存后按优先级重排，保证列表顺序与预览一致
  workingEntries.value = [...workingEntries.value].sort(
    (a, b) => b.priority - a.priority,
  );
  closeEntryEditor();
  // 立即写入 LocalStorage，避免只点「确定」未点底部「保存」导致重登后不生效
  void persistEntriesOnly("快捷服务已保存，请用对应演示账号打开聊天欢迎页验证");
}

async function persistEntriesOnly(successMessage: string) {
  businessConfigStore.saveRecommendEntriesOverride(
    cloneEntries(workingEntries.value),
  );
  appToast(successMessage);
}

function onToggleEntryEnabled(entryId: string, enabled: boolean) {
  const index = workingEntries.value.findIndex((item) => item.entryId === entryId);
  if (index < 0) return;
  workingEntries.value[index] = {
    ...workingEntries.value[index],
    enabled,
  };
  void persistEntriesOnly(enabled ? "已启用并保存" : "已关闭并保存");
}

function openQuestionEditor(questionId: string) {
  const index = findQuestionIndex(workingQuestions.value, questionId);
  if (index < 0) return;
  editingQuestionIndex.value = index;
  const question = workingQuestions.value[index];
  const {
    ruleField,
    ruleValue,
    rulePersonaValues,
    andRuleEnabled,
    andRuleField,
    andRuleValue,
  } = parseRuleIntoForm(question.rules);
  editQuestionForm.value = {
    id: question.id,
    text: question.text,
    desc: question.desc ?? "",
    prompt: question.prompt,
    icon: question.icon,
    badgeColor: question.badgeColor ?? "#54c783",
    enabled: question.enabled !== false,
    priority: question.priority ?? 10,
    pinTop: question.pinTop === true,
    target: question.target || "chat",
    targetPath: question.targetPath ?? "",
    scenicIds: resolveItemScenicIds(question),
    ruleField,
    ruleValue,
    rulePersonaValues,
    andRuleEnabled,
    andRuleField,
    andRuleValue,
  };
  questionEditorVisible.value = true;
}

function closeQuestionEditor() {
  questionEditorVisible.value = false;
  editingQuestionIndex.value = -1;
}

async function persistQuestionsOnly(successMessage: string) {
  businessConfigStore.saveWelcomeQuestionsOverride(
    cloneWelcomeQuestions(workingQuestions.value),
  );
  appToast(successMessage);
}

function confirmQuestionEditor() {
  if (editingQuestionIndex.value < 0) return;
  const current = workingQuestions.value[editingQuestionIndex.value];
  const parsedPriority = Number(editQuestionForm.value.priority);
  const scopedScenicIds = editQuestionForm.value.scenicIds.filter(Boolean);
  if (!scopedScenicIds.length) {
    appToast("请至少选择一个适用景区");
    return;
  }
  if (
    editQuestionForm.value.ruleField === "personaId" &&
    !editQuestionForm.value.rulePersonaValues.length
  ) {
    appToast("请至少选择一个适用演示账号");
    return;
  }
  const target = editQuestionForm.value.target || "chat";
  const targetPath = editQuestionForm.value.targetPath.trim();
  workingQuestions.value[editingQuestionIndex.value] = {
    ...current,
    id: editQuestionForm.value.id.trim() || current.id,
    text: editQuestionForm.value.text.trim() || current.text,
    desc: editQuestionForm.value.desc.trim() || undefined,
    prompt: editQuestionForm.value.prompt.trim() || current.prompt,
    icon: editQuestionForm.value.icon.trim() || current.icon,
    badgeColor: editQuestionForm.value.badgeColor.trim() || current.badgeColor,
    enabled: editQuestionForm.value.enabled,
    priority: Number.isFinite(parsedPriority)
      ? parsedPriority
      : (current.priority ?? 0),
    pinTop: editQuestionForm.value.pinTop === true,
    target,
    targetPath:
      target === "chat" ? undefined : targetPath || undefined,
    scenicId: undefined,
    scenicIds: scopedScenicIds,
    rules: buildQuestionRules(),
  };
  workingQuestions.value = [...workingQuestions.value].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
  );
  closeQuestionEditor();
  void persistQuestionsOnly("游游推荐已保存，请用对应演示账号打开聊天欢迎页验证");
}

function onToggleQuestionEnabled(questionId: string, enabled: boolean) {
  const index = findQuestionIndex(workingQuestions.value, questionId);
  if (index < 0) return;
  workingQuestions.value[index] = {
    ...workingQuestions.value[index],
    enabled,
  };
  void persistQuestionsOnly(enabled ? "已启用并保存" : "已关闭并保存");
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
  businessConfigStore.saveWelcomeQuestionsOverride(
    cloneWelcomeQuestions(workingQuestions.value),
  );
  await skillStore.loadSkills(true);
  appToast(successMessage);
}

async function onSave() {
  await persistAll("已保存，聊天页将使用新配置");
}

async function onReset() {
  try {
    await showConfirmDialog({
      title: "恢复默认配置？",
      message:
        "将删除本机 LocalStorage 键 scenic_admin_business_override，并重新加载仓库里的 JSON 默认项（Skill / 快捷服务 / 游游推荐）。",
    });
  } catch {
    return;
  }
  businessConfigStore.clearAdminPatch();
  await Promise.all([
    skillStore.loadSkills(true),
    businessConfigStore.loadSkills(true),
    businessConfigStore.loadRecommendEntries(true),
    businessConfigStore.loadWelcomeTemplates(true),
    businessConfigStore.loadWelcomeQuestions(true),
  ]);
  workingSkills.value = normalizeSkillsTriggerKeywords(
    cloneSkills(businessConfigStore.skills),
  );
  workingEntries.value = cloneEntries(businessConfigStore.recommendEntries);
  workingWelcomeTemplates.value = cloneWelcomeTemplates(
    businessConfigStore.welcomeTemplates,
  );
  workingQuestions.value = cloneWelcomeQuestions(
    businessConfigStore.welcomeQuestions,
  );
  appToast("已清除覆盖并恢复 JSON 默认");
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

const DEMO_OPS_ITEMS: Array<{
  action: DemoOpsAction;
  title: string;
  confirm: string;
  /** 是否依赖当前预览景区（建单类需要；清券/重置开票/重置答题为账号级） */
  needsScenic?: boolean;
}> = [
  {
    action: "clear_new_guest_coupon",
    title: "清空新人券",
    confirm:
      "将清空当前账号在全部景区下的新人专享券，可再次演示领取。请重新打开聊天页验证。",
    needsScenic: false,
  },
  {
    action: "ensure_today_paid_order",
    title: "当日待出行订单",
    confirm: "将为当前账号 upsert 一笔「当前景区」今日待出行订单（paid）。",
    needsScenic: true,
  },
  {
    action: "ensure_today_completed_order",
    title: "当日已核销订单",
    confirm: "将为当前账号 upsert 一笔「当前景区」今日已核销订单（completed，可开票/点评）。",
    needsScenic: true,
  },
  {
    action: "reset_invoice_status",
    title: "重置开票状态",
    confirm:
      "将当前账号全部景区订单的发票状态重置为未开票。请重新打开聊天页验证。",
    needsScenic: false,
  },
  {
    action: "reset_quiz_progress",
    title: "重置答题为未答题状态",
    confirm:
      "将清空当前账号全部答题成功记录，演出/明星结果可再次出现答题邀请。请重新打开聊天页验证。",
    needsScenic: false,
  },
];

async function onDemoOps(
  action: DemoOpsAction,
  title: string,
  confirm: string,
  needsScenic = true,
) {
  if (!authStore.personaId) {
    appToast("请先登录演示账号");
    return;
  }
  if (needsScenic && !previewScenicId.value) {
    appToast("请先选择预览景区");
    scenicPickerVisible.value = true;
    return;
  }
  const scenicLine = previewScenicId.value
    ? `当前景区：${previewScenicName.value}（${previewScenicId.value}）\n`
    : "";
  await showConfirmDialog({
    title,
    message: `当前账号：${currentPersonaLabel.value}\n${scenicLine}${confirm}`,
  });
  try {
    const { data: res } = await postDemoOps(action);
    if (res.code !== 200) {
      appToast(res.message || "操作失败");
      return;
    }
    appToast(res.message || "已完成（请重新打开聊天页查看）");
  } catch {
    appToast("操作失败，请确认已登录且开发服务已启动");
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
      text="演示版：快捷服务规则改完点「确定」即写入本机；须用规则匹配的演示账号登录后打开聊天欢迎页。最多展示 4 个（按优先级）。"
    />

    <section class="admin-ui__block admin-business__scenic-bar">
      <van-cell
        title="当前预览景区"
        :value="previewScenicName"
        is-link
        :label="
          [previewCityName, previewScenicId].filter(Boolean).join(' · ') || '未选择'
        "
        @click="scenicPickerVisible = true"
      />
      <van-cell title="列表显示全部景区配置">
        <template #right-icon>
          <van-switch v-model="listShowAllScenics" size="20px" />
        </template>
      </van-cell>
    </section>

    <van-tabs v-model:active="activeTab" class="admin-business__tabs">
      <van-tab title="Skill 场景" name="skill">
        <van-collapse v-model="skillSectionOpen" class="admin-business__collapse">
          <van-collapse-item
            name="skills"
            :title="`Skill 场景（${workingSkills.length}）`"
          >
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
          </van-collapse-item>

          <van-collapse-item name="cardViews" title="卡片展示配置（只读）">
            <div class="admin-ui__panel admin-ui__panel--card">
              <van-cell
                v-for="view in businessConfigStore.cardViews"
                :key="view.cardType"
                :title="view.label"
                :label="`${view.cardType} · 最多 ${view.maxItems ?? '-'} 条`"
              />
            </div>
          </van-collapse-item>

          <van-collapse-item
            name="exclusions"
            :title="`路由排他规则（只读 · ${exclusionRules.length}）`"
          >
            <p class="admin-business__hint admin-business__hint--block">
              对应代码层 Workflow 互斥说明，演示版仅展示，不可在此设置。
            </p>
            <div class="admin-ui__panel admin-ui__panel--card">
              <van-cell
                v-for="rule in exclusionRules"
                :key="rule.ruleId"
                :title="rule.name"
                :label="`当「${rule.when}」→ 优先 ${skillNameById(rule.preferSkillId)}，排除 ${skillNameById(rule.excludeSkillId)}`"
              />
              <van-cell
                title="打开路由冲突检查"
                label="查看触发词重叠与排他覆盖情况"
                is-link
                @click="openRouteConflictCheck"
              />
            </div>
          </van-collapse-item>
        </van-collapse>
      </van-tab>

      <van-tab title="欢迎页入口" name="entry">
        <van-collapse v-model="entrySectionOpen" class="admin-business__collapse">
          <van-collapse-item
            name="quickServices"
            :title="`快捷服务（${displayWorkingEntries.length}/${workingEntries.length}，展示最多 ${MAX_QUICK_SERVICES} 个）`"
          >
            <p class="admin-business__hint admin-business__hint--block">
              {{
                listShowAllScenics
                  ? "当前显示全部景区配置；编辑时可指定适用景区。"
                  : `仅显示适用于「${previewScenicName}」的配置（含全景区通用）。`
              }}
            </p>
            <div class="admin-ui__panel admin-ui__panel--card">
              <van-cell
                v-for="entry in displayWorkingEntries"
                :key="entry.entryId"
                :title="entry.title"
                :label="`${entry.entryId} · ${scenicScopeSummary(entry)} · 优先级 ${entry.priority} · ${entryRuleSummary(entry)}`"
                is-link
                @click="openEntryEditor(entry.entryId)"
              >
                <template #value>
                  <van-switch
                    :model-value="entry.enabled !== false"
                    size="20px"
                    @click.stop
                    @update:model-value="onToggleEntryEnabled(entry.entryId, $event)"
                  />
                </template>
              </van-cell>
            </div>
          </van-collapse-item>

          <van-collapse-item
            name="welcomeRecommend"
            :title="`游游推荐（${displayWorkingQuestions.length}/${workingQuestions.length}，每账号最多 ${MAX_WELCOME_RECOMMEND} 条）`"
          >
            <div class="admin-ui__panel admin-ui__panel--card">
              <van-cell
                v-for="question in displayWorkingQuestions"
                :key="question.id"
                :title="question.text"
                :label="`${question.id} · ${scenicScopeSummary(question)}${question.pinTop ? ' · 置顶' : ''} · ${question.target || 'chat'} · 优先级 ${question.priority ?? 0} · ${questionRuleSummary(question)}`"
                is-link
                @click="openQuestionEditor(question.id)"
              >
                <template #value>
                  <van-switch
                    :model-value="question.enabled !== false"
                    size="20px"
                    @click.stop
                    @update:model-value="
                      onToggleQuestionEnabled(question.id, $event)
                    "
                  />
                </template>
              </van-cell>
            </div>
          </van-collapse-item>

          <van-collapse-item
            name="rulePreview"
            :title="`规则预览（三个演示账号 · ${previewScenicName}）`"
          >
            <p class="admin-business__hint admin-business__hint--block">
              同时展示各账号在当前预览景区下的命中结果，无需切换账号。
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
                快捷服务（优先级降序，最多 {{ MAX_QUICK_SERVICES }} 个）
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
          </van-collapse-item>

          <van-collapse-item name="fieldCatalog" title="规则字段目录（只读）">
            <div class="admin-ui__panel admin-ui__panel--card">
              <van-cell
                v-for="field in ruleEligibleFields"
                :key="field.fieldId"
                :title="field.label"
                :label="`${field.fieldId} · ${field.valueType}`"
              />
            </div>
          </van-collapse-item>
        </van-collapse>
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

    <section class="admin-ui__block admin-business__demo-ops">
      <p class="admin-ui__block-title">
        演示快捷工具 · {{ previewScenicName }}
      </p>
      <p class="admin-business__hint admin-business__hint--block">
        作用于已登录账号：{{ currentPersonaLabel }}；订单写入景区
        {{ previewScenicId || "未选" }}。订单操作为 upsert，重复点击不会堆单。改完后请重新打开聊天页查看。
      </p>
      <van-cell
        title="切换操作景区"
        :value="previewScenicName"
        is-link
        class="admin-business__demo-ops-scenic"
        @click="scenicPickerVisible = true"
      />
      <div class="admin-business__demo-ops-grid">
        <button
          v-for="item in DEMO_OPS_ITEMS"
          :key="item.action"
          type="button"
          class="admin-ui__btn admin-ui__btn--outline admin-business__demo-ops-btn"
          @click="
            onDemoOps(
              item.action,
              item.title,
              item.confirm,
              item.needsScenic !== false,
            )
          "
        >
          {{ item.title }}
        </button>
      </div>
    </section>

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
            label="优先级（越大越靠前）"
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
            <p class="admin-business__section-title">适用景区（可多选，至少选一个）</p>
            <van-cell
              v-for="scenic in scenicStore.enabledScenics"
              :key="scenic.scenicId"
              :title="scenic.name"
              :label="`${scenicStore.enabledCities.find((c) => c.cityId === scenic.cityId)?.name || ''} · ${scenic.scenicId}`"
              clickable
              @click="toggleEntryScenicId(scenic.scenicId)"
            >
              <template #right-icon>
                <van-checkbox
                  :model-value="editEntryForm.scenicIds.includes(scenic.scenicId)"
                  @click.stop="toggleEntryScenicId(scenic.scenicId)"
                />
              </template>
            </van-cell>
          </div>

          <div class="admin-business__section">
            <p class="admin-business__section-title">触发规则</p>
            <p class="admin-business__hint admin-business__hint--block">
              数字越大越靠前；无规则时对所有演示账号展示（编辑器会默认勾选全部账号）。仅勾选「新客」并点确定后，中级/VIP 才不会看到。其它字段按各账号上下文（在园、待出行订单等）求值。
            </p>
            <van-cell title="条件字段">
              <template #value>
                <select
                  class="admin-business__select"
                  :value="editEntryForm.ruleField"
                  @change="
                    onRuleFieldChange(
                      ($event.target as HTMLSelectElement).value,
                    )
                  "
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
            <div
              v-if="editEntryForm.ruleField === 'personaId'"
              class="admin-business__persona-rules"
            >
              <p class="admin-business__section-title">适用演示账号（可多选）</p>
              <van-cell
                v-for="opt in DEMO_PERSONA_OPTIONS"
                :key="opt.value"
                :title="opt.label"
                clickable
                @click="togglePersonaRuleValue(opt.value)"
              >
                <template #right-icon>
                  <van-checkbox
                    :model-value="
                      editEntryForm.rulePersonaValues.includes(opt.value)
                    "
                    @click.stop="togglePersonaRuleValue(opt.value)"
                  />
                </template>
              </van-cell>
            </div>
            <van-cell
              v-else-if="selectedRuleFieldMeta?.valueType === 'boolean'"
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
            <van-cell title="附加条件（且）">
              <template #right-icon>
                <van-switch v-model="editEntryForm.andRuleEnabled" size="20px" />
              </template>
            </van-cell>
            <template v-if="editEntryForm.andRuleEnabled">
              <van-cell title="附加字段">
                <template #value>
                  <select
                    v-model="editEntryForm.andRuleField"
                    class="admin-business__select"
                  >
                    <option
                      v-for="field in andRuleFieldOptions"
                      :key="field.fieldId"
                      :value="field.fieldId"
                    >
                      {{ field.label }}
                    </option>
                  </select>
                </template>
              </van-cell>
              <van-cell title="附加条件值">
                <template #value>
                  <van-switch
                    v-model="editEntryForm.andRuleValue"
                    size="20px"
                  />
                </template>
              </van-cell>
            </template>
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
          <van-cell title="强制置顶（游游推荐第一位）">
            <template #value>
              <van-switch v-model="editQuestionForm.pinTop" size="20px" />
            </template>
          </van-cell>
          <van-cell title="点击行为">
            <template #value>
              <select v-model="editQuestionForm.target" class="admin-business__select">
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
            v-if="editQuestionForm.target === 'page' || editQuestionForm.target === 'h5'"
            v-model="editQuestionForm.targetPath"
            label="跳转路径"
            placeholder="如 /activity 或 https://…"
          />
          <van-field
            v-model="editQuestionForm.prompt"
            label="点击 prompt"
            type="textarea"
            rows="3"
            autosize
            :placeholder="
              editQuestionForm.target === 'chat'
                ? '点击后发起对话的内容'
                : '可选；跳转类可不填'
            "
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
          <div class="admin-business__section">
            <p class="admin-business__section-title">适用景区（可多选，至少选一个）</p>
            <van-cell
              v-for="scenic in scenicStore.enabledScenics"
              :key="scenic.scenicId"
              :title="scenic.name"
              :label="`${scenicStore.enabledCities.find((c) => c.cityId === scenic.cityId)?.name || ''} · ${scenic.scenicId}`"
              clickable
              @click="toggleQuestionScenicId(scenic.scenicId)"
            >
              <template #right-icon>
                <van-checkbox
                  :model-value="editQuestionForm.scenicIds.includes(scenic.scenicId)"
                  @click.stop="toggleQuestionScenicId(scenic.scenicId)"
                />
              </template>
            </van-cell>
          </div>
          <div class="admin-business__section">
            <p class="admin-business__section-title">触发规则</p>
            <p class="admin-business__hint admin-business__hint--block">
              数字越大越靠前；无规则时对所有演示账号展示（编辑器会默认勾选全部账号）。仅勾选「新客」并点确定后，中级/VIP 才不会看到。其它字段按各账号上下文（在园、待出行订单等）求值。
            </p>
            <van-cell title="条件字段">
              <template #value>
                <select
                  class="admin-business__select"
                  :value="editQuestionForm.ruleField"
                  @change="
                    onQuestionRuleFieldChange(
                      ($event.target as HTMLSelectElement).value,
                    )
                  "
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
            <div
              v-if="editQuestionForm.ruleField === 'personaId'"
              class="admin-business__persona-rules"
            >
              <p class="admin-business__section-title">适用演示账号（可多选）</p>
              <van-cell
                v-for="opt in DEMO_PERSONA_OPTIONS"
                :key="opt.value"
                :title="opt.label"
                clickable
                @click="toggleQuestionPersonaRuleValue(opt.value)"
              >
                <template #right-icon>
                  <van-checkbox
                    :model-value="
                      editQuestionForm.rulePersonaValues.includes(opt.value)
                    "
                    @click.stop="toggleQuestionPersonaRuleValue(opt.value)"
                  />
                </template>
              </van-cell>
            </div>
            <van-cell
              v-else-if="selectedQuestionRuleFieldMeta?.valueType === 'boolean'"
              title="条件值"
            >
              <template #value>
                <van-switch
                  :model-value="editQuestionForm.ruleValue === true"
                  size="20px"
                  @update:model-value="editQuestionForm.ruleValue = $event"
                />
              </template>
            </van-cell>
            <van-cell
              v-else-if="selectedQuestionRuleFieldMeta?.valueType === 'enum'"
              title="条件值"
            >
              <template #value>
                <select
                  v-model="editQuestionForm.ruleValue"
                  class="admin-business__select"
                >
                  <option
                    v-for="opt in selectedQuestionRuleFieldMeta.enumOptions ?? []"
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
              :model-value="String(editQuestionForm.ruleValue ?? '')"
              label="条件值"
              @update:model-value="editQuestionForm.ruleValue = $event"
            />
            <van-cell title="附加条件（且）">
              <template #right-icon>
                <van-switch v-model="editQuestionForm.andRuleEnabled" size="20px" />
              </template>
            </van-cell>
            <template v-if="editQuestionForm.andRuleEnabled">
              <van-cell title="附加字段">
                <template #value>
                  <select
                    v-model="editQuestionForm.andRuleField"
                    class="admin-business__select"
                  >
                    <option
                      v-for="field in andQuestionRuleFieldOptions"
                      :key="field.fieldId"
                      :value="field.fieldId"
                    >
                      {{ field.label }}
                    </option>
                  </select>
                </template>
              </van-cell>
              <van-cell title="附加条件值">
                <template #value>
                  <van-switch
                    v-model="editQuestionForm.andRuleValue"
                    size="20px"
                  />
                </template>
              </van-cell>
            </template>
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
    <ScenicPickerSheet
      v-model:show="scenicPickerVisible"
      :cities="scenicStore.enabledCities"
      :scenics="scenicStore.enabledScenics"
      :current-scenic-id="previewScenicId"
      :initial-city-id="scenicStore.resolvePickerCityId(previewScenicId)"
      title="选择预览 / 操作景区"
      @select="onConfigScenicPicked"
      @update:city-id="(cityId) => scenicStore.selectCity(cityId)"
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

.admin-business__collapse {
  margin: 8px 12px 12px;
  background: transparent;
}

.admin-business__collapse :deep(.van-collapse-item) {
  margin-bottom: 10px;
  border-radius: 14px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.08);
}

.admin-business__collapse :deep(.van-collapse-item__title) {
  padding: 14px 16px;
  font-size: 15px;
  font-weight: 600;
  color: #323233;
  align-items: center;
}

.admin-business__collapse :deep(.van-collapse-item__content) {
  padding: 0 12px 12px;
  color: inherit;
  background: #fff;
}

.admin-business__collapse :deep(.van-collapse-item__content) > .admin-ui__panel {
  box-shadow: none;
  border: 1px solid #ebedf0;
}

.admin-business__collapse :deep(.van-hairline--top-bottom::after),
.admin-business__collapse :deep(.van-collapse-item--border::after) {
  border: none;
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

.admin-business__demo-ops {
  margin-top: 8px;
  padding-bottom: 8px;
}

.admin-business__demo-ops-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.admin-business__demo-ops-btn {
  margin: 0;
  width: 100%;
  box-shadow: none;
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

.admin-business__persona-rules {
  padding-bottom: 8px;
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

.admin-business__scenic-bar {
  margin-bottom: 4px;
}

.admin-business__scenic-bar :deep(.van-cell) {
  background: #fff;
}

.admin-business__demo-ops-scenic {
  margin-bottom: 10px;
  border-radius: 10px;
  overflow: hidden;
}
</style>

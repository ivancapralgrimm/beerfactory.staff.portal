import { supabase } from "@/lib/supabase";
import { cacheAttestationBank, readCachedAttestationBank } from "@/features/attestation/attestation-offline";
import type { QuestionBank, QuizAnswer, QuizCategory, QuizQuestion } from "@/features/attestation/types";

let cachedBank: QuestionBank | null = null;
type BankRequest = { generation: number; promise: Promise<QuestionBank> };
let inflight: BankRequest | null = null;
let onlineInflight: BankRequest | null = null;
let bankGeneration = 0;
let cacheWrites: Promise<void> = Promise.resolve();

export function invalidateQuestionBank(): void {
  bankGeneration += 1;
  cachedBank = null;
  inflight = null;
  onlineInflight = null;
}

function shuffle<T>(input: readonly T[]): T[] {
  const output = [...input];
  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function integerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function validAnswer(value: unknown): value is QuizAnswer {
  if (!isRecord(value)) return false;
  const a = value;
  return typeof a.text === "string" && a.text.trim().length > 0 && typeof a.correct === "boolean";
}

function validQuestion(value: unknown): value is QuizQuestion {
  if (!isRecord(value)) return false;
  const q = value;
  return nonEmptyString(q.id) && nonEmptyString(q.q)
    && nonEmptyString(q.group) && nonEmptyString(q.topic)
    && typeof q.knowledgeType === "string" && ["bar", "kitchen", "wine", "service"].includes(q.knowledgeType)
    && typeof q.venue === "string" && ["bf", "bb", "common"].includes(q.venue)
    // The RPC represents absent optional text as null; cached banks may omit it.
    && ["source", "sourceRef", "reviewUrl", "reviewLabel", "subcategory", "reviewNote"].every(
      (key) => q[key] == null || typeof q[key] === "string"
    )
    && (q.revision === undefined || integerInRange(q.revision, 1, Number.MAX_SAFE_INTEGER))
    && Array.isArray(q.answers) && q.answers.length === 4
    && Array.from(q.answers).every(validAnswer)
    && q.answers.filter((a) => a.correct).length === 1
    && new Set(q.answers.map((a) => a.text.trim().toLowerCase())).size === 4;
}

function questionSignature(q: QuizQuestion): string {
  // Compare snapshot content, independent of object property insertion order.
  return JSON.stringify([
    q.id, q.q, q.group, q.topic, q.knowledgeType, q.venue,
    q.answers.map((a) => [a.text, a.correct]), q.source ?? null, q.sourceRef ?? null,
    q.reviewUrl ?? null, q.reviewLabel ?? null, q.subcategory ?? null,
    q.reviewNote ?? null, q.revision ?? null
  ]);
}

export function validateQuestionBank(value: unknown): QuestionBank {
  if (!isRecord(value)) throw new Error("question_bank_invalid");
  const b = value;
  if (b.schemaVersion !== 3) throw new Error("question_bank_cache_incompatible");
  if (!integerInRange(b.passPercent, 50, 100)
    || !integerInRange(b.questionsPerTest, 1, 50)
    || (b.revision !== undefined && !integerInRange(b.revision, 1, Number.MAX_SAFE_INTEGER))
    || (b.generatedAt !== undefined && typeof b.generatedAt !== "string")
    || !Array.isArray(b.categories) || b.categories.length < 1) {
    throw new Error("question_bank_settings_invalid");
  }
  const categoryIds = new Set<string>();
  const signatures = new Map<string, string>();
  for (const raw of b.categories) {
    if (!isRecord(raw)) throw new Error("question_bank_category_invalid");
    if (!nonEmptyString(raw.id) || !nonEmptyString(raw.label) || categoryIds.has(raw.id)
      || typeof raw.knowledgeType !== "string" || !["bar", "kitchen", "wine", "service"].includes(raw.knowledgeType)
      || typeof raw.venue !== "string" || !["bf", "bb", "common"].includes(raw.venue)
      || !integerInRange(raw.questionsPerTest, 1, 50)
      || !Array.isArray(raw.questions) || !Array.isArray(raw.ticketPlan)) {
      throw new Error(`question_bank_category_invalid:${typeof raw.id === "string" ? raw.id : "unknown"}`);
    }
    const c = raw as unknown as QuizCategory;
    categoryIds.add(c.id);
    if (c.specificQuestionCount !== null
      && (!integerInRange(c.specificQuestionCount, 0, c.questionsPerTest)
        || (c.venue === "common" && c.specificQuestionCount !== 0))) {
      throw new Error(`question_bank_quota_invalid:${c.id}`);
    }
    const idsInTicket = new Set<string>();
    for (const q of c.questions) {
      if (!validQuestion(q) || idsInTicket.has(q.id)
        || q.knowledgeType !== c.knowledgeType
        || !(q.venue === "common" || (c.venue !== "common" && q.venue === c.venue))) {
        throw new Error(`question_bank_question_invalid:${q?.id || "unknown"}`);
      }
      idsInTicket.add(q.id);
      // Same shared source question may occur in several tickets, but not diverge.
      const signature = questionSignature(q);
      if (signatures.has(q.id) && signatures.get(q.id) !== signature) {
        throw new Error(`question_bank_shared_question_mismatch:${q.id}`);
      }
      signatures.set(q.id, signature);
    }
    const parts = new Set<string>();
    let total = 0;
    for (const part of c.ticketPlan) {
      if (!isRecord(part) || !nonEmptyString(part.topic)
        || !integerInRange(part.count, 1, c.questionsPerTest) || parts.has(part.topic)) {
        throw new Error(`question_bank_ticket_invalid:${c.id}`);
      }
      parts.add(part.topic);
      total += part.count;
    }
    if (total !== c.questionsPerTest) throw new Error(`question_bank_ticket_invalid:${c.id}`);
    const { pools, sharedGroups } = ticketPools(c);
    let min = 0;
    let max = 0;
    for (const pool of pools) {
      const range = quotaRange(pool.groups, pool.count);
      if (!range) throw new Error(`question_bank_ticket_capacity:${c.id}:${pool.topic}`);
      min += range.min;
      max += range.max;
    }
    if (sharedGroups.size > 0 && !selectAcrossTopics(pools, sharedGroups, null, false)) {
      throw new Error(`question_bank_ticket_capacity:${c.id}:groups`);
    }
    if (c.specificQuestionCount !== null
      && (c.specificQuestionCount < min || c.specificQuestionCount > max
        || (sharedGroups.size > 0 && !selectAcrossTopics(pools, sharedGroups, c.specificQuestionCount, false)))) {
      throw new Error(`question_bank_quota_capacity:${c.id}`);
    }
  }
  return value as QuestionBank;
}

/** Legacy reads are permitted only when PostgREST confirms that the *new RPC*
 * does not exist yet. Network failures and forbidden responses must not downgrade.
 * This bridge is intentionally limited to the four original BF category IDs.
 */
function isMissingV3Rpc(error: unknown): boolean {
  if (!isRecord(error)) return false;
  const code = error.code;
  const message = typeof error.message === "string" ? error.message : "";
  return code === "PGRST202" || (code === "42883" && message.includes("get_attestation_bank_v3"));
}

function adaptLegacyBank(value: unknown): QuestionBank {
  if (!isRecord(value) || !Array.isArray(value.categories)) {
    throw new Error("question_bank_legacy_unsupported");
  }
  const originalTypes = new Set(["bar", "kitchen", "wine", "service"]);
  const categories = value.categories.map((raw) => {
    if (!isRecord(raw) || !originalTypes.has(String(raw.id))
      || !Array.isArray(raw.questions) || !Array.isArray(raw.ticketPlan)) {
      // Never guess the knowledge type of custom categories or new tickets.
      throw new Error("question_bank_legacy_unsupported");
    }
    const knowledgeType = raw.id as QuizCategory["knowledgeType"];
    const questions = raw.questions.map((question) => {
      if (!isRecord(question) || "knowledgeType" in question || "venue" in question) {
        // A partially migrated backend is not safe to reinterpret as the old model.
        throw new Error("question_bank_legacy_unsupported");
      }
      return { ...question, knowledgeType, venue: "bf" };
    });
    return {
      ...raw, knowledgeType, venue: "bf", specificQuestionCount: null, questions
    };
  });
  const converted = validateQuestionBank({
    ...value, schemaVersion: 3, legacyCompatibility: true, categories
  });
  return converted;
}

async function fetchOnlineQuestionBank(generation: number) {
  const { data, error } = await supabase.rpc("get_attestation_bank_v3");
  if (error || !data) {
    if (!isMissingV3Rpc(error)) throw new Error("question_bank_online_unavailable");
    const legacy = await supabase.rpc("get_attestation_bank");
    if (legacy.error || !legacy.data) throw new Error("question_bank_online_unavailable");
    const bank = adaptLegacyBank(legacy.data);
    if (generation === bankGeneration) cachedBank = bank;
    // Do not write synthetic v3 to IndexedDB: when the migration lands,
    // an offline launch must never mistake the old pool for the new server.
    return bank;
  }
  const bank = validateQuestionBank(data);
  if (generation === bankGeneration) {
    cachedBank = bank;
    // Serialize disk writes too: a slow earlier write must finish before a
    // newer snapshot is persisted. Invalidation never deletes stored data.
    cacheWrites = cacheWrites.then(async () => {
      if (generation === bankGeneration && cachedBank === bank) await cacheAttestationBank(bank);
    }).catch(() => undefined);
  }
  return bank;
}

function onlineQuestionBank(): BankRequest {
  if (onlineInflight) return onlineInflight;
  const generation = ++bankGeneration;
  const request = { generation, promise: fetchOnlineQuestionBank(generation) };
  onlineInflight = request;
  const clear = () => { if (onlineInflight === request) onlineInflight = null; };
  void request.promise.then(clear, clear);
  return request;
}

async function fetchQuestionBank(request: BankRequest) {
  try { return await request.promise; }
  catch (onlineError) {
    try {
      const cached = await readCachedAttestationBank();
      if (cached?.bank) {
        if ((cached.bank as { schemaVersion?: number }).schemaVersion !== 3) {
          throw new Error("question_bank_cache_incompatible");
        }
        const bank = validateQuestionBank(cached.bank);
        if (request.generation === bankGeneration) cachedBank = bank;
        return bank;
      }
    } catch (cacheError) {
      if (cacheError instanceof Error && cacheError.message === "question_bank_cache_incompatible") {
        throw cacheError;
      }
    }
    throw onlineError;
  }
}

export async function warmAttestationBank() {
  try { return await onlineQuestionBank().promise; } catch { return null; }
}
export async function loadQuestionBank(options?: { force?: boolean }) {
  const force = options?.force === true;
  if (!force && cachedBank) return cachedBank;
  if (inflight && inflight.generation === bankGeneration) return inflight.promise;
  const online = onlineQuestionBank();
  const request = { generation: online.generation, promise: fetchQuestionBank(online) };
  inflight = request;
  try { return await request.promise; } finally { if (inflight === request) inflight = null; }
}

function copyWithShuffledAnswers(q: QuizQuestion): QuizQuestion {
  return { ...q, answers: shuffle(q.answers.map((a) => ({ ...a }))) };
}

type TicketGroup = { key: string; common: QuizQuestion[]; specific: QuizQuestion[] };
type TopicPool = { topic: string; count: number; groups: TicketGroup[] };

function ticketPools(category: QuizCategory) {
  const byTopic = new Map(category.ticketPlan.map((part) => [part.topic, new Map<string, TicketGroup>()]));
  const groupTopics = new Map<string, string>();
  const sharedGroups = new Set<string>();
  for (const q of category.questions) {
    const groups = byTopic.get(q.topic);
    if (!groups) continue;
    if (groupTopics.has(q.group) && groupTopics.get(q.group) !== q.topic) sharedGroups.add(q.group);
    groupTopics.set(q.group, q.topic);
    let group = groups.get(q.group);
    if (!group) {
      group = { key: q.group, common: [], specific: [] };
      groups.set(q.group, group);
    }
    (q.venue === "common" ? group.common : group.specific).push(q);
  }
  const pools: TopicPool[] = category.ticketPlan.map((part) => ({
    ...part, groups: [...byTopic.get(part.topic)!.values()]
  }));
  return { pools, sharedGroups };
}

function quotaRange(groups: readonly TicketGroup[], count: number) {
  if (groups.length < count) return null;
  let common = 0;
  let specific = 0;
  for (const group of groups) {
    if (group.common.length > 0) common += 1;
    if (group.specific.length > 0) specific += 1;
  }
  // Overlapping variants still supply only one slot per group. Every integer
  // in this interval is achievable when these groups belong to one topic.
  return { min: Math.max(0, count - common), max: Math.min(count, specific) };
}

function randomInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pick<T>(values: readonly T[]): T {
  return values[randomInt(0, values.length - 1)];
}

function selectWithinTopic(pool: TopicPool, exact: number | null): QuizQuestion[] {
  if (exact === null) {
    return shuffle(pool.groups).slice(0, pool.count).map((group) => pick([...group.common, ...group.specific]));
  }
  const commonOnly = shuffle(pool.groups.filter((group) => group.specific.length === 0));
  const specificOnly = shuffle(pool.groups.filter((group) => group.common.length === 0));
  const mixed = shuffle(pool.groups.filter((group) => group.common.length > 0 && group.specific.length > 0));
  const commonCount = pool.count - exact;
  // Reserve enough mixed groups for both quotas before sampling either side.
  const specificOnlyCount = randomInt(
    Math.max(0, exact - mixed.length, pool.count - mixed.length - commonOnly.length),
    Math.min(exact, specificOnly.length)
  );
  const commonOnlyCount = randomInt(
    Math.max(0, pool.count - mixed.length - specificOnlyCount),
    Math.min(commonCount, commonOnly.length)
  );
  const mixedSpecific = exact - specificOnlyCount;
  const mixedCommon = commonCount - commonOnlyCount;
  return [
    ...specificOnly.slice(0, specificOnlyCount).map((group) => pick(group.specific)),
    ...commonOnly.slice(0, commonOnlyCount).map((group) => pick(group.common)),
    ...mixed.slice(0, mixedSpecific).map((group) => pick(group.specific)),
    ...mixed.slice(mixedSpecific, mixedSpecific + mixedCommon).map((group) => pick(group.common))
  ];
}

function selectLocalTopics(pools: readonly TopicPool[], exact: number | null): QuizQuestion[] | null {
  const ranges = pools.map((pool) => quotaRange(pool.groups, pool.count));
  if (ranges.some((range) => range === null)) return null;
  const suffixMin = Array<number>(pools.length + 1).fill(0);
  const suffixMax = Array<number>(pools.length + 1).fill(0);
  for (let i = pools.length - 1; i >= 0; i -= 1) {
    suffixMin[i] = suffixMin[i + 1] + ranges[i]!.min;
    suffixMax[i] = suffixMax[i + 1] + ranges[i]!.max;
  }
  if (exact !== null && (exact < suffixMin[0] || exact > suffixMax[0])) return null;
  let remaining = exact;
  return pools.flatMap((pool, i) => {
    if (remaining === null) return selectWithinTopic(pool, null);
    const count = randomInt(
      Math.max(ranges[i]!.min, remaining - suffixMax[i + 1]),
      Math.min(ranges[i]!.max, remaining - suffixMin[i + 1])
    );
    remaining -= count;
    return selectWithinTopic(pool, count);
  });
}

/** Compatibility path for older/unit-test banks with groups in several topics.
 * Enumerate group combinations rather than slot permutations, collapse equivalent
 * variants, and memoize failed states. Topic-local production banks never use it.
 */
function selectAcrossTopics(
  input: readonly TopicPool[], sharedGroups: ReadonlySet<string>, exact: number | null, randomize: boolean
): QuizQuestion[] | null {
  const pools = input.map((pool) => ({ ...pool, groups: randomize ? shuffle(pool.groups) : pool.groups }))
    .sort((a, b) => (a.groups.length - a.count) - (b.groups.length - b.count));
  const used = new Set<string>();
  const failed = new Set<string>();
  const selected: QuizQuestion[] = [];

  function solve(index: number, start: number, needed: number, quota: number | null): boolean {
    if (needed === 0) {
      if (index + 1 === pools.length) return quota === null || quota === 0;
      return solve(index + 1, 0, pools[index + 1].count, quota);
    }
    // Only shared groups can affect later topics; a monotone candidate index
    // already prevents reusing a group within this topic.
    const key = JSON.stringify([index, start, needed, quota, [...used].sort()]);
    if (failed.has(key)) return false;
    let min = 0;
    let max = 0;
    let slots = 0;
    const available = new Set<string>();
    for (let i = index; i < pools.length; i += 1) {
      const count = i === index ? needed : pools[i].count;
      const groups = pools[i].groups.slice(i === index ? start : 0).filter((group) => !used.has(group.key));
      const range = quotaRange(groups, count);
      if (!range) { failed.add(key); return false; }
      min += range.min;
      max += range.max;
      slots += count;
      for (const group of groups) available.add(group.key);
    }
    if (available.size < slots || (quota !== null && (quota < min || quota > max))) {
      failed.add(key);
      return false;
    }
    const pool = pools[index];
    for (let i = start; i <= pool.groups.length - needed; i += 1) {
      const group = pool.groups[i];
      if (used.has(group.key)) continue;
      const representative = (questions: QuizQuestion[]) => randomize ? pick(questions) : questions[0];
      const variants = quota === null
        ? [representative([...group.common, ...group.specific])]
        : [group.common.length ? representative(group.common) : null,
          group.specific.length ? representative(group.specific) : null].filter((q): q is QuizQuestion => q !== null);
      for (const q of randomize ? shuffle(variants) : variants) {
        if (sharedGroups.has(group.key)) used.add(group.key);
        selected.push(q);
        if (solve(index, i + 1, needed - 1, quota === null ? null : quota - (q.venue !== "common" ? 1 : 0))) return true;
        selected.pop();
        used.delete(group.key);
      }
    }
    failed.add(key);
    return false;
  }
  return pools.length > 0 && solve(0, 0, pools[0].count, exact) ? selected : null;
}

/** One physical question may be in multiple tickets. Inside an attempt, group keys are unique.
 * A null specific quota preserves legacy behavior (no common questions required).
 * A numeric quota requires precisely that many venue-only questions.
 */
export function buildQuizTicket(category: QuizCategory): QuizQuestion[] {
  const { pools, sharedGroups } = ticketPools(category);
  const selected = sharedGroups.size > 0
    ? selectAcrossTopics(pools, sharedGroups, category.specificQuestionCount, true)
    : selectLocalTopics(pools, category.specificQuestionCount);
  if (!selected) throw new Error("attestation_ticket_capacity");
  return shuffle(selected.map(copyWithShuffledAnswers));
}

export function hasPassed(correct: number, total: number, passPercent: number) {
  return total > 0 && correct * 100 >= total * passPercent;
}

function directRecipeReviewRoute(question: QuizQuestion) {
  const match = (question.source?.trim() || "").match(
    /^Карта\s+(Бар|Кухня):.*\(ID\s+([A-Za-z0-9_-]+)\)\s*$/iu
  );
  if (!match) return null;
  const sourceKey = match[1].toLocaleLowerCase("ru") === "бар" ? "bar" : "kitchen";
  return `/menu/${encodeURIComponent(`${sourceKey}:${match[2]}`)}`;
}
export function normalizeReviewRoute(question: QuizQuestion) {
  const reviewUrl = question.reviewUrl || "";
  if (reviewUrl === "#/menu") return directRecipeReviewRoute(question);
  if (reviewUrl.startsWith("#/menu/")) return reviewUrl.slice(1);
  const legacyArticle = reviewUrl.match(/^#\/article\/(lesson-\d+)$/);
  if (legacyArticle) return `/knowledge/${legacyArticle[1]}`;
  if (reviewUrl.startsWith("#/knowledge/")) return reviewUrl.slice(1);
  return null;
}

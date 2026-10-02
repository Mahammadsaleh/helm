import type { CallKit, Digest, Fact, Triage } from "@/lib/ai/schema";

/** Triage per item. Each checkpoint includes the entries for items visible at that time. */
export const TRIAGE: Record<string, Omit<Triage, "itemId">> = {
  "em-1": { bucket: "noise", reason: "Newsletter, nothing time-sensitive", eventId: null },
  "em-2": { bucket: "you", reason: "Needs your signature; blocks Davr data migration", eventId: "ev-davr" },
  "em-3": { bucket: "fyi", reason: "Weekend maintenance, no action", eventId: null },
  "em-4": { bucket: "delegate", reason: "Backlog sorted: 1 article to Davr prep, rest to audio", eventId: null },
  "em-5": { bucket: "delegate", reason: "Routine approvals Maya can clear", eventId: null },
  "em-6": { bucket: "fyi", reason: "Speaking invite, reply next week", eventId: null },
  "em-7": { bucket: "delegate", reason: "Legal summarises the redline before 10:30", eventId: "ev-davr" },
  "em-8": { bucket: "fyi", reason: "Agenda for the 09:45 1:1; feeds the one-pager", eventId: "ev-marcus" },
  "em-9": { bucket: "noise", reason: "Vendor pitch", eventId: null },
  "em-10": { bucket: "noise", reason: "Calendar update, already applied", eventId: null },
  "em-11": { bucket: "you", reason: "Board chair's one-pager, due 17:00", eventId: null },
  "em-12": { bucket: "fyi", reason: "Deck v4: source for one-pager numbers", eventId: "ev-boardprep" },
  "em-13": { bucket: "fyi", reason: "Due next week", eventId: null },
  "em-14": { bucket: "noise", reason: "Facilities notice", eventId: null },
  "em-15": { bucket: "fyi", reason: "Confirms Richard meets investors tomorrow", eventId: null },
  "em-16": { bucket: "you", reason: "Interpreter out for the 10:30 call", eventId: "ev-davr" },
  "em-17": { bucket: "noise", reason: "Automatic reminder", eventId: "ev-davr" },
  "em-18": { bucket: "delegate", reason: "Second DSA chase; covered by your DSA decision", eventId: "ev-davr" },
  "em-19": { bucket: "noise", reason: "Newsletter", eventId: null },
  "em-20": { bucket: "fyi", reason: "Pre-read for the Q3 close review", eventId: "ev-q3close" },
  "em-21": { bucket: "fyi", reason: "Comments due next week", eventId: null },
  "em-22": { bucket: "noise", reason: "Social notification", eventId: null },
  "em-23": { bucket: "fyi", reason: "Supports the press line: the reorg removed no roles", eventId: "ev-reorg" },
  "em-24": { bucket: "you", reason: "Richard wants Davr status in the one-pager", eventId: null },
  "em-25": { bucket: "you", reason: "Reporter's deadline is 16:00", eventId: null },
  "em-26": { bucket: "you", reason: "Statement needs your approval by about 15:00", eventId: null },
  "em-27": { bucket: "you", reason: "Davr terms shifted; legal checks before anything in writing", eventId: null },
  "em-28": { bucket: "delegate", reason: "Third DSA chase; waiting on legal's check", eventId: null },
  "em-29": { bucket: "you", reason: "Corrected Davr numbers; one-pager updated", eventId: null },
  "em-30": { bucket: "you", reason: "Offer decision for Aisha this week", eventId: null },
  "em-31": { bucket: "noise", reason: "Security report, no action", eventId: null },
  "em-32": { bucket: "fyi", reason: "Only sent when nobody approves", eventId: null },
  "sl-0738": { bucket: "delegate", reason: "Assistant out; Maya can cover", eventId: null },
  "sl-0805": { bucket: "fyi", reason: "Tech debt on record; one line in the one-pager", eventId: "ev-product" },
  "sl-0807": { bucket: "noise", reason: "Same as Maya's email", eventId: null },
  "sl-0822": { bucket: "fyi", reason: "1:1 moved to 09:45", eventId: "ev-marcus" },
  "sl-0958": { bucket: "fyi", reason: "Product review ran into Marcus's 1:1", eventId: "ev-marcus" },
  "sl-1042": { bucket: "fyi", reason: "Acme close to signing; one-pager updated", eventId: null },
  "sl-1147": { bucket: "noise", reason: "Status ping, outcome follows", eventId: null },
  "sl-1205": { bucket: "fyi", reason: "TechCorp staying; 15:30 call can shrink", eventId: "ev-techcorp" },
  "sl-1203": { bucket: "fyi", reason: "Comms is drafting a statement for you", eventId: null },
  "sl-1215": { bucket: "fyi", reason: "Richard leaves for the airport around 18:00", eventId: null },
  "sl-1316": { bucket: "you", reason: "Jordan needs a decision before about 15:00", eventId: null },
  "sl-1350": { bucket: "fyi", reason: "Priya's view before your Aisha interview", eventId: "ev-vp-aisha" },
  "sl-1512": { bucket: "noise", reason: "Same as Sarah's correction email", eventId: null },
  "sl-1620": { bucket: "fyi", reason: "Only sent when nobody approves", eventId: null },
  "sl-1640": { bucket: "fyi", reason: "Only sent when nobody approves", eventId: null },
  "doc-davr-brief": { bucket: "fyi", reason: "Call brief for 10:30", eventId: "ev-davr" },
  "doc-q3-notes": { bucket: "fyi", reason: "Raw Q3 notes; some lines are out of date", eventId: null },
  "rd-1": { bucket: "you", reason: "Changes your 10:30 call: new CBU data rules", eventId: "ev-davr" },
  "rd-2": { bucket: "fyi", reason: "In your commute digest", eventId: null },
  "rd-3": { bucket: "fyi", reason: "In your commute digest", eventId: null },
  "rd-4": { bucket: "noise", reason: "In your commute digest", eventId: null },
  "rd-5": { bucket: "noise", reason: "Duplicate of Tom's tech debt note", eventId: null },
};

export function triageFor(itemIds: string[]): Triage[] {
  return itemIds.filter((id) => TRIAGE[id]).map((itemId) => ({ itemId, ...TRIAGE[itemId] }));
}

export const DIGEST: Digest = {
  pulledForward: [
    { itemId: "rd-1", eventId: "ev-davr", reason: "New CBU data rules apply to today's Davr call" },
  ],
  episodes: [
    {
      itemId: "rd-2",
      minutes: 2,
      title: "AI copilots in retail banking",
      script:
        "Banks are rolling out AI copilots for customers and staff, and early adopters report real time savings. The common failure is trust: staff can't tell when the tool is confident and when it is guessing. The three banks profiled fixed this by showing a visible confidence signal next to every AI answer. Worth keeping in mind for the assistant in our own mobile app.",
    },
    {
      itemId: "rd-3",
      minutes: 2,
      title: "Central Asia banking M&A",
      script:
        "Cross-border bank acquisitions in Central Asia have accelerated as larger regional players look beyond saturated home markets. The analysis says integration speed decides success: acquirers that move fast on rebranding and systems migration keep more customers than those that let integration drag past six months. Relevant to the Davr Bank rebranding timeline.",
    },
    {
      itemId: "rd-4",
      minutes: 1,
      title: "Q3 fintech funding",
      script:
        "A short one. AI-native banking startups are taking a growing share of early-stage capital compared with last year.",
    },
  ],
  skipped: [{ itemId: "rd-5", reason: "Same point as Tom's tech debt note this morning" }],
};

export const CALL_KIT: CallKit = {
  eventId: "ev-davr",
  purpose:
    "Align on the open points and next steps. Nothing is signed on this call; sign-off follows in writing, in both languages, after legal review.",
  opening: {
    en: "Thank you for joining. Our interpreter is unwell today, so we will speak slowly and confirm every point in writing afterwards, in Uzbek and Russian. Today we align; we sign later, in writing.",
    uz: "Qo'shilganingiz uchun rahmat. Bugun tarjimonimiz betob, shuning uchun sekin gapiramiz va har bir kelishuvni keyinroq o'zbek va rus tillarida yozma ravishda tasdiqlaymiz. Bugun fikrlarimizni muvofiqlashtiramiz, imzolash esa keyinroq yozma ravishda bo'ladi.",
    ru: "Спасибо, что присоединились. Наш переводчик сегодня заболел, поэтому мы будем говорить медленно и после звонка подтвердим каждый пункт письменно на узбекском и русском языках. Сегодня мы согласовываем позиции, а подписание пройдёт позже в письменном виде.",
  },
  agenda: [
    {
      en: "Data Sharing Agreement: status and signing date. It is needed before any customer data moves.",
      uz: "Ma'lumot almashish to'g'risidagi shartnoma: holati va imzolash sanasi. Mijozlar ma'lumotlari ko'chirilishidan oldin kerak.",
      ru: "Соглашение об обмене данными: статус и дата подписания. Оно необходимо до передачи любых данных клиентов.",
    },
    {
      en: "Integration capital: two tranches, at Day-1 and Day-100. Timing only, no amounts agreed today.",
      uz: "Integratsiya kapitali: ikki transh, birinchi kun va yuzinchi kunda. Bugun faqat muddatlar, summalar kelishilmaydi.",
      ru: "Интеграционный капитал: два транша, в первый и сотый день. Сегодня только сроки, суммы не согласовываем.",
    },
    {
      en: "Steering committee: two seats for Davr Bank leadership.",
      uz: "Boshqaruv qo'mitasi: Davr Bank rahbariyati uchun ikki o'rin.",
      ru: "Руководящий комитет: два места для руководства Давр Банка.",
    },
    {
      en: "Branch rebranding window: 90 days from Day-1, after Central Bank approval.",
      uz: "Filiallarni rebrending qilish muddati: Markaziy bank roziligidan so'ng, birinchi kundan boshlab 90 kun.",
      ru: "Срок ребрендинга отделений: 90 дней с первого дня, после одобрения Центрального банка.",
    },
    {
      en: "Governing law: still open. Our legal teams will meet separately.",
      uz: "Qo'llaniladigan huquq: hali ochiq. Yuristlarimiz alohida uchrashadi.",
      ru: "Применимое право: вопрос открыт. Юристы обсудят его отдельно.",
    },
    {
      en: "Central Bank of Uzbekistan: approval status, and who will be the local data protection contact.",
      uz: "O'zbekiston Respublikasi Markaziy banki: ruxsat holati va ma'lumotlarni himoya qilish bo'yicha mahalliy mas'ul shaxs kim bo'lishi.",
      ru: "Центральный банк Узбекистана: статус одобрения и кто будет местным ответственным за защиту данных.",
    },
  ],
  glossary: [
    { term: "Tranche", en: "A portion of the integration capital released at a milestone.", uz: "Transh: integratsiya kapitalining ma'lum bosqichda ajratiladigan qismi.", ru: "Транш: часть интеграционного капитала, выделяемая по достижении этапа." },
    { term: "Day-1 readiness", en: "When rebranded branches and systems can go live for customers.", uz: "Birinchi kun tayyorgarligi: rebrending qilingan filiallar va tizimlar mijozlar uchun ishga tushadigan payt.", ru: "Готовность к первому дню: момент, когда отделения после ребрендинга и системы начинают работать для клиентов." },
    { term: "Regulatory sign-off", en: "Formal approval from the Central Bank of Uzbekistan, required before rebranding can launch.", uz: "Regulyator roziligi: O'zbekiston Respublikasi Markaziy bankining rasmiy ruxsati; rebrendingdan oldin talab qilinadi.", ru: "Одобрение регулятора: официальное разрешение Центрального банка Узбекистана, необходимое до запуска ребрендинга." },
    { term: "Core banking migration", en: "Moving Davr Bank's systems onto the group's platform.", uz: "Asosiy bank tizimini ko'chirish: Davr Bank tizimlarini guruh platformasiga o'tkazish.", ru: "Миграция АБС: перевод систем Давр Банка на платформу группы." },
    { term: "Retention agreements", en: "Contracts to keep key Davr Bank staff through the transition.", uz: "Xodimlarni saqlab qolish shartnomalari: o'tish davrida asosiy xodimlarni saqlab qolish bo'yicha shartnomalar.", ru: "Соглашения об удержании: договоры о сохранении ключевых сотрудников Давр Банка на переходный период." },
    { term: "Governing law", en: "Which legal system interprets the integration agreement.", uz: "Qo'llaniladigan huquq: integratsiya shartnomasini qaysi huquqiy tizim talqin qilishi.", ru: "Применимое право: правовая система, по которой толкуется соглашение об интеграции." },
    { term: "Data Sharing Agreement", en: "The contract that allows customer data to move between the two banks.", uz: "Ma'lumot almashish to'g'risidagi shartnoma: mijozlar ma'lumotlarini ikki bank o'rtasida uzatishga ruxsat beruvchi shartnoma.", ru: "Соглашение об обмене данными: договор, разрешающий передачу данных клиентов между двумя банками." },
  ],
  doNotCommit: [
    "Governing law. Davr proposed Uzbek law; our legal countered. Leave it to the lawyers.",
    "Tranche amounts or release dates.",
    "A Day-1 date. Central Bank approval is still pending.",
    "Starting data migration. It needs a signed DSA and a designated local data protection contact.",
  ],
  sourceIds: ["doc-davr-brief", "em-7", "em-16", "rd-1"],
};

export const F = {
  nii: {
    key: "q3.nii", section: "highlights",
    text: "Net interest income up ~22% QoQ, mostly from corporate lending.",
    status: "needs-check", check: "QoQ or YoY? Is Davr consolidation in the number?", owner: "sarah",
    sourceIds: ["doc-q3-notes", "em-12"],
  },
  niiVerified: {
    key: "q3.nii", section: "highlights",
    text: "Net interest income up ~22% QoQ, including Davr Bank's first full quarter of consolidation.",
    status: "verified", check: null, owner: "sarah",
    sourceIds: ["em-29", "doc-q3-notes"],
  },
  costIncome: {
    key: "q3.cost_income", section: "highlights",
    text: "Cost-to-income ratio 52% (board deck v4).",
    status: "needs-check", check: "Is v4 still the latest deck?", owner: "sarah",
    sourceIds: ["doc-q3-notes", "em-12"],
  },
  costIncomeVerified: {
    key: "q3.cost_income", section: "highlights",
    text: "Cost-to-income ratio 52%.",
    status: "verified", check: null, owner: "sarah",
    sourceIds: ["em-29", "em-12"],
  },
  ai: {
    key: "q3.ai_assistant", section: "highlights",
    text: "AI assistant in the mobile app shipped 2 weeks early; 40% of eligible customers used it in the first week.",
    status: "verified", check: null, owner: null,
    sourceIds: ["doc-q3-notes"],
  },
  acme: {
    key: "q3.acme", section: "highlights",
    text: "Acme corporate loan, ~$4M facility, could close this quarter.",
    status: "needs-check", check: "Signed or pipeline? Which quarter?", owner: "marcus",
    sourceIds: ["doc-q3-notes", "em-8"],
  },
  acmeUpdated: {
    key: "q3.acme", section: "highlights",
    text: "Acme corporate loan (~$4M facility): legal redlines back, signing expected this week. Pipeline, not booked.",
    status: "needs-check", check: "Count it in Q3 or Q4?", owner: "marcus",
    sourceIds: ["sl-1042", "doc-q3-notes"],
  },
  techcorp: {
    key: "q3.techcorp", section: "highlights",
    text: "TechCorp, previously an attrition risk, confirmed it is staying (12:05).",
    status: "verified", check: null, owner: "lena",
    sourceIds: ["sl-1205"],
  },
  attrition: {
    key: "q3.attrition", section: "risks",
    text: "Customer attrition up to ~3.1% annualized from 2.4% last quarter; the TechCorp account is part of this.",
    status: "verified", check: null, owner: null,
    sourceIds: ["doc-q3-notes"],
  },
  attritionUpdated: {
    key: "q3.attrition", section: "risks",
    text: "Customer attrition up to ~3.1% annualized from 2.4% last quarter. TechCorp, the largest account at risk, is staying.",
    status: "verified", check: null, owner: null,
    sourceIds: ["doc-q3-notes", "sl-1205"],
  },
  competition: {
    key: "q3.competition", section: "risks",
    text: "Competitive pressure from a new digital-only bank in SME lending.",
    status: "verified", check: null, owner: null,
    sourceIds: ["doc-q3-notes"],
  },
  techDebt: {
    key: "q3.tech_debt", section: "risks",
    text: "Notification-system technical debt is growing; not blocking this quarter (raised by Tom).",
    status: "verified", check: null, owner: null,
    sourceIds: ["doc-q3-notes", "sl-0805", "rd-5"],
  },
  capital: {
    key: "davr.capital", section: "davr",
    text: "$18M integration capital, released in two tranches at Day-1 and Day-100; pending Day-1 sign-off.",
    status: "verified", check: null, owner: null,
    sourceIds: ["doc-q3-notes", "em-12"],
  },
  capitalCorrected: {
    key: "davr.capital", section: "davr",
    text: "$18.6M integration capital: $11.2M at Day-1 and $7.4M at Day-100; pending Day-1 sign-off.",
    status: "verified", check: null, owner: "sarah",
    sourceIds: ["em-29"],
  },
  dsa: {
    key: "davr.dsa", section: "davr",
    text: "Data Sharing Agreement unsigned on our side; required before any customer data crosses the border.",
    status: "verified", check: null, owner: "legal",
    sourceIds: ["doc-q3-notes", "em-2", "rd-1"],
  },
  dsaHold: {
    key: "davr.dsa", section: "davr",
    text: "Data Sharing Agreement still unsigned; on hold until legal confirms the term shift does not affect it.",
    status: "needs-check", check: "Legal to confirm", owner: "legal",
    sourceIds: ["em-28", "em-27"],
  },
  callAtRisk: {
    key: "davr.call", section: "davr",
    text: "Day-1 sign-off call at risk: the interpreter cancelled at 10:05.",
    status: "verified", check: null, owner: null,
    sourceIds: ["em-16"],
  },
  callHeld: {
    key: "davr.call", section: "davr",
    text: "Day-1 call held at 10:30 as an alignment call without an interpreter. Sign-off moves to writing, in both languages, after legal review.",
    status: "needs-check", check: "Confirm what was agreed on the call", owner: "ceo",
    sourceIds: ["em-16", "ev-davr"],
  },
  cbu: {
    key: "davr.cbu", section: "davr",
    text: "Central Bank of Uzbekistan approval still pending. New guidance also requires a designated local data protection contact.",
    status: "verified", check: null, owner: null,
    sourceIds: ["doc-davr-brief", "rd-1"],
  },
  terms: {
    key: "davr.terms", section: "davr",
    text: "Integration terms shifted slightly since this morning's board deck; legal is checking before anything is finalised in writing.",
    status: "needs-check", check: "Legal to confirm what changed", owner: "legal",
    sourceIds: ["em-27"],
  },
  rumor: {
    key: "press.rumor", section: "press",
    text: "TechInsight is preparing a story, citing two sources, that the bank plans to lay off ~15% of staff, tied to the digital banking unit.",
    status: "verified", check: null, owner: null,
    sourceIds: ["em-25"],
  },
  statementPending: {
    key: "press.statement", section: "press",
    text: "No layoffs are planned. The rumor appears to stem from last month's reorganisation of digital banking teams, which changed structure, not headcount. Statement awaiting your approval.",
    status: "needs-check", check: "Approve; confirm the line also holds for Davr Bank staff", owner: "ceo",
    sourceIds: ["em-26", "em-23"],
  },
  statementApproved: {
    key: "press.statement", section: "press",
    text: "No layoffs are planned. The rumor appears to stem from last month's reorganisation of digital banking teams, which changed structure, not headcount. Statement approved for release, subject to a group-wide scope check.",
    status: "needs-check", check: "Confirm Jordan sent it before 16:00", owner: "jordan",
    sourceIds: ["em-26", "em-23"],
  },
  itHeadcount: {
    key: "q3.it_headcount", section: "press",
    text: "Internal context: IT headcount grew by 6 this quarter, mostly in digital banking. Not for external use without HR sign-off.",
    status: "verified", check: null, owner: null,
    sourceIds: ["doc-q3-notes"],
  },
} satisfies Record<string, Fact>;

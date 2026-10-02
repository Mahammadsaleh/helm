import type { Item } from "@/lib/types";

const READING_FILE = "07_reading_backlog.txt";

/**
 * Documents from the text files, split by the time each part would exist.
 * The call brief and the Q3 notes were written as of the end of the day; the
 * lines that only exist later (10:05 cancellation, 13:40 CFO flag) are left
 * out here and arrive as their own timestamped emails instead.
 */
export const DOCS: Item[] = [
  {
    id: "doc-davr-brief",
    kind: "doc",
    at: "08:45",
    from: "integration-office",
    ref: "Davr call brief",
    subject: "Davr Bank: Day-1 integration sign-off call",
    text: `Scheduled: 10:30–11:15, Zoom

DEAL CONTEXT
ABB Super Bank completed its acquisition of Davr Bank (Tashkent, Uzbekistan) earlier this year. This call is meant to finalize Day-1 readiness — the operational, legal, and branding milestones that need to be locked before rebranding and systems cutover can proceed.

ATTENDEES
- Bekzod Nazarov — Chairman of the Management Board, Davr Bank. Comfortable with everyday English from prior international dealings, but has said on earlier calls that fast-paced legal and financial terminology is difficult to follow.
- Dilnoza Rashidova — Deputy Chairman & CFO, Davr Bank. Limited spoken English; has relied on interpretation for anything beyond small talk on past calls.
- Interpreter — Nodira.

OUTSTANDING ITEMS GOING INTO THE CALL
1. Data Sharing Agreement (DSA) still unsigned on our side (legal has been chasing since 7:55am). Davr Bank's side is now asking about it directly — it's needed before cross-border customer data can be migrated.
2. Redlined Day-1 integration plan sent by Dilnoza at 8:41am — has not been reviewed yet.

KEY TERMS UNDER DISCUSSION (from the redline)
- Integration capital injection: $18M, released in two tranches tied to Day-1 and Day-100 milestones
- Two seats for Davr Bank leadership on the joint integration steering committee
- Branch rebranding rollout window: 90 days from Day-1
- Governing law for the integration agreement: to be confirmed (Davr Bank proposed Uzbek law; our legal countered with our home jurisdiction)
- Regulatory sign-off from the Central Bank of Uzbekistan still pending

GLOSSARY — TERMS THAT HAVE CAUSED CONFUSION ON PRIOR CALLS
- "Tranche" — a portion of the integration capital released at a milestone
- "Day-1 readiness" — the point at which rebranded branches and systems can go live for customers
- "Regulatory sign-off" — formal approval from the Central Bank of Uzbekistan, required before rebranding can launch
- "Core banking migration" — the technical cutover of Davr Bank's systems onto the parent group's platform
- "Retention agreements" — contracts to keep key Davr Bank staff through the transition period
- "Governing law" — which legal system interprets the integration agreement`,
    provenance: {
      kind: "file",
      file: "03_davr_bank_call_brief.txt",
      note: "Morning version. The 10:05 cancellation and the 1:40pm CFO flag arrive as emails #16 and #27.",
    },
  },
  {
    id: "doc-q3-notes",
    kind: "doc",
    at: "09:05",
    from: "board-sec",
    ref: "Q3 raw notes",
    subject: "Raw notes from the quarter (for Richard's one-pager)",
    text: `--- from Aug board prep doc ---
- net interest income up ~22% QoQ, mostly from corporate lending
- customer attrition ticked up, ~3.1% annualized (was 2.4% last Q) — TechCorp account is part of this
- IT headcount +6 this quarter, mostly the digital banking team
- cost-to-income ratio: 52% (from board deck v4)

--- notes from product review 9/15 ---
new AI assistant in the mobile banking app shipped 2 weeks early, early usage strong (40% of eligible customers used it in the first week)
- one eng lead flagged technical debt in the notification system, "not urgent but growing"

--- notes from sales sync 9/22 ---
pipeline healthy, Acme corporate loan (mentioned by Marcus this AM) could close this quarter, ~$4M facility
- competitive pressure increasing from a new digital-only bank in SME lending

--- Davr Bank integration status ---
- $18M integration capital injection, released in two tranches tied to Day-1 and Day-100 milestones — still pending Day-1 sign-off
- Data Sharing Agreement (DSA) unsigned as of this morning, legal chasing`,
    provenance: {
      kind: "file",
      file: "05_board_chair_request_and_notes.txt",
      note: "Raw notes only. The 1:40pm and interpreter lines arrive later as their own items.",
    },
  },
  {
    id: "rd-1",
    kind: "article",
    at: "08:05",
    from: "reading",
    ref: "Backlog 1",
    subject: "Central Bank of Uzbekistan Tightens Cross-Border Data Rules",
    text: "(Industry brief, saved 2 weeks ago)\nUzbekistan's central bank issued updated guidance this month on cross-border data transfers for financial institutions, tightening requirements around customer data localization and third-party data sharing agreements. Banks operating in or acquiring Uzbek entities will need signed data sharing agreements in place before any customer data can move across borders, and are expected to designate a local data protection contact. Analysts say the rules are aimed at foreign-owned banks completing acquisitions of local players, a category that has grown over the past two years as regional consolidation picks up.",
    provenance: { kind: "file", file: READING_FILE },
  },
  {
    id: "rd-2",
    kind: "article",
    at: "08:05",
    from: "reading",
    ref: "Backlog 2",
    subject: "The Rise of AI Copilots in Retail Banking",
    text: "(Trade publication feature, saved 10 days ago)\nRetail banks are increasingly deploying AI copilots for both customers and staff — from chatbots that handle account questions to internal tools that help relationship managers prep for client meetings. Early adopters report meaningful time savings, but also flag a common failure mode: copilots that are functional but not trusted, because staff can't tell when the tool is confident versus guessing. The piece profiles three banks that solved this by surfacing a visible confidence signal alongside AI-generated answers.",
    provenance: { kind: "file", file: READING_FILE },
  },
  {
    id: "rd-3",
    kind: "article",
    at: "08:05",
    from: "reading",
    ref: "Backlog 3",
    subject: "Regional Banking M&A: What's Next for Central Asia",
    text: "(Market analysis, saved 1 week ago)\nConsolidation among Central Asian banks has accelerated, with several cross-border acquisitions closing this year as larger regional players look to expand beyond saturated home markets. The analysis flags integration speed as the biggest determinant of deal success — acquirers that move fast on rebranding and systems migration retain more customers than those that let integration drag past six months.",
    provenance: { kind: "file", file: READING_FILE },
  },
  {
    id: "rd-4",
    kind: "article",
    at: "08:05",
    from: "reading",
    ref: "Backlog 4",
    subject: "Q3 Fintech Funding Roundup",
    text: "(Newsletter digest, saved 3 days ago)\nA brief roundup of the quarter's notable fintech funding rounds, with a short note on AI-native banking startups pulling an increasing share of early-stage capital compared to last year.",
    provenance: { kind: "file", file: READING_FILE },
  },
  {
    id: "rd-5",
    kind: "article",
    at: "08:05",
    from: "reading",
    ref: "Backlog 5",
    subject: "Internal Memo: Notification System Technical Debt",
    text: "(Forwarded by an eng lead, saved 5 days ago)\nA short internal write-up flagging that the notification system's technical debt is growing. Not urgent enough to block anything this quarter, but the author recommends addressing it before more features are built on top of it.",
    provenance: { kind: "file", file: READING_FILE },
  },
];

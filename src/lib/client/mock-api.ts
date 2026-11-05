/**
 * 임시(mock) 일기 API — docs/API.md 형식 그대로 돌려주는 가짜 서버.
 *
 * 브라우저 메모리에만 데이터를 두므로 새로고침하면 처음 상태로 돌아간다. 서버·DB·로그인이 필요 없다.
 * 실제 API로 바꾸는 방법은 config.ts 의 USE_MOCK_API 를 false 로 바꾸는 것뿐이다.
 *
 * 여러 상황을 다시 만들어 볼 수 있다. (화면 확인과 테스트용)
 *  - 일기를 저장할 때: create 옵션, 또는 "auto" 일 때 본문에 아래 표시를 넣는다.
 *      [실패]      분석 실패 (기본 위로 문구)
 *      [위기]      위기 + 분석 성공 (상담 연락처 상자 + 공감 메시지)
 *      [위기실패]  위기 + 분석 실패 (상담 연락처 상자 + 기본 위로 문구)
 *      [저장오류]  저장 오류 (500)
 *    표시가 없으면 분석 성공이다.
 *  - 목록: list 옵션 (정상 / 불러오기 오류 / 더 보기 오류 / 로그인 필요), 빈 목록은 resetMockApi([])
 *  - 삭제: remove 옵션 (정상 / 오류 / 이미 지워짐 / 로그인 필요), 또는 본문에 [삭제오류] 가 있는 일기
 *  - 한 번에 상황을 고르려면 setMockPreset("empty" | "list-error" | "save-error" | ...)
 */
import {
  ApiClientError,
  INTERNAL_ERROR_MESSAGE,
  NOT_FOUND_MESSAGE,
  UNAUTHORIZED_MESSAGE,
} from "./errors";
import { validateDiaryContent } from "./validation";
import type { EntriesApi, Entry, EntryPage, ListEntriesOptions } from "./types";

export type MockCreateMode =
  | "auto"
  | "success"
  | "failed"
  | "crisis-success"
  | "crisis-failed"
  | "error"
  | "unauthorized";
export type MockListMode = "normal" | "error" | "error-on-more" | "unauthorized";
export type MockRemoveMode = "normal" | "error" | "not-found" | "unauthorized";

export type MockOptions = {
  /** 응답이 오기까지 기다리는 시간(밀리초). 테스트에서는 0 */
  delayMs: number;
  /** 목록 한 번에 돌려줄 개수. 요청에 limit 이 있으면 그 값을 쓴다. */
  pageSize: number;
  create: MockCreateMode;
  list: MockListMode;
  remove: MockRemoveMode;
};

export type MockPreset =
  | "normal"
  | "empty"
  | "list-error"
  | "more-error"
  | "save-error"
  | "delete-error"
  | "unauthorized";

export const DEFAULT_MOCK_OPTIONS: MockOptions = {
  delayMs: 700,
  pageSize: 10,
  create: "auto",
  list: "normal",
  remove: "normal",
};

// ---------- 샘플 데이터 ----------

const MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";

function success(
  id: string,
  createdAt: string,
  content: string,
  emotion: NonNullable<Entry["emotion"]>,
  emotionScore: NonNullable<Entry["emotionScore"]>,
  empathyMessage: string,
): Entry {
  return {
    id,
    content,
    createdAt,
    analysisStatus: "success",
    emotion,
    emotionScore,
    empathyMessage,
    isCrisis: false,
    modelUsed: MODEL,
  };
}

function failed(id: string, createdAt: string, content: string, isCrisis = false): Entry {
  return {
    id,
    content,
    createdAt,
    analysisStatus: "failed",
    emotion: null,
    emotionScore: null,
    empathyMessage: null,
    isCrisis,
    modelUsed: null,
  };
}

/** 위기 + 분석 성공 샘플의 공감 메시지. 밝은 응원 없이 조심스럽게 쓴다. */
const CRISIS_EMPATHY =
  "요즘 마음이 많이 무겁고 지치셨군요. 그런 마음을 적어 주셔서 고마워요. 지금 혼자 견디고 계신 건 아닌지 마음이 쓰여요.";

/** 처음 상태의 샘플 일기 23개 (최신순). 한국 시간으로 여러 날에 걸쳐 있다. */
export function createSeedEntries(): Entry[] {
  return [
    failed("mock-001", "2026-11-05T05:20:00.000Z", "오늘은 그냥 조용히 지나갔다."),
    success(
      "mock-002",
      "2026-11-05T05:12:34.567Z",
      "오늘 친구와 오랜만에 만나서 많이 웃었다.",
      "기쁨",
      4,
      "오랜만에 친구를 만나 많이 웃으셨군요. 마음이 한결 가벼워진 하루였겠어요. 그 따뜻한 기분이 오래 이어지면 좋겠어요.",
    ),
    success(
      "mock-003",
      "2026-11-04T13:40:00.000Z",
      "발표 준비 때문에 밤늦게까지 깨어 있었는데 내일이 걱정된다.",
      "불안",
      3,
      "발표가 코앞이라 마음이 쉽게 놓이지 않으시겠어요. 그만큼 열심히 준비하셨다는 뜻이에요. 오늘은 푹 쉬면서 마음을 달래 보세요.",
    ),
    {
      ...success(
        "mock-004",
        "2026-11-04T10:05:00.000Z",
        "요즘 마음이 많이 무겁고 지쳐서 아무것도 하고 싶지 않다.",
        "슬픔",
        5,
        CRISIS_EMPATHY,
      ),
      isCrisis: true,
    },
    success(
      "mock-005",
      "2026-11-03T11:00:00.000Z",
      "점심에 먹은 김치찌개가 정말 맛있었다. 😋\n내일도 먹고 싶다.",
      "기쁨",
      2,
      "맛있는 점심 덕분에 입가에 웃음이 번졌겠어요. 작은 즐거움이 하루를 든든하게 채워 주었네요.",
    ),
    failed(
      "mock-006",
      "2026-11-03T02:30:00.000Z",
      "마음이 계속 가라앉고 누구에게도 말하고 싶지 않은 날이다.",
      true,
    ),
    success(
      "mock-007",
      "2026-11-02T14:10:00.000Z",
      "회의에서 내 의견이 무시당한 것 같아 화가 났다.",
      "분노",
      4,
      "의견이 가볍게 넘겨진 것 같아 많이 속상하셨겠어요. 화가 난 마음도 자연스러운 반응이에요. 숨을 고르면서 천천히 정리해 보세요.",
    ),
    success(
      "mock-008",
      "2026-11-02T09:00:00.000Z",
      "아침 산책을 하며 낙엽 밟는 소리를 들었다.",
      "평온",
      4,
      "낙엽 밟는 소리를 들으며 걷는 아침이라니, 참 고요하고 편안했겠어요. 그 여유로운 마음이 오늘 하루도 감싸 주면 좋겠어요.",
    ),
    success(
      "mock-009",
      "2026-11-01T12:30:00.000Z",
      "<script>alert('hello')</script> 같은 글자도 그대로 보여야 한다.",
      "평온",
      1,
      "차분하게 하루를 정리하고 계시는군요. 담담한 마음으로 하루를 바라보는 모습이 느껴져요.",
    ),
    success(
      "mock-010",
      "2026-10-31T13:20:00.000Z",
      "비가 와서 하루 종일 집에 있었다. 조금 쓸쓸했다.",
      "슬픔",
      2,
      "비 오는 날 집에만 있으니 쓸쓸한 기분이 드셨군요. 그런 날에는 따뜻한 차 한 잔이 위로가 되기도 해요.",
    ),
    success(
      "mock-011",
      "2026-10-30T10:10:00.000Z",
      "드디어 프로젝트를 끝냈다! 정말 뿌듯하다.",
      "기쁨",
      5,
      "프로젝트를 끝내셨다니 정말 축하드려요. 쏟아부은 노력이 결실을 맺어 얼마나 뿌듯하실지 느껴져요.",
    ),
    failed("mock-012", "2026-10-29T12:00:00.000Z", "오늘은 별일 없이 하루를 보냈다."),
    success(
      "mock-013",
      "2026-10-28T12:45:00.000Z",
      "내일 건강검진 결과가 나온다. 괜히 마음이 두근거린다.",
      "불안",
      4,
      "결과를 기다리는 시간은 유난히 길게 느껴지지요. 마음이 두근거리는 것도 당연해요. 오늘 밤은 편안히 쉬실 수 있기를 바라요.",
    ),
    success(
      "mock-014",
      "2026-10-27T11:15:00.000Z",
      "동생이 내 물건을 말도 없이 가져가서 짜증이 났다.",
      "분노",
      3,
      "말없이 물건을 가져가 버려서 속상하셨겠어요. 짜증이 나는 마음도 충분히 이해돼요.",
    ),
    success(
      "mock-015",
      "2026-10-26T13:00:00.000Z",
      "오랜만에 책을 읽다가 잠깐 졸았다. 나른하고 좋았다.",
      "평온",
      3,
      "책을 읽다 스르르 졸 수 있는 여유라니 참 평화로운 오후였겠어요. 나른한 행복이 느껴져요.",
    ),
    success(
      "mock-016",
      "2026-10-25T14:00:00.000Z",
      "친구와 다퉈서 마음이 무겁다.",
      "슬픔",
      3,
      "친구와 다투고 나니 마음이 무거우셨겠어요. 그만큼 소중한 사이라는 뜻이기도 해요.",
    ),
    success(
      "mock-017",
      "2026-10-24T09:30:00.000Z",
      "새로 산 운동화를 신고 출근했다. 발걸음이 가볍다.",
      "기쁨",
      3,
      "새 운동화처럼 발걸음도 마음도 가벼운 아침이었겠어요. 기분 좋은 시작이 하루를 따라가면 좋겠어요.",
    ),
    failed("mock-018", "2026-10-23T12:00:00.000Z", "저녁에 라면을 끓여 먹었다."),
    success(
      "mock-019",
      "2026-10-22T15:00:00.000Z",
      "면접 결과를 기다리는 중이라 잠이 오지 않는다.",
      "불안",
      5,
      "결과를 기다리느라 잠이 오지 않으시는군요. 많이 긴장되실 텐데, 여기까지 오신 것만으로도 충분히 애쓰셨어요.",
    ),
    success(
      "mock-020",
      "2026-10-21T10:00:00.000Z",
      "창가에 앉아 햇살을 쬐며 커피를 마셨다.",
      "평온",
      5,
      "따스한 햇살 속에서 커피를 마시는 시간이 참 평온했겠어요. 그 고요한 순간을 마음에 담아 두세요.",
    ),
    success(
      "mock-021",
      "2026-10-20T12:00:00.000Z",
      "버스를 놓쳐서 지각했다. 하루 시작부터 꼬였다.",
      "분노",
      2,
      "버스를 놓쳐 하루가 꼬이는 기분이셨겠어요. 속상한 마음이 이해돼요. 남은 하루는 조금 더 순탄하길 바라요.",
    ),
    success(
      "mock-022",
      "2026-10-19T13:00:00.000Z",
      "가족과 저녁을 먹으며 이야기를 많이 나눴다.",
      "기쁨",
      3,
      "가족과 오붓하게 이야기를 나눈 저녁이었군요. 함께하는 시간이 마음을 든든하게 채워 주었겠어요.",
    ),
    success(
      "mock-023",
      "2026-10-18T14:30:00.000Z",
      "일요일 오후, 아무 계획 없이 쉬었다.",
      "평온",
      2,
      "계획 없이 푹 쉬는 일요일 오후도 꼭 필요하지요. 편안히 쉬신 하루가 다음 한 주의 힘이 되어 줄 거예요.",
    ),
  ];
}

// ---------- 상태 (브라우저 메모리) ----------

let options: MockOptions = { ...DEFAULT_MOCK_OPTIONS };
let store: Entry[] = createSeedEntries();
let newEntryCounter = 0;

/** 옵션 일부를 바꾼다. (예: setMockOptions({ delayMs: 0, create: "failed" })) */
export function setMockOptions(patch: Partial<MockOptions>): void {
  options = { ...options, ...patch };
}

export function getMockOptions(): MockOptions {
  return { ...options };
}

/** 옵션과 저장된 일기를 처음 상태로 되돌린다. entries 를 주면 그 목록으로 시작한다. ([] 는 빈 목록) */
export function resetMockApi(entries?: Entry[], patch?: Partial<MockOptions>): void {
  options = { ...DEFAULT_MOCK_OPTIONS, ...patch };
  store = entries ? [...entries] : createSeedEntries();
  newEntryCounter = 0;
}

/** 상황 이름으로 한 번에 설정한다. (화면 확인용. 응답 지연 시간은 유지한다.) */
export function setMockPreset(preset: MockPreset): void {
  const delayMs = options.delayMs;
  switch (preset) {
    case "empty":
      resetMockApi([], { delayMs });
      return;
    case "list-error":
      resetMockApi(undefined, { delayMs, list: "error" });
      return;
    case "more-error":
      resetMockApi(undefined, { delayMs, list: "error-on-more" });
      return;
    case "save-error":
      resetMockApi(undefined, { delayMs, create: "error" });
      return;
    case "delete-error":
      resetMockApi(undefined, { delayMs, remove: "error" });
      return;
    case "unauthorized":
      resetMockApi(undefined, {
        delayMs,
        create: "unauthorized",
        list: "unauthorized",
        remove: "unauthorized",
      });
      return;
    default:
      resetMockApi(undefined, { delayMs });
  }
}

// ---------- 내부 도구 ----------

async function wait(): Promise<void> {
  if (options.delayMs <= 0) return;
  await new Promise<void>((resolve) => setTimeout(resolve, options.delayMs));
}

const unauthorized = () =>
  new ApiClientError({ status: 401, code: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE });
const internal = () =>
  new ApiClientError({ status: 500, code: "INTERNAL_ERROR", message: INTERNAL_ERROR_MESSAGE });
const notFound = () =>
  new ApiClientError({ status: 404, code: "NOT_FOUND", message: NOT_FOUND_MESSAGE });

type CreateOutcome = "success" | "failed" | "crisis-success" | "crisis-failed" | "error";

/** "auto" 이면 본문의 표시로 결과를 정한다. */
function resolveOutcome(content: string): CreateOutcome {
  const mode = options.create;
  if (mode !== "auto" && mode !== "unauthorized") return mode;
  if (content.includes("[저장오류]")) return "error";
  if (content.includes("[위기실패]")) return "crisis-failed";
  if (content.includes("[위기]")) return "crisis-success";
  if (content.includes("[실패]")) return "failed";
  return "success";
}

function cursorOf(entry: Entry): string {
  return `mock:${entry.id}`;
}

// ---------- API 구현 ----------

export const mockEntriesApi: EntriesApi = {
  async createEntry(content) {
    await wait();
    if (options.create === "unauthorized") throw unauthorized();

    // 서버와 같은 입력 검증 (400)
    const checked = validateDiaryContent(content);
    if (!checked.ok) {
      throw new ApiClientError({
        status: 400,
        code: "VALIDATION_ERROR",
        message: checked.message,
        details: [{ field: "content", code: checked.code, message: checked.message }],
      });
    }

    const outcome = resolveOutcome(checked.content);
    if (outcome === "error") throw internal();

    newEntryCounter += 1;
    const id = `mock-new-${newEntryCounter}`;
    const createdAt = new Date().toISOString();

    let entry: Entry;
    switch (outcome) {
      case "failed":
        entry = failed(id, createdAt, checked.content);
        break;
      case "crisis-failed":
        entry = failed(id, createdAt, checked.content, true);
        break;
      case "crisis-success":
        entry = {
          ...success(id, createdAt, checked.content, "슬픔", 4, CRISIS_EMPATHY),
          isCrisis: true,
        };
        break;
      default:
        entry = success(
          id,
          createdAt,
          checked.content,
          "평온",
          3,
          "오늘의 마음을 한 줄로 차분히 남겨 주셨군요. 스스로를 돌아보는 시간을 가진 것만으로도 충분히 잘하신 거예요. 편안한 하루가 되길 바라요.",
        );
    }

    store = [entry, ...store];
    return entry;
  },

  async listEntries(listOptions: ListEntriesOptions = {}): Promise<EntryPage> {
    await wait();
    if (options.list === "unauthorized") throw unauthorized();
    if (options.list === "error") throw internal();
    if (options.list === "error-on-more" && listOptions.cursor) throw internal();

    const limit = listOptions.limit ?? options.pageSize;
    let start = 0;
    if (listOptions.cursor) {
      const index = store.findIndex((entry) => cursorOf(entry) === listOptions.cursor);
      if (index === -1) {
        throw new ApiClientError({
          status: 400,
          code: "VALIDATION_ERROR",
          message: "요청 값이 올바르지 않아요.",
          details: [
            { field: "cursor", code: "invalid_cursor", message: "요청 값이 올바르지 않아요." },
          ],
        });
      }
      start = index + 1;
    }

    const entries = store.slice(start, start + limit);
    const hasMore = start + limit < store.length;
    return {
      entries,
      nextCursor: hasMore && entries.length > 0 ? cursorOf(entries[entries.length - 1]) : null,
    };
  },

  async getEntry(id) {
    await wait();
    if (options.list === "unauthorized") throw unauthorized();
    const entry = store.find((item) => item.id === id);
    if (!entry) throw notFound();
    return entry;
  },

  async deleteEntry(id) {
    await wait();
    if (options.remove === "unauthorized") throw unauthorized();
    if (options.remove === "error") throw internal();
    if (options.remove === "not-found") throw notFound();

    const entry = store.find((item) => item.id === id);
    if (!entry) throw notFound();
    if (entry.content.includes("[삭제오류]")) throw internal();
    store = store.filter((item) => item.id !== id);
  },
};

import { auth } from "@/auth";

/**
 * 세션에서 로그인한 사용자의 id(구글 계정 ID)를 꺼낸다.
 * 로그인하지 않았거나 id가 비어 있으면 null — 호출하는 쪽이 401을 돌려준다.
 *
 * 사용자 구분은 오직 이 값으로만 한다. 요청 본문·주소·쿼리의 user_id는 읽지 않는다.
 */
export async function getSessionUserId(): Promise<string | null> {
  const session = await auth();
  const id = session?.user?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

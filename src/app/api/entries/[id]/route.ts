import { deleteEntry, findEntry } from "@/lib/db";

import { toEntry } from "../../_lib/entry";
import {
  internalError,
  jsonResponse,
  logServerError,
  notFound,
  unauthorized,
} from "../../_lib/responses";
import { getSessionUserId } from "../../_lib/session";
import { isEntryId } from "../../_lib/validation";

/**
 * /api/entries/[id] — 내 일기 하나(GET), 내 일기 삭제(DELETE). 약속: docs/API.md 5.3, 5.4
 *
 * 없는 id, 남의 일기 id, uuid 형식이 아닌 id는 모두 똑같은 404다. (존재 여부를 알려 주지 않는다.)
 * 쿼리에는 항상 세션의 user_id 조건이 붙는다. 주소의 id는 일기 번호일 뿐 사용자를 정하지 못한다.
 */

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    const { id } = await context.params;
    if (!isEntryId(id)) return notFound();

    const row = await findEntry(userId, id);
    if (!row) return notFound();
    return jsonResponse({ entry: toEntry(row) });
  } catch (error) {
    logServerError("GET /api/entries/[id]", error);
    return internalError();
  }
}

export async function DELETE(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    const { id } = await context.params;
    if (!isEntryId(id)) return notFound();

    // 실제로 지운다. 남의 일기·없는 일기·이미 지운 일기는 지워진 행이 없으므로 404다.
    const deletedId = await deleteEntry(userId, id);
    if (!deletedId) return notFound();
    return jsonResponse({ deleted: true, id: deletedId });
  } catch (error) {
    logServerError("DELETE /api/entries/[id]", error);
    return internalError();
  }
}

import type { Person } from "@/types/identity";
export type PersonChoice = Pick<Person, "id" | "name" | "roles" | "status">;
/** Cookies are sent only to this origin; a 401 never selects a replacement actor. */
export async function actorFetch(input: string, init: RequestInit = {}) {
  return fetch(input, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
  });
}
async function decode<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.error?.code ?? data.message ?? "Local identity unavailable.",
    );
  return data;
}
/** Bounded GET bootstrap/catalog reads; command transports and retry semantics stay unchanged. */
export async function readLocalApi<T>(path: string): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      actorFetch(path, { signal: controller.signal }).then(decode<T>),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error("LOCAL_PREVIEW_TIMEOUT"));
          controller.abort();
        }, 15000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export function isLocalSessionError(code: string) {
  return [
    "LOCAL_SESSION_REQUIRED",
    "LOCAL_SESSION_INVALID",
    "LOCAL_PERSON_UNAVAILABLE",
    "CANONICAL_PERSON_UNAVAILABLE",
  ].includes(code);
}
export function localIdentityMessage(code: string) {
  if (
    code === "LOCAL_ACTOR_DISABLED" ||
    code === "LOCAL_ORIGIN_UNCONFIGURED" ||
    code === "LOOPBACK_LISTENER_UNVERIFIED"
  )
    return "Local identity is unavailable. Start the preview in local-development mode on its configured loopback origin, then select a user in Me.";
  if (code === "LOCAL_PREVIEW_TIMEOUT")
    return "The local preview did not respond. Try again, or open Me to check your local identity.";
  if (
    [
      "LOCAL_SESSION_REQUIRED",
      "LOCAL_SESSION_INVALID",
      "LOCAL_PERSON_UNAVAILABLE",
      "CANONICAL_PERSON_UNAVAILABLE",
    ].includes(code)
  )
    return "Select a local identity in Me to load the asset database. Your previous session may have expired.";
  return code || "Select a local identity in Me to load the asset database.";
}
export async function fetchActorPerson() {
  return readLocalApi<Person>("/api/actor/person");
}
export async function fetchDevelopmentPeople() {
  return readLocalApi<PersonChoice[]>("/api/development/session");
}
export async function selectDevelopmentPerson(personId: string) {
  await decode(
    await actorFetch("/api/development/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId }),
    }),
  );
  return fetchActorPerson();
}
export async function fetchReviewerPeople() {
  return decode<PersonChoice[]>(await actorFetch("/api/booking/reviewers"));
}

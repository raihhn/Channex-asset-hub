import type { CurrentUser } from "@/types/auth";
import { defaultCurrentUserId, peopleFixtures } from "@/lib/fixtures/people";

/** Fixture-only account identity used by the prototype until auth is introduced. */
const defaultPerson = peopleFixtures.find((person) => person.id === defaultCurrentUserId)!;
export const currentUser: CurrentUser = {
  id: defaultPerson.id,
  displayName: defaultPerson.name,
  email: defaultPerson.email,
  capabilities: ["asset:read", "request:create"],
};

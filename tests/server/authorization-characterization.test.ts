import { ActorResolutionError } from "@/server/auth/actor-context";
import { createElement, type ReactNode } from "react";
import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PrototypeProvider,
  usePrototype,
} from "@/features/prototype/prototype-provider";
import { AdminScreen } from "@/features/admin/admin-screen";
import { peopleFixtures } from "@/lib/fixtures/people";
import { prototypeAssets } from "@/lib/fixtures/prototype-data";
import {
  isAssignableReviewer,
  validateReviewerAssignment,
  validateReviewDecision,
} from "@/lib/domain/approvals";
import { scopeWarnings, validatePersonDraft } from "@/lib/domain/people";
import { validateFinancialReferenceEditor } from "@/lib/domain/financial-references";
import { getCurrentSession, getCurrentUser } from "@/server/auth/session";
import {
  sessionHasCapability,
  hasCapability,
} from "@/server/authorization/capabilities";
import {
  submitBooking,
  resubmitBooking,
} from "@/lib/server/booking";
import {
  vendorActor,
  operationalVendorActor,
  listVendors,
  saveVendor,
} from "@/lib/server/vendors";
import {
  GET as getBookings,
  POST as postBooking,
} from "@/app/api/booking/requests/route";
import type { Person, PersonDraft, UserRole } from "@/types/identity";
import type {
  ApprovalAssignment,
  PrototypeRequest,
  RequestDraft,
} from "@/types/prototype";

// No real pg implementation is loaded. SQL writes below affect test doubles only.
const db = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
  release: vi.fn(),
}));
vi.mock("pg", () => ({
  default: {
    Pool: class {
      query(...args: unknown[]) {
        return db.query(...args);
      }
      connect() {
        return db.connect();
      }
    },
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/components/shared/use-vendor-locations", () => ({
  useVendorLocations: () => ({
    vendorLocations: [],
    vendorLoading: false,
    vendorError: "",
  }),
}));
vi.mock("@/components/shared/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => children,
}));
// Test the real parent visibility gate without exercising child editor UI.
vi.mock("@/features/admin/people-master-screen", () => ({
  PeopleMasterScreen: () => "people-editor-probe",
}));

const admin = peopleFixtures.find((p) => p.id === "dev-user")!;
const brand = peopleFixtures.find((p) => p.id === "user-brand")!;
const vendor = peopleFixtures.find((p) => p.id === "user-vendor")!;
const roles: UserRole[] = [
  "REQUESTER",
  "STORE_DEV",
  "BRAND",
  "VENDOR",
  "SUPER_ADMIN",
  "MANAGEMENT",
];
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(PrototypeProvider, null, children);
const personDraft = (): PersonDraft => ({
  name: "Characterization Person",
  email: "characterization@example.test",
  roles: ["REQUESTER"],
  status: "ACTIVE",
  brandIds: [],
  categoryIds: [],
  areaIds: [],
  dcIds: [],
});
const draft = (): RequestDraft => ({
  projectName: "Policy characterization",
  projectAddress: "Test venue",
  destination: "Test venue",
  purpose: "Characterization",
  contact: "Physical PIC",
  budgetCode: "TEST",
  startDate: "2026-11-12",
  endDate: "2026-11-13",
  boothType: "Custom Booth",
  items: [],
  wbsCodes: [],
});
const request = (): PrototypeRequest => ({
  ...draft(),
  items: [],
  id: "REQ-TEST",
  status: "Pending approval",
  submittedByUserId: brand.id,
  submittedAt: "2026-10-22",
  reviewRound: 2,
});
const assignment = (): ApprovalAssignment => ({
  id: "assignment-test",
  requestId: "REQ-TEST",
  reviewerUserId: brand.id,
  cycle: 2,
  sequence: 1,
  status: "Pending",
  assignedAt: "2026-10-22",
  assignedByUserId: admin.id,
});
const vendorRequest = (
  id: string,
  url = "http://localhost/api/vendors",
  origin?: string,
) =>
  new Request(url, {
    headers: { cookie: `test-person=${id}`, ...(origin ? { origin } : {}) },
  });

async function mountProvider() {
  const hook = renderHook(() => usePrototype(), { wrapper });
  await waitFor(() => expect(hook.result.current.assetLoading).toBe(false));
  return hook;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv(
    "ASSETHUB_DATABASE_URL",
    "postgresql://127.0.0.1:1/never_connect_characterization",
  );
  vi.stubEnv("ASSETHUB_VENDOR_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_ASSETHUB_BOOKING_ENABLED", "true");
  db.query.mockImplementation(() => {
    throw new Error("Unexpected SQL in characterization double");
  });
  db.connect.mockResolvedValue({ query: db.query, release: db.release });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url !== "/api/assets") throw new Error("Unexpected network request");
      return Response.json({ assets: [], internalWarehouses: [] });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("M1-A session and development identity characterization", () => {
  it("keeps default capabilities separate from the same Person's Super Admin role", async () => {
    const session = await getCurrentSession();
    expect(session).toMatchObject({
      source: "development",
      user: {
        id: admin.id,
        displayName: "Development workspace",
        capabilities: ["asset:read", "request:create"],
      },
    });
    expect(admin.roles).toContain("SUPER_ADMIN");
    expect(await hasCapability("master-data:manage")).toBe(false);
    expect(sessionHasCapability(session, "request:approve")).toBe(false);
    expect(sessionHasCapability(null, "asset:read")).toBe(false);
  });
  it("has no provider or development fallback in the production session adapter", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await getCurrentSession()).toBeNull();
    expect(await getCurrentUser()).toBeNull();
    expect(await hasCapability("asset:read")).toBe(false);
  });
  it("switches only to an active browser Person; legacy role view does not select the server actor", async () => {
    const { result } = await mountProvider();
    act(() => result.current.setRole("System Admin"));
    expect(result.current.currentUser.id).toBe(admin.id);
    await act(async () => result.current.setCurrentUserId(vendor.id));
    expect(result.current.currentUser.id).toBe(vendor.id);
    expect(() =>
      result.current.registerAsset({ ...prototypeAssets[0], totalQuantity: 1 }),
    ).toThrow(/StoreDev or Super Admin/);
    expect((await getCurrentUser())?.id).toBe(admin.id);
    expect(() => result.current.setCurrentUserId("not-a-person")).toThrow(
      /active prototype user/,
    );
    act(() => result.current.setPersonStatus(brand.id, "INACTIVE"));
    expect(() => result.current.setCurrentUserId(brand.id)).toThrow(
      /active prototype user/,
    );
    // Existing fixture bridge is independent of mutable UI People, not verified authentication.
    expect(policyPerson(brand.id).status).toBe("ACTIVE");
  });
  it("does not turn scopes into routing/grants or require a corporate email domain", () => {
    expect(() => validatePersonDraft(personDraft())).not.toThrow();
    expect(scopeWarnings({ ...personDraft(), roles: ["STORE_DEV"] })).toEqual([
      "StoreDev scope not configured; no routing is inferred.",
    ]);
    expect(() =>
      validatePersonDraft({
        ...personDraft(),
        areaIds: ["warehouse-jakarta-hub"],
      }),
    ).toThrow(/organizational/);
    expect(() =>
      validatePersonDraft({ ...personDraft(), roles: ["VENDOR"] }),
    ).toThrow(/registered Vendor/);
  });
});

describe("M1-A asset registration and People provider boundaries", () => {
  it.each(roles)(
    "characterizes registration for %s without inferring scope permissions",
    async (role) => {
      const { result } = await mountProvider();
      let id = "";
      act(() => {
        id = result.current.createPerson({
          ...personDraft(),
          roles: [role],
          ...(role === "VENDOR" ? { vendorId: vendor.vendorId } : {}),
        }).id;
      });
      await act(async () => result.current.setCurrentUserId(id));
      const asset = {
        ...prototypeAssets[0],
        id: "asset-characterization",
        name: "Test asset",
        totalQuantity: 1,
        unitPolicy: { stockUnit: "Unit" as const },
      };
      if (["STORE_DEV", "SUPER_ADMIN"].includes(role)) {
        // Same role permission, but the approved durable contract no longer accepts
        // a fixture Asset as successful session-only registration.
        expect(() => result.current.registerAsset(asset)).toThrow(/complete draft/);
        expect(result.current.assets.find(a=>a.id===asset.id)).toBeUndefined();
      } else
        expect(() => result.current.registerAsset(asset)).toThrow(
          /StoreDev or Super Admin/,
        );
    },
  );
  it("preserves People validation and dedicated self-inactivation rejection", async () => {
    const { result } = await mountProvider();
    expect(() => result.current.setPersonStatus(admin.id, "INACTIVE")).toThrow(
      /Switch prototype user/,
    );
    expect(() =>
      result.current.createPerson({
        ...personDraft(),
        email: admin.email.toUpperCase(),
      }),
    ).toThrow(/already registered/);
    let id = "";
    act(() => {
      id = result.current.createPerson(personDraft()).id;
    });
    expect(() =>
      result.current.updatePerson(id, {
        ...personDraft(),
        email: brand.email.toUpperCase(),
      }),
    ).toThrow(/already registered/);
    act(() => result.current.setPersonStatus(id, "INACTIVE"));
    expect(result.current.people.find((p) => p.id === id)?.status).toBe(
      "INACTIVE",
    );
  });
  it("records the general-edit self-inactivation bypass as an inconsistency, not approved policy", async () => {
    const { result } = await mountProvider();
    const {
      id: _id,
      createdAt: _created,
      updatedAt: _updated,
      ...self
    } = admin;
    act(() =>
      result.current.updatePerson(admin.id, { ...self, status: "INACTIVE" }),
    );
    expect(result.current.currentUser.status).toBe("INACTIVE");
  });
  it("does not invent self-role or last-admin protection for the existing general edit action", async () => {
    const { result } = await mountProvider();
    const {
      id: _id,
      createdAt: _created,
      updatedAt: _updated,
      ...self
    } = admin;
    act(() =>
      result.current.updatePerson(admin.id, { ...self, roles: ["REQUESTER"] }),
    );
    expect(result.current.currentUser.roles).toEqual(["REQUESTER"]);
    expect(
      result.current.people.some((p) => p.roles.includes("SUPER_ADMIN")),
    ).toBe(false);
  });
  it("distinguishes the Super Admin People screen gate from unguarded provider mutations", async () => {
    let store: ReturnType<typeof usePrototype> | undefined;
    function Probe() {
      store = usePrototype();
      return createElement(AdminScreen, { section: "users" });
    }
    render(createElement(PrototypeProvider, null, createElement(Probe)));
    await waitFor(() => expect(store?.assetLoading).toBe(false));
    expect(screen.getByText("people-editor-probe")).toBeInTheDocument();
    await act(async () => store!.setCurrentUserId(vendor.id));
    expect(screen.queryByText("people-editor-probe")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Global administration is not visible for this prototype user.",
      ),
    ).toBeInTheDocument();
    let id = "";
    act(() => {
      id = store!.createPerson(personDraft()).id;
    });
    act(() =>
      store!.updatePerson(id, {
        ...personDraft(),
        name: "Changed via provider",
      }),
    );
    act(() => store!.setPersonStatus(id, "INACTIVE"));
    expect(store!.people.find((p) => p.id === id)).toMatchObject({
      name: "Changed via provider",
      status: "INACTIVE",
    });
  });
});

describe("M1-A confirmed review rules", () => {
  it.each(roles)(
    "requires Super Admin to assign, independently of %s scope/role",
    (role) => {
      const actor: Person = {
        ...admin,
        id: "assigner",
        roles: [role],
        brandIds: [],
        categoryIds: [],
        areaIds: [],
        dcIds: [],
      };
      const action = () =>
        validateReviewerAssignment(
          { ...request(), submittedByUserId: admin.id },
          brand,
          actor,
          [],
        );
      if (role === "SUPER_ADMIN") expect(action).not.toThrow();
      else expect(action).toThrow(/Super Admin/);
    },
  );
  it("excludes inactive and all Vendor-role combinations from assignment, and rejects self-review", () => {
    for (const reviewer of [
      vendor,
      { ...brand, status: "INACTIVE" as const },
      { ...admin, roles: ["SUPER_ADMIN", "VENDOR"] as UserRole[] },
    ]) {
      expect(isAssignableReviewer(reviewer)).toBe(false);
      expect(() =>
        validateReviewerAssignment(request(), reviewer, admin, []),
      ).toThrow(/active internal/);
    }
    expect(() =>
      validateReviewerAssignment(request(), brand, admin, []),
    ).toThrow(/own Request/);
    expect(() =>
      validateReviewerAssignment(
        { ...request(), submittedByUserId: admin.id },
        brand,
        admin,
        [assignment()],
      ),
    ).toThrow(/already assigned/);
  });
  it("does not allow Super Admin to override the assigned reviewer", () => {
    expect(() =>
      validateReviewDecision(request(), assignment(), admin, "Approved", ""),
    ).toThrow(/No admin override/);
    expect(() =>
      validateReviewDecision(request(), assignment(), brand, "Approved", ""),
    ).not.toThrow();
  });
  it("requires the active cycle and reasons for negative decisions", () => {
    expect(() =>
      validateReviewDecision(
        request(),
        { ...assignment(), cycle: 1 },
        brand,
        "Approved",
        "",
      ),
    ).toThrow(/active review assignment/);
    expect(() =>
      validateReviewDecision(
        request(),
        { ...assignment(), status: "Superseded" },
        brand,
        "Approved",
        "",
      ),
    ).toThrow(/active review assignment/);
    for (const decision of ["Rejected", "Needs update"] as const)
      expect(() =>
        validateReviewDecision(request(), assignment(), brand, decision, " "),
      ).toThrow(/reason/);
  });
});

// Persistence is stubbed, while real booking service authorization/validation executes.
function stubBookingRows(
  owner = brand.id,
  status = "Needs update",
  version = 1,
) {
  db.query.mockImplementation(async (sql: string) => {
    let rows: unknown[] = [];
    if (sql.startsWith("select 'REQ-'"))
      rows = [{ request_number: "REQ-TEST" }];
    else if (sql.includes("from booking.requests where request_number=$1"))
      rows = [
        {
          id: "00000000-0000-4000-8000-000000000001",
          request_number: "REQ-TEST",
          status,
          version,
          review_round: 1,
          submitted_by_user_id: owner,
          start_date: draft().startDate,
          end_date: draft().endDate,
          payload: draft(),
          submitted_at: "2026-10-22",
        },
      ];
    else if (
      !/^(begin|commit|rollback|select pg_advisory|select .*booking\.(command_receipts|request_items|request_groups|request_wbs|review_history)|delete from booking\.|insert into booking\.|update booking\.)/s.test(
        sql,
      )
    )
      throw new Error("Unrecognized SQL in disconnected booking double");
    return { rows, rowCount: rows.length };
  });
}
const commandKey = "00000000-0000-4000-8000-000000000002";

describe("M1-A real booking service with disconnected SQL", () => {
  it.each(peopleFixtures.map((p) => p.id))(
    "submission has no extra role restriction for active fixture %s",
    async (id) => {
      stubBookingRows(id, "Pending approval");
      const saved = await submitBooking(
        draft(),
        policyPerson(id),
        commandKey,
      );
      expect(saved.submittedByUserId).toBe(id);
      expect(db.query).toHaveBeenCalledWith("commit");
    },
  );
  it.each([null, "unknown-person"])(
    "rejects a missing/unknown actor %s",
    (id) => {
      expect(() => policyPerson(id)).toThrow(/active prototype user/);
    },
  );
  it.each(["owner", "admin"])(
    "allows %s resubmission through the existing service guard",
    async (kind) => {
      stubBookingRows();
      const saved = await resubmitBooking(
        "REQ-TEST",
        draft(),
        kind === "owner" ? brand : admin,
        1,
        commandKey,
      );
      expect(saved.id).toBe("REQ-TEST");
      expect(db.query).toHaveBeenCalledWith("commit");
    },
  );
  it("rejects another requester, wrong status and stale version without committing", async () => {
    stubBookingRows();
    await expect(
      resubmitBooking("REQ-TEST", draft(), vendor, 1, commandKey),
    ).rejects.toThrow(/Only the requester/);
    stubBookingRows(brand.id, "Approved");
    await expect(
      resubmitBooking("REQ-TEST", draft(), brand, 1, commandKey),
    ).rejects.toThrow(/needing an update/);
    stubBookingRows(brand.id, "Needs update", 2);
    await expect(
      resubmitBooking("REQ-TEST", draft(), brand, 1, commandKey),
    ).rejects.toMatchObject({ code: "STALE" });
    expect(db.query).not.toHaveBeenCalledWith("commit");
  });
  it("rejects headerless booking POST at the actual route before a transaction", async () => {
    const response = await postBooking(
      new Request("http://localhost/api/booking/requests", {
        method: "POST",
        body: JSON.stringify({ draft: draft(), commandKey }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: {code: "LOCAL_SESSION_REQUIRED"} });
    expect(db.connect).not.toHaveBeenCalled();
  });
  it("requires a trusted actor for booking GET without changing the successful projection", async () => {
    db.query.mockResolvedValue({ rows: [] });
    const response = await getBookings(vendorRequest(admin.id));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      requests: [],
      assignments: [],
    });
    expect(db.connect).toHaveBeenCalled();
  });
});

describe("M1-A vendor and manual financial-reference authorization", () => {
  it("allows active non-admin operational lookup but rejects vendor administration", async () => {
    expect((await operationalVendorActor(vendorRequest(vendor.id))).id).toBe(vendor.id);
    await expect(vendorActor(vendorRequest(vendor.id))).rejects.toThrow(/Super Admin/);
    expect((await vendorActor(vendorRequest(admin.id))).id).toBe(admin.id);
    expect(db.connect).not.toHaveBeenCalled();
  });
  it("enforces repository administration against canonical fixtures, not supplied role claims", async () => {
    db.query.mockResolvedValue({ rows: [] });
    await expect(listVendors(admin)).resolves.toEqual([]);
    const forged = { ...vendor, roles: ["SUPER_ADMIN"] as UserRole[] };
    await expect(listVendors(forged)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(saveVendor({}, forged)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.connect).not.toHaveBeenCalled();
  });
  it("rejects remote, cross-origin and missing-session vendor requests", async () => {
    await expect(vendorActor(vendorRequest(admin.id,"https://example.test/api/vendors"))).rejects.toMatchObject({code:"LOCAL_ORIGIN_REJECTED"});
    await expect(vendorActor(vendorRequest(admin.id,"http://localhost/api/vendors","https://example.test"))).rejects.toMatchObject({code:"LOCAL_ORIGIN_REJECTED"});
    await expect(vendorActor(new Request("http://localhost/api/vendors"))).rejects.toMatchObject({code:"LOCAL_SESSION_REQUIRED"});
  });
  it.each(roles)(
    "keeps the financial-reference editor restricted for %s",
    (role) => {
      const action = () =>
        validateFinancialReferenceEditor({ ...admin, roles: [role] });
      if (role === "SUPER_ADMIN") expect(action).not.toThrow();
      else expect(action).toThrow(/Super Admin/);
    },
  );
});

// Policy tests deliberately isolate local browser state from the authenticated transport.
vi.mock("@/features/prototype/use-local-identity", async () => {
 const {peopleFixtures} = await import("@/lib/fixtures/people");
 return {useLocalIdentity:()=>({person:peopleFixtures[0],choices:peopleFixtures,loading:false,error:"",select:vi.fn(),epoch:0})};
});

function policyPerson(id:string|null) {
 const person=peopleFixtures.find(p=>p.id===id&&p.status==="ACTIVE");
 if(!person)throw new Error("Choose an active prototype user.");
 return person;
}
vi.mock("@/server/people/canonical", async () => {
 const {peopleFixtures}=await import("@/lib/fixtures/people");
 const lookup=(id:string)=>peopleFixtures.find(p=>p.id===id&&p.status==="ACTIVE")??null;
 return {findCanonicalPerson:async(id:string)=>lookup(id),requireCanonicalPerson:async(id:string)=>{
  const person=lookup(id);if(!person)throw new ActorResolutionError(401,"CANONICAL_PERSON_UNAVAILABLE");return person;
 }};
});
vi.mock("@/server/auth/resolve-actor", async () => {
 const {peopleFixtures}=await import("@/lib/fixtures/people");
 const {ActorResolutionError}=await import("@/server/auth/actor-context");
 return {resolveServerActor:async(request:Request)=>{
  const url=new URL(request.url),origin=request.headers.get("origin");
  if(url.hostname!=="localhost"||(origin&&origin!==url.origin))throw new ActorResolutionError(403,"LOCAL_ORIGIN_REJECTED");
  const id=request.headers.get("cookie")?.replace("test-person=","");
  const person=peopleFixtures.find(p=>p.id===id&&p.status==="ACTIVE");
  if(!person)throw new ActorResolutionError(401,"LOCAL_SESSION_REQUIRED");
  return {person};
 },actorErrorResponse:(error:InstanceType<typeof ActorResolutionError>)=>Response.json({error:{code:error.code}},{status:error.status})};
});

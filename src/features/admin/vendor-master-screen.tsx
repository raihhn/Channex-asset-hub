"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  Button,
  Card,
  Chip,
  Input,
  TextArea,
  Switch,
  Checkbox,
  AlertDialog,
} from "@heroui/react";
import { Plus, Pencil } from "lucide-react";
import { usePrototype } from "@/features/prototype/prototype-provider";
import { WorkflowDisclosure } from "@/components/shared/workflow-disclosure";
import { administrationData } from "@/lib/fixtures/administration-data";
import { VendorContactDialog } from "@/features/admin/vendor-contact-dialog";
import type { VendorContact, VendorDraft, VendorRecord } from "@/types/vendor";

type AuditRow = {
  actorName: string;
  action: string;
  version: number;
  occurredAt: string;
};
async function decode<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw new Error(body.message ?? "Could not save vendor.");
  return body;
}
export function VendorMasterScreen() {
  const { currentUser } = usePrototype();
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<VendorRecord>();
  const [draft, setDraft] = useState<VendorDraft>();
  const [pendingDelete, setPendingDelete] = useState<{
    kind: "PIC" | "warehouse";
    id: string;
    name: string;
  }>();
  const [contactEditor, setContactEditor] = useState<{
    warehouseId: string;
    contact: VendorContact;
  }>();
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const headers = {
    "Content-Type": "application/json",
    "x-prototype-actor-id": currentUser.id,
  };
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/vendors", {
      headers: { "x-prototype-actor-id": currentUser.id },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(decode<VendorRecord[]>)
      .then(setVendors)
      .catch((error: Error) => {
        if (error.name !== "AbortError") setError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [currentUser.id]);
  async function reload() {
    setDraft(undefined);
    setEditing(undefined);
    setAudit([]);
    setLoading(true);
    setError("");
    try {
      setVendors(
        await decode<VendorRecord[]>(
          await fetch("/api/vendors", { headers, cache: "no-store" }),
        ),
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not load vendors.",
      );
    } finally {
      setLoading(false);
    }
  }
  function openNew() {
    setEditing(undefined);
    setAudit([]);
    setError("");
    setSuccess("");
    setDraft({
      name: "",
      legalName: "",
      active: true,
      contacts: [],
      warehouses: [
        {
          id: crypto.randomUUID(),
          name: "",
          address: "",
          addressVerified: true,
          active: true,
          contactIds: [],
        },
      ],
    });
  }
  async function edit(vendor: VendorRecord) {
    setEditing(vendor);
    setDraft(structuredClone(vendor));
    setError("");
    setSuccess("");
    setAudit([]);
    try {
      setAudit(
        await decode<AuditRow[]>(
          await fetch(`/api/vendors/${vendor.id}`, {
            headers,
            cache: "no-store",
          }),
        ),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not load audit history.",
      );
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const saved = await decode<VendorRecord>(
        await fetch(editing ? `/api/vendors/${editing.id}` : "/api/vendors", {
          method: editing ? "PUT" : "POST",
          headers,
          body: JSON.stringify(
            editing ? { draft, version: editing.version } : draft,
          ),
        }),
      );
      setVendors((rows) =>
        [...rows.filter((v) => v.id !== saved.id), saved].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      setDraft(undefined);
      setEditing(undefined);
      setAudit([]);
      setSuccess(`${saved.name} saved to database.`);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not save vendor.",
      );
    } finally {
      setBusy(false);
    }
  }
  const visible = vendors.filter((v) =>
    [
      v.name,
      v.legalName,
      ...v.warehouses.flatMap((w) => [w.name, w.address]),
      ...v.contacts.flatMap((c) => [c.name, c.phone, c.email]),
    ]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const input = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    type = "text",
    required = true,
  ) => (
    <label className="grid min-w-0 gap-2 text-sm font-medium">
      {label}
      <Input
        variant="primary"
        className="w-full"
        aria-label={label}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
      />
    </label>
  );
  return (
    <div className="grid min-w-0 gap-5">
      <Card className="border-border gap-4 border p-4 sm:p-6">
        <Card.Content className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            aria-label="Search vendors"
            placeholder="Search vendor, warehouse, PIC"
            className="w-full sm:max-w-md"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
          <div className="flex gap-2 sm:ml-auto">
            <Button
              variant="secondary"
              isDisabled={busy || loading}
              onPress={reload}
            >
              Reload
            </Button>
            <Button isDisabled={loading || busy} onPress={openNew}>
              <Plus className="size-4" aria-hidden="true" />
              Add vendor
            </Button>
          </div>
        </Card.Content>
      </Card>
      {error && !draft ? (
        <p
          role="alert"
          className="bg-danger-soft text-danger-soft-foreground rounded-xl p-4 text-sm"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p role="status" className="text-success-soft-foreground text-sm">
          {success}
        </p>
      ) : null}
      {loading ? <p role="status">Loading vendor database…</p> : null}
      {draft ? (
        <Card className="border-border border p-4 sm:p-6">
          <form className="grid gap-6" onSubmit={save}>
            <fieldset disabled={busy} className="grid min-w-0 gap-6">
              <Card.Header>
                <Card.Title>
                  {editing ? `Edit ${editing.name}` : "Add vendor"}
                </Card.Title>
                <Card.Description>
                  Update vendor details, warehouses, and responsible contacts.
                  Changes take effect when you select Save vendor.
                </Card.Description>
              </Card.Header>
              <div className="grid gap-4 sm:grid-cols-2">
                {input("Vendor name", draft.name, (name) =>
                  setDraft({ ...draft, name }),
                )}
                {input(
                  "Legal company name (optional)",
                  draft.legalName,
                  (legalName) => setDraft({ ...draft, legalName }),
                  "text",
                  false,
                )}
              </div>
              <VendorActiveSwitch
                label="Vendor active"
                active={draft.active}
                disabled={busy}
                onChange={(active) => setDraft({ ...draft, active })}
              />
              <section className="grid gap-4" aria-label="Vendor warehouses">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Warehouses</h2>
                  <Button
                    size="sm"
                    type="button"
                    variant="secondary"
                    onPress={() =>
                      setDraft({
                        ...draft,
                        warehouses: [
                          {
                            id: crypto.randomUUID(),
                            name: "",
                            address: "",
                            addressVerified: true,
                            active: true,
                            contactIds: [],
                          },
                          ...draft.warehouses,
                        ],
                      })
                    }
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Add warehouse
                  </Button>
                </div>
                {draft.warehouses.map((w, index) => (
                  <Card key={w.id} variant="secondary" className="gap-4 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong>Warehouse {index + 1}</strong>
                      {draft.warehouses.length > 1 &&
                      !editing?.warehouses.some(
                        (record) => record.id === w.id,
                      ) ? (
                        <Button
                          size="sm"
                          type="button"
                          variant="ghost"
                          onPress={() =>
                            setPendingDelete({
                              kind: "warehouse",
                              id: w.id,
                              name: w.name || `Warehouse ${index + 1}`,
                            })
                          }
                        >
                          Delete new warehouse
                        </Button>
                      ) : null}
                      <VendorActiveSwitch
                        label={`Warehouse ${index + 1} active`}
                        active={w.active}
                        disabled={busy}
                        onChange={(active) =>
                          setDraft({
                            ...draft,
                            warehouses: draft.warehouses.map((r) =>
                              r.id === w.id ? { ...r, active } : r,
                            ),
                          })
                        }
                      />
                    </div>
                    {input(`Warehouse ${index + 1} name`, w.name, (name) =>
                      setDraft({
                        ...draft,
                        warehouses: draft.warehouses.map((r) =>
                          r.id === w.id ? { ...r, name } : r,
                        ),
                      }),
                    )}
                    <label className="grid gap-2 text-sm font-medium">
                      Warehouse {index + 1} address
                      <TextArea
                        aria-label={`Warehouse ${index + 1} address`}
                        variant="primary"
                        required
                        value={w.address}
                        onChange={(e) => {
                          const address = e.currentTarget.value;
                          setDraft({
                            ...draft,
                            warehouses: draft.warehouses.map((r) =>
                              r.id === w.id ? { ...r, address } : r,
                            ),
                          });
                        }}
                      />
                    </label>
                    <div className="grid gap-2">
                      <Checkbox
                        aria-label={`Warehouse ${index + 1} address confirmed`}
                        isSelected={w.addressVerified}
                        isDisabled={busy}
                        onChange={(addressVerified) =>
                          setDraft({
                            ...draft,
                            warehouses: draft.warehouses.map((r) =>
                              r.id === w.id ? { ...r, addressVerified } : r,
                            ),
                          })
                        }
                      >
                        <Checkbox.Content>
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                          Address confirmed
                        </Checkbox.Content>
                      </Checkbox>
                      {!w.addressVerified ? (
                        <p className="text-warning-soft-foreground text-xs">
                          Dummy / incomplete address. Confirm after replacing it
                          with the complete address.
                        </p>
                      ) : null}
                    </div>
                    <fieldset className="grid gap-2">
                      <legend className="mb-2 text-sm font-medium">
                        PICs for warehouse {index + 1}
                      </legend>
                      <p className="text-muted text-xs">
                        Choose an existing PIC or add a new contact for this
                        warehouse. At least one active PIC is required.
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-fit"
                        size="sm"
                        onPress={() =>
                          setContactEditor({
                            warehouseId: w.id,
                            contact: {
                              id: crypto.randomUUID(),
                              name: "",
                              phone: "",
                              email: "",
                              active: true,
                            },
                          })
                        }
                      >
                        <Plus className="size-4" aria-hidden="true" />
                        Add new PIC
                      </Button>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {draft.contacts.map((c, i) => (
                          <Checkbox
                            aria-label={`Assign ${c.name || `PIC ${i + 1}`} to warehouse ${index + 1}`}
                            key={c.id}
                            isSelected={w.contactIds.includes(c.id)}
                            isDisabled={
                              busy ||
                              (!c.active && !w.contactIds.includes(c.id))
                            }
                            onChange={(selected) =>
                              setDraft({
                                ...draft,
                                warehouses: draft.warehouses.map((r) =>
                                  r.id === w.id
                                    ? {
                                        ...r,
                                        contactIds: selected
                                          ? [...r.contactIds, c.id]
                                          : r.contactIds.filter(
                                              (id) => id !== c.id,
                                            ),
                                      }
                                    : r,
                                ),
                              })
                            }
                          >
                            <Checkbox.Content>
                              <Checkbox.Control>
                                <Checkbox.Indicator />
                              </Checkbox.Control>
                              {c.name || `PIC ${i + 1}`}
                              {!c.active ? " (inactive)" : ""}
                            </Checkbox.Content>
                          </Checkbox>
                        ))}
                      </div>
                    </fieldset>
                    {w.contactIds.length ? (
                      <div className="border-border grid gap-3 border-t pt-3">
                        {w.contactIds.map((id) => {
                          const c = draft.contacts.find(
                            (contact) => contact.id === id,
                          );
                          if (!c) return null;
                          return (
                            <div className="grid gap-2" key={id}>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <strong className="text-sm">{c.name}</strong>
                                <Button
                                  size="sm"
                                  type="button"
                                  variant="ghost"
                                  aria-label={`Edit ${c.name} for warehouse ${index + 1}`}
                                  onPress={() =>
                                    setContactEditor({
                                      warehouseId: w.id,
                                      contact: c,
                                    })
                                  }
                                >
                                  Edit PIC
                                </Button>
                              </div>
                              <p className="text-muted text-xs break-all">
                                {c.phone} · {c.email}
                              </p>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <VendorActiveSwitch
                                  label={`${c.name} active for warehouse ${index + 1}`}
                                  active={c.active}
                                  disabled={busy}
                                  onChange={(active) =>
                                    setDraft({
                                      ...draft,
                                      contacts: draft.contacts.map((record) =>
                                        record.id === id
                                          ? { ...record, active }
                                          : record,
                                      ),
                                    })
                                  }
                                />
                                {!editing?.contacts.some(
                                  (record) => record.id === id,
                                ) ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onPress={() =>
                                      setPendingDelete({
                                        kind: "PIC",
                                        id,
                                        name: c.name,
                                      })
                                    }
                                  >
                                    Delete new PIC
                                  </Button>
                                ) : null}
                              </div>
                              {draft.warehouses.filter((warehouse) =>
                                warehouse.contactIds.includes(id),
                              ).length > 1 ? (
                                <p className="text-muted text-xs">
                                  Shared contact. Edits and status changes apply
                                  to all linked warehouses.
                                </p>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-warning-soft-foreground text-xs">
                        No PIC assigned yet.
                      </p>
                    )}
                  </Card>
                ))}
              </section>
            </fieldset>
            {error ? (
              <p role="alert" className="text-danger-soft-foreground text-sm">
                {error}
              </p>
            ) : null}
            <Card.Footer className="flex flex-wrap gap-3">
              <Button type="submit" isPending={busy}>
                Save vendor
              </Button>
              <Button
                type="button"
                variant="secondary"
                isDisabled={busy}
                onPress={() => {
                  setDraft(undefined);
                  setEditing(undefined);
                  setError("");
                }}
              >
                Cancel
              </Button>
            </Card.Footer>
          </form>
          {audit.length ? (
            <div className="border-border mt-6 grid gap-2 border-t pt-4">
              <h3 className="font-semibold">Recent changes</h3>
              {audit.map((a) => (
                <p
                  key={`${a.version}-${a.action}`}
                  className="text-muted text-xs"
                >
                  {a.action} · v{a.version} · {a.actorName} ·{" "}
                  {new Date(a.occurredAt).toLocaleString("en-GB", {
                    timeZone: "Asia/Jakarta",
                  })}
                </p>
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}
      {!draft ? (
        <>
          <p className="text-muted text-sm">
            {visible.length} {visible.length === 1 ? "vendor" : "vendors"}
          </p>
          <div className="grid gap-4">
            {visible.map((v) => (
              <Card
                key={v.id}
                aria-label={`Vendor ${v.name}`}
                className="border-border gap-4 border p-5 sm:p-6"
              >
                <Card.Header className="flex-row items-start justify-between gap-4">
                  <div className="grid min-w-0 gap-2">
                    <Card.Title
                      render={(props) => <h2 {...props} />}
                      className="break-words"
                    >
                      {v.name}
                    </Card.Title>
                    {v.legalName ? (
                      <Card.Description>{v.legalName}</Card.Description>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip
                        size="sm"
                        variant="soft"
                        color={v.active ? "success" : "default"}
                      >
                        {v.active ? "Active" : "Inactive"}
                      </Chip>
                      <span className="text-muted text-sm">
                        {v.warehouses.length} warehouses · {v.contacts.length}{" "}
                        {v.contacts.length === 1 ? "PIC" : "PICs"}
                      </span>
                    </div>
                    {v.warehouses.some((w) => !w.addressVerified) ? (
                      <p className="text-warning-soft-foreground text-xs">
                        {v.warehouses.filter((w) => !w.addressVerified).length}{" "}
                        {v.warehouses.filter((w) => !w.addressVerified)
                          .length === 1
                          ? "address needs"
                          : "addresses need"}{" "}
                        confirmation
                      </p>
                    ) : null}
                  </div>
                  <Button
                    className="shrink-0"
                    size="sm"
                    variant="secondary"
                    isDisabled={busy}
                    onPress={() => edit(v)}
                    aria-label={`Edit ${v.name}`}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                    Edit
                  </Button>
                </Card.Header>
                <WorkflowDisclosure
                  title="View warehouses & PICs"
                  variant="ghost"
                  className="border-border border-t pt-2"
                >
                  <div className="grid min-w-0 gap-6 lg:grid-cols-3">
                    <section
                      className="grid min-w-0 content-start gap-4 lg:col-span-2"
                      aria-label={`${v.name} warehouses`}
                    >
                      <p className="text-muted text-xs font-medium">
                        WAREHOUSES
                      </p>
                      <ul className="divide-border grid divide-y">
                        {v.warehouses.map((w) => (
                          <li
                            key={w.id}
                            className="grid gap-2 py-4 first:pt-0 last:pb-0"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium">
                                {w.name}
                              </span>
                              {!w.active ? (
                                <Chip size="sm" variant="soft">
                                  Inactive
                                </Chip>
                              ) : null}
                            </div>
                            <p className="text-muted text-sm break-words whitespace-pre-wrap">
                              {w.address}
                            </p>
                            {!w.addressVerified ? (
                              <p className="text-warning-soft-foreground text-xs">
                                Dummy / address needs confirmation
                              </p>
                            ) : null}
                            <p className="text-muted text-xs">
                              PIC:{" "}
                              {w.contactIds
                                .map((id) =>
                                  v.contacts.find((c) => c.id === id),
                                )
                                .filter((c) => !!c)
                                .map(
                                  (c) =>
                                    `${c.name}${!c.active ? " (inactive)" : ""}`,
                                )
                                .join(", ") || "No PIC assigned"}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </section>
                    <section
                      className="border-border grid min-w-0 content-start gap-4 border-t pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6"
                      aria-label={`${v.name} PIC contacts`}
                    >
                      <p className="text-muted text-xs font-medium">
                        PIC CONTACTS
                      </p>
                      <ul className="grid gap-4">
                        {v.contacts.map((c) => (
                          <li key={c.id} className="grid gap-1 text-sm">
                            <span className="font-medium">
                              {c.name}
                              {!c.active ? " (inactive)" : ""}
                            </span>
                            <span className="text-muted">{c.phone}</span>
                            <span className="text-muted break-all">
                              {c.email}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  </div>
                  {v.importNotes?.length ? (
                    <section
                      className="border-border grid gap-3 border-t pt-4"
                      aria-label={`${v.name} import notes`}
                    >
                      <h3>Source details to review</h3>
                      {v.importNotes.map((note, i) => (
                        <div className="grid min-w-0 gap-2 text-sm" key={i}>
                          <strong>
                            {note.source.warehouse || "Location not supplied"}
                          </strong>
                          <p className="text-warning-soft-foreground text-xs">
                            {note.issues.join(" · ")}
                          </p>
                          <p className="text-muted break-words">
                            PIC: {note.source.picName || "Name not supplied"}
                            {note.source.phone ? ` · ${note.source.phone}` : ""}
                          </p>
                          <p className="text-muted break-all">
                            {note.source.emails.join(" · ") ||
                              "Email not supplied"}
                          </p>
                        </div>
                      ))}
                    </section>
                  ) : null}
                </WorkflowDisclosure>
              </Card>
            ))}
          </div>
          <WorkflowDisclosure
            title="Internal warehouse references"
            variant="ghost"
            className="border-border border-t pt-3"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {administrationData["warehouses-vendors"].rows
                .filter((row) => row.Type === "Internal warehouse")
                .map((row) => (
                  <div key={row.Name} className="grid gap-1 text-sm">
                    <strong>{row.Name}</strong>
                    <p className="text-muted">{row.Location}</p>
                  </div>
                ))}
            </div>
          </WorkflowDisclosure>
        </>
      ) : null}
      {contactEditor && draft ? (
        <VendorContactDialog
          key={contactEditor.contact.id}
          contact={contactEditor.contact}
          contacts={draft.contacts}
          warehouseName={
            draft.warehouses.find((w) => w.id === contactEditor.warehouseId)
              ?.name || "New warehouse"
          }
          usageCount={
            draft.warehouses.filter((w) =>
              w.contactIds.includes(contactEditor.contact.id),
            ).length
          }
          onClose={() => setContactEditor(undefined)}
          onSave={(contact) => {
            setDraft({
              ...draft,
              contacts: draft.contacts.some((c) => c.id === contact.id)
                ? draft.contacts.map((c) => (c.id === contact.id ? contact : c))
                : [contact, ...draft.contacts],
              warehouses: draft.warehouses.map((w) =>
                w.id === contactEditor.warehouseId
                  ? {
                      ...w,
                      contactIds: w.contactIds.includes(contact.id)
                        ? w.contactIds
                        : [contact.id, ...w.contactIds],
                    }
                  : w,
              ),
            });
            setContactEditor(undefined);
          }}
          onReuse={(id) => {
            setDraft({
              ...draft,
              contacts: draft.contacts.map((c) =>
                c.id === id ? { ...c, active: true } : c,
              ),
              warehouses: draft.warehouses.map((w) =>
                w.id === contactEditor.warehouseId
                  ? {
                      ...w,
                      contactIds: w.contactIds.includes(id)
                        ? w.contactIds
                        : [id, ...w.contactIds],
                    }
                  : w,
              ),
            });
            setContactEditor(undefined);
          }}
        />
      ) : null}
      <AlertDialog.Backdrop
        isOpen={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(undefined);
        }}
        isKeyboardDismissDisabled={false}
      >
        <AlertDialog.Container placement="center">
          <AlertDialog.Dialog
            aria-label={`Delete new ${pendingDelete?.kind ?? "record"}`}
          >
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>
                Delete {pendingDelete?.kind}?
              </AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>
                Remove <strong>{pendingDelete?.name}</strong> from this form?
                {pendingDelete?.kind === "PIC"
                  ? " Its warehouse assignments will also be removed."
                  : ""}
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button
                variant="secondary"
                onPress={() => setPendingDelete(undefined)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onPress={() => {
                  if (!pendingDelete || !draft) return;
                  const { kind, id } = pendingDelete;
                  setDraft(
                    kind === "PIC"
                      ? {
                          ...draft,
                          contacts: draft.contacts.filter((c) => c.id !== id),
                          warehouses: draft.warehouses.map((w) => ({
                            ...w,
                            contactIds: w.contactIds.filter(
                              (contactId) => contactId !== id,
                            ),
                          })),
                        }
                      : {
                          ...draft,
                          warehouses: draft.warehouses.filter(
                            (w) => w.id !== id,
                          ),
                        },
                  );
                  setPendingDelete(undefined);
                }}
              >
                Delete {pendingDelete?.kind}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
      {!draft && !loading && !error && !visible.length ? (
        <p>No vendors match this search.</p>
      ) : null}
    </div>
  );
}

function VendorActiveSwitch({
  label,
  active,
  disabled,
  onChange,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onChange: (active: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch
        aria-label={label}
        size="sm"
        isSelected={active}
        isDisabled={disabled}
        onChange={onChange}
      >
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          Active
        </Switch.Content>
      </Switch>
      {!active ? (
        <Chip size="sm" variant="soft">
          Inactive
        </Chip>
      ) : null}
    </div>
  );
}

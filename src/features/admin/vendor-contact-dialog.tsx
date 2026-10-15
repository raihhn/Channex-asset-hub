"use client";
import { useState, type FormEvent } from "react";
import { Modal, Button, Input, Checkbox } from "@heroui/react";
import type { VendorContact } from "@/types/vendor";

function phoneKey(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("62") ? `0${digits.slice(2)}` : digits;
}
export function VendorContactDialog({
  contact,
  contacts,
  warehouseName,
  usageCount,
  onSave,
  onReuse,
  onClose,
}: {
  contact: VendorContact;
  contacts: VendorContact[];
  warehouseName: string;
  usageCount: number;
  onSave: (contact: VendorContact) => void;
  onReuse: (id: string) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(contact);
  const [separate, setSeparate] = useState(false);
  const [error, setError] = useState("");
  const editing = contacts.some((c) => c.id === contact.id);
  const matches = contacts.filter(
    (c) =>
      c.id !== form.id &&
      ((form.email.trim() &&
        c.email.trim().toLowerCase() === form.email.trim().toLowerCase()) ||
        (phoneKey(form.phone) && phoneKey(c.phone) === phoneKey(form.phone))),
  );
  function submit(event: FormEvent) {
    event.preventDefault();
    if (matches.length && !separate) return;
    if (
      !/^[+\d\s().-]+$/.test(form.phone) ||
      form.phone.replace(/\D/g, "").length < 6
    ) {
      setError("Enter a valid PIC phone number.");
      return;
    }
    if (!form.name.trim()) {
      setError("Enter the PIC name.");
      return;
    }
    onSave({
      ...form,
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim().toLowerCase(),
    });
  }
  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container placement="center">
        <Modal.Dialog
          aria-label={editing ? "Edit warehouse PIC" : "Add warehouse PIC"}
        >
          <form className="grid gap-4" onSubmit={submit}>
            <Modal.Header>
              <Modal.Heading>
                {editing ? "Edit PIC" : "Add new PIC"}
              </Modal.Heading>
              <p className="text-muted text-sm">
                {warehouseName}
                {editing && usageCount > 1
                  ? ` · Used by ${usageCount} warehouses. Changes apply to all of them.`
                  : ""}
              </p>
            </Modal.Header>
            <Modal.Body className="grid gap-4">
              {(
                [
                  ["name", "PIC name", "text"],
                  ["phone", "PIC phone", "tel"],
                  ["email", "PIC email", "email"],
                ] as const
              ).map(([key, label, type]) => (
                <label key={key} className="grid gap-2 text-sm font-medium">
                  {label}
                  <Input
                    variant="primary"
                    aria-label={label}
                    required
                    type={type}
                    maxLength={
                      key === "email" ? 254 : key === "phone" ? 80 : 200
                    }
                    value={form[key]}
                    onChange={(e) => {
                      setForm({ ...form, [key]: e.currentTarget.value });
                      setSeparate(false);
                      setError("");
                    }}
                  />
                </label>
              ))}
              {matches.length ? (
                <div className="bg-warning-soft grid gap-3 rounded-xl p-3">
                  <p className="text-warning-soft-foreground text-sm">
                    This phone number or email is already recorded. Use the
                    existing PIC to avoid duplicating the contact.
                  </p>
                  {matches.map((c) => (
                    <Button
                      key={c.id}
                      type="button"
                      variant="secondary"
                      onPress={() => onReuse(c.id)}
                    >
                      {c.active ? "Use" : "Use and reactivate"} {c.name}
                    </Button>
                  ))}
                  <Checkbox isSelected={separate} onChange={setSeparate}>
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      This is a different person sharing these contact details
                    </Checkbox.Content>
                  </Checkbox>
                </div>
              ) : null}
              {error ? (
                <p role="alert" className="text-danger-soft-foreground text-sm">
                  {error}
                </p>
              ) : null}
            </Modal.Body>
            <Modal.Footer>
              <Button type="button" variant="secondary" onPress={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                isDisabled={Boolean(matches.length && !separate)}
              >
                {editing ? "Apply PIC changes" : "Add and assign PIC"}
              </Button>
            </Modal.Footer>
          </form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

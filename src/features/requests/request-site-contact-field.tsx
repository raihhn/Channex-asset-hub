"use client";

import { useEffect, useState } from "react";
import { Button, Input } from "@heroui/react";
import { HeroSelect } from "@/components/shared/hero-select";
import { readLocalApi, localIdentityMessage } from "@/lib/actor-client";
import {
  canSelectInternalContact,
  internalContactLabel,
  type InternalContact,
} from "@/lib/domain/internal-contacts";
import type { Person } from "@/types/identity";

type Selection = {
  value: string;
  internalId?: string;
  onChange: (value: string, internalId?: string) => void;
};

function InternalRequestContactSelector({ internalId, onChange }: Selection) {
  const [contacts, setContacts] = useState<InternalContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    readLocalApi<InternalContact[]>("/api/internal-contacts")
      .then((rows) => {
        if (active) setContacts(rows);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "Kontak belum dapat dimuat.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  return (
    <div className="grid min-w-0 gap-2">
      <HeroSelect
        label="Pilih PIC internal untuk Request"
        variant="secondary"
        value={internalId ?? ""}
        placeholder={
          loading
            ? "Memuat kontak internal…"
            : "Cari nama, email, atau telepon PIC…"
        }
        isDisabled={loading || !!error}
        options={contacts
          .filter((contact) => contact.active)
          .map((contact) => ({
            value: contact.id,
            label: internalContactLabel(contact),
          }))}
        onChange={(id) => {
          const contact = contacts.find(
            (contact) => contact.id === id && contact.active,
          );
          if (contact) onChange(internalContactLabel(contact), contact.id);
        }}
      />
      {error && (
        <div className="grid gap-2">
          <p role="alert" className="text-danger text-sm">
            {localIdentityMessage(error)}
          </p>
          <Button
            type="button"
            className="w-fit"
            variant="tertiary"
            onPress={() => {
              setLoading(true);
              setError("");
              setAttempt((current) => current + 1);
            }}
          >
            Muat ulang kontak
          </Button>
        </div>
      )}
    </div>
  );
}

/** Directory selection is optional. Manual/existing vendor contact remains supported. */
export function RequestSiteContactField({
  actor,
  value,
  internalId,
  onChange,
}: Selection & { actor: Person }) {
  return (
    <div className="col-span-full grid min-w-0 gap-3">
      {canSelectInternalContact(actor) && (
        <InternalRequestContactSelector
          key={actor.id}
          value={value}
          internalId={internalId}
          onChange={onChange}
        />
      )}
      <label className="grid min-w-0 gap-2 text-sm font-medium">
        Project-site PIC (name and contact)
        <Input
          variant="secondary"
          className="w-full min-w-0"
          value={value}
          readOnly={!!internalId}
          placeholder="Name · phone number"
          onChange={(e) => onChange(e.currentTarget.value)}
        />
      </label>
      {internalId && (
        <Button
          type="button"
          className="w-fit"
          variant="tertiary"
          onPress={() => onChange(value)}
        >
          Isi PIC manual
        </Button>
      )}
      <p className="text-muted text-sm">
        PIC lokasi / event untuk Request ini. PIC pengelola tetap dan penerima
        fisik asset dicatat terpisah.
      </p>
    </div>
  );
}

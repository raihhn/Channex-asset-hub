"use client";
import { useCallback, useEffect, useState } from "react";
import {
  fetchActorPerson,
  fetchDevelopmentPeople,
  selectDevelopmentPerson,
  type PersonChoice,
} from "@/lib/actor-client";
import type { Person } from "@/types/identity";

export function useLocalIdentity(onPerson: (person: Person | null) => void) {
  const [person, setPerson] = useState<Person | null>(null);
  const [choices, setChoices] = useState<PersonChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    let active = true;
    // Reading existing cookies never creates a session or defaults to Super Admin.
    // Selector discovery must not keep Inventory loading after actor resolution settles.
    fetchDevelopmentPeople()
      .then((list) => {
        if (active) setChoices(list);
      })
      .catch(() => {
        if (active) setChoices([]);
      });
    fetchActorPerson()
      .then((actor) => {
        if (!active) return;
        setPerson(actor);
        onPerson(actor);
        setError("");
      })
      .catch((failure: unknown) => {
        if (!active) return;
        setPerson(null);
        onPerson(null);
        setError(
          failure instanceof Error
            ? failure.message
            : "Local session required.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [epoch, onPerson]);
  const select = useCallback(
    async (id: string) => {
      setLoading(true);
      setError("");
      setPerson(null);
      try {
        const next = await selectDevelopmentPerson(id);
        setPerson(next);
        onPerson(next);
        setEpoch((value) => value + 1);
      } catch (failure) {
        setError(
          failure instanceof Error
            ? failure.message
            : "Local identity unavailable.",
        );
        throw failure;
      } finally {
        setLoading(false);
      }
    },
    [onPerson],
  );
  const refresh = useCallback(() => {
    setPerson(null);
    onPerson(null);
    setLoading(true);
    setError("");
    setEpoch((value) => value + 1);
  }, [onPerson]);
  return { person, choices, loading, error, select, refresh, epoch };
}

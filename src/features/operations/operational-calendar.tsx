"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button, Card, Chip } from "@heroui/react";

import { HeroSelect } from "@/components/shared/hero-select";
import {
  getReservationPhaseState,
  type Reservation,
} from "@/lib/domain/reservations";

type Phase = "Outbound" | "Event usage" | "Inbound" | "Receipt";
type CalendarEntry = { reservation: Reservation; phase: Phase; state: string };

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getLocalNowKey(now: Date) {
  return `${dateKey(now)}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function entriesForDate(
  date: string,
  reservations: Reservation[],
  now: string,
): CalendarEntry[] {
  const entries: CalendarEntry[] = [];
  for (const reservation of reservations) {
    const outboundDate = reservation.outboundAt.slice(0, 10);
    const inboundDate = reservation.inboundAt.slice(0, 10);
    const usageStart = reservation.usageStartAt.slice(0, 10);
    const usageEnd = reservation.usageEndAt.slice(0, 10);
    if (date === outboundDate)
      entries.push({
        reservation,
        phase: "Outbound",
        state: getReservationPhaseState(reservation, "Outbound", now),
      });
    if (date >= usageStart && date <= usageEnd)
      entries.push({
        reservation,
        phase: "Event usage",
        state: getReservationPhaseState(reservation, "Event usage", now),
      });
    if (date === inboundDate)
      entries.push({
        reservation,
        phase: "Inbound",
        state: getReservationPhaseState(reservation, "Inbound", now),
      });
    if (
      reservation.actualInboundAt &&
      date === dateKey(new Date(reservation.actualInboundAt)) &&
      date !== inboundDate
    )
      entries.push({ reservation, phase: "Receipt", state: "Completed" });
  }
  return entries;
}

export function OperationalCalendar({
  reservations,
}: {
  reservations: Reservation[];
}) {
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [brand, setBrand] = useState("All brands");
  const [assetId, setAssetId] = useState("All assets");
  const [activity, setActivity] = useState("All events / activities");
  const [location, setLocation] = useState("All locations");
  const now = getLocalNowKey(new Date());
  const today = now.slice(0, 10);
  const brands = [
    ...new Set(reservations.map((item) => item.assetBrand)),
  ].sort();
  const assets = [
    ...new Map(
      reservations.map((item) => [item.assetId, item.assetName]),
    ).entries(),
  ];
  const activities = [
    ...new Set(reservations.map((item) => item.activityName)),
  ].sort();
  const locations = [
    ...new Set(reservations.map((item) => item.destination)),
  ].sort();
  const filteredReservations = reservations.filter(
    (item) =>
      !["Draft", "Rejected", "Cancelled"].includes(item.requestStatus) &&
      (brand === "All brands" || item.assetBrand === brand) &&
      (assetId === "All assets" || item.assetId === assetId) &&
      (activity === "All events / activities" ||
        item.activityName === activity) &&
      (location === "All locations" || item.destination === location),
  );
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const key = dateKey(date);
    return {
      date,
      key,
      entries: entriesForDate(key, filteredReservations, now),
    };
  });
  const monthLabel = month.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const outboundToday = filteredReservations.filter(
    (item) => item.outboundAt.slice(0, 10) === today,
  ).length;
  const inboundToday = filteredReservations.filter(
    (item) => item.inboundAt.slice(0, 10) === today,
  ).length;
  const lateInbound = filteredReservations.filter(
    (item) =>
      item.blocksAvailability && !item.actualInboundAt && item.inboundAt < now,
  ).length;
  const reservedNow = filteredReservations.filter(
    (item) =>
      item.blocksAvailability &&
      !item.actualInboundAt &&
      item.outboundAt <= now,
  ).length;
  const monthStart = dateKey(firstDay);
  const monthEnd = dateKey(
    new Date(month.getFullYear(), month.getMonth() + 1, 0),
  );
  const monthReservations = filteredReservations.filter(
    (item) =>
      (item.inboundAt.slice(0, 10) >= monthStart &&
        item.outboundAt.slice(0, 10) <= monthEnd) ||
      Boolean(
        item.actualInboundAt &&
        dateKey(new Date(item.actualInboundAt)) >= monthStart &&
        dateKey(new Date(item.actualInboundAt)) <= monthEnd,
      ),
  );
  const resetFilters = () => {
    setBrand("All brands");
    setAssetId("All assets");
    setActivity("All events / activities");
    setLocation("All locations");
  };

  return (
    <section
      className="operational-calendar"
      aria-labelledby="operational-calendar-title"
    >
      <header className="operational-calendar__header">
        <div>
          <p>Planning visibility</p>
          <h2 id="operational-calendar-title">Operational calendar</h2>
          <span>
            Planned outbound → usage → inbound. Physical movement is recorded
            separately.
          </span>
        </div>
        <div className="operational-calendar__month-controls">
          <Button
            aria-label="Previous month"
            isIconOnly
            onPress={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
            variant="secondary"
          >
            <ChevronLeft size={18} />
          </Button>
          <strong>{monthLabel}</strong>
          <Button
            aria-label="Next month"
            isIconOnly
            onPress={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
            variant="secondary"
          >
            <ChevronRight size={18} />
          </Button>
        </div>
      </header>

      <div className="operational-calendar__summary">
        <Card>
          <span>Outbound today</span>
          <strong>{outboundToday}</strong>
        </Card>
        <Card>
          <span>Inbound today</span>
          <strong>{inboundToday}</strong>
        </Card>
        <Card>
          <span>Late inbound</span>
          <strong>{lateInbound}</strong>
        </Card>
        <Card>
          <span>Availability held</span>
          <strong>{reservedNow}</strong>
        </Card>
      </div>

      <div className="operational-calendar__filters">
        <HeroSelect
          label="Brand"
          onChange={setBrand}
          options={[
            { label: "All brands", value: "All brands" },
            ...brands.map((value) => ({ label: value, value })),
          ]}
          value={brand}
        />
        <HeroSelect
          label="Asset"
          onChange={setAssetId}
          options={[
            { label: "All assets", value: "All assets" },
            ...assets.map(([value, label]) => ({ label, value })),
          ]}
          value={assetId}
        />
        <HeroSelect
          label="Event / activity"
          onChange={setActivity}
          options={[
            {
              label: "All events / activities",
              value: "All events / activities",
            },
            ...activities.map((value) => ({ label: value, value })),
          ]}
          value={activity}
        />
        <HeroSelect
          label="Destination"
          onChange={setLocation}
          options={[
            { label: "All locations", value: "All locations" },
            ...locations.map((value) => ({ label: value, value })),
          ]}
          value={location}
        />
        <Button onPress={resetFilters} variant="tertiary">
          Clear filters
        </Button>
      </div>

      <div
        className="operational-calendar__legend"
        aria-label="Calendar phases"
      >
        <span>
          <i className="is-outbound" />
          Outbound
        </span>
        <span>
          <i className="is-usage" />
          Event usage
        </span>
        <span>
          <i className="is-inbound" />
          Inbound
        </span>
      </div>
      <div className="operational-calendar__grid-wrap">
        <div
          className="operational-calendar__grid"
          role="grid"
          aria-label={monthLabel}
        >
          {(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const).map(
            (day) => (
              <div
                className="operational-calendar__weekday"
                role="columnheader"
                key={day}
              >
                {day}
              </div>
            ),
          )}
          {days.map(({ date, key, entries }) => (
            <div
              aria-label={`${date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}${entries.length ? `, ${entries.length} operational phases` : ""}`}
              className={`operational-calendar__day${date.getMonth() !== month.getMonth() ? "is-outside-month" : ""}${key === today ? "is-today" : ""}`}
              role="gridcell"
              key={key}
            >
              <span className="operational-calendar__day-number">
                {date.getDate()}
              </span>
              <div className="operational-calendar__day-entries">
                {entries
                  .slice(0, 4)
                  .map(({ reservation, phase, state }, index) => (
                    <Link
                      className={`operational-calendar__entry is-${phase === "Event usage" ? "usage" : phase === "Receipt" ? "inbound" : phase.toLowerCase()}`}
                      href={`/requests/${reservation.requestId}`}
                      key={`${reservation.id}-${phase}-${index}`}
                      title={`${reservation.assetName} · ${reservation.activityName} · ${phase} · ${state} · ${reservation.destination}`}
                    >
                      <span>
                        {phase === "Outbound"
                          ? "Out"
                          : phase === "Inbound" || phase === "Receipt"
                            ? "In"
                            : "Use"}
                      </span>
                      <strong>{reservation.assetName}</strong>
                      <small>
                        {state} · {reservation.assetBrand}
                      </small>
                      <small>
                        {reservation.activityName} · {reservation.requestId}
                      </small>
                    </Link>
                  ))}
                {entries.length > 4 ? (
                  <small className="operational-calendar__more">
                    +{entries.length - 4} more
                  </small>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="operational-calendar__bookings">
        <div className="section-heading">
          <h3>Bookings in view</h3>
          <span>{monthReservations.length}</span>
        </div>
        {monthReservations.length ? (
          <ul>
            {monthReservations
              .slice()
              .sort((first, second) =>
                first.outboundAt.localeCompare(second.outboundAt),
              )
              .map((reservation) => (
                <li key={reservation.id}>
                  <div>
                    <Link href={`/assets/${reservation.assetId}`}>
                      <strong>{reservation.assetName}</strong>
                    </Link>
                    <span>
                      {reservation.activityName} · {reservation.assetBrand} ·{" "}
                      {reservation.destination}
                    </span>
                    <small>
                      Planned outbound{" "}
                      {reservation.outboundAt.replace("T", " · ")} → Usage{" "}
                      {reservation.usageStartAt.slice(0, 10)}–
                      {reservation.usageEndAt.slice(0, 10)} → Planned inbound{" "}
                      {reservation.inboundAt.replace("T", " · ")}
                    </small>
                    {reservation.actualInboundAt ? (
                      <small>
                        Actual inbound{" "}
                        {new Date(reservation.actualInboundAt).toLocaleString(
                          "en-GB",
                          {
                            dateStyle: "medium",
                            timeStyle: "short",
                          },
                        )}
                      </small>
                    ) : reservation.requestStatus === "Completed" ? (
                      <small>
                        Receipt evidence unavailable · physical return not
                        confirmed
                      </small>
                    ) : null}
                  </div>
                  <Chip
                    color={
                      reservation.actualInboundAt
                        ? "success"
                        : getReservationPhaseState(
                              reservation,
                              "Inbound",
                              now,
                            ) === "Late"
                          ? "danger"
                          : "accent"
                    }
                    size="sm"
                    variant="soft"
                  >
                    Inbound{" "}
                    {getReservationPhaseState(reservation, "Inbound", now)}
                  </Chip>
                  <Link href={`/requests/${reservation.requestId}`}>
                    {reservation.requestId}
                  </Link>
                </li>
              ))}
          </ul>
        ) : null}
      </div>
      <p className="operational-calendar__note">
        Dates use the browser’s local timezone. Calendar entries are planned
        reservations, not proof of physical departure. Inbound Completed and
        actual arrival appear only after a linked Confirm Received action.
      </p>
      {monthReservations.length === 0 ? (
        <p className="operational-calendar__empty">
          No operational reservations fall in this month with these filters.
        </p>
      ) : null}
      {monthReservations.length > 0 ? (
        <p className="sr-only">
          {monthReservations.length} asset reservations shown this month.
        </p>
      ) : null}
    </section>
  );
}

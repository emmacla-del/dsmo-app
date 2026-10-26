"use client";

import { DayPicker, type DateRange } from "react-day-picker";
import { enGB, fr } from "react-day-picker/locale";
import type { UiLocale } from "@/lib/register-i18n";

export function RegistrationQueueDatePicker({
  selected,
  onSelect,
  locale,
}: {
  selected: DateRange | undefined;
  onSelect: (range: DateRange | undefined) => void;
  locale: UiLocale;
}) {
  return (
    <DayPicker
      mode="range"
      selected={selected}
      onSelect={onSelect}
      locale={locale === "fr" ? fr : enGB}
      disabled={{ after: new Date() }}
      className="mx-auto"
      classNames={{
        months: "flex",
        month: "space-y-3",
        month_caption: "relative flex h-8 items-center justify-center",
        caption_label: "text-sm font-medium",
        nav: "flex items-center gap-1",
        button_previous: "absolute left-0 inline-flex size-8 items-center justify-center rounded-md border border-input bg-background hover:bg-accent",
        button_next: "absolute right-0 inline-flex size-8 items-center justify-center rounded-md border border-input bg-background hover:bg-accent",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 rounded-md text-center text-[0.8rem] font-normal text-muted-foreground",
        weeks: "mt-2 flex flex-col gap-1",
        week: "flex w-full",
        day: "relative size-9 p-0 text-center text-sm focus-within:z-20 [&:has([aria-selected])]:bg-accent/60",
        day_button: "inline-flex size-9 items-center justify-center rounded-md p-0 font-normal hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
        range_start: "rounded-l-md bg-accent",
        range_end: "rounded-r-md bg-accent",
        range_middle: "rounded-none bg-accent/60",
        today: "font-semibold text-primary",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-40",
      }}
    />
  );
}

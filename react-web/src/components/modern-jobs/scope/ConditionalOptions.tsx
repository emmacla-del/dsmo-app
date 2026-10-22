"use client";

import { Checkbox } from "@/components/onefop/form/Checkbox";
import { RadioGroup } from "@/components/onefop/form/Radio";

export interface OptionItem {
  id: string;
  label: string;
  sublabel?: string;
}

interface ConditionalOptionsProps {
  options: OptionItem[];
  selected: string[];
  onChange: (selected: string[]) => void;
  allowMultiple?: boolean;
  ariaLabel?: string;
}

/**
 * The follow-up choices of one quiz beat. A plain checkbox or radio, the
 * whole label clickable: the option is not a box (constitution §9).
 */
export function ConditionalOptions({
  options,
  selected,
  onChange,
  allowMultiple = true,
  ariaLabel,
}: ConditionalOptionsProps) {
  const fieldId = `cond-${(ariaLabel ?? "options").replace(/\s+/g, "-")}`;

  if (!allowMultiple) {
    return (
      <div style={{ marginTop: "var(--cam-field-stack-gap)" }}>
        <RadioGroup
          fieldId={fieldId}
          ariaLabel={ariaLabel ?? fieldId}
          options={options.map((opt) => ({
            value: opt.id,
            label: opt.label,
            caption: opt.sublabel,
          }))}
          value={selected[0]}
          onChange={(_, value) => onChange(value ? [String(value)] : [])}
        />
      </div>
    );
  }

  const toggle = (id: string, next: boolean) => {
    if (next) onChange([...selected, id]);
    else onChange(selected.filter((item) => item !== id));
  };

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{
        display: "flex",
        flexDirection: "column",
        marginTop: "var(--cam-field-stack-gap)",
      }}
    >
      {options.map((opt) => (
        <Checkbox
          key={opt.id}
          id={`${fieldId}-${opt.id}`}
          checked={selected.includes(opt.id)}
          onChange={(next) => toggle(opt.id, next)}
          label={
            opt.sublabel ? (
              <>
                <span style={{ display: "block" }}>{opt.label}</span>
                <span className="cam-hint" style={{ display: "block" }}>{opt.sublabel}</span>
              </>
            ) : (
              opt.label
            )
          }
        />
      ))}
    </div>
  );
}

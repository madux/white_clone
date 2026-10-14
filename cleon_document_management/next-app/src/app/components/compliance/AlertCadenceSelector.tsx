"use client";

export function AlertCadenceSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (newValue: string) => void;
}) {
  const PRESETS = [
    { label: "90 days before", days: 90 },
    { label: "60 days before", days: 60 },
    { label: "30 days before", days: 30 },
    { label: "15 days before", days: 15 },
    { label: "7 days before", days: 7 },
    { label: "1 day before", days: 1 },
    { label: "On expiry day", days: 0 },
  ];

  const currentDays = (value || "60,30,15,7,0")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));

  const toggleDay = (day: number) => {
    let next: number[];
    if (currentDays.includes(day)) {
      next = currentDays.filter((d) => d !== day);
    } else {
      next = [...currentDays, day].sort((a, b) => b - a);
    }
    onChange(next.join(","));
  };

  return (
    <div className="space-y-2 sm:col-span-2">
      <span className="label">Reminders</span>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => {
          const isSelected = currentDays.includes(preset.days);
          return (
            <button
              key={preset.days}
              type="button"
              onClick={() => toggleDay(preset.days)}
              className={`inline-flex cursor-pointer items-center rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                isSelected
                  ? "bg-brand-pink text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-pink-300 hover:text-brand-pink"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

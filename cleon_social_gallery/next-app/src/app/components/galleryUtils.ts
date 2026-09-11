export function initials(name: string) {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "SG"
  );
}

export function formatDuration(seconds: number) {
  if (!seconds) return "";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remaining}`;
}

export function relativeTime(value: string) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${Math.max(minutes, 1)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function greeting(name?: string) {
  const hour = new Date().getHours();
  const salutation = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return name ? `${salutation}, ${name.split(" ")[0]}` : salutation;
}

export function formatActivityMessage(event: {
  event_type: string;
  entity_type: string;
  details?: string;
}) {
  const entity = event.entity_type === "album" ? "an album" : event.entity_type === "media" ? "media" : "a comment";
  const messages: Record<string, string> = {
    created: `created ${entity}`,
    uploaded: "uploaded new media",
    modified: `updated ${entity}`,
    deleted: `removed ${entity}`,
    restored: `restored ${entity}`,
    approved: "approved media",
    rejected: "rejected media",
    reported: "reported content",
    shared: "shared content",
    exported: "exported brand content",
  };
  const action = messages[event.event_type] || event.event_type;
  if (event.details) return `${action} — ${event.details}`;
  return action;
}

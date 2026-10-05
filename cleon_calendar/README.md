# cleon_calendar

Shared OWL calendar for every CleonHR app (leave, shifts, attendance, company events...).
It only renders and navigates. Data loading, permissions and modals stay in the consuming module.

Reference consumer: `hr_leave_dashboard/static/src/js/leave_calendar.js`.

## Usage

1. Add `"cleon_calendar"` to your module's `depends`.
2. Use the component:

```js
import { CleonCalendar } from "@cleon_calendar/calendar/calendar";
import { getViewRange } from "@cleon_calendar/calendar/calendar_utils";

class ShiftCalendar extends Component {
    static template = "my_module.ShiftCalendar";
    static components = { CleonCalendar };

    setup() {
        this.orm = useService("orm");
        this.state = useState({ events: [], loading: true });
        onWillStart(() => this.load(getViewRange("month", new Date())));
    }

    async load({ dateFrom, dateTo }) {
        this.state.loading = true;
        const shifts = await this.orm.call("hr.shift", "get_calendar_data", [dateFrom, dateTo]);
        this.state.events = shifts.map((s) => ({
            id: s.id,
            title: s.employee_name,
            subtitle: s.shift_name,
            start: s.start,          // "YYYY-MM-DD" or "YYYY-MM-DD HH:MM"
            end: s.end,              // inclusive
            color: s.color,
        }));
        this.state.loading = false;
    }
}
```

```xml
<CleonCalendar events="state.events"
               loading="state.loading"
               views="['month', 'week', 'day']"
               weekStart="1"
               onRangeChange.bind="load"
               onEventClick.bind="openShift"
               onDayClick.bind="openDay"/>
```

## Props

| Prop | Default | Notes |
| --- | --- | --- |
| `events` | `[]` | See event shape below |
| `date`, `view` | today, first of `views` | Optional. Pass them to control navigation from the parent |
| `views` | `["month","week","day","year"]` | Order controls the switcher buttons |
| `weekStart` | `0` (Sunday) | `1` for Monday |
| `locale` | `"en-US"` | Used for labels |
| `loading`, `error`, `onRetry` | | Built-in spinner / error banner |
| `selectable` | `false` | Enables drag-to-select. Ranges go to `onSelectRange(from, to)` and single clicks to `onDayClick` |
| `maxEventsPerDay` | `3` | Month cells show "+N more" beyond this and call `onMoreClick(ymd, events)` |
| `showDayContent` | `true` | Whether the `dayContent` slot replaces the event stack, e.g. heat-map or coverage modes |
| `yearDayCount(ymd)` | counts events | Drives the year view's heat colours (server aggregates) |
| `dayTitle`, `emptyText`, `dayHeading` | | Copy |

Callbacks: `onRangeChange({view, date, dateFrom, dateTo})`, `onDayClick(ymd, events)`,
`onSelectRange(from, to)`, `onEventClick(event)`, `onMoreClick(ymd, events)`.

## Event shape

```js
{
    id, title, start, end,         // required: id, title, start
    subtitle, detail,              // extra lines in week / day views
    color, textColor,
    type: "event" | "marker",      // marker = neutral all-day banner (holidays, closures)
    icon: "fa-star text-warning",
    className: "o_ccal_dashed",    // e.g. tentative / pending items
    badge: { label, className },   // day view
    tooltip, clickable, data,
}
```

## Slots

`toolbarStart`, `actions` (toolbar), `banner` (above grid), `dayContent` {day, events},
`event` {event, view} (custom block rendering), `yearHeader`, `yearMonthSummary` {month},
`yearMonthFooter` {month}, `legend`.

Colours are CSS variables on `.o_ccal` (`--ccal-accent`, ...), so an app can override them.

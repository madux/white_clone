# OWL application contract

The OWL shell talks only to the non-persistent `hr.expense.app` service. Its
bootstrap response publishes a versioned contract:

- `contract.version` is the payload protocol version.
- `contract.modules` is the authoritative list of page loaders.
- `contract.actions` defines the allowed, required, and default fields for each
  configuration, petty-cash, accounting, and budget modal.

Every `get_app_page(module, page)` response has the same required envelope:

```text
contract_version  integer matching bootstrap contract.version
module            requested module key
page              requested page key
available         boolean
records           list
kpis              object
charts            object
```

Additional module-specific option objects are permitted. Page loaders are
registered in `HrExpenseApp._PAGE_LOADERS`; the gateway normalizes their output
through `page_payload()` before it crosses the RPC boundary. The OWL client
validates the envelope before assigning it to reactive state.

The stable `hr.expense.app` model is split internally across the bootstrap,
operations, financial, and governance service files. This separation does not
change RPC method names or the payload protocol.

Action field names live in `APP_ACTION_CONTRACTS` in
`models/hr_expense_app_contract.py`. The browser builds modal values from the
published defaults, and the corresponding Python endpoint rejects missing or
unknown fields. Add or rename an action field there first, then update the form
and its endpoint in the same change.

The unit suite checks contract publication, every normalized page envelope, and
invalid action payload rejection. The authenticated browser tour remains the
end-to-end guard for all module and sub-page renderers.

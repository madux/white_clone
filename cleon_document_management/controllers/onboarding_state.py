# -*- coding: utf-8 -*-
"""Per-module document management onboarding state (JSON on res.users)."""

ONBOARDING_MODULE_IDS = (
    "workspace",
    "employee_files",
    "organizational",
    "administration",
)

WORKSPACE_STEP_IDS = {
    "workspace",
    "upload",
    "approval",
    "shared",
    "search",
}

EMPLOYEE_FILES_STEP_IDS = {
    "ef-home",
    "ef-issues",
    "ef-groups",
    "ef-exclusions",
    "ef-custom-groups",
}

ORGANIZATIONAL_STEP_IDS = {
    "folders",
    "organizational-upload",
    "org-sharing",
}

ADMINISTRATION_STEP_IDS = {
    "document-types",
    "approval-workflow",
    "sharing",
    "approval-inbox",
}

ONBOARDING_STEPS = (
    WORKSPACE_STEP_IDS
    | EMPLOYEE_FILES_STEP_IDS
    | ORGANIZATIONAL_STEP_IDS
    | ADMINISTRATION_STEP_IDS
)

STEP_TO_MODULE = {
    **{step: "workspace" for step in WORKSPACE_STEP_IDS},
    **{step: "employee_files" for step in EMPLOYEE_FILES_STEP_IDS},
    **{step: "organizational" for step in ORGANIZATIONAL_STEP_IDS},
    **{step: "administration" for step in ADMINISTRATION_STEP_IDS},
}

MODULE_STEP_IDS = {
    "workspace": WORKSPACE_STEP_IDS,
    "employee_files": EMPLOYEE_FILES_STEP_IDS,
    "organizational": ORGANIZATIONAL_STEP_IDS,
    "administration": ADMINISTRATION_STEP_IDS,
}


def _default_module(pending_show=False):
    return {
        "completed_steps": [],
        "dismissed": False,
        "completed": False,
        "pending_show": pending_show,
    }


def default_onboarding_state():
    """No module auto-opens its guide until the user enters that area (arm) or setup completes."""
    return {
        "modules": {
            "workspace": _default_module(),
            "employee_files": _default_module(),
            "organizational": _default_module(),
            "administration": _default_module(),
        }
    }


def _module_setup_complete(env, module_id):
    if module_id == "employee_files":
        config = env["doc.employee.files.config"].get_for_company()
        return bool(config.setup_complete)
    return True


def _migrate_legacy_state(state):
    if state.get("modules"):
        return state
    legacy_steps = list(state.get("completed_steps") or [])
    legacy_dismissed = bool(state.get("dismissed"))
    legacy_completed = bool(state.get("completed"))
    legacy_show = not legacy_dismissed and not legacy_completed

    modules = {}
    for module_id, step_ids in MODULE_STEP_IDS.items():
        completed_steps = [step for step in legacy_steps if step in step_ids]
        modules[module_id] = {
            "completed_steps": completed_steps,
            "dismissed": False,
            "completed": len(completed_steps) == len(step_ids) and bool(step_ids),
            "pending_show": False,
        }
    modules["workspace"]["dismissed"] = legacy_dismissed
    modules["workspace"]["completed"] = legacy_completed
    modules["workspace"]["pending_show"] = legacy_show
    return {"modules": modules}


def normalize_state(state):
    state = dict(state or {})
    state = _migrate_legacy_state(state)
    modules = state.get("modules") or {}
    normalized = {}
    for module_id in ONBOARDING_MODULE_IDS:
        mod = dict(modules.get(module_id) or _default_module())
        step_ids = MODULE_STEP_IDS[module_id]
        completed_steps = [
            step for step in mod.get("completed_steps", []) if step in step_ids
        ]
        mod["completed_steps"] = completed_steps
        mod["dismissed"] = bool(mod.get("dismissed"))
        mod["completed"] = bool(mod.get("completed"))
        mod["pending_show"] = bool(mod.get("pending_show"))
        normalized[module_id] = mod
    return {"modules": normalized}


def module_public_view(mod):
    show = (
        mod.get("pending_show")
        and not mod.get("dismissed")
        and not mod.get("completed")
    )
    return {
        "show": show,
        "dismissed": mod.get("dismissed"),
        "completed": mod.get("completed"),
        "completed_steps": mod.get("completed_steps", []),
        "pending_show": mod.get("pending_show"),
    }


def serialize_for_api(state, is_admin, env=None):
    state = normalize_state(state)
    modules_out = {}
    for module_id in ONBOARDING_MODULE_IDS:
        view = module_public_view(state["modules"][module_id])
        if env and not _module_setup_complete(env, module_id):
            view = {
                **view,
                "show": False,
                "pending_show": False,
            }
        modules_out[module_id] = view
    return {
        "modules": modules_out,
        "is_admin": is_admin,
    }


def arm_module(state, module_id, env=None):
    if module_id not in ONBOARDING_MODULE_IDS:
        return state
    if env and not _module_setup_complete(env, module_id):
        return state
    state = normalize_state(state)
    mod = state["modules"][module_id]
    if not mod.get("completed") and not mod.get("dismissed"):
        mod["pending_show"] = True
    return state


def update_state(state, action, module_id=None, step_id=None, env=None):
    state = normalize_state(state)
    if action == "reset":
        if module_id and module_id in ONBOARDING_MODULE_IDS:
            state["modules"][module_id] = _default_module()
        else:
            state = default_onboarding_state()
        return state

    if action == "arm":
        if not module_id:
            return state
        return arm_module(state, module_id, env=env)

    if not module_id or module_id not in ONBOARDING_MODULE_IDS:
        return state

    mod = state["modules"][module_id]
    step_ids = MODULE_STEP_IDS[module_id]
    completed_steps = list(mod.get("completed_steps") or [])

    if action == "complete_step" and step_id in step_ids:
        if step_id not in completed_steps:
            completed_steps.append(step_id)
        mod.update(
            {
                "completed_steps": completed_steps,
                "dismissed": False,
            }
        )
    elif action == "complete":
        mod.update(
            {
                "completed_steps": completed_steps,
                "completed": True,
                "pending_show": False,
            }
        )
    elif action == "dismiss":
        mod.update(
            {
                "completed_steps": completed_steps,
                "dismissed": True,
                "pending_show": False,
            }
        )

    state["modules"][module_id] = mod
    return state

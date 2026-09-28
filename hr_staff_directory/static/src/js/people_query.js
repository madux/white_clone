/** @odoo-module **/

/** Shared People-tab query helpers. Keep in sync with
 *  hr.employee._apply_segment_conditions / funnel matching. */

export const FUNNEL_TO_SEGMENT_FIELD = {
    department: 'dept',
    grade: 'gradeLevel',
    location: 'location',
    gender: 'gender',
    performance: 'performanceScore',
    employment_type: 'employmentType',
    lifecycle: 'lifecycleState',
    manager: 'lineManager',
    flight_risk: 'flightRisk',
    availability: 'availability',
    work_mode: 'workMode',
    tenure: 'tenureBucket',
    skills: 'skills',
    languages: 'languages',
    reporting_depth: 'reportingDepth',
};

export const SEGMENT_FIELD_LABELS = {
    dept: 'Department',
    role: 'Role',
    gradeLevel: 'Grade',
    location: 'Location',
    workMode: 'Work Mode',
    employmentType: 'Employment Type',
    lifecycleState: 'Lifecycle',
    flightRisk: 'Flight Risk',
    retentionPriority: 'Retention Priority',
    lineManager: 'Reports To',
    tenureBucket: 'Tenure',
    gender: 'Gender',
    id: 'Employee ID',
    skills: 'Skills',
    languages: 'Languages',
    performanceScore: 'Performance',
    availability: 'Availability',
    reportingDepth: 'Reporting Depth',
    startDateFrom: 'Start from',
    startDateTo: 'Start to',
};

export function normToken(val) {
    return String(val || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

export function asList(val) {
    if (Array.isArray(val)) {
        return val.map((item) => String(item).trim()).filter(Boolean);
    }
    if (val === undefined || val === null || val === '') {
        return [];
    }
    return String(val).split(',').map((item) => item.trim()).filter(Boolean);
}

export function parseTenureMonths(label) {
    const text = String(label || '').toLowerCase();
    if (!text || text.includes('<')) {
        return 0;
    }
    const years = text.match(/(\d+)\s*y/);
    const months = text.match(/(\d+)\s*m/);
    return (years ? parseInt(years[1], 10) * 12 : 0) + (months ? parseInt(months[1], 10) : 0);
}

export function tenureBucket(months) {
    if (months < 12) {
        return '0-1y';
    }
    if (months < 36) {
        return '1-3y';
    }
    if (months < 60) {
        return '3-5y';
    }
    return '5y+';
}

export function personHireDate(person) {
    return person.start_date || person.create_date || '';
}

export function personSkills(person) {
    return asList(person.skills);
}

export function personLanguages(person) {
    return asList(person.languages);
}

export function personEmploymentType(person) {
    return person.employment_type || person.employee_type || '';
}

export function personScore(person) {
    const raw = person.progress_score;
    if (raw !== undefined && raw !== null && raw !== '') {
        const num = parseFloat(raw);
        if (!Number.isNaN(num)) {
            return num;
        }
    }
    const text = String(person.performance_score || '').replace('%', '');
    const match = text.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
}

export function performanceBucket(score) {
    if (score < 60) {
        return '0-59';
    }
    if (score < 80) {
        return '60-79';
    }
    return '80-100';
}

export function personLifecycle(person) {
    return person.lifecycle_state || '';
}

function personFieldValue(person, field) {
    switch (field) {
        case 'dept':
            return person.department || '';
        case 'role':
            return person.job_title || '';
        case 'gradeLevel':
            return person.grade || person.band || '';
        case 'location':
            return person.work_location || '';
        case 'workMode':
            return person.work_mode || '';
        case 'employmentType':
            return personEmploymentType(person);
        case 'lifecycleState':
            return personLifecycle(person);
        case 'flightRisk':
            return person.flight_risk || '';
        case 'retentionPriority':
            return person.retention_priority || '';
        case 'lineManager':
            return person.manager_name || person.reports_to || '';
        case 'tenureBucket':
            return tenureBucket(parseTenureMonths(person.tenure));
        case 'gender':
            return person.gender || '';
        case 'id':
            return person.emp_ref || person.employee_id || '';
        case 'skills':
            return personSkills(person).join(',');
        case 'languages':
            return personLanguages(person).join(',');
        case 'performanceScore':
            return personScore(person);
        case 'availability':
            return person.availability || '';
        case 'reportingDepth':
            return (person.direct_report_ids && person.direct_report_ids.length)
                ? 'Has Direct Reports'
                : 'Individual Contributor';
        case 'startDate':
        case 'startDateFrom':
        case 'startDateTo':
            return personHireDate(person);
        default:
            return person[field] || '';
    }
}

function valuesEqual(left, right) {
    return normToken(left) === normToken(right);
}

function listHas(haystack, needle) {
    const items = asList(haystack);
    if (!items.length) {
        return valuesEqual(haystack, needle) || normToken(haystack).includes(normToken(needle));
    }
    return items.some((item) => valuesEqual(item, needle) || normToken(item).includes(normToken(needle)));
}

export function matchSegmentCondition(person, cond) {
    if (!cond || !cond.field || !cond.operator) {
        return false;
    }
    const field = cond.field;
    const op = cond.operator;
    const val = cond.value;
    if (val === undefined || val === null || val === '') {
        return false;
    }

    if (field === 'startDateFrom' || (field === 'startDate' && op === 'gte')) {
        const hire = personHireDate(person);
        return Boolean(hire && hire >= String(val));
    }
    if (field === 'startDateTo' || (field === 'startDate' && op === 'lte')) {
        const hire = personHireDate(person);
        return Boolean(hire && hire <= String(val));
    }

    if (field === 'performanceScore' && ['eq', 'gte', 'lte', 'between'].includes(op)) {
        const score = personScore(person);
        if (op === 'eq') {
            return score === parseFloat(val);
        }
        if (op === 'gte') {
            return score >= parseFloat(val);
        }
        if (op === 'lte') {
            return score <= parseFloat(val);
        }
        const [lo, hi] = String(val).split('-');
        return score >= parseFloat(lo) && score <= parseFloat(hi || lo);
    }

    if (field === 'performanceScore' && (op === 'is' || op === 'in' || op === 'isNot' || op === 'notIn')) {
        const bucket = performanceBucket(personScore(person));
        const selected = asList(val);
        const hit = selected.some((item) => valuesEqual(item, bucket));
        return op === 'isNot' || op === 'notIn' ? !hit : hit;
    }

    const pVal = personFieldValue(person, field);
    const selected = asList(val);
    const isMulti = field === 'skills' || field === 'languages';

    if (op === 'in' || op === 'isAnyOf') {
        return selected.some((item) => (isMulti ? listHas(pVal, item) : valuesEqual(pVal, item)));
    }
    if (op === 'notIn') {
        return selected.every((item) => (isMulti ? !listHas(pVal, item) : !valuesEqual(pVal, item)));
    }
    if (op === 'is') {
        return isMulti ? listHas(pVal, val) : valuesEqual(pVal, val);
    }
    if (op === 'isNot') {
        return isMulti ? !listHas(pVal, val) : !valuesEqual(pVal, val);
    }
    if (op === 'contains') {
        return normToken(pVal).includes(normToken(val)) || listHas(pVal, val);
    }
    if (op === 'notContains') {
        return !normToken(pVal).includes(normToken(val)) && !listHas(pVal, val);
    }
    return false;
}

export function applySegmentConditions(people, conditions) {
    const list = Array.isArray(conditions) ? conditions.filter((c) => c && c.field && c.operator && c.value !== '' && c.value !== undefined) : [];
    if (!list.length) {
        return [];
    }
    return (people || []).filter((person) => list.every((cond) => matchSegmentCondition(person, cond)));
}

export function funnelFiltersToConditions(activeFilters) {
    const conditions = [];
    const filters = activeFilters || {};
    if (filters.start_date_from) {
        conditions.push({ field: 'startDateFrom', operator: 'gte', value: filters.start_date_from });
    }
    if (filters.start_date_to) {
        conditions.push({ field: 'startDateTo', operator: 'lte', value: filters.start_date_to });
    }
    for (const [key, values] of Object.entries(filters)) {
        if (key === 'start_date_from' || key === 'start_date_to') {
            continue;
        }
        if (!Array.isArray(values) || !values.length) {
            continue;
        }
        const field = FUNNEL_TO_SEGMENT_FIELD[key];
        if (!field) {
            continue;
        }
        if (values.length === 1) {
            conditions.push({ field, operator: 'is', value: values[0] });
        } else {
            conditions.push({ field, operator: 'in', value: [...values] });
        }
    }
    return conditions;
}

export function matchFunnelFilters(person, activeFilters) {
    const filters = activeFilters || {};
    if (filters.start_date_from || filters.start_date_to) {
        const hire = personHireDate(person);
        if (filters.start_date_from && (!hire || hire < filters.start_date_from)) {
            return false;
        }
        if (filters.start_date_to && (!hire || hire > filters.start_date_to)) {
            return false;
        }
    }
    for (const [key, selected] of Object.entries(filters)) {
        if (key === 'start_date_from' || key === 'start_date_to') {
            continue;
        }
        if (!Array.isArray(selected) || !selected.length) {
            continue;
        }
        const field = FUNNEL_TO_SEGMENT_FIELD[key];
        if (!field) {
            continue;
        }
        if (!matchSegmentCondition(person, {
            field,
            operator: selected.length > 1 ? 'in' : 'is',
            value: selected.length > 1 ? selected : selected[0],
        })) {
            return false;
        }
    }
    return true;
}

export function formatConditionValue(value) {
    if (Array.isArray(value)) {
        return value.join(', ');
    }
    return String(value || '');
}

export function formatConditionChip(cond) {
    const label = SEGMENT_FIELD_LABELS[cond.field] || cond.field;
    return `${label} ${cond.operator} ${formatConditionValue(cond.value)}`;
}

export function computeFilteredStats(people) {
    const rows = people || [];
    const life = (person) => normToken(person.lifecycle_state);
    const onLeave = rows.filter((person) => (
        life(person) === 'onleave' ||
        normToken(person.availability) === 'onleave'
    )).length;
    const probation = rows.filter((person) => life(person) === 'probation').length;
    const retention = rows.filter((person) => {
        const value = person.retention_priority;
        if (value === true || value === 1) {
            return true;
        }
        const token = String(value || '').trim().toLowerCase();
        return Boolean(token) && token !== '0' && token !== 'false' && token !== 'low' && token !== 'no';
    }).length;
    const inactive = new Set(['terminated', 'alumni', 'suspended']);
    const active = rows.filter((person) => !inactive.has(life(person)) && life(person) !== 'onleave').length;
    return {
        total: rows.length,
        active,
        on_leave: onLeave,
        probation,
        retention_priority: retention,
    };
}

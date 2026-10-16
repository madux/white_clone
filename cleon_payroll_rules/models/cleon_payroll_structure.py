# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class CleonPayrollStructure(models.Model):
    _inherit = "cleon.payroll.structure"

    compiled_order = fields.Text(compute="_compute_compiled_order",
                                 help="Order the engine will run, computed from declared reads.")

    def get_all_rules(self):
        """Active rules only, ordered by what each one reads. The typed sequence is
        only a tie-breaker between rules that do not depend on each other."""
        rules = super().get_all_rules().filtered(lambda r: r.state == "active")
        return self._sort_rules_by_reads(rules)

    @api.model
    def _sort_rules_by_reads(self, rules):
        Rule = self.env["cleon.payroll.rule"]
        rules = rules.sorted(key=lambda r: (r.sequence, r.code))
        by_code = {r.code: r for r in rules}
        members = {}
        for r in rules:
            members[r.category_id.code] = members.get(r.category_id.code, Rule) | r
        deps = {}
        for r in rules:
            d = Rule
            for code in r._get_read_codes("rules"):
                t = by_code.get(code)
                if t and t != r:
                    d |= t
            for ccode in r._get_read_codes("categories"):
                d |= members.get(ccode, Rule).filtered(lambda x: x.category_id != r.category_id)
            deps[r.id] = d
        ordered, done, remaining = [], set(), list(rules)
        while remaining:
            nxt = next((r for r in remaining if all(x.id in done for x in deps[r.id])), None)
            if nxt is None:
                self._raise_cycle(remaining, deps)
            ordered.append(nxt.id)
            done.add(nxt.id)
            remaining.remove(nxt)
        return Rule.browse(ordered)

    @api.model
    def _raise_cycle(self, remaining, deps):
        rem_ids = {r.id for r in remaining}
        node, path = remaining[0], []
        while node.id not in [p.id for p in path]:
            path.append(node)
            node = next(x for x in deps[node.id] if x.id in rem_ids)
        start = [p.id for p in path].index(node.id)
        cycle = path[start:] + [node]
        raise ValidationError(_("Circular rule dependency: %s. Each of these rules reads "
                                "another one in the loop.") % " -> ".join(c.name for c in cycle))

    @api.constrains("rule_ids", "parent_id")
    def _check_rule_cycles(self):
        for s in self:
            rules = s.rule_ids.filtered(lambda r: r.state != "superseded")
            if s.parent_id:
                rules |= s.parent_id.rule_ids.filtered(lambda r: r.state != "superseded")
            s._sort_rules_by_reads(rules)

    def _compute_compiled_order(self):
        for s in self:
            try:
                s.compiled_order = "  ->  ".join(
                    "%s (%s)" % (r.name, r.code) for r in s.get_all_rules())
            except ValidationError as e:
                s.compiled_order = str(e.args[0])

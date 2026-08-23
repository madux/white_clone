# -*- coding: utf-8 -*-
from . import controllers, models


def post_init_hook(env):
    env['hr.work.location']._post_init_geocode()

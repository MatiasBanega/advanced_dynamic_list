# -*- coding: utf-8 -*-

import base64
import hashlib
import json

import odoo
from odoo import api, http, models
from odoo.http import request


class advanced_dynamicHttp(models.AbstractModel):
    _inherit = 'ir.http'

    def session_info(self):
        session_info = super(advanced_dynamicHttp, self).session_info()
        # global or local
        session_info['advanced_dynamic_list_mode'] = request.env[
            'ir.config_parameter'].sudo().get_param('advanced_dynamic_list.mode', 'global')
        return session_info

# -*- coding: utf-8 -*-

from odoo import models, api, _
import logging

_logger = logging.getLogger(__name__)

class advanced_dynamicBaseExtend(models.AbstractModel):
    """
    base extend
    """
    _inherit = "base"

    @api.model
    def load_views(self, views, options=None):
        """
        load views
        """
        options = options or {}
        action_id = options.get('action_id')
        self = self.with_context(advanced_dynamic_action_id=action_id)
        return super(advanced_dynamicBaseExtend, self).load_views(views, options)

    @api.model
    def _fields_view_get(self, view_id=None, view_type='form', toolbar=False, submenu=False):
        """
        extend to add user data
        """
        result = super(advanced_dynamicBaseExtend, self)._fields_view_get(
            view_id, view_type, toolbar, submenu)
        # get the default view id
        if not view_id:
            view_id = result.get('view_id', False)
        if view_type == 'tree' or view_type == 'form':
            self._post_process_user_data(view_id, view_type, result)
        return result

    @api.model
    def _post_process_user_data(self, view_id, view_type, result):
        """
        """
        context = self.env.context
        action_id = context.get('advanced_dynamic_action_id', False)
        user_data = self.env['advanced_dynamic_list.user_data'].get_user_data(
            self._name, action_id, view_id, view_type)
        
        result["advanced_dynamic_user_data"] = user_data
        _logger.info("user_data: %s", user_data)
        
        return result

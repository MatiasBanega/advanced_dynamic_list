# -*- coding: utf-8 -*-

from odoo import api, fields, models
import base64


class advanced_dynamicTableSetting(models.TransientModel):
    '''
    awesome user setting
    '''
    _inherit = 'res.config.settings'

    virtual_scroll = fields.Boolean(string="Virtual Scroll", default=True)
    allow_user_config = fields.Boolean(string="Allow User Config", default=False)
    enable_advanced_dynamic_list_by_default = fields.Boolean(string="Enable advanced_dynamic List", default=True)
    based_on_admin_setting = fields.Boolean(string="Based on Admin Setting", default=True)

    @api.model
    def get_list_config(self):
        """
        get list config
        """
        ir_config = self.env['ir.config_parameter'].sudo()
        virtual_scroll = ir_config.get_param("advanced_dynamic_list.virtual_scroll")
        allow_user_config = ir_config.get_param("advanced_dynamic_list.allow_user_config")
        enable_advanced_dynamic_list_by_default = ir_config.get_param("advanced_dynamic_list.enable_advanced_dynamic_list_by_default")
        based_on_admin_setting = ir_config.get_param("advanced_dynamic_list.based_on_admin_setting")

        return {
            "virtual_scroll": virtual_scroll,
            "allow_user_config": allow_user_config,
            "enable_advanced_dynamic_list_by_default": enable_advanced_dynamic_list_by_default,
            "based_on_admin_setting": based_on_admin_setting,
        }


    @api.model
    def get_values(self):
        '''
        get the vuales
        :return:
        '''
        res = super(advanced_dynamicTableSetting, self).get_values()

        list_config = self.get_list_config()
        res.update(list_config)

        return res

    def set_values(self):
        '''
        set values
        :return:
        '''
        super(advanced_dynamicTableSetting, self).set_values()

        ir_config = self.env['ir.config_parameter'].sudo()

        ir_config.set_param("advanced_dynamic_list.virtual_scroll", self.virtual_scroll)
        ir_config.set_param("advanced_dynamic_list.allow_user_config", self.allow_user_config)
        ir_config.set_param("advanced_dynamic_list.enable_advanced_dynamic_list_by_default", self.enable_advanced_dynamic_list_by_default)
        ir_config.set_param("advanced_dynamic_list.based_on_admin_setting", self.based_on_admin_setting)

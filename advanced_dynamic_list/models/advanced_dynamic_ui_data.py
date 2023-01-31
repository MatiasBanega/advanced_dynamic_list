# -*- coding: utf-8 -*-


from odoo import models, fields, api, _


class advanced_dynamicUIData(models.Model):
    """
    user setting data
    """
    _name = 'advanced_dynamic_list.ui_data'
    _description = 'advanced_dynamic list ui data'

    model_name = fields.Char(string="Name", required=True)
    x2many_model_name = fields.Char(string="x2many model Name")

    view_id = fields.Char(string="View Id")
    view_type = fields.Char(string="View Type", default='tree')
    action_id = fields.Char(string="Action Id")

    enable_advanced_dynamic_list = fields.Boolean(string="Enable List Manager", default=True)
    enable_virtual_scroll = fields.Boolean(string="Enable Virtual Scroll", default=False)
    force_readonly = fields.Boolean(string="Enable Readonly", default=False)
    auto_ajust_column = fields.Boolean(string="Auto Ajust Column", default=True)

    has_serials = fields.Boolean(string="Has Serial", default=False)
    show_search_row = fields.Boolean(string="Show Search Row", default=True)
    border_style = fields.Selection(
        selection=[('striped', 'striped'),('bordered', 'bordered')], string="Border Style")
    tree_column = fields.Char(string="Tree Column")
    expand_row_template = fields.Char(string="Expand Row Template")

    user_fields = fields.One2many(
        comodel_name="advanced_dynamic_list.user_field",
        inverse_name="user_data",
        string="user fields")

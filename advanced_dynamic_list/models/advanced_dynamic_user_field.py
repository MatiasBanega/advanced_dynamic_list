# -*- coding: utf-8 -*-

from email.policy import default
from odoo import models, fields, api


class advanced_dynamicUserFields(models.Model):
    """
    user setting data
    """
    _name = 'advanced_dynamic_list.user_field'
    _description = 'advanced_dynamic_list.user_field'

    user_data = fields.Many2one(
        comodel_name="advanced_dynamic_list.user_data", string="user data", ondelete="cascade")
    name = fields.Char(string="Field Name", required="True")
    string = fields.Char(string="Field String", required="True")
    visible = fields.Boolean(string="Show Fields In List", default=True)
    order = fields.Integer(string="Name")
    
    # the width maybe a string like 100px
    width = fields.Char(string="width")
    parent = fields.Char(string="Parent")

    required = fields.Boolean(string="Required", default=False)
    readonly = fields.Boolean(string="Readonly", default=False)

    fixed_left = fields.Boolean(string="fixed left", default=False)
    fixed_right = fields.Boolean(string="fixed right", default=False)

    domain = fields.Char(string="Domain")
    context = fields.Char(string="Context")
    attrs = fields.Char(string="Attrs")
    options = fields.Char(string="Options")

    field_class = fields.Char(string="Field Class")
    field_style = fields.Char(string="Field Style")

    is_button = fields.Boolean(string="Is Button", default=False)
    is_widget = fields.Boolean(string="Is Widget", default=False)


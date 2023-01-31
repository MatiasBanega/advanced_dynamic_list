# -*- coding: utf-8 -*-


from odoo import models, fields, api, _, SUPERUSER_ID
import logging

_logger = logging.getLogger(__name__)


class advanced_dynamicUserData(models.Model):
    """
    user setting data
    """
    _name = 'advanced_dynamic_list.user_data'
    _description = 'advanced_dynamic list user data'

    model_name = fields.Char(string="Name", required=True)
    x2many_model_name = fields.Char(string="x2many model Name")

    uid = fields.Many2one(comodel_name='res.users', string="User")
    view_id = fields.Char(string="View Id")
    view_type = fields.Char(string="View Type", default='tree')
    action_id = fields.Char(string="Action Id")

    enable_advanced_dynamic_list = fields.Boolean(string="Enable List Manager", default=True)
    enable_virtual_scroll = fields.Boolean(string="Enable Virtual Scroll", default=False)
    force_readonly = fields.Boolean(string="Enable Readonly", default=False)
    auto_ajust_column = fields.Boolean(string="Auto Ajust Column", default=True)
    column_configer_layout = fields.Selection(
        selection=[('horizontal', 'Horizontal'),('vertical', 'Vertical')], string="Configer Column Layout", default='vertical')

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

    @api.model
    def get_user_data(self, model_name, action_id, view_id, view_type):
        """
        check if the user data exits
        :param model_name:
        :param uid:
        :param view_id:
        :return:
        """
        results = []
        list_config = self.env['res.config.settings'].sudo().get_list_config()
        records = self.get_user_record(self.env.uid, model_name, action_id, view_id, view_type)
        # use the admin data as default data
        if not records and list_config.get('based_on_admin_setting') and self.env.uid not in [SUPERUSER_ID, 2]:
            records = self.get_user_record(
                SUPERUSER_ID, model_name, action_id, view_id, view_type)
            if not records:
                records = self.get_user_record(
                    2, model_name, action_id, view_id, view_type)
        if records:
            for record in records:
                result = record.read()[0]
                user_fields = record.user_fields.read()
                result["user_fields"] = user_fields
                if record.x2many_model_name:
                    # as the subview do not load the fields, so we load it here
                    result["advanced_dynamic_x2many_fields"] = self.env[record.x2many_model_name].fields_get()
                results.append(result)
        else:
            result = None

        if view_type in ['tree', 'list'] and results:
            results = results[0]

        if not results:
            return False

        return results

    @api.model
    def get_user_record(
        self, uid, model_name, action_id, view_id, view_type, x2many_model_name=None):
        """
        check if the user data exits
        :param model_name:
        :param uid:
        :param view_id:
        :return:
        """  
        if view_type == 'tree':
            view_type = 'list'

        domain = [('model_name', '=', model_name),
                  ('uid', '=', uid), 
                  ('view_type', '=', view_type)]
                
        if view_id:
            domain.append(('view_id', '=', view_id))
        if x2many_model_name:
            domain.append(('x2many_model_name', '=', x2many_model_name))

        records = self.env['advanced_dynamic_list.user_data'].search(domain, order='id desc', limit=1)

        return records

    @api.model
    def update_user_data(self, user_data):
        """
        update user data
        """
        record = self.get_user_record(
            self.env.uid,
            user_data['model_name'], 
            user_data.get('action_id', False),
            user_data.get('view_id', False),
            user_data['view_type'],
            user_data.get('x2many_model_name', False))

        # get the user_field field names
        fields_name_list = self.env['advanced_dynamic_list.user_field']._fields.keys()
        fields = user_data.get("user_fields", [])
        field_datas = []
        if fields:
            field_datas = [(5, 0, 0)]
            for rec in fields:
                for key in rec:
                    if key not in fields_name_list:
                        del rec[key]
                field_datas.append((0, 0, rec))
            user_data['user_fields'] = field_datas

        if record:
            record.write(user_data)
        else:
            record = self.create(user_data)

        return record._geUserRecordData()

    def _geUserRecordData(self):
        """
        get user data
        """
        result = self.read()[0]
        user_fields = self.user_fields.read()
        result["user_fields"] = user_fields

        return result

    @api.model
    def enableListManager(self, user_data):
        """
        enable list manager
        """
        record = self.get_user_record(
            user_data['model_name'], 
            user_data.get('action_id', False),
            user_data.get('view_id', False),
            user_data['view_type'],
            user_data.get('x2many_model_name', False))
        if not record:
            record = self.create(user_data)
        record.write({'enable_advanced_dynamic_list': True})
        return record._geUserRecordData()

    @api.model
    def reset_user_settings(self, user_data):
        """
        reset user settings
        """
        record = self.get_user_record(
            self.env.uid,
            user_data['model_name'], 
            user_data.get('action_id', False),
            user_data.get('view_id', False),
            user_data['view_type'],
            user_data.get('x2many_model_name', False))
        if record:
            record.unlink()

        return False

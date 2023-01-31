odoo.define('advanced_dynamic_list.form_render', function (require) {

    "use strict";
    
    var FormRender = require('web.FormRenderer');
    
    FormRender.include({
        
        custom_events: _.extend({}, FormRender.prototype.custom_events, {
            'advanced_dynamic_get_x2many_user_data': '_onGetX2manyUserData',
            'advanced_dynamic_update_x2many_user_data': '_onUpdateX2manyUserData',
        }),

        init: function (parent, state, params) {
            this._super.apply(this, arguments);
            this.advanced_dynamic_user_datas = params.advanced_dynamic_user_data;
            this.advanced_dynamic_user_data_cache = {};
            _.each(this.advanced_dynamic_user_datas, (advanced_dynamic_user_data) => {
                if (advanced_dynamic_user_data.x2many_model_name) {
                    this.advanced_dynamic_user_data_cache[
                        advanced_dynamic_user_data.x2many_model_name] = advanced_dynamic_user_data;
                }
            })
        },

        _onGetX2manyUserData: function (ev) {
            ev.stopPropagation();
            var data = ev.data;
            var field = data.field;
            if (field.relation in this.advanced_dynamic_user_data_cache) {
                ev.data.callback(this.advanced_dynamic_user_data_cache[field.relation]);
            } else {
                ev.data.callback(false);
            }
        },

        _onUpdateX2manyUserData: function (ev) {
            ev.stopPropagation();
            var data = ev.data;
            var field = data.field;
            var advanced_dynamic_user_data = data.advanced_dynamic_user_data;
            this.advanced_dynamic_user_data_cache[field.relation] = advanced_dynamic_user_data;
        },
    })
})
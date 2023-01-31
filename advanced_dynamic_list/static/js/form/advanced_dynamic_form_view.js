odoo.define('advanced_dynamic_list.form_view', function (require) {

    "use strict";

    var core = require('web.core');
    var FormView = require('web.FormView');

    let advanced_dynamicListMode = odoo.advanced_dynamic_list_mode;
    var _lt = core._lt;

    FormView.include({

        init: function (viewInfo, params) {
            this.advanced_dynamic_user_data = viewInfo.advanced_dynamic_user_data || [];
            this.action_id = (params.action && params.action.id) || false;
            return this._super.apply(this, arguments);
        },

        getRenderer: function () {
            this.rendererParams = _.extend({}, {
                'advanced_dynamic_user_data': this.fieldsView.advanced_dynamic_user_data || false
            }, this.rendererParams);
            return this._super.apply(this, arguments);
        },

        getController: function () {
            this.controllerParams = _.extend({}, {
                'advanced_dynamic_user_data': this.fieldsView.advanced_dynamic_user_data || false
            }, this.controllerParams);
            return this._super.apply(this, arguments);
        },

        _getUserData: function (modelName) {
            let self = this;
            var advanced_dynamic_user_datas =  this.advanced_dynamic_user_data || []
            var advanced_dynamic_user_data = _.find(advanced_dynamic_user_datas, function (advanced_dynamic_user_data) {
                return advanced_dynamic_user_data.x2many_model_name == modelName;
            });
            return advanced_dynamic_user_data;
        },

        _processFieldsView: function (fieldsView, viewType) {
            var fv = this._super.apply(this, arguments);
            if (viewType == 'tree' || viewType == 'list') {
                // add the user field
                var relation = fieldsView.field_relation || fieldsView.model;
                if (!relation) {
                    return fv;
                }
                var advanced_dynamic_user_data = this._getUserData(relation);
                var advanced_dynamic_x2many_fields = advanced_dynamic_user_data && advanced_dynamic_user_data.advanced_dynamic_x2many_fields || undefined;
                if (advanced_dynamic_user_data) {
                    // add the user field
                    fv.advanced_dynamic_user_fields = advanced_dynamic_user_data.user_fields || false;
                    fv.fields = _.defaults({}, fv.fields, advanced_dynamic_x2many_fields);
                    fv.viewFields = _.defaults({}, fv.viewFields, advanced_dynamic_x2many_fields);
                    if (fv.advanced_dynamic_user_fields) {
                        let fieldsInfo = fv.fieldsInfo[viewType];
                        for (var i = 0; i < fv.advanced_dynamic_user_fields.length; i++) {
                            var field = fv.advanced_dynamic_user_fields[i];
                            if (!fieldsInfo[field.name] && field.name in fv.fields) {
                                // create a json node 
                                var jsonNode = {
                                    tag: "field",
                                    attrs: {
                                        name: field.name,
                                        modifiers: {
                                            "readonly": field.readonly,
                                        },
                                    },
                                    children: [],
                                }
                               this._processNode(jsonNode, fv);
                            }
                        }
                    }
                }
            }
            return fv;
        },

        _processField: function (viewType, field, attrs) {
            if (!_.isEmpty(field.views)) {
                _.each(field.views, function (innerFieldsView, viewType) {
                    innerFieldsView.field_relation = field.relation;
                });
            }
            return this._super.apply(this, arguments);
        },
    });
})
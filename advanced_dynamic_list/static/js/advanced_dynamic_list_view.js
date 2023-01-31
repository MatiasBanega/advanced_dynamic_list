odoo.define('advanced_dynamic_list.list_view', function (require) {
    "use strict";

    var advanced_dynamicListRender = require('advanced_dynamic_list.list_render');
    var advanced_dynamicListController = require('advanced_dynamic_list.list_controller');
    var BasicView = require('web.BasicView');
    var ListView = require('web.ListView');
    var advanced_dynamicListModel = require('advanced_dynamic_list.list_model');
    let advanced_dynamicListMode = odoo.advanced_dynamic_list_mode
    var view_registry = require('web.view_registry');

    let advanced_dynamicListConfig = {

        init: function (viewInfo, params) {
            this._super.apply(this, arguments)
            this.viewParams = params;
        },

        getRenderer: function () {
            this.rendererParams = _.extend({}, {
                'advanced_dynamic_user_data': this.fieldsView.advanced_dynamic_user_data || false,
                'view_params': this.viewParams || false,
            }, this.rendererParams);
            return this._super.apply(this, arguments);
        },

        getController: function () {
            this.controllerParams = _.extend({}, {
                'advanced_dynamic_user_data': this.fieldsView.advanced_dynamic_user_data || false,
                'view_params': this.viewParams || false,
            }, this.controllerParams);
            return this._super.apply(this, arguments);
        },

        getModel: function () {
            this.model = this._super.apply(this, arguments);
            this.model.advanced_dynamic_user_data = this.fieldsView.advanced_dynamic_user_data || false;
            return this.model;
        },

        _processFieldsView: function (fieldsView, viewType) {
            var fv = this._super.apply(this, arguments);
            viewType = viewType || this.viewType;
            var fields = fv.fields;
            fv.advanced_dynamic_user_fields = (
                fieldsView.advanced_dynamic_user_data && fieldsView.advanced_dynamic_user_data.user_fields) || false;
            // add the advanced_dynamic user fields to the fields view
            if (fv.advanced_dynamic_user_fields && fv.advanced_dynamic_user_fields.length > 0) {
                let fieldsInfo = fv.fieldsInfo[viewType || this.viewType];
                for (var i = 0; i < fv.advanced_dynamic_user_fields.length; i++) {
                    var field = fv.advanced_dynamic_user_fields[i];
                    if (!fieldsInfo[field.name] && field.name in fields) {
                        // create a xml node
                        var jsonNode = {
                            tag: "field",
                            attrs: {
                                name: field.name,
                                modifiers: {
                                    "readon ly": field.readonly,
                                },
                            },
                            children: [],
                        }
                       this._processNode(jsonNode, fv);
                    }
                }
            }
            return fv;
        },

        parseArch: function (arch) {
            var doc = $.parseXML(arch).documentElement;
            var stripWhitespaces = doc.nodeName.toLowerCase() !== 'kanban';
            return utils.xml_to_json(doc, stripWhitespaces);
        },

        viewType: 'list'
    }

    if (advanced_dynamicListMode == 'global') {
        ListView.include(advanced_dynamicListConfig);
    } else {
        advanced_dynamicListConfig.config =  _.extend({}, BasicView.prototype.config, {
            Renderer: advanced_dynamicListRender,
            Controller: advanced_dynamicListController,
            Model: advanced_dynamicListModel,
        })
        let advanced_dynamicList = ListView.extend(advanced_dynamicListConfig);
        view_registry.add('advanced_dynamic_list', advanced_dynamicList);
        return advanced_dynamicList;
    }
});

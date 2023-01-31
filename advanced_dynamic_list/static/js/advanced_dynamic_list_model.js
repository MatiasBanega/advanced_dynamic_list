odoo.define('advanced_dynamic_list.list_model', function (require) {

    "use strict";

    var BasicModel = require('web.BasicModel');
    var advanced_dynamicFakeView = require('advanced_dynamic_list.fake_view');

    var advanced_dynamicListMode = odoo.advanced_dynamic_list_mode

    var advanced_dynamicListModel = {

        updateUserData: function (advanced_dynamic_user_data, id) {
            this.advanced_dynamic_user_data = advanced_dynamic_user_data;

            // update the view
            let element = this.localData[id];

            // update fieldsInfo
            let fakeView =  new advanced_dynamicFakeView();
            let advanced_dynamic_user_fields = (advanced_dynamic_user_data && advanced_dynamic_user_data.user_fields) || false;
            
            // add the advanced_dynamic user fields to the fields view
            if (advanced_dynamic_user_fields && advanced_dynamic_user_fields.length > 0) {
                let viewFieldsInfo = element.fieldsInfo[element.viewType];
                let loadParams = this.loadParams;
                let fv = {
                    fieldsInfo: element.fieldsInfo,
                    type: element.viewType,
                    viewFields: loadParams.fields,
                    fields: element.fields,
                }
                for (var i = 0; i < advanced_dynamic_user_fields.length; i++) {
                    var field = advanced_dynamic_user_fields[i];
                    if (!(field.name in element.fields)) {
                        continue;
                    }
                    if (!viewFieldsInfo[field.name]) {
                        // create a xml node
                        var jsonNode = {
                            tag: "field",
                            attrs: {
                                name: field.name,
                                modifiers: {},
                            },
                            children: [],
                        }
                        fakeView._processNode(jsonNode, fv);
                    }
                }
                element.fieldsInfo = fv.fieldsInfo;
                element.viewFields = fv.viewFields;
                element.fields = fv.fields;
            }
        },

        _reload: function (id, options) {
            var element = this.localData[id];
            // extra domain
            if (options && options.extra_domains && options.extra_domains.length > 0) {
                element.backup_domain = _.clone(element.domain);
                for (var i = 0; i < options.extra_domains.length; i++) {
                    var domain = options.extra_domains[i];
                    element.domain.push(domain[0]);
                }
            }
            return this._super.apply(this, arguments);
        },

        _load: function (dataPoint, options) {
            return this._super.apply(this, arguments).then(function (list) {
                if (list.backup_domain) {
                    list.domain = list.backup_domain;
                    delete list.backup_domain;
                }
                return list;
            });
        }
    }

    if (advanced_dynamicListMode == 'global') {
        BasicModel.include(advanced_dynamicListModel);
    } else {
        let advanced_dynamicListModel = BasicModel.extend(advanced_dynamicListModel);
        return advanced_dynamicListModel;
    }
});
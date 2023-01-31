odoo.define('advanced_dynamic_list.form_model', function (require) {

    "use strict";

    var BasicModel = require('web.BasicModel');
    var advanced_dynamicFakeView = require('advanced_dynamic_list.fake_view');

    var advanced_dynamicFormModel = odoo.advanced_dynamic_list_mode

    var advanced_dynamicListModel = {

        updateX2ManyUserData: function (id, fields, field, advanced_dynamic_user_data) {

            if (field.type != 'one2many' && field.type != 'many2many') {
                return
            }
            this.advanced_dynamic_user_data = advanced_dynamic_user_data;

            // update the view
            let element = this.localData[id];
            let viewType = element.viewType;
            let fieldName = field.name;
            var fieldInfo = element.fieldsInfo[viewType][fieldName];
            var fieldMode = fieldInfo.mode;
            var views = fieldInfo.views;
            var subView = views[fieldMode];
            // all fields info
            var allFields = subView.viewFields;

            // update fieldsInfo
            let fakeView = new advanced_dynamicFakeView();
            let advanced_dynamic_user_fields = (advanced_dynamic_user_data && advanced_dynamic_user_data.user_fields) || false;
            // add the advanced_dynamic user fields to the fields view
            if (advanced_dynamic_user_fields && advanced_dynamic_user_fields.length > 0) {
                let fv = {
                    fieldsInfo: subView.fieldsInfo,
                    type: subView.type,
                    viewFields: _.defaults(subView.viewFields, fields),
                    fields: fields,
                }
                for (var i = 0; i < advanced_dynamic_user_fields.length; i++) {
                    var field = advanced_dynamic_user_fields[i];
                    if (!allFields[field.name]) {
                        continue;
                    }
                    
                    if (!subView.fieldsInfo[field.name]) {
                        // create a xml node
                        var jsonNode = {
                            tag: "field",
                            attrs: {
                                name: field.name,
                                modifiers: {// some field are read only?
                                },
                            },
                            children: [],
                        }
                        fakeView._processNode(jsonNode, fv);
                    }
                }
                subView.fieldsInfo = fv.fieldsInfo;
                subView.viewFields = fv.viewFields;
                subView.fields = fv.fields;
            }
        }
    }

    if (advanced_dynamicFormModel == 'global') {
        BasicModel.include(advanced_dynamicListModel);
    } else {
        let advanced_dynamicListModel = BasicModel.extend(advanced_dynamicListModel);
        return advanced_dynamicListModel;
    }
});
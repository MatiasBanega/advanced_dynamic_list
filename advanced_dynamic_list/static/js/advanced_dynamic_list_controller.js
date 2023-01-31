odoo.define('advanced_dynamic_list.list_controller', function (require) {

    "use strict";

    var ListController = require('web.ListController');
    let advanced_dynamicListMode = odoo.advanced_dynamic_list_mode

    let advanced_dynamicController = {
        _onReload: function (ev) {
            ev.stopPropagation(); // prevent other controllers from handling this request
            
            var data = ev && ev.data || {};
            var handle = data.db_id;
            var prom;
            if (handle) {
                // reload the relational field given its db_id
                prom = this.model.reload(handle).then(this._confirmSave.bind(this, handle));
            } else {
                // no db_id given, so reload the main record
                prom = this.reload({
                    fieldNames: data.fieldNames,
                    keepChanges: data.keepChanges || false,
                    extra_domains: data.extra_domains || []
                });
            }
            prom.then(ev.data.onSuccess).guardedCatch(ev.data.onFailure);
        }
    }

    if (advanced_dynamicListMode == 'global') {
        ListController.include(advanced_dynamicController);
    } else {
        let advanced_dynamic_list_controller = ListController.extend(advanced_dynamicController);
        return advanced_dynamic_list_controller;
    }
});
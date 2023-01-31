odoo.define('advanced_dynamic_list.x2many_field', function (require) {
    "use strict";

    const relational_fields = require('web.relational_fields');
    const advanced_dynamicX2manyRender = require('advanced_dynamic_list.x2many_list_render');

    /**
     * field x2many
     */
    relational_fields.FieldX2Many.include({
        _getRenderer: function () {
            let render = this._super.apply(this, arguments);
            if (this.view.arch.tag === 'tree') {
                render = advanced_dynamicX2manyRender;
            }
            return render;
        },
    });
})
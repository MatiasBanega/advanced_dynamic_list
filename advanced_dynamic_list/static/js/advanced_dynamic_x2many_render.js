odoo.define('advanced_dynamic_list.x2many_list_render', function (require) {

    "use strict";

    require('advanced_dynamic_list.list_render')
    var ListRenderer = require('web.ListRenderer');

    let Render = ListRenderer.extend({
        init: function() {
            this.isX2ManyRender = true;
            this._super.apply(this, arguments);
        }
    })

    return Render;
})
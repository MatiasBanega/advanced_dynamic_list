odoo.define('advanced_dynamic_list.auto_complete_source_registry', function (require) {
    "use strict";

    var Registry = require('web.Registry');
    var AutoCompleteSources = require('advanced_dynamic_list.auto_compelte_sources');
    var registry = new Registry();

    // fields
    registry
        .add('char', AutoCompleteSources.CharField)
        .add('text', AutoCompleteSources.CharField)
        .add('html', AutoCompleteSources.CharField)
        .add('boolean', AutoCompleteSources.BooleanField)
        .add('integer', AutoCompleteSources.IntegerField)
        .add('id', AutoCompleteSources.IntegerField)
        .add('float', AutoCompleteSources.FloatField)
        .add('monetary', AutoCompleteSources.FloatField)
        .add('selection', AutoCompleteSources.SelectionField)
        .add('datetime', AutoCompleteSources.DateTimeField)
        .add('date', AutoCompleteSources.DateField)
        .add('many2one', AutoCompleteSources.ManyToOneField)
        .add('many2many', AutoCompleteSources.CharField)
        .add('one2many', AutoCompleteSources.CharField);

    return registry;
});


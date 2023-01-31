odoo.define('advanced_dynamic_list.search_fields', function (require) {

    "use strict";

    var core = require('web.core');
    var Widget = require('web.Widget');
    var field_utils = require('web.field_utils');
    var registry = require('advanced_dynamic_list.search_item_registry');
    var AutoComplete = require('advanced_dynamic_list.auto_complete');
    var AutocompleteRegistry = require('advanced_dynamic_list.auto_complete_source_registry');
    var SearchFacet = require('advanced_dynamic_list.search_facet');

    var _t = core._t;
    var _lt = core._lt;

    var SearchItem = Widget.extend({
        template: 'advanced_dynamic_list.search_row_item',

        events: {
            'change .operation': 'operator_changed',
            'compositionend .o_searchview_input': '_onCompositionendInput',
            'compositionstart .o_searchview_input': '_onCompositionstartInput',
            'keydown': '_onKeydown',
        },

        custom_events: {
            'advanced_dynamic_auto_complete_selected': '_onAutoCompleteSelected',
            'facet_removed': '_onFacetRemoved',
        },

        init: function (parent, field, options) {
            this._super(parent);

            this.field = field;
            this.options = options;
            this.facets = options.facets || [];
            this.searchFacets = [];
            this._isInputComposing = false;
        },

        start: function () {
            let defs = []
            defs.push(this._super.apply(this, arguments));

            var type = this.field.type;
            var Field = registry.getAny([type, "char"]);

            this.value = new Field(this, this.field);
            if (this.options.show_operator) {
                _.each(this.value.operators, function (operator) {
                    $('<option>', { value: operator.value })
                        .text(String(operator.text))
                        .appendTo(this.$('.field_operation'));
                });
            }
            var $field_value = this.$('.field_value').show().empty();
            defs.push(this.value.appendTo($field_value));

            _.each(this.facets, function (facet) {
                defs.push(self._renderFacet(facet));
            });

            return Promise.all(defs);
        },

        _onAutoCompleteSelected: function (ev) {
            let data = ev.data;
            let facet = data.facet;
            this._renderFacet(facet);
            this.trigger_up('search_facet_changed');
        },

        _onSelectChanged: function (ev) {
            let data = ev.data;
            let facet = data.facet;
            this._renderFacet(facet);
            this.trigger_up('search_facet_changed');
        },

        _renderFacet: function (facet) {
            var searchFacet = new SearchFacet(this, facet);
            this.searchFacets.push(searchFacet);
            return searchFacet.prependTo(this.$el);
        },

        operator_changed: function (e) {
            this.value.show_inputs($(e.target));
        },

        _onCompositionendInput: function () {
            this._isInputComposing = false;
        },

        _onCompositionstartInput: function () {
            this._isInputComposing = true;
        },

        get_domain: function () {

            let field = this.field;
            let operator = undefined;
            if (this.options.show_operator) {
                let op_select = this.$('.o_searchview_extended_prop_op')[0];
                operator = op_select.options[op_select.selectedIndex];
            } else {
                operator = this.value.operators[0];
                field = this.value.field;
            }

            let domains = [];
            _.each(this.searchFacets, (widget) => {
                let autoCompleteValues = widget.facet.filter.autoCompleteValues;
                for (let i = 0; i < autoCompleteValues.length; i++) {
                    let autoCompleteValue = autoCompleteValues[i];
                    let domain = this.value.get_domain(field, operator, autoCompleteValue.value);
                    if (domain) {
                        domains.push(domain);
                    }
                }
            });

            return domains;
        },

        _onFacetRemoved: function (ev) {
            // remove the search facet from the list
            let facet = ev.data.facet;
            let index = this.searchFacets.indexOf(facet);
            if (index > -1) {
                this.searchFacets.splice(index, 1);
            }
            this.trigger_up('search_facet_changed');
        },

        _onKeydown: function (e) {

            if (this._isInputComposing) {
                return;
            }

            switch (e.which) {
                case $.ui.keyCode.LEFT:
                    //this._focusPreceding();
                    e.preventDefault();
                    break;

                case $.ui.keyCode.RIGHT:
                    //this._focusFollowing();
                    e.preventDefault();
                    break;

                case $.ui.keyCode.DOWN:
                    // if the searchbar dropdown is closed, try to focus the renderer
                    const $dropdown = this.$('.o_searchview_autocomplete:visible');
                    if (!$dropdown.length) {
                        this.trigger_up('navigation_move', { direction: 'down' });
                        e.preventDefault();
                    }
                    break;

                case $.ui.keyCode.BACKSPACE:
                    let val = this.value.get_value();
                    if (!val || val === '') {
                        if (this.searchFacets.length > 0) {
                            let lastFacet = this.searchFacets[this.searchFacets.length - 1];
                            lastFacet.destroy();
                            this.searchFacets.splice(this.searchFacets.length - 1, 1);
                            this.trigger_up('search_facet_changed');
                        }
                    }
                    break;

                case $.ui.keyCode.ENTER:
                    // if (this.$input.val() === '') {
                    //     this.trigger_up('reload');
                    // }
                    break;
            }
        },

        _getFocusedFacetIndex: function () {
            return _.findIndex(this.searchFacets, function (searchFacet) {
                return searchFacet.$el[0] === document.activeElement;
            });
        },
    });

    var Field = Widget.extend({

        emptyLabel: _lt('Empty'),

        events: {
            'compositionend .o_searchview_input': '_onCompositionendInput',
            'compositionstart .o_searchview_input': '_onCompositionstartInput',
            'keydown': '_onKeydown',
        },

        init: function (parent, field, options) {
            this._super(parent);
            this.field = field;
            this.options = options;
            this.default_operator = (options && options.default_operator) || undefined;
            this.filter = {
                attrs: {
                    name: field.name,
                    string: field.string || field.name,
                    filter_domain: "[]",
                    description: field.string,
                },
                autoCompleteValues: [],
                tag: 'field',
            }
            this.autoCompleteSources = []
            this.isComposing = false;
        },

        ensure_operator: function (operator) {
            if (!operator) {
                operator = this.default_operator;
            }
            if (!operator) {
                operator = this.operators[0];
            }
            return operator;
        },

        _onCompositionendInput: function () {
            this._isInputComposing = false;
        },

        _onCompositionstartInput: function () {
            this._isInputComposing = true;
        },

        get_label: function (field, operator) {
            var format;
            operator = this.ensure_operator(operator);
            switch (operator.value) {
                case '∃': case '∄': format = _t('%(field)s %(operator)s'); break;
                default: format = _t('%(field)s %(operator)s "%(value)s"'); break;
            }
            return this.format_label(format, field, operator);
        },

        start: function () {
            this._super.apply(this, arguments).then(() => {
                this._setupAutoCompletion();
            });
        },

        format_label: function (format, field, operator) {
            operator = this.ensure_operator(operator);
            return _.str.sprintf(format, {
                field: field.string,
                operator: operator.label || operator.text,
                value: this
            });
        },

        parse_value: function (val) {
            return val;
        },

        get_domain: function (field, operator, value) {
            operator = this.ensure_operator(operator);
            switch (operator.value) {
                case '∃': return [[field.name, '!=', false]];
                case '∄': return [[field.name, '=', false]];
                default: return [[field.name, operator.value, value ? this.parse_value(value) : this.get_value(value)]];
            }
        },

        show_inputs: function (operator) {
            operator = this.ensure_operator(operator);
            var $value = this.$el.parent();
            switch (operator.val()) {
                case '∃':
                case '∄':
                    $value.hide();
                    break;
                default:
                    $value.show();
            }
        },

        toString: function () {
            return this.get_value();
        },

        _setupAutoCompletion: function () {
            if (this.tagName === 'input') {
                this.$input = this.$el;
                var self = this;
                this._setupAutoCompletionWidgets();
                this.autoComplete = new AutoComplete(this, {
                    $input: this.$el,
                    source: this._getAutoCompleteSources.bind(this),
                    select: this._onAutoCompleteSelected.bind(this),
                    get_search_string: function () {
                        return self.$input.val().trim();
                    },
                });
                return this.autoComplete.appendTo($('body'))
            } else {
                return $.when();
            }
        },

        _onAutoCompleteSelected: function (e, ui) {
            e.preventDefault();
            var facet = ui.item.facet;
            if (!facet) {
                // this happens when selecting "(no result)" item
                this.trigger_up('reset');
                return;
            }
            var filter = facet.filter;
            filter.autoCompleteValues = [facet.values[0]];
            this.trigger_up('advanced_dynamic_auto_complete_selected', {
                facet: facet,
            });
            this.$input.val('');
        },

        _onCompositionendInput: function () {
            this._isInputComposing = false;
        },

        _onCompositionstartInput: function () {
            this._isInputComposing = true;
        },

        _setupAutoCompletionWidgets: function () {
            var registry = AutocompleteRegistry;
            var Obj = registry.getAny([this.field.type]);
            if (Obj) {
                this.autoCompleteSources.push(new (Obj)(this, this.filter, this.field, {}));
            }
        },

        _getAutoCompleteSources: function (req, callback) {
            var defs = this.autoCompleteSources.map(function (source) {
                return source.getAutocompletionValues(req.term);
            });
            Promise.all(defs).then(function (result) {
                var resultCleaned = _(result).chain()
                    .compact()
                    .flatten(true)
                    .value();
                callback(resultCleaned);
            });
        },

        _onKeydown: function (e) {
            if (this._isInputComposing) {
                return;
            }
            switch (e.which) {
                case $.ui.keyCode.ENTER:
                    let $input = this.$el;
                    // check the tag is input
                    if ($input.prop('tagName') != 'INPUT') {
                        $input = this.$el.find('input');
                    }
                    if ($input && ($input.val() == '' || $input.val() == undefined)) {
                        let operator = { value: "∄", text: _lt("is set") }
                        let facet = {
                            filter: {
                                autoCompleteValues: [{
                                    label: this.emptyLabel,
                                }],
                                domain: this.get_domain(this.field, operator),
                            }
                        }
                        this.trigger_up('advanced_dynamic_auto_complete_selected', {
                            facet: facet
                        });
                    }
                    break;
            }
        },
    });

    var Char = Field.extend({
        tagName: 'input',
        className: 'o_input',
        attributes: {
            type: 'text'
        },

        operators: [
            { value: "ilike", text: _lt("contains") },
            { value: "not ilike", text: _lt("doesn't contain") },
            { value: "=", text: _lt("is equal to") },
            { value: "!=", text: _lt("is not equal to") },
            { value: "∃", text: _lt("is set") },
            { value: "∄", text: _lt("is not set") }
        ],

        get_value: function () {
            return '' + this.$el.val();
        }
    });

    var DateTime = Field.extend({
        tagName: 'input',
        serverFormat: 'YYYY-MM-DD HH:mm:ss',
        timePicker: true,

        operators: [
            { value: "between", text: _lt("is between") },
            { value: "=", text: _lt("is equal to") },
            { value: "!=", text: _lt("is not equal to") },
            { value: ">", text: _lt("is after") },
            { value: "<", text: _lt("is before") },
            { value: ">=", text: _lt("is after or equal to") },
            { value: "<=", text: _lt("is before or equal to") },
            { value: "∃", text: _lt("is set") },
            { value: "∄", text: _lt("is not set") }
        ],

        _onDatetimeChanged: function (start, end) {
            this.start = start;
            this.end = end;
            let facet = {
                filter: {
                    autoCompleteValues: [{
                        label: start.format('MMMM D, YYYY') + ' - ' + end.format('MMMM D, YYYY')
                    }],
                    domain: this.get_domain(this.field, this.operator),
                }
            }
            this.trigger_up('advanced_dynamic_auto_complete_selected', {
                facet: facet
            });
        },

        get_value: function (index = 0) {
            if (index === 0) {
                return this.start.add(-this.getSession().getTZOffset(this.start), 'minutes');
            } else {
                return this.end.add(-this.getSession().getTZOffset(this.start), 'minutes');
            }
        },

        get_domain: function (field, operator) {
            operator = this.ensure_operator(operator);
            switch (operator.value) {
                case '∃':
                    return [[field.name, '!=', false]];
                case '∄':
                    return [[field.name, '=', false]];
                case 'between':
                    return [
                        [field.name, '>=', this._formatMomentToServer(this.get_value(0))],
                        [field.name, '<=', this._formatMomentToServer(this.get_value(1))]
                    ];
                default:
                    return [[field.name, operator.value, this._formatMomentToServer(this.get_value())]];
            }
        },

        toString: function () {
            var str = field_utils.format[this.attributes.type](this.get_value(), { type: this.attributes.type });
            var date_1_value = this.get_value(1);
            if (date_1_value) {
                str += _lt(" and ") + field_utils.format[this.attributes.type](date_1_value, { type: this.attributes.type });
            }
            return str;
        },

        start: function () {
            this._super.apply(this, arguments)
            this.start = moment().subtract(29, 'days');
            this.end = moment();
            this.$el.addClass('o_input');
            this.$el.daterangepicker({
                startDate: this.start,
                endDate: this.end,
                timePicker: true,
                showDropdowns: true,
                timePicker: this.timePicker,
                ranges: {
                    'Today': [moment(), moment()],
                    'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
                    'Last 7 Days': [moment().subtract(6, 'days'), moment()],
                    'Last 30 Days': [moment().subtract(29, 'days'), moment()],
                    'This Month': [moment().startOf('month'), moment().endOf('month')],
                    'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
                }
            }, this._onDatetimeChanged.bind(this));
        },

        _formatMomentToServer: function (momentValue) {
            if (!momentValue) {
                return false;
            }
            return momentValue.locale('en').format(this.serverFormat);
        }
    });

    var Date = DateTime.extend({
        serverFormat: 'YYYY-MM-DD',

        operators: [
            { value: "=", text: _lt("is equal to") },
            { value: "!=", text: _lt("is not equal to") },
            { value: ">", text: _lt("is after") },
            { value: "<", text: _lt("is before") },
            { value: ">=", text: _lt("is after or equal to") },
            { value: "<=", text: _lt("is before or equal to") },
            { value: "between", text: _lt("is between") },
            { value: "∃", text: _lt("is set") },
            { value: "∄", text: _lt("is not set") }
        ],

        init: function () {
            this._super.apply(this, arguments);
            this.timePicker = false;
        }
    });

    var Integer = Field.extend({
        tagName: 'input',
        className: 'o_input',

        operators: [
            { value: "=", text: _lt("is equal to") },
            { value: "!=", text: _lt("is not equal to") },
            { value: ">", text: _lt("greater than") },
            { value: "<", text: _lt("less than") },
            { value: ">=", text: _lt("greater than or equal to") },
            { value: "<=", text: _lt("less than or equal to") },
            { value: "∃", text: _lt("is set") },
            { value: "∄", text: _lt("is not set") }
        ],

        toString: function () {
            return this.$el.val();
        },

        parse_value: function (val) {
            return field_utils.parse.integer(val === "" ? 0 : val);
        },

        get_value: function (value) {
            try {
                if (value) {
                    return field_utils.parse.integer(value === "" ? 0 : value);
                } else {
                    var val = this.$el.val();
                    return field_utils.parse.integer(val === "" ? 0 : val);
                }

            } catch (e) {
                return "";
            }
        }
    });

    var Id = Integer.extend({
        operators: [
            { value: "=", text: _lt("is") },
            { value: "<=", text: _lt("less than or equal to") },
            { value: ">", text: _lt("greater than") }
        ]
    });

    var Float = Field.extend({
        tagName: 'input',
        template: 'advanced_dynamic_list.search_row.float',
        operators: [
            { value: "=", text: _lt("is equal to") },
            { value: "!=", text: _lt("is not equal to") },
            { value: ">", text: _lt("greater than") },
            { value: "<", text: _lt("less than") },
            { value: ">=", text: _lt("greater than or equal to") },
            { value: "<=", text: _lt("less than or equal to") },
            { value: "∃", text: _lt("is set") },
            { value: "∄", text: _lt("is not set") }
        ],

        init: function (parent, columns, fields) {
            this._super.apply(this, arguments);
            this.decimal_point = _t.database.parameters.decimal_point;
        },

        toString: function () {
            return this.$el.val();
        },

        parse_value: function (val) {
            return field_utils.parse.float(val === "" ? 0 : val);
        },

        get_value: function (value) {
            try {
                if (value) {
                    return value === "" ? false : field_utils.parse.float(value);
                } else {
                    var val = this.$el.val();
                    return val === "" ? false : field_utils.parse.float(val);
                }
            } catch (e) {
                return "";
            }
        }
    });

    var Selection = Field.extend({
        template: 'advanced_dynamic_list.search_row.selection',

        events: {
            'change': 'on_change',
        },

        operators: [
            { value: "=", text: _lt("is") },
            { value: "!=", text: _lt("is not") },
            { value: "∃", text: _lt("is set") },
            { value: "∄", text: _lt("is not set") }
        ],

        toString: function () {
            var select = this.$el[0];
            var option = select.options[select.selectedIndex];
            return option.label || option.text;
        },

        get_value: function () {
            return this.$el.val();
        },

        /**
         * on change
         */
        on_change: function (event) {
            event.preventDefault();

            let facet = {
                filter: {
                    autoCompleteValues: [{
                        label: this.$el.val()
                    }],
                    domain: this.get_domain(this.field, this.operator),
                }
            }
            this.trigger_up('advanced_dynamic_auto_complete_selected', {
                facet: facet
            });
        }
    });

    var Boolean = Field.extend({
        tagName: 'span',
        operators: [
            { value: "=", text: _lt("is true") },
            { value: "!=", text: _lt("is false") }
        ],
        get_label: function (field, operator) {
            operator = this.ensure_operator(operator);
            return this.format_label(
                _t('%(field)s %(operator)s'), field, operator);
        },
        get_value: function () {
            return true;
        }
    });

    var Many2One = Char.extend({

        operators: [
            { value: "=", text: _lt("in ids") },
        ],

        parse_value: function (val) {
            // var val = this.$el.val();
            // return val
            if (typeof val === "integer") {
                return val;
            }
            return field_utils.parse.integer(val === "" ? 0 : val);
        },

        get_domain: function (field, operator, value) {
            operator = this.ensure_operator(operator);
            var operator_value = '='
            if (typeof value !== "number") {
                return [[field.name, operator_value, 0]];
            } else {
                return [[field.name, operator_value, value]]
            }
        },
    });

    registry
        .add('boolean', Boolean)
        .add('char', Char)
        .add('date', Date)
        .add('datetime', DateTime)
        .add('float', Float)
        .add('id', Id)
        .add('integer', Integer)
        .add('many2many', Char)
        .add('many2one', Many2One)
        .add('monetary', Float)
        .add('one2many', Char)
        .add('text', Char)
        .add('selection', Selection);

    return {
        Boolean: Boolean,
        Many2One: Many2One,
        Char: Char,
        Date: Date,
        DateTime: DateTime,
        Field: Field,
        Float: Float,
        Id: Id,
        Integer: Integer,
        Selection: Selection,
        SearchItem: SearchItem,
    };
});

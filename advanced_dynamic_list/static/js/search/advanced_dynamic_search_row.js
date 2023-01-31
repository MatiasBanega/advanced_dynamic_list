odoo.define('advanced_dynamic_list.search_row', function (require) {

    "use strict";

    var SearchFields = require('advanced_dynamic_list.search_fields');
    var Widget = require('web.Widget');

    var SearchItem = SearchFields.SearchItem;

    var advanced_dynamicSearchRow = Widget.extend({
        tagName: 'tr',
        className: 'advanced_dynamic_search_row',
        custom_events: {
            search_facet_changed: '_onSearchFacetChanged',
        },

        events: _.extend({}, Widget.prototype.events, {}),

        jsLibs: [
            '/advanced_dynamic_list/static/libs/daterangepicker/daterangepicker.js',
        ],

        cssLibs: [
            '/advanced_dynamic_list/static/libs/daterangepicker/daterangepicker.css',
        ],

        init: function (parent, columns, fields) {
            this._super.apply(this, arguments);

            this.fields = [];
            for (let key in fields) {
                let field = _.clone(fields[key]);
                field.name = key;
                this.fields.push(field);
            }
            this.columns = columns;
            this.search_items = [];
            this.listRender = this.getParent();

            // get precell count
            this.trigger_up('advanced_dynamic_list.get_precell_count', {
                callback: (cellCount) => {
                    this.precell_count = cellCount;
                }
            });
        },

        start: function () {
            var superProm = this._super.apply(this, arguments);
            var $tr = this._render_search_fields();
            
            // add the extra cells
            this.trigger_up('advanced_dynamic_list.add_extra_cells', {
                $tr: $tr,
                options: {
                    header: true,
                    empty: true, 
                }
            });
            $tr.appendTo(this.$el);

            return superProm;
        },

        _get_column_field: function (column) {
            let name = column.attrs.name;
            let field = _.find(this.fields, function (field, key) {
                return field.name === name || key === name;
            });
            return field;
        },

        _render_search_fields: function () {
            let $tr = this.$el;
            for (let i = 0; i < this.columns.length; i++) {
                let column = this.columns[i];
                // get the realted field
                let $th = $('<th>');
                
                let field = this._get_column_field(column);
                if (field && field.searchable) {
                    let search_field = this._render_field(field)
                    this.search_items.push(search_field);
                    search_field.appendTo($th);
                } 

                // check fixed left
                if (column.fixed_left) {
                    $th.addClass('advanced_dynamic_fixed_left')
                    if (column.fixed_left_last) {
                        $th.addClass('advanced_dynamic_fixed_left_last')
                    }
                } else if (column.fixed_right) {
                    $th.addClass('advanced_dynamic_fixed_right')
                    // need optimize
                    // if (column.fixed_right_first) {
                    //     $th.addClass('advanced_dynamic_fixed_right_first')
                    // }
                    if (this.getParent()._fixedRightFirst(column.index)) {
                        $th.addClass('advanced_dynamic_fixed_right_first')
                    }
                }

                $th.attr('data-col-index', i + this.precell_count);
                $tr.append($th);
            }
            return $tr;
        },

        _render_field: function (field) {
            var field = new SearchItem(this, field, {
                'show_label': false,
                'show_operator': false,
                'show_trash': false,
            });
            return field;
        },

        do_search: function () {
            let domains = [];
            for (let i = 0; i < this.search_items.length; i++) {
                let search_item = this.search_items[i];
                let tmp_domains = search_item.get_domain();
                if (tmp_domains) {
                    for (let j = 0; j < tmp_domains.length; j++) {
                        domains.push(tmp_domains[j]);
                    }
                }
            }
            this.trigger_up('reload', {
                extra_domains: domains
            });
        },

        _onSearchFacetChanged: function (ev) {
            ev.stopPropagation();
            this.do_search();
        },
    });

    return advanced_dynamicSearchRow;
});

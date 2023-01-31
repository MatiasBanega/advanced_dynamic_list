odoo.define('advanced_dynamic_list.list_config', function (require) {
    
    "use strict";

    var Widget = require('web.Widget');
    var core = require('web.core');

    var advanced_dynamicColumnConfiger = Widget.extend({

        template: 'advanced_dynamic_list.list_config',

        events: {
            'click .tab_item': '_onTabItemClick',
            'click .add-new-group': '_onAddNewGroup',
            'click .remove_column': '_onRemoveColumn',
            'click .save_column_config': '_onSaveColumnConfig',
            'click .cancel_column_config': '_onCancelColumnConfig',
            'click .toggle_visible': '_onToggleVisible',
            'click .lock_column': '_onLockColumn',
            'click .reset_settings': '_onResetSettings',
        },

        init: function (parent, isX2Many) {
            this._super.apply(this, arguments);

            this.header_arch = [];
            this.fields = [];
            this.invisible_fields = [];
            this.nested_sorters = [];
            this.isX2Many = isX2Many;
            this.advanced_dynamic_user_data = undefined;
        },

        willStart: function () {
            let self = this;
            return this._super.apply(this, arguments).then(function () {
                if (self.isX2Many) {
                    let parent = self.getParent();
                    let state = parent.state;
                    let model = state.model;
                    return self._rpc({
                        "model": model,
                        "method": "fields_get",
                        "args": []
                    }).then(function (fields) {
                        self.fields = fields;
                        // the field maybe do not has the name in odoo14
                        for (let key in fields) {
                            let field = fields[key];
                            field.name = key;
                        }
                    })
                }
            })
        },

        _onRemoveColumn: function (e) {
            e.stopPropagation();
            e.preventDefault();

            var $target = $(e.currentTarget);

            // invisble item container
            var $invisible_fields = this.$('.invisible_fields');

            // get the nearest '.list-group-item'
            var $parent = $target.closest('.list-group-item');

            // find the sub list-group-item
            var $sub_parent = $parent.find('.list-group');

            // find the leaf items and append to invisible_fields
            _.each($sub_parent, function (item) {
                let $tmp_item = $(item);
                // checkc has sub items
                if ($tmp_item.find('.list-group-item').length == 0) {
                    $tmp_item.detach();
                    $tmp_item.appendTo($invisible_fields);
                }
            });

            // remove it
            $parent.remove();
        },

        _onAddNewGroup: function (event) {
            
            event.stopPropagation();
            event.preventDefault();

            var $input = this.$('.new-group-name');
            let value = $input.val();
            if (!value) {
                return;
            }
            let $item = $(core.qweb.render('advanced_dynamic_list.column_group_item', {
                column: {
                    string: value,
                    name: value,
                    attrs: {
                        string: value,
                        name: value,
                    }
                },
                widget: this,
            }));
            $item.appendTo(this.$('.list_fields_container'))
            $input.val('');

            this._reInitNestedSorts();
        },

        _sameAsParent: function (column) {
            let parent = column.parent;
            if (!parent) {
                return false;
            }
            if (parent.name == column.name) {
                return true;
            }
            return false;
        },

        _reInitNestedSorts: function () {
            // destroy 
            for (let i = 0; i < this.nested_sorters.length; i++) {
                this.nested_sorters[i].destroy();
            }
            // init the nested
            let nested_sorters = []
            var nestedSortables = [].slice.call(this.$el[0].querySelectorAll('.nested-sortable'));
            for (var i = 0; i < nestedSortables.length; i++) {
                let sorter = new Sortable(nestedSortables[i], {
                    group: 'column_config',
                    animation: 150,
                    fallbackOnBody: true,
                    swapThreshold: 0.65,
                    handle: '.drag_handle'
                });
                nested_sorters.push(sorter);
            }
            this.nested_sorters = nested_sorters;
        },

        _isField: function (column) {
            if (!column.children || !column.children.length) {
                return true;
            } else if (column.tag && column.tag != 'field') {
                return true;
            } else {
                if (this._isAllChidrenSame(column) && !column.parent) {
                    return true;
                }
            }
            return false;
        },

        ensureDelayItems: function (
            header_arch, fields, hidden_fields, invisible_fields, advanced_dynamic_user_data) {
  
            this.$('.sorter_container').empty();
            this.header_arch = header_arch;
            if (!this.isX2Many) {
                this.fields = fields;
            }
            this.fields_cache = {};
            for (let i = 0; i < fields.length; i++) {
                this.fields_cache[fields[i].name] = fields[i];
            }
            
            // maybe the user data has not been created, we must set the default values
            this.advanced_dynamic_user_data = advanced_dynamic_user_data;

            // set the layout class
            if (this.get_config_column_layout() == 'vertical') {
                this.$el.addClass('layout_vertical');
                this.$el.removeClass('layout_horizontal');
            } else {
                this.$el.addClass('layout_horizontal');
                this.$el.removeClass('layout_vertical');
            }

            this.hidden_fields = hidden_fields;
            this.render_invisible_fields = invisible_fields;
            this._postDealHeaderArch();
            this.header_arch = this.header_arch;
            if (!this.isX2Many) {
                this.fields = []
                for (let key in fields) {
                    let field = _.clone(fields[key])
                    field.name = key;
                    this.fields.push(field);
                }
            }
            
            this._getInvisibleColumn();
            this.column_config = $(core.qweb.render('advanced_dynamic_list.column_config', {
                widget: this
            }));
            this.column_config.appendTo(this.$('.sorter_container'));
            // init the nested sorters
            this._reInitNestedSorts();
            this.invisible_sorter = new Sortable(
                this.$el[0].querySelector('.invisible_fields'), {
                group: 'column_config',
                animation: 150,
                handle: '.drag_handle'
            });

            // cleare the setting first
            this.$('#settings').empty();

            // append the settings
            let $settings =  $(core.qweb.render('advanced_dynamic_list.settings', {
                widget: this
            }));
            $settings.appendTo(this.$('#settings'));
        },

        /**
         * get config column layout
         * @returns 
         */
        get_config_column_layout: function () {
            if (!this.advanced_dynamic_user_data) {
                return 'Horizontal';
            }
            return this.advanced_dynamic_user_data.column_configer_layout;
        },

        _postDealHeaderArch: function () {
            let header_arch = this.header_arch;
            _.each(header_arch, function (column) {
                if (column.children) {
                    _.each(column.children, function (child) {
                        child.parent = column;
                    });
                }
            });
        },

        isHidenFields: function (column) {
            let name = column.name || column.attrs && column.attrs.name;
            let index = _.findIndex(this.hidden_fields, function (item) {
                return item.name == name || (item.attrs && item.attrs.name == name);
            });
            return index == -1 ? false : true;
        },

        _isAllChidrenSame: function (column) {
            let allSame = true;
            let children = column.children;
            while (children && children.length > 0) {
                if (children.length > 1) {
                    allSame = false;
                    break;
                }
                let child = children[0];
                if (child.name != column.name) {
                    allSame = false;
                    break;
                }
                children = child.children;
            }
            return allSame;
        },

        _getInvisibleColumn: function () {

            let self = this;
            let visible_fields = [];
            let visible_fields_cache = {};

            function visit(column) {
                let children = column.children;
                if (!children || children.length == 0) {
                    visible_fields.push(column);
                } else {
                    for (let i = 0; i < children.length; i++) {
                        let child = children[i];
                        visit(child);
                    }
                }
            }

            _.each(this.header_arch, function (column) {
                visit(column);
            })

            _.each(visible_fields, function (column) {
                visible_fields_cache[column.name || column.attrs.name] = column;
            })

            let invisible_fields = this.render_invisible_fields;
            _.each(this.fields, function (field) {
                if (field.name in self.hidden_fields) {
                    return
                }
                if (!visible_fields_cache[field.name]) {
                    invisible_fields.push(field);
                }
            });

            this.invisible_fields = invisible_fields;
        },

        /**
         * deal the tab item click event
         * @param {*} e 
         */
        _onTabItemClick: function (e) {

            var $target = $(e.currentTarget);
            var tab_id = $target.data('tab-id');

            // remove all the active item
            this.$('.tab_item').removeClass('active');
            $target.addClass('active');

            this.$('.tab_content .active').removeClass('active');
            this.$('.tab_content #' + tab_id).addClass('active');
        },

        _getColumnName: function (column) {
            let name = column.name;
            if (!name && column.attrs) {
                name = column.attrs.name;
            }
            return name;
        },

        _getColumnString: function (column) {
            let string = column.string 
            if (!string && column.attrs) { 
                string = column.attrs.string;
                // get string from field
                if (!string) {
                    let field = this.fields_cache[column.attrs.name];
                    if (field) {
                        string = field.string;
                    }
                }
                // get from name
                if (!string) {
                    string = column.name || column.attrs.name;
                }
            }
            return string;
        },

        _getCurrentColumnConfig: function () {
            let $columns = this.$('.column_config_container .list-group-item');
            let columns = [];
            for (let i = 0; i < $columns.length; i++) {
                let $column = $($columns[i]);
                // check this item has child column
                let $sub_groups = $column.find('.nested-sortable');
                // if has child column, it is a group, ignore it
                if ($sub_groups.length > 0) {
                    continue;
                } else {
                    // get the parent column
                    let $parents = $column.parents('.list-group-item');
                    let parent_path = [];
                    for (let j = 0; j < $parents.length; j++) {
                        let $parent = $($parents[j]);
                        let $input = $parent.find('input');
                        let parent_name = $input.val();
                        parent_path.push(parent_name);
                    }
                    let $input = $column.find('input');
                    // get the string
                    let string = $input.val();
                    // get the width mechanism
                    let $width_policy = $column.find('.width_policy')
                    //  get the value
                    let width_policy = $width_policy.val(); 
                    // get the width
                    let width = 0;
                    if (width_policy == 'auto') {
                        width = false;
                    } else {
                        width = $input.attr('column-width')
                    }
                    // get the visible, check .toggle_visible  has class icon-visible
                    let visible = $column.find('.toggle_visible').hasClass('icon-visible');
                    // get the locked info
                    let locked = $column.find('.lock_column').hasClass('icon-lock');
                    let fixed_left = false, fixed_right = false;
                    if (locked) {
                        if (columns.length == 0) {
                            fixed_left = true;
                        } else {
                            let last_column = columns[columns.length - 1];
                            if (last_column.fixed_left) {
                                fixed_left = true;
                            } else {
                                fixed_right = true;
                            }
                        }
                    }
                    let column = {
                        name: $column.data('column-name'),
                        parent: parent_path.join('.'),
                        order: columns.length + 1,  // the order is the index
                        string: string,
                        visible: visible,
                        width: width,
                        fixed_left: fixed_left,
                        fixed_right: fixed_right,
                    };
                    columns.push(column);
                }
            }
            return columns;
        },

        /**
         * @returns 
         * get settings of the current view
         */
        _getSettings: function () {

            let has_serials = this.$('#has_serials').prop('checked');
            let enable_virtual_scroll = this.$('#enable_virtual_scroll').prop('checked');
            let force_readonly = this.$('#force_readonly').prop('checked')
            let show_search_row = this.$('#show_search_row').prop('checked');
            let border_style = this.$('#border_style').val();
            let enable_advanced_dynamic_list = this.$('#enable_advanced_dynamic_list').prop('checked');
            let tree_column = this.$('#tree_column').val();
            let expand_row_template = this.$('#expand_row_template').val();
            let auto_ajust_column = this.$('#auto_ajust_column').prop('checked');
            let column_configer_layout = this.$('#column_configer_layout').val();

            return {
                has_serials: has_serials,
                enable_virtual_scroll: enable_virtual_scroll,
                force_readonly: force_readonly,
                show_search_row: show_search_row,
                border_style: border_style,
                enable_advanced_dynamic_list: enable_advanced_dynamic_list,
                tree_column: tree_column,
                expand_row_template: expand_row_template,
                auto_ajust_column: auto_ajust_column,
                column_configer_layout: column_configer_layout,
            };
        },

        _onSaveColumnConfig: function (event) {
            event.preventDefault();
            event.stopPropagation();

            this.hide();
            let columns = this._getCurrentColumnConfig();
            this.trigger_up('advanced_dynamic_list.update_user_settings', {
                columns: columns,
                fields: this.fields,
                settings: this._getSettings()
            });
        },

        _onCancelColumnConfig: function (event) {
            event.preventDefault();
            event.stopPropagation();
            this.hide();
        },

        _onToggleVisible: function (event) {
            let $target = $(event.currentTarget);
            
            // if has clas icon-visible, change it to icon-invisible
            if ($target.hasClass('icon-visible')) {
                $target.removeClass('icon-visible');
                $target.removeClass('btn-success');

                $target.addClass('icon-invisible');
                $target.addClass('btn-danger');
            } else {
                $target.removeClass('icon-invisible');
                $target.removeClass('btn-danger');

                $target.addClass('icon-visible');
                $target.addClass('btn-success');
            }
        },

        hide: function () {
            if (!this.$el) {
                return
            }
            this.$el.removeClass('show');
        },

        show: function () {
            this.$el.addClass('show');
        },

        _onLockColumn: function (event) {
            let $target = $(event.currentTarget);
            if ($target.hasClass('icon-lock')) {
                $target.removeClass('icon-lock');
                $target.addClass('icon-unlock');
            } else {
                $target.removeClass('icon-unlock');
                $target.addClass('icon-lock');
            }
        },

        /**
         * get the column is fixed
         */
        _isFixedColumn: function(column) {
            if (column.fixed_left || column.fixed_right) {
                return true;
            } else {
                return false;
            }
        },

        /**
         * reset settings
         * @param {*} event 
         */
        _onResetSettings: function (event) {
            this.trigger_up('advanced_dynamic_list.reset_settings');
        },

        _getCurrentConfig: function (name) {
            if (this.advanced_dynamic_user_data) {
                return this.advanced_dynamic_user_data[name];
            } else {
                switch (name) {
                    case 'has_serials':
                        return true;
                    case 'enable_virtual_scroll':
                        return false;
                    case 'force_readonly':
                        return false;
                    case 'show_search_row':
                        return true;
                    case 'border_style':
                        return 'bordered';
                    case 'enable_advanced_dynamic_list':
                        return true;
                }
            }
        },

        configer_layout: function () {
            return this.advanced_dynamic_user_data && this.advanced_dynamic_user_data.column_configer_layout || 'vertical';
        },

        /**
         * get the column config xml
         * @param {*} columns 
         */
        _inheritColumnConfig: function (columns) {
            let self = this;
            let column_config = [];
            let column_config_map = {};
            let column_config_map_by_name = {};
            // get the column config from the view
            _.each(columns, function (column) {
                let column_config_item = {
                    name: column.name,
                    parent: column.parent,
                    order: column.order,
                    string: column.string,
                    visible: column.visible,
                    width: column.width,
                    fixed_left: column.fixed_left,
                    fixed_right: column.fixed_right,
                };
                column_config.push(column_config_item);
                column_config_map[column.name] = column_config_item;
                column_config_map_by_name[column.name] = column_config_item;
            });

            // get the column config from the user data
            if (this.advanced_dynamic_user_data) {
                let user_columns = this.advanced_dynamic_user_data.columns;
                _.each(user_columns, function (column) {
                    let column_config_item = column_config_map[column.name];
                    if (column_config_item) {
                        column_config_item.visible = column.visible;
                        column_config_item.width = column.width;
                        column_config_item.fixed_left = column.fixed_left;
                        column_config_item.fixed_right = column.fixed_right;
                    } else {
                        column_config_item = {
                            name: column.name,
                            parent: column.parent,
                            order: column.order,
                            string: column.string,
                            visible: column.visible,
                            width: column.width,
                            fixed_left: column.fixed_left,
                            fixed_right: column.fixed_right,
                        };
                        column_config.push(column_config_item);
                        column_config_map[column.name] = column_config_item;
                        column_config_map_by_name[column.name] = column_config_item;
                    }
                });
            }
            
            // gen the arch
            let arch = '<tree>';
            _.each(column_config, function (column) {
                if (column.visible) {
                    let column_arch = `<field name="${column.name}"`;
                    if (column.width) {
                        column_arch += ` width="${column.width}"`;
                    }
                    if (column.fixed_left) {
                        column_arch += ` fixed_left="1"`;
                    }
                    if (column.fixed_right) {
                        column_arch += ` fixed_right="1"`;
                    }
                    column_arch += '/>';
                    arch += column_arch;
                }
            })
            arch += '</tree>';
        }
    });

    return advanced_dynamicColumnConfiger;
})

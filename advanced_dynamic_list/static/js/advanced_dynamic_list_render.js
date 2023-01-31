odoo.define('advanced_dynamic_list.list_render', function (require) {

    "use strict";

    var core = require('web.core');
    var qweb = core.qweb
    var BasicRenderer = require('web.BasicRenderer');
    var dom = require('web.dom');

    var ListRenderer = require('web.ListRenderer');
    var advanced_dynamicListConfig = require('advanced_dynamic_list.list_config');
    var SearchRow = require('advanced_dynamic_list.search_row');
    var pyUtils = require('web.py_utils');

    var _t = core._t;

    require('web.EditableListRenderer')

    var advanced_dynamicListMode = odoo.advanced_dynamic_list_mode;

    var { addResizeListener, removeResizeListener } = require('advanced_dynamic_list.resize_event_manager')
    var { advanced_dynamicGetScrollbarWidth, isNumber, MAGIC_FIELDS, ASC_SVG } = require('advanced_dynamic_list.util');

    let advanced_dynamicListRender = {

        tableTemplate: undefined,
        isX2ManyRender: false,

        // serials
        hasSerials: false,

        // spcial fields
        hidden_fields: {},
        invisible_fields: {},

        // expand row
        hasExpandRow: false,
        expandRowTemplate: 'advanced_dynamic_list.expand_row',
        defaultExpandHeight: 61,

        // tree column
        pathColumn: 'parent_path',
        expandTree: false,

        // fixed columns
        hasFixedLeftColumn: false,
        hasFixedRightColumn: false,

        tableBody: undefined,
        rowInfos: [],
        rowInfoCache: {},

        bodyTableWidth: 0,
        remove_raw_header_cells: true,

        events: _.extend({}, ListRenderer.prototype.events, {

            'click .advanced_dynamic_list_expander i': '_onRowExpanderClick',
            'click .advanced_dynamic_tree_hierarch': '_onTreeExpanderClick',
            'click thead th:not(.o_column_sortable)': '_onSortColumn',

            'mouseenter .advanced_dynamic_body_table  tr': '_onRowMouseEnter',
            'mouseleave .advanced_dynamic_body_table  tr': '_onRowMouseLeave',
        }),

        custom_events: _.extend({}, ListRenderer.prototype.custom_events, {
            'advanced_dynamic_list.update_user_settings': '_onUpdateUserSettings',
            'advanced_dynamic_list.reset_settings': '_onResetSettings',
            'advanced_dynamic_list.get_precell_count': '_onGetPrecellCount',
            'advanced_dynamic_list.add_extra_cells': '_onAddExtraCells',
        }),

        updateColumnWidth: function () {

            if (!this.enableadvanced_dynamicList) {
                return;
            }

            if (!this.el) {
                return;
            }

            const colGroup = this.el.querySelectorAll('.advanced_dynamic_body_table colgroup')[0];
            if (colGroup) {
                return
            }

            if (!this.columnWidths
                && this.el.offsetParent === null) {
                // there is no record nor widths to restore or the list is not visible
                // -> don't force column's widths w.r.t. their label
                return;
            }

            // as we change to 
            const thElements = [...this.body_table.querySelectorAll('thead > tr > th')];
            if (!thElements.length) {
                return;
            }

            let columnWidths = this.columnWidths;
            if (!columnWidths || !columnWidths.length) {

                // Set table layout auto and remove inline style to make sure that css
                // rules apply (e.g. fixed width of record selector)
                this.body_table.style.tableLayout = 'auto';
                thElements.forEach(th => {
                    th.style.width = null;
                    th.style.maxWidth = null;
                });

                // Resets the default widths computation now that the table is visible.
                this._computeDefaultWidths();

                if (this.advanced_dynamic_user_data && !this.advanced_dynamic_user_data.auto_ajust_colunm) {
                    const table = this.el.querySelectorAll('.advanced_dynamic_table_body table')[0];
                    const thead = table.getElementsByTagName('thead')[0];
                    // const thElements = [...thead.getElementsByTagName('th')];
                    const thElements = [...thead.querySelectorAll('.advanced_dynamic_raw_header th')];
                    columnWidths = thElements.map(th => th.offsetWidth);
                } else {
                    // Squeeze the table by applying a max-width on largest columns to
                    // ensure that it doesn't overflow
                    columnWidths = this._squeezeTable();
                }
            }

            // set the column group widthes
            thElements.forEach((th, index) => {
                // Width already set by default relative width computation
                if (!th.style.width) {
                    th.style.width = `${columnWidths[index]}px`;
                }
            });

            // set the body colgroups
            $(colGroup).remove();
            const bodyColGroup = document.createElement('colgroup');
            for (let i = 0; i < columnWidths.length; i++) {
                const col = document.createElement('col');
                col.setAttribute('width', columnWidths[i]);
                col.style.width = columnWidths[i] + 'px';
                bodyColGroup.appendChild(col);
            }
            this.body_table.appendChild(bodyColGroup);

            // set the header column groups
            const headerColGroup = this.header_table.querySelectorAll('colgroup');
            $(headerColGroup).remove();
            const cloneGroup = bodyColGroup.cloneNode(true);
            this.header_table.prepend(cloneGroup);

            // clone to footer
            const footerColGroup = this.footer_table.querySelectorAll('colgroup');
            $(footerColGroup).remove();
            const footerCloneGroup = bodyColGroup.cloneNode(true);
            this.footer_table.prepend(footerCloneGroup);

            // Set the table layout to fixed
            this.header_table.style.tableLayout = 'fixed';
            // make the main table fixed
            this.body_table.style.tableLayout = 'fixed';
            // make the footer table fixed
            this.footer_table.style.tableLayout = 'fixed';

            // update fixed positions
            this._updateAllFixedPositions();

            // remove the delay remove cells
            if (this.remove_raw_header_cells) {
                this.$header_table.find('.advanced_dynamic_delay_remove').remove();
            }

            // set the row span
            var $tmpThs = this.$header_table.find('th[data-rowspan]')
            $tmpThs.each(function (index, tmpTh) {
                let rowSpan = $(tmpTh).attr('data-rowspan');
                if (rowSpan) {
                    $(tmpTh).attr('rowspan', parseInt(rowSpan));
                }
            });

            // empty the list
            this.$body_table.find('thead > tr').empty();
        },

        /**
         * render create row, odoo15 not work
         * @param {*} rowInfo 
         * @returns 
         */
        _renderCreateRow: function (rowInfo) {

            // it is not a data row
            var $tr = $('<tr/>')
                .attr('data-id', rowInfo.rowKey)
                .data('id', rowInfo.rowKey)

            var colspan = this._getColumnCount();

            if (this.handleField) {
                colspan = colspan - 1;
                $tr.append('<td>');
            }
            
            var $td = $('<td>')
                .attr('colspan', colspan)
                .addClass('o_field_x2many_list_row_add');
                
            $tr.append($td);

            _.each(this.creates, function (create, index) {
                var $a = $('<a href="#" role="button">')
                    .attr('data-context', create.context)
                    .text(create.string);
                if (index > 0) {
                    $a.addClass('ml16');
                }
                $td.append($a);
            });

            return $tr;
        },

        init: function (parent, state, params) {
            this._super.apply(this, arguments);
            
            // add list context to create
            for (let i = 0; i < this.creates.length; i++) {
                const create = this.creates[i];
                // eval the context
                let tmp_context = pyUtils.py_eval(create.context || '{}');
                tmp_context = Object.assign(tmp_context, this.state.context); 
                create.context = JSON.stringify(tmp_context);
            }

            // check if it is in x2many mode
            if (parent.record) {
                this.isX2ManyRender = true;
            }

            // save the options, it will be used in change user settings
            this.options = this.state.context.option || {};

            // config panel
            this.configPanel = undefined;

            // get the saved user data
            if (this.isX2ManyRender) {
                this.trigger_up('advanced_dynamic_get_x2many_user_data', {
                    field: parent.field,
                    callback: (advanced_dynamic_user_data) => {
                        this.advanced_dynamic_user_data = advanced_dynamic_user_data;
                    }
                });
            } else {
                this.advanced_dynamic_user_data = params.advanced_dynamic_user_data || undefined;
                this.view_params = params.view_params || undefined;
            }

            // update options
            this._updateOptions();

            // fixed the decoration for field
            this._updateDecorations(this.advanced_dynamic_user_data);

            // get the saved user data
            _.bindAll(this, '_onBodyContainerResize', '_onBodyTableResize', "_onTableResize");

            // init the positions of ervery row
            this._initRowInfos();
        },

        _updateOptions: function () {
            if (this.advanced_dynamic_user_data) {
                this.enableadvanced_dynamicList = this.advanced_dynamic_user_data.enable_advanced_dynamic_list;
                this.hasSerials = this.advanced_dynamic_user_data.has_serials;
                this.forceReadonly = this.advanced_dynamic_user_data.force_readonly;
                this.showSearchRow = this.advanced_dynamic_user_data.show_search_row;
                this.borderStyle = this.advanced_dynamic_user_data.border_style || 'bordered';
                this.expandRowTemplate = this.advanced_dynamic_user_data.expand_row_template || undefined;
                this.treeColumn = this.advanced_dynamic_user_data.tree_column || undefined;
            } else {
                this.enableadvanced_dynamicList = true;
                this.hasSerials = false;
                this.forceReadonly = false;
                this.showSearchRow = true;
                this.borderStyle = 'bordered';
                this.expandRowTemplate = undefined;
                this.treeColumn = undefined;
            }
            this.hasExpander = this.expandRowTemplate ? true : false;
        },

        _doPostStartInit: function () {
            // add resize listener to the list container
            addResizeListener(this.$table_body.get(0), this._onBodyContainerResize);

            // hide customizer
            $(document).on("click", "*", (event) => {
                if (!$(event.target).is(
                    $(".advanced_dynamic_list_config, .advanced_dynamic_list_config *, .o_optional_columns_dropdown_toggle "))) {
                    this._hideConfigPanel()
                }
            });
        },

        start: function () {
            let self = this;
            if (!this.enableadvanced_dynamicList) {
                this._super.apply(this, arguments);
            } else {
                this._super.apply(this, arguments).then(() => {
                    this._doPostStartInit();
                    // listen to the body table resize
                    addResizeListener(this.$el.get(0), this._onTableResize);
                });
            }
        },

        _onTableResize: function () {
            this.updateColumnWidth();
        },

        _hideConfigPanel: function () {
            if (this.configPanel) {
                this.configPanel.hide();
            }
        },

        destroy: function () {
            if (this.$el) {
                removeResizeListener(this.$el.get(0), this._onTableResize);
            }
            this._super.apply(this, arguments);
            if (this.enableadvanced_dynamicList) {
                if (this.$table_body) {
                    removeResizeListener(this.$table_body.get(0), this._onBodyContainerResize);
                }
                if (this.$body_table) {
                    removeResizeListener(this.$body_table.get(0), this._onBodyTableResize);
                }

            }
        },

        _onBodyContainerResize: function (contentRect) {

            if (this.isLoading) {
                return
            }

            let height = contentRect.height;
            if (height == this.tableOffestHeight) {
                return;
            }
            this.tableOffestHeight = contentRect.height;
            this.$table_body.on('scroll', this._onTableBodyScroll.bind(this));
            this._onTableBodyScroll();

            // do scroll patch always   
            this._scrollPatch();
        },

        _getUserData: function () {
            var userData = undefined;

            if (this.isX2ManyRender) {
                var x2mField = this.getParent();
                var formRender = x2mField.getParent();
                var formController = formRender.getParent();
                var formModel = formController.model;

                var modelName = x2mField.field.relation;
                var loadParams = formModel.loadParams;

                var viewId = formController.viewId;
                var context = loadParams.context || {};
                var params = context.params || {};
                var actionId = params.action || false;
                var uid = context.uid || false;

                userData = {
                    model_name: formController.modelName,
                    uid: uid,
                    view_id: viewId,
                    action_id: actionId,
                    view_type: formRender.viewType,
                    x2many_model_name: modelName,
                }
            } else {
                var controller = this.getParent();
                var model = controller.model;
                var loadParams = model.loadParams;

                var viewId = controller.viewId;
                var context = loadParams.context || {};
                var params = context.params || {};
                var actionId = params.action || false;
                var modelName = loadParams.modelName;
                var uid = context.uid || false;

                if (!actionId && this.view_params) {
                    actionId = this.view_params.actionId || this.view_params.action.id;
                }

                userData = {
                    model_name: modelName,
                    uid: uid,
                    view_id: viewId,
                    action_id: actionId,
                    view_type: controller.viewType,
                }
            }

            return userData;
        },

        _onBodyTableResize: function (contentRect) {

            if (this.el.offsetParent === null) {
                return;
            }

            // check if just the height changed
            let justCheckScroll = false;
            let width = contentRect.width;
            if (width == this.bodyTableWidth) {
                justCheckScroll = true;
            }

            // scroll patch, this will affect the scroll
            this._scrollPatch();

            this.bodyTableWidth = contentRect.width;
            this._syncTableWidth(justCheckScroll);
        },

        _syncTableWidth: function (checkScroll) {

            // tiggered when size change by this fucntion
            if (this.ignore_size_change) {
                this.ignore_size_change = false;
                return
            }

            const header_table = this.header_table;
            const body_table = this.body_table;
            const footer_table = this.footer_table;
            const table_body = this.table_body;

            let width = `${header_table.offsetWidth}px`;

            let col_changed = false;
            let scrollBarWidth = this.getScrollBarWidth();
            let delta = this.$table_body.width() - this.$table_body.prop('clientWidth')
            // get the header colgroup
            let headerCols = this.$header_table.find('colgroup col');

            if (delta > 0
                && headerCols.length
                && body_table.offsetWidth == table_body.offsetWidth) {

                // get the width without scrollbar
                width = `${header_table.offsetWidth - scrollBarWidth}px`;

                // get the max width col
                let max_width = 0;
                let index = 0;
                for (let i = 0; i < headerCols.length; i++) {
                    let col = headerCols[i];
                    let width = parseInt(col.style.width);
                    if (width > max_width) {
                        max_width = width;
                        index = i;
                    }
                }
                // subsctract the scroll width
                max_width -= delta;
                // set the max width
                headerCols[index].style.width = `${max_width}px`;
                // get the body colgroup
                let bodyCols = this.$body_table.find('colgroup col');
                // set the max width
                bodyCols[index].style.width = `${max_width}px`;
                // get the footer colgroup
                let footerCols = this.$footer_table.find('colgroup col');
                // set the max width
                footerCols[index].style.width = `${max_width}px`;
                // set as changed
                col_changed = true;
            } else {
                if (checkScroll) {
                    return
                }
            }

            // set the ignore flag
            this.ignore_size_change = true;

            // sync the table width
            header_table.style.width = width;
            body_table.style.width = width;

            if (footer_table) {
                footer_table.style.width = width;
            }

            if (col_changed) {
                // update fixed positions, update header will update the search too
                this._updateAllFixedPositions();
            }
        },

        _onRowMouseEnter: function (event) {
            let $tr = $(event.currentTarget);
            $tr.addClass('hover');
        },

        _onRowMouseLeave: function (event) {
            let $tr = $(event.currentTarget);
            $tr.removeClass('hover');
        },

        _getScrollWidth: function (element) {
            var width = 0;
            if (element) {
                width = element.offsetWidth - element.clientWidth;
            } else {
                element = document.createElement('div');
                element.style.width = '100px';
                element.style.height = '100px';
                element.style.overflowY = 'scroll';

                document.body.appendChild(element);
                width = element.offsetWidth - element.clientWidth;
                document.body.removeChild(element);
            }
            return width;
        },

        _initLayout: function () {

            if (!this.tableTemplate) {
                this.tableTemplate = qweb.render('advanced_dynamic_list.list_view', { widget: this })
            }

            if (!this.$layout) {
                this.$layout = $(this.tableTemplate);

                // table header
                this.$table_header = this.$layout.find('.advanced_dynamic_table_header');
                this.$header_table = this.$table_header.find('table');
                this.header_table = this.$header_table[0];

                // main table body part
                this.$table_body = this.$layout.find('.advanced_dynamic_table_body');
                this.table_body = this.$table_body[0];
                this.$page_simulator = this.$table_body.find('.advanced_dynamic_page_simulater');
                this.$body_table = this.$table_body.find('table');
                this.body_table = this.$body_table[0];

                // table footer
                this.$table_footer = this.$layout.find('.advanced_dynamic_table_footer');
                this.$footer_table = this.$table_footer.find('table');
                this.footer_table = this.$footer_table.get(0);

                // append layout
                this.$el.append(this.$layout);
                this.$el.addClass('d-flex flex-fill flex-column')
            } else {
                this._clearContent();
            }

            // set the border style
            if (this.borderStyle == 'bordered') {
                this.$body_table.addClass('advanced_dynamic_bordered');
            } else {
                this.$body_table.removeClass('advanced_dynamic_bordered');
            }
        },

        /**
         * sync the table scorll position
         */
        _syncTableHeaderScroll: function () {
            // get the scroll position
            let scrollLeft = this.$table_body.scrollLeft()
            // sync header scroll
            this.$table_header.scrollLeft(scrollLeft);
            // sync footer scroll
            this.$table_footer.scrollLeft(scrollLeft);
        },

        _onTableBodyScroll: function () {
            if (this.isLoading) {
                return;
            }
            this._syncTableHeaderScroll();
        },

        _onTreeExpanderClick: function (event) {
            event.stopPropagation();
            event.preventDefault();

            let target = event.currentTarget;
            let $target = $(target);
            let $expand_icon = $target.find('i')
            let $tr = $target.closest('tr');
            let id = $tr.attr('data-id');
            // check is expanded
            let isExpanded = $expand_icon.hasClass('icon-expand');
            if (isExpanded) {
                $expand_icon.removeClass('icon-expand').addClass('icon-collapese');
                //this._expandRow(id);
                this._collapseRow(id);
            } else {
                $expand_icon.removeClass('icon-collapese').addClass('icon-expand');
                //this._collapseRow(id);
                this._expandRow(id);
            }
        },

        _getChildrenRowInfos(id) {
            let row_position_info = this.rowInfoCache[id];
            let dataIndex = row_position_info.dataIndex;
            let record = this.state.data[dataIndex];
            let parent_path = record.data.parent_path;
            let index = row_position_info.index;
            let row_infos = [];
            for (let i = index + 1; i < this.rowInfos.length; i++) {
                let tmp_row_position = this.rowInfos[i];
                let tmp_dataIndex = tmp_row_position.dataIndex;
                let tmp_record = this.state.data[tmp_dataIndex];
                if (_.str.startsWith(tmp_record.data.parent_path, parent_path)) {
                    row_infos.push(tmp_row_position);
                } else {
                    break;
                }
            }
            return row_infos;
        },

        _expandRow(id) {
            let rowInfo = this.rowInfoCache[id];
            rowInfo.nodeExpanded = true;
            let row_infos = this._getChildrenRowInfos(id);
            if (row_infos.length == 0) {
                return;
            }
            // set real visible
            for (let i = 0; i < row_infos.length; i++) {
                let row_info = row_infos[i];
                let rid = row_info.rowKey;
                let $tr = this.$body_table.find(`tr[data-id="${rid}"]`);
                // hide the row
                $tr.hide();
            }
        },

        /**
         * collapse the row
         */
        _collapseRow: function (id) {
            let rowInfo = this.rowInfoCache[id];
            rowInfo.nodeExpanded = false;
            let row_infos = this._getChildrenRowInfos(id);
            if (row_infos.length == 0) {
                return;
            }
            for (let i = 0; i < row_infos.length; i++) {
                let row_info = row_infos[i];
                let rid = row_info.rowKey;
                let $tr = this.$body_table.find(`tr[data-id="${rid}"]`);
                $tr.show();
            }
        },

        _onRowExpanderClick: function (event) {

            event.stopPropagation();
            event.preventDefault();

            const $target = $(event.currentTarget);

            let $tr = $target.closest('tr');
            let id = $tr.data('id');

            // check is expanded
            const isExpanded = $target.hasClass('expanded');
            // add expand row
            if (!isExpanded) {
                $target.addClass('expanded');
                let record = _.find(this.state.data, { id: id });
                let $expandRow = this._renderExpandRow(record, $tr.index);
                // insert after $tr
                $tr.after($expandRow);
            } else {
                // remove expand row
                $target.removeClass('expanded');
                let $expandRow = $tr.next('tr.advanced_dynamic_expand_row');
                $expandRow.remove();
            }
        },

        _getElementStickyPosition: function ($el, cols, fixed_left) {
            var index = $el.data('col-index');
            if (index === undefined) {
                index = $el.index();
            }
            if (fixed_left) {
                let left = 0;
                for (let i = 0; i < index; i++) {
                    let column = cols[i];
                    left += parseInt(column.style.width);
                }
                return left;
            } else {
                let right = 0;
                for (let i = cols.length - 1; i > index; i--) {
                    let column = cols[i];
                    right += parseInt(column.style.width);
                }
                if (this.hasScrollPatch) {
                    right += this.getScrollBarWidth();
                }
                return right;
            }
        },

        _updateAllFixedPositions: function () {
            this._updateFixedPositions('header');
            this._updateFixedPositions('body');
            if (this.$footer_table.length) {
                this._updateFixedPositions('footer');
            }
        },

        /**
         * to do, use a cache to cahce the cols positions to avoid recalculate
         * @param {*} type='header' 
         */
        _updateFixedPositions: function (type, scope = 'all') {
            var self = this;
            var cols = undefined;
            var $fixed_items = undefined;

            // deal fixed left
            if (scope == 'all' || scope == 'left') {
                if (type == 'header') {
                    cols = this.$header_table.find('colgroup col');
                    $fixed_items = this.$header_table.find('th.advanced_dynamic_fixed_left');
                } else if (type == 'body') {
                    cols = this.$body_table.find('colgroup col');
                    $fixed_items = this.$body_table.find('td.advanced_dynamic_fixed_left');
                } else if (type == 'footer') {
                    cols = this.$footer_table.find('colgroup col');
                    $fixed_items = this.$footer_table.find('td.advanced_dynamic_fixed_left');
                } else if (type == 'search') {
                    cols = this.$header_table.find('colgroup col');
                    $fixed_items = this.$header_table.find('.advanced_dynamic_search_row th.advanced_dynamic_fixed_left');
                }

                // as the cols may not be ready, so we need to wait for it
                if (cols.length == 0 || !$fixed_items) {
                    return;
                }

                $fixed_items.each(function (index, element) {
                    const $element = $(element);
                    let left = self._getElementStickyPosition($element, cols, true);
                    $element.css('left', left);
                })
            }

            // deal fixed right
            if (scope == 'all' || scope == 'right') {
                if (type == 'header') {
                    $fixed_items = this.$header_table.find('th.advanced_dynamic_fixed_right');
                } else if (type == 'body') {
                    $fixed_items = this.$body_table.find('td.advanced_dynamic_fixed_right');
                } else if (type == 'footer') {
                    $fixed_items = this.$footer_table.find('td.advanced_dynamic_fixed_right');
                } else if (type == 'search') {
                    $fixed_items = this.$header_table.find('.advanced_dynamic_search_row th.advanced_dynamic_fixed_right');
                }

                $fixed_items.each(function (index, element) {
                    const $element = $(element);
                    let right = self._getElementStickyPosition($element, cols, false);
                    // add the scroll width if there has scroll patch
                    if (type != 'body') {
                        // find the scroll patch
                        let $scroll_patch = self.$table_header.find('.advanced_dynamic_list_patch');
                        if ($scroll_patch.length > 0) {
                            let scroll_width = self.getScrollBarWidth();
                            right += scroll_width;
                        }
                    }
                    $element.css('right', right);
                })
            }
        },

        _clearContent: function () {
            let $bodyTbody = this.$body_table.find('tbody');
            let $footerTbody = this.$footer_table.find('tfoot');

            $bodyTbody.remove();
            $footerTbody.remove();

            // remove the old thead
            this.$body_table.css('width', '');

            // no content helper
            this.$('.o_view_nocontent').remove();
        },

        _isHeaderExits: function () {
            let headerTr = this.$header_table.find('thead tr');
            return headerTr.length == 0 ? false : true;
        },

        async _renderView() {

            if (!this.enableadvanced_dynamicList) {
                await this._super.apply(this, arguments);
                if (!this.optionalColumns.length) {
                    this.el.classList.add('o_list_optional_columns');
                    this.$('table').append(
                        $('<i class="o_optional_columns_dropdown_toggle fa fa-ellipsis-v"/>')
                    );
                    this.$el.append(this._renderOptionalColumnsDropdown());
                }
                return;
            }

            const oldPagers = this.pagers;
            let prom;
            if (true || this.state.count > 0 || !this.noContentHelp) {
                this.pagers = [];

                const orderedBy = this.state.orderedBy;
                this.hasHandle = orderedBy.length === 0 || orderedBy[0].name === this.handleField;
                this._computeAggregates();

                // init table layout
                this._initLayout()

                // remove old listeners
                removeResizeListener(this.$body_table.get(0), this._onBodyTableResize);

                // listen to the body table resize
                addResizeListener(this.$body_table.get(0), this._onBodyTableResize);

                // render header
                let needRenderFakeHeader = false;
                if (!this._isHeaderExits()) {
                    var $header = this._renderMainTableHeader();
                    this.$header_table.append($header);
                    needRenderFakeHeader = true;
                }

                const defs = [];
                this.defs = defs;

                if (this.isGrouped) {
                    this.$body_table.append(this._renderGroups(this.state.data));
                } else {
                    var body_content = this._renderMainTableBody();
                    this.$body_table.append(body_content);
                }

                // render the header to the main table body, the header just form show
                if (needRenderFakeHeader) {
                    let $header = this._renderMainTableHeader(true);
                    this.$body_table.append($header);
                }

                this.$footer_table.append(this._renderFooter());

                // just load the data
                if (!this.enableVirtualScroll && !needRenderFakeHeader) {
                    this._updateAllFixedPositions();
                }

                // there will create defs when render
                delete this.defs;
                prom = Promise.all(defs);
            }

            // avoid to call the parent to render the view again
            await Promise.all([BasicRenderer.prototype._renderView.apply(this, arguments), prom]);

            // destroy the previously instantiated pagers, if any
            oldPagers.forEach(pager => pager.destroy());

            // append the table (if any) to the main element
            if (document.body.contains(this.el)) {
                this.pagers.forEach(pager => pager.on_attach_callback());
            }

            // advanced_dynamic list config
            if (!this.configPanel) {
                // render to config panel toggler
                this.$table_header.append(
                    $('<i class="o_optional_columns_dropdown_toggle fa fa-ellipsis-v"/>')
                );
                // render config panel
                this.configPanel = new advanced_dynamicListConfig(this, this.isX2ManyRender);
                if (this.isX2ManyRender) {
                    // append to body
                    this.configPanel.appendTo($('body'));
                } else {
                    this.configPanel.appendTo(this.$('.advanced_dynamic_list_container'));
                }
            }

            if (this.selection.length) {
                const $checked_rows = this.$('tr').filter((index, el) => this.selection.includes(el.dataset.id));
                $checked_rows.find('.o_list_record_selector input').prop('checked', true);
                if ($checked_rows.length === this.$('.o_data_row').length) {
                    // all rows are checked
                    this.$('thead .o_list_record_selector input').prop('checked', true);
                }
            }

            // display the no content helper if necessary
            if (!this._hasContent() && !!this.noContentHelp) {
                this._renderNoContentHelper();
            }
        },

        _renderOptionalColumnsDropdown: function () {
            // add a toggle button after
            var $optionalColumnsDropdown = this._super.apply(this, arguments);
            var $dropDown = $optionalColumnsDropdown.find('.dropdown-menu');
            var $enable_list_manager = $(core.qweb.render('advanced_dynamic_list.enable_list_manager'));
            $dropDown.append($enable_list_manager);
            return $optionalColumnsDropdown;
        },

        _onToggleOptionalColumn: function (ev) {
            var $target = $(ev.currentTarget);
            if ($target.hasClass('advanced_dynamic_list_switcher')) {
                $target.find('input').prop('checked', !$target.find('input').prop('checked'));
                ev.stopPropagation();

                setTimeout(() => {
                    this.enableListManager();
                }, 500);

                return
            }
            this._super.apply(this, arguments);
        },

        /**
         * Render the footer.  It is a <tfoot> with a single row, containing all
         * aggregates, if applicable.
         * @private
         * @returns {jQueryElement} a <tfoot> element
         */
        _renderFooter: function () {

            if (!this.enableadvanced_dynamicList) {
                return this._super.apply(this, arguments);
            }

            // clear first
            this.$footer_table.find('tfoot').remove();

            var aggregates = {};
            _.each(this.columns, function (column) {
                if ('aggregate' in column) {
                    aggregates[column.attrs.name] = column.aggregate;
                }
            });
            var $cells = this._renderAggregateCells(aggregates);
            if (this.hasSelectors) {
                $cells.unshift($('<td>', { class: 'advanced_dynamic_fixed_left' }));
            }
            if (this.hasSerials) {
                $cells.unshift($('<td>', { class: 'advanced_dynamic_fixed_left' }));
            }
            if (this.hasExpander) {
                $cells.unshift($('<td>', { class: 'advanced_dynamic_fixed_left' }));
            }
            var $tr = $('<tr>').append($cells)
            var $tfoot = $('<tfoot>').append($tr);
            return this.$footer_table.append($tfoot);
        },

        _getColumnName: function (column) {
            return column.name || column.attrs.name;
        },

        _updateFooter: function () {
            if (this.enableadvanced_dynamicList) {
                this._computeAggregates();
                this._renderFooter();
                this._updateFixedPositions('footer');
            } else {
                this._super.apply(this, arguments);
            }
        },

        _getColumnsTotalWidth(relativeWidths) {
            return relativeWidths.reduce((acc, width) => acc + width, 0);
        },

        _renderBodyCell: function (record, node, col_index, options) {

            if (!this.enableadvanced_dynamicList) {
                return this._super.apply(this, arguments);
            }

            let $td = this._super.apply(this, arguments);
            // deal sticky columns
            if (!this.isGrouped) {
                // disable tree when grouped
                if (node.attrs.name == this.treeColumn && this.pathColumn) {
                    var $span = $('<span>', { class: 'advanced_dynamic_tree_hierarch' });
                    let path = record.data[this.pathColumn];

                    // splite by '/'
                    let hierarchy = _.str.trim(path, '/').split('/');
                    var level = hierarchy.length;
                    var padding = (level - 1) * 16;
                    $span.css('padding-left', padding + 'px');

                    let $expandIcon = $('<i class="iconfont">');
                    $span.append($expandIcon);
                    $expandIcon.attr('data-path', path);
                    if (level > 1) {
                        let parentPath = hierarchy.slice(0, level - 1).join('/');
                        $expandIcon.attr('data-parent-path', parentPath);
                    }

                    // deal the expand icon
                    let row_info = this.rowInfoCache[record.id];
                    let dataIndex = row_info.dataIndex;
                    if (dataIndex < this.state.data.length - 1) {
                        let next_record = this.state.data[dataIndex + 1];
                        let next_record_path = next_record.data[this.pathColumn];
                        if (_.str.startsWith(next_record_path, path)) {
                            if (row_info.nodeExpanded) {
                                $expandIcon.addClass('icon-collapese');
                            } else {
                                $expandIcon.addClass('icon-expand');
                            }
                        } else {
                            $expandIcon.addClass('icon-empty');
                        }
                    } else {
                        $expandIcon.addClass('icon-empty');
                    }

                    $td.prepend($span);
                }
            }

            if (node.fixed_left) {
                $td.addClass('advanced_dynamic_fixed_left');
                if (node.fixed_left_last) {
                    // the text may be overflow
                    let $children = $td.children();
                    let $div = $('<div>', { class: 'advanced_dynamic_fixed_last_wapper' });
                    if ($children.length > 0) {
                        $div.append($children);
                    }
                    let $content = $td.contents();
                    $div.append($content);
                    $td.empty().append($div);
                    $td.addClass('advanced_dynamic_fixed_left_last');
                }
            } else if (node.fixed_right) {
                $td.addClass('advanced_dynamic_fixed_right');
                if (this._fixedRightFirst(node.index)) {
                    $td.addClass('advanced_dynamic_fixed_right_first');
                }
            }

            return $td;
        },

        /**
         * overwrite
         */
        _renderGroup: function (group, groupLevel) {
            if (!this.enableadvanced_dynamicList) {
                return this._super.apply(this, arguments);
            }
            var self = this;
            if (group.groupedBy.length) {
                // the opened group contains subgroups
                return this._renderGroups(group.data, groupLevel + 1);
            } else {
                // the opened group contains records
                var index = 1;
                var $records = _.map(group.data, function (record,) {
                    return self._renderRow(record, group, index++);
                });
                return [$('<tbody>').append($records)];
            }
        },

        _renderRow: function (record, group, index) {

            if (!this.enableadvanced_dynamicList) {
                return this._super.apply(this, arguments);
            }

            var self = this;
            var $cells = this.columns.map(function (column, column_index) {
                var $cell = self._renderBodyCell(record, column, column_index, { mode: 'readonly' });
                return $cell
            });

            var $tr = $('<tr/>', { class: 'o_data_row' })
                .attr('data-id', record.id)
                .data('id', record.id)
                .append($cells);

            // empty = false, classes = '', serial_no = 0
            if (!this.isGrouped) {
                let rowInfo = this.rowInfoCache[record.id];
                let serial = 0;
                if (this.hasSerials) {
                    serial = this.state.offset + rowInfo.serial;
                }
                this._addExtraCell($tr, {
                    header: false,
                    empty: false,
                    classes: '',
                    serial: serial,
                });
                // add the row class
                let index = rowInfo.index + 1
                if (index % 2 === 0) {
                    $tr.addClass('advanced_dynamic_odd_row');
                }
            } else {
                // the group searial is start erver group
                let serial = 0;
                if (this.hasSerials) {
                    serial = group.offset + index;
                }
                this._addExtraCell($tr, {
                    header: false,
                    empty: false,
                    classes: '',
                    serial: serial,
                });
            }
            this._setDecorationClasses($tr, this.rowDecorations, record);
            return $tr;
        },

        /**
         * update custom user field decorations
         * @param {*} advanced_dynamic_user_data
         */
        _updateDecorations: function (advanced_dynamic_user_data) {
            let advanced_dynamic_user_fields = (advanced_dynamic_user_data && advanced_dynamic_user_data.user_fields) || [];
            for (var i = 0; i < advanced_dynamic_user_fields.length; i++) {
                var field = advanced_dynamic_user_fields[i];
                if (!this.fieldDecorations[field.name]) {
                    const decorations = this._extractDecorationAttrs(field);
                    this.fieldDecorations[field.name] = decorations;
                }
            }
        },

        _getPreCellCount: function () {

            var count = 0;
            if (this.hasSelectors) {
                count += 1;
            }

            // expand
            if (this.hasExpander) {
                count += 1;
            }

            if (this.hasSerials) {
                count += 1;
            }

            return count;
        },

        /**
         * get column count
         */
        _getColumnCount: function () {
            let count = this.columns.length;
            let preCellCount = this._getPreCellCount();
            if (this.addTrashIcon) {
                count += 1;
            }
            return count + preCellCount;
        },

        _renderExpandRow: function (record, row_index) {
            let expand_row_key = `${record.id}_expand_row`;
            let $tr = $(`<tr class='o_data_row advanced_dynamic_expand_row'><td colspan='${this._getColumnCount()}'/></tr>`)
            $tr.attr('data-id', expand_row_key)
            $tr.data('id', expand_row_key)
            let expand_row = $(core.qweb.render(
                this.expandRowTemplate,
                {
                    record: record,
                    row_index: row_index
                }
            ));
            $tr.find('td').append(expand_row);
            return $tr;
        },

        _renderSelector: function (tag, disableInput) {
            if (!this.enableadvanced_dynamicList) {
                return this._super.apply(this, arguments);
            } else {
                var $content = dom.renderCheckbox();
                if (disableInput) {
                    $content.find("input[type='checkbox']").prop('disabled', disableInput);
                }
                var $el = $(`<${tag} class="o_list_record_selector"><div></div></${tag}>`)
                $el.find('div').addClass(
                    'o_list_record_selector advanced_dynamic_list_selector').append($content);
                $el.css('max-width', '40px');
                return $el;
            }
        },

        _fixedLeftLast: function (index) {
            if (index < this.columns.length - 1) {
                let next_col = this.columns[index + 1];
                if (!next_col.fixed_left) {
                    return true;
                }
            }
            return false;
        },

        _fixedRightFirst: function (index) {
            if (index > 0) {
                let prev_col = this.columns[index - 1];
                if (!prev_col.fixed_right) {
                    return true;
                }
            }
            return false;
        },

        _renderHeaderCell: function (node) {
            if (!this.enableadvanced_dynamicList) {
                return this._super.apply(this, arguments);
            } else {
                var col_index = node.index;
                var $th = this._super.apply(this, arguments);
                if (node.fixed_left) {
                    $th.addClass('advanced_dynamic_fixed_left');
                    if (this._fixedLeftLast(col_index)) {
                        $th.addClass('advanced_dynamic_fixed_left_last');
                    }
                } else if (node.fixed_right) {
                    $th.addClass('advanced_dynamic_fixed_right');
                    if (this._fixedRightFirst(col_index)) {
                        $th.addClass('advanced_dynamic_fixed_right_first');
                    }
                }
                return $th;
            }
        },

        _renderHeaderButton: function (event) {
            var nodeWithoutWidth = Object.assign({}, node);
            delete nodeWithoutWidth.attrs.width;

            let extraClass = '';
            if (node.attrs.icon) {
                const btnStyleRegex = /\bbtn-[a-z]+\b/;
                if (!btnStyleRegex.test(nodeWithoutWidth.attrs.class)) {
                    extraClass = 'btn-link o_icon_button';
                }
            }
            var $button = viewUtils.renderButtonFromNode(nodeWithoutWidth, {
                extraClass: extraClass,
            });
            this._handleAttributes($button, node);

            return $button;
        },

        _onGetPrecellCount: function (event) {
            let data = event.data
            let callback = data.callback;
            let count = this._getPreCellCount();
            callback(count);
        },

        /**
         * get column width
         * @param {*} column 
         * @returns 
         */
        _getColumnWidth: function (column) {

            if (!this.enableadvanced_dynamicList) {
                return this._super.apply(this, arguments);
            }

            // if we set the width
            if (column.attrs.width) {
                return column.attrs.width;
            }

            const fieldsInfo = this.state.fieldsInfo.list;
            const name = column.attrs.name;
            if (!fieldsInfo[name]) {
                // Unnamed columns get default value
                return '1';
            }
            const widget = fieldsInfo[name].Widget.prototype;
            if ('widthInList' in widget) {
                return widget.widthInList;
            }
            const field = this.state.fields[name];
            if (!field) {
                // this is not a field. Probably a button or something of unknown
                // width.
                return '1';
            }
            const fixedWidths = {
                boolean: '70px',
                date: '92px',
                datetime: '146px',
                float: '92px',
                integer: '74px',
                monetary: '104px',
            };
            let type = field.type;
            if (fieldsInfo[name].widget in fixedWidths) {
                type = fieldsInfo[name].widget;
            }
            return fixedWidths[type] || '1';
        },

        /**
         * add extra cell for sub widgets
         */
        _onAddExtraCells: function (event) {
            let data = event.data;
            let $tr = data.$tr;
            let options = data.options;
            this._addExtraCell($tr, options);
        },

        /**
         * method to add extra cells
         * @param {*} $tr 
         * @param {*} header 
         */
        _addExtraCell: function ($tr, options) {

            // extrat options
            let header = options.header || false;
            let tag = options.header ? 'th' : 'td';
            let empty = options.empty || false;
            let classes = options.classes || '';

            // render expander
            if (this.hasExpander) {
                if (!empty) {
                    var $tmp_el = undefined;
                    if (options.header) {
                        $tmp_el = $(
                            `<${tag} class='advanced_dynamic_fixed_left advanced_dynamic_list_expander advanced_dynamic_fixed_left ${classes}'></${tag}>`);
                    } else {
                        if (!this.isGrouped) {
                            let id = $tr.data('id');
                            let rowInfo = this.rowInfoCache[id];
                            let icon_class = 'icon-arrow-right'
                            if (rowInfo.expanded) {
                                icon_class += ' expanded'
                            }
                            $tmp_el = $(
                                `<${tag} class='advanced_dynamic_fixed_left advanced_dynamic_list_expander advanced_dynamic_fixed_left ${options.classes}'><div><i class="iconfont ${icon_class}"/></div></${tag}>`);
                        } else {
                            let icon_class = 'icon-arrow-right'
                            $tmp_el = $(
                                `<${tag} class='advanced_dynamic_fixed_left advanced_dynamic_list_expander advanced_dynamic_fixed_left ${options.classes}'><div><i class="iconfont ${icon_class}"/></div></${tag}>`);
                        }
                    }
                    $tr.prepend($tmp_el);
                } else {
                    let $el = $(`<${tag} class='${classes} advanced_dynamic_fixed_left'>`)
                    $tr.prepend($el);
                }
            }

            // render serial
            if (this.hasSerials) {
                if (!empty) {
                    let $tmp_el = undefined;
                    if (header) {
                        $tmp_el = $(`<${tag}>#</${tag}>`)
                    } else {
                        $tmp_el = $(`<${tag}>${options.serial}</${tag}>`)
                    }
                    $tmp_el.addClass(`advanced_dynamic_list_cell advanced_dynamic_serial_cell advanced_dynamic_fixed_left ${classes}`);
                    $tr.prepend($tmp_el);
                } else {
                    $tr.prepend($(`<${tag} class='${classes} advanced_dynamic_fixed_left'>`));
                }
            }

            // render selectors
            if (this.hasSelectors) {
                if (!empty) {
                    let selector = this._renderSelector(tag);
                    $(selector).addClass(`o_list_record_selector advanced_dynamic_fixed_left ${classes}`);
                    $tr.prepend(selector);
                } else {
                    $tr.prepend($(`<${tag} class='${classes} advanced_dynamic_fixed_left'>`));
                }
            }

            // add trash icon
            if (this.addTrashIcon) {
                if (!empty) {
                    let $tmp_el = undefined;
                    if (header) {
                        $tmp_el = $(`<${tag} class='${classes} o_list_record_remove_header' style="min-width:32px">`)
                    } else {
                        var $icon = this.isMany2Many ?
                            $('<button>', { 'class': 'fa fa-times', 'name': 'unlink', 'aria-label': _t('Unlink row ') }) :
                            $('<button>', { 'class': 'fa fa-trash-o', 'name': 'delete', 'aria-label': _t('Delete row ') });
                        $tmp_el = $('<td>', { class: 'o_list_record_remove' }).append($icon);
                    }
                    $tr.append($tmp_el);
                } else {
                    $tr.append($(`<${tag} class='${classes} o_list_record_remove_header' style="min-width:32px">`));
                }
            }
        },

        _renderMainTableHeader: function (justRaw = false) {
            var self = this;

            // render the raw header
            var $tr = $('<tr class="advanced_dynamic_raw_header">').append(_.map(this.columns, function (column) {
                var $th = self._renderHeaderCell(column)
                column.$el = $th;
                return $th
            }));

            // render parent groups
            let $header = $('<thead>')

            // render parent rows 
            if (!justRaw) {
                let $group_trs = this._renderHeaderGroups();
                this._addExtraCell($tr, {
                    header: true,
                    empty: false,
                    classes: $group_trs.length ? 'advanced_dynamic_delay_remove' : ''
                });

                if ($group_trs.length > 0) {
                    let $first_row = _.first($group_trs);
                    let nRows = $group_trs.length + 1;

                    // set the selector row span
                    if (this.hasSelectors) {
                        $first_row.find('.o_list_record_selector').parents('th:first').attr('data-rowspan', nRows);
                    }

                    // set the serial row span
                    if (this.hasSerials) {
                        $first_row.find('.advanced_dynamic_serial_cell').attr('data-rowspan', nRows);
                    }

                    // set the expander row span
                    if (this.hasExpander) {
                        $first_row.find('.advanced_dynamic_list_expander').attr('data-rowspan', nRows);
                    }

                    $header.append($group_trs);
                }
            } else {
                this._addExtraCell($tr, {
                    header: true,
                    empty: false,
                    classes: ''
                });
            }

            $header.append($tr);

            if (!justRaw) {
                // set the col index, the rowspan has not been delete yet
                let $trs = $header.find('tr');
                _.each($trs, function (tr, index) {
                    let $tr = $(tr);
                    let $ths = $tr.find('th');
                    let colIndex = 0;
                    _.each($ths, function (th, index) {
                        let $th = $(th);
                        $th.attr('data-col-index', colIndex);
                        colIndex++;
                        let colSpan = parseInt($th.attr('colspan'));
                        if (colSpan) {
                            colIndex += colSpan - 1;
                        }
                    })
                })

                // render the search row
                if (!this.isX2ManyRender
                    && this.showSearchRow) {
                    let searchRow = this._renderSearchRow();
                    searchRow.appendTo($header).then(() => {
                        this._updateFixedPositions('search');
                    });
                }
            }

            return $header;
        },

        /**
         * render the search row
         */
        _renderSearchRow: function () {
            let searchRow = new SearchRow(this, this.columns, this.state.fields);
            return searchRow;
        },

        /**
         * check need to check parent
         */
        check_has_parent: function (cur_columns) {
            for (var i = 0; i < cur_columns.length; i++) {
                let column = cur_columns[i]
                if (column.parent) {
                    return true
                }
            }
            return false
        },

        /**
         * render parent groups
         */
        _renderHeaderGroups: function () {
            let header_arch = [this.columns];
            let $group_trs = [];
            let cur_columns = [];
            for (var i = 0; i < this.columns.length; i++) {
                let column = this.columns[i]
                cur_columns.push({
                    name: this.columns[i].attrs.name,
                    string: this.columns[i].attrs.string || this.columns[i].attrs.name,
                    children: [],
                    parent: column.parent || null,
                    $el: column.$el,
                    fixed_left: column.fixed_left,
                    fixed_right: column.fixed_right,
                    fixed_left_last: column.fixed_left_last,
                    fixed_right_first: column.fixed_right_first,
                    colspan: 1
                })
            }

            let hasParent = this.check_has_parent(cur_columns);
            while (hasParent) {
                let parent_columns = []
                for (let i = 0; i < cur_columns.length; i++) {
                    let tmp_column = cur_columns[i]
                    if (tmp_column.parent) {
                        let parent_exits = false;
                        let parent_name = tmp_column.parent.name
                        if (parent_columns.length > 0) {
                            let last_parent = _.last(parent_columns)
                            // must ajacent
                            if (last_parent.name == parent_name) {
                                last_parent.children.push(tmp_column)
                                last_parent.colspan += tmp_column.colspan
                                last_parent.fixed_left = tmp_column.fixed_left
                                last_parent.fixed_right = tmp_column.fixed_right
                                last_parent.fixed_left_last = tmp_column.fixed_left_last
                                // fixed_right_first
                                last_parent.fixed_right_first = tmp_column.fixed_right_first
                                parent_exits = true
                            }
                            tmp_column.parent_column = last_parent
                        }
                        if (!parent_exits) {
                            parent_columns.push({
                                name: parent_name,
                                string: parent_name,
                                children: [tmp_column],
                                parent: tmp_column.parent.parent,
                                colspan: tmp_column.colspan,
                                fixed_left: tmp_column.fixed_left,
                                fixed_right: tmp_column.fixed_right,
                                fixed_left_last: tmp_column.fixed_left_last,
                                fixed_right_first: tmp_column.fixed_right_first,
                                real_group: true
                            })
                            tmp_column.parent_column = _.last(parent_columns)
                        }
                    } else {
                        parent_columns.push({
                            name: tmp_column.name,
                            string: tmp_column.string,
                            children: [tmp_column],
                            colspan: tmp_column.colspan || 1,
                            fixed_left: tmp_column.fixed_left,
                            fixed_right: tmp_column.fixed_right,
                            fixed_left_last: tmp_column.fixed_left_last,
                            fixed_right_first: tmp_column.fixed_right_first,
                            parent: null,
                            real_group: false
                        })
                        tmp_column.parent_column = _.last(parent_columns)
                    }
                }
                cur_columns = parent_columns;
                hasParent = this.check_has_parent(cur_columns);
                // add to the header arch
                header_arch.unshift(cur_columns)
                // render to the dom
                let $tr = this._renderParentColumns(cur_columns, hasParent)
                $group_trs.unshift($tr)
            }
            this.header_arch = header_arch;
            return $group_trs
        },

        _renderParentColumns: function (columns, hasParent) {
            let self = this;

            var $tr = $('<tr>')
            _.map(columns, function (column) {
                var $th = self._renderParentColumn(column);
                $tr.append($th)
            })

            if (!hasParent) {
                this._addExtraCell($tr, {
                    header: true,
                    empty: false,
                });
            } else {
                this._addExtraCell($tr, {
                    header: true,
                    empty: false,
                    classes: 'advanced_dynamic_delay_remove'
                });
            }

            return $tr;
        },

        _getColumnString: function (column) {
            return column.string || column.attrs && column.attrs.string || column.attrs && column.attrs.name || column.name;
        },

        _renderParentColumn: function (column, index) {

            // calc the rows span
            let rowspans = 1;
            let tmp_column = column;
            while (tmp_column.children
                && tmp_column.children.length == 1) {
                let child = tmp_column.children[0];
                // check has the same name
                if (child.name == tmp_column.name) {
                    rowspans += 1;
                    tmp_column = child;
                    if (tmp_column.$el) {
                        tmp_column.$el.addClass('advanced_dynamic_delay_remove');
                        tmp_column.$el = null;
                    }
                } else {
                    break
                }
            }

            let $th = $('<th>' + this._getColumnString(column) + '</th>');
            if (column.colspan > 1) {
                $th.attr('colspan', column.colspan);
            }
            if (rowspans > 1) {
                $th.attr('data-rowspan', rowspans);
            }
            $th.css('text-align', 'center');
            $th.attr('data-name', column.name || (column.attrs && column.attrs.name));

            // add resizer
            const resizeHandle = document.createElement('span');
            resizeHandle.classList = 'o_resize';
            resizeHandle.onclick = this._onClickResize.bind(this);
            resizeHandle.onmousedown = this._onStartResize.bind(this);
            $th.append(resizeHandle);

            // check fixed left
            if (column.fixed_left) {
                $th.addClass('advanced_dynamic_fixed_left')
                if (column.fixed_left_last) {
                    $th.addClass('advanced_dynamic_fixed_left_last')
                }
            } else if (column.fixed_right) {
                $th.addClass('advanced_dynamic_fixed_right')
                if (column.fixed_right_first) {
                    $th.addClass('advanced_dynamic_fixed_right_first')
                }
            }
            column.$el = $th;
            return $th;
        },

        _getNumberOfCols: function () {
            return this._getColumnCount();
        },

        /**
         * @returns 
         */
        _renderMainTableBody: function () {
            let self = this;
            let $rows = this._renderRows();
            let $body = $('<tbody>').append($rows);
            // the sorter problem
            if (this.hasHandle) {
                $body.sortable({
                    axis: 'y',
                    items: '> tr.o_data_row',
                    helper: 'clone',
                    handle: '.o_row_handle',
                    cursor: "grabbing",
                    stop: function (event, ui) {
                        // update currentID taking moved line into account
                        if (self.currentRow !== null) {
                            var currentID = self.state.data[self.currentRow].id;
                            self.currentRow = self._getRow(currentID).index();
                        }
                        self.unselectRow().then(function () {
                            self._moveRecord(ui.item.data('id'), ui.item.index());
                        });
                    }
                });
            }
            return $body;
        },

        _scrollPatch: function () {
            var scollWidth = this.$table_body.width() - this.$table_body.prop('clientWidth')
            var scollHeight = this.$table_body.height() - this.$table_body.prop('clientHeight')
            if (scollWidth > 0 && scollHeight > 0) {
                const body_table = this.body_table;
                const table_body = this.table_body;

                // check realy need patch
                var scollWidth = this.$table_body.width() - this.$table_body.prop('clientWidth')
                var scrollBarWidth = this.getScrollBarWidth();
                if (scollWidth == scrollBarWidth && body_table.offsetWidth == table_body.offsetWidth) {
                    this.hasScrollPatch = false;
                    this._syncTableWidth();
                    return;
                }

                this.hasScrollPatch = true;
                // header
                var header_patch = this.$table_header.find('.advanced_dynamic_list_patch')
                if (!header_patch.length) {
                    var $patch = $('<div class="advanced_dynamic_list_patch advanced_dynamic_fixed_right"><div class="patch_inner" /></div>');
                    $patch.find('.patch_inner').css('width', scollWidth + 'px');
                    this.$table_header.append($patch);
                }
                // footer
                var footer_patch = this.$table_footer.find('.advanced_dynamic_list_patch')
                if (!footer_patch.length) {
                    var $patch = $('<div class="advanced_dynamic_list_patch advanced_dynamic_fixed_right"><div class="patch_inner" /></div>');
                    $patch.find('.patch_inner').css('width', scollWidth + 'px');
                    this.$table_footer.append($patch);
                    var $tdColone = $patch.clone();
                    this.$table_footer.find('.footer_scroller').append($tdColone);
                }
            } else {
                this.hasScrollPatch = false;
                var header_patch = this.$header_table.find('.advanced_dynamic_list_patch')
                $(header_patch).remove();
                var footer_patch = this.$footer_table.find('.advanced_dynamic_list_patch')
                $(footer_patch).remove();
            }
            // update right fixed position        
            this._syncTableWidth();
            // as we maybe change the width  of the table
            this._updateAllFixedPositions();
        },

        /**
         * process column group
         * @param {*} columns 
         * @param {*} group 
         */
        _processColumnGroup: function () {
            for (let i = 0; i < this.columns.length; i++) {
                let column = this.columns[i];
                let parent_path = column.parent || undefined;
                if (parent_path && typeof ('parent_path') == 'string') {
                    // split by '.'
                    let parent_parts = parent_path.split('.');
                    let cur = column;
                    // set the parent
                    while (parent_parts.length > 0) {
                        // get last part, parent. grandparent, etc.
                        let parent_part = parent_parts.shift();
                        cur.parent = {
                            name: parent_part,
                            fixed_left: cur.fixed_left,
                            fixed_right: cur.fixed_right,
                            parent: undefined,
                        }
                        cur = cur.parent
                    }
                }
            }
        },

        _processColumns: function (columnInvisibleFields) {

            if (!this.enableadvanced_dynamicList) {
                return this._super.apply(this, arguments);
            }

            var self = this;

            this.handleField = null;
            this.columns = [];
            this.optionalColumns = [];
            this.optionalColumnsEnabled = [];
            this.hidden_fields = [];
            this.invisible_fields = [];

            // delete column that not in cache
            let user_fields = this.advanced_dynamic_user_data && this.advanced_dynamic_user_data.user_fields || [];
            let user_field_cache = {};
            _.each(user_fields, (field) => {
                user_field_cache[field.name] = field;
                if (!field.visible) {
                    let name = field.name;
                    this.hidden_fields[name] = field
                }
            });

            _.each(this.arch.children, function (column) {
                let user_field = user_field_cache[column.attrs.name];
                // add column options
                if (column.attrs.options) {
                    column.options = column.attrs.options ? pyUtils.py_eval(column.attrs.options) : {};
                    column.fixed_left = user_field ? user_field.fixed_left : column.options.fixed_left || false;
                    column.fixed_right = user_field ? user_field.fixed_right : column.options.fixed_right || false;
                } else {
                    column.options = {}
                    column.fixed_left = false
                    column.fixed_right = false
                }

                if (column.tag !== 'control'
                    && column.tag !== 'groupby'
                    && column.tag !== 'header') {
                    var reject = column.attrs.modifiers.column_invisible;
                    if (column.tag === "button_group") {
                        reject = column.children.every(child => columnInvisibleFields[child.attrs.name]);
                    } else if (column.attrs.name in columnInvisibleFields) {
                        reject = columnInvisibleFields[column.attrs.name];
                    }

                    // do not show handle field when grouped
                    if (!reject
                        && column.attrs.widget === 'handle') {
                        self.handleField = column.attrs.name;
                        if (self.isGrouped) {
                            reject = true;
                        }
                    }

                    if (user_fields.length > 0) {
                        if (!user_field) {
                            reject = true;
                        } else if (!user_field.visible) {
                            reject = true;
                            self.hidden_fields[column.attrs.name] = column;
                        } else {
                            let modifiers = column.attrs.modifiers;
                            if (modifiers && user_field.visible) {
                                modifiers.column_invisible = false;
                                reject = false;
                            }
                        }
                    }

                    // string will use in column configer
                    let name = column.name || column.attrs.name;
                    let field = self.state.fields[name];

                    column.string = field && field.string;
                    column.attrs.string = column.string;

                    if (!reject) {
                        self.columns.push(column);
                    } else if (column.attrs.modifiers.column_invisible) {
                        self.hidden_fields[column.attrs.name] = column;
                    }

                    // put in the invisible list
                    if (reject && !self.hidden_fields[column.attrs.name]) {
                        self.invisible_fields[column.attrs.name] = column;
                    }
                }
            });

            // deal user fields
            if (user_fields.length > 0) {

                // delete form columns which not in cache
                this.columns = _.filter(this.columns, function (column) {
                    let user_field = user_field_cache[column.attrs.name];
                    if (user_field) {
                        // force to show the column
                        let modifiers = column.attrs.modifiers;
                        if (modifiers
                            && modifiers.column_invisible
                            && !user_field.invisible) {
                            // remove from hide list
                            delete self.hidden_fields[column.attrs.name];
                            modifiers.column_invisible = false;
                        }
                        // if not visible
                        if (!user_field.visible) {
                            return false;
                        }
                        return true;
                    }
                    return false;
                });

                // deal the user add fields
                let arch_columns = {};
                _.each(this.columns, function (column) {
                    arch_columns[column.attrs.name] = column
                });

                // add column that not in columns
                _.each(user_fields, function (field) {
                    if (!(field.name in arch_columns)) {

                        let readOnly = false;
                        if (field.name in MAGIC_FIELDS) {
                            readOnly = true;
                        }

                        // check name is valid
                        if (!self.state.fields[field.name]) {
                            return;
                        }

                        // ignore the ivisible field
                        if (!field.visible) {
                            return;
                        }

                        self.columns.push({
                            tag: 'field',
                            attrs: {
                                name: field.name,
                                string: field.string,
                                modifiers: {
                                    readonly: readOnly,
                                },
                            },
                            string: field.string,
                            parent: field.parent,
                            order: field.order,
                            fixed_left: field.fixed_left,
                            fixed_right: field.fixed_right,
                            with: field.width,
                        });
                    } else {
                        let column = arch_columns[field.name];
                        column.order = field.order;
                        column.fixed_left = field.fixed_left;
                        column.fixed_right = field.fixed_right;
                        column.parent = field.parent;
                        column.string = field.string;
                        if (field.width) {
                            column.attrs.width = field.width;
                            column.width = field.width;
                        } else {
                            delete column.attrs.width;
                            delete column.width;
                        }
                        if (column.attrs) {
                            column.attrs.string = field.string;
                        }
                    }
                });
            }

            // sort the columns by fixed_left and fixed right and order and index
            this.columns.sort(function (a, b) {
                if (a.fixed_left && !b.fixed_left) {
                    return -1;
                } else if (!a.fixed_left && b.fixed_left) {
                    return 1;
                } else if (a.fixed_right && !b.fixed_right) {
                    return 1;
                } else if (!a.fixed_right && b.fixed_right) {
                    return -1;
                } else if (a.order && !b.order) {
                    return -1;
                } else if (!a.order && b.order) {
                    return 1;
                } else if (a.order && b.order) {
                    if (a.order != b.order) {
                        return a.order - b.order;
                    } else {
                        return a.index - b.index;
                    }
                } else {
                    return a.index - b.index;
                }
            });

            // add extra property
            _.each(this.columns, function (column, index) {
                // update the index
                column.index = index;

                if (column.fixed_left) {
                    self.hasFixedLeftColumn = true;
                    if (self._fixedLeftLast(column.index)) {
                        column.fixed_left_last = true;
                    }
                }

                if (column.fixed_right) {
                    self.hasFixedRightColumn = true;
                    if (self._fixedRightFirst(column.index)) {
                        column.fixed_right_first = true;
                    }
                }
            })

            // deal the group
            this._processColumnGroup();
        },

        // _onSortColumn: function () {
        //     if (this.currentRow === null && !this.isResizing) {
        //         this._super.apply(this, arguments);
        //     }
        // },

        /**
         * render search row
         */
        _render_search_row: function () {
            var fragment = document.createDocumentFragment();
            var $panel = qweb.render('advanced_dynamic_lsit_manager.search_row', {
                widget: this,
            });
            $panel.appendTo(fragment);
            return fragment;
        },

        _get_auto_compelte_data: function (field, field_type, search_val, relation) {
            return this._rpc({
                model: 'user.mode',
                method: 'get_auto_complete_data',
                args: [this.state.model, field, field_type, search_val, relation]
            })
        },

        _get_leaf_columns(column, leaf_cloumns) {
            if (column.children.length == 1) {
                leaf_cloumns.push(column.children[0])
                return
            }
            for (var i = 0; i < column.children.length; i++) {
                let child = column.children[i]
                get_leaf_columns(child, leaf_cloumns)
            }
        },

        _get_column_tree: function () {
            let cur_columns = [];
            for (var i = 0; i < this.columns.length; i++) {
                let column = this.columns[i]
                cur_columns.push({
                    name: this.columns[i].attrs.name,
                    children: [column],
                    parent: column.parent || null,
                    leaf_columns: 0,
                    span: 0
                })
            }

            /**
             * check need to check parent
             */
            function check_has_parent() {
                for (var i = 0; i < cur_columns.length; i++) {
                    let column = cur_columns[i]
                    if (column.parent) {
                        return true
                    }
                }
                return false
            }

            while (check_has_parent()) {
                let tmp_columns = {}
                for (let i = 0; i < cur_columns.length; i++) {
                    let tmp_column = cur_columns[i]
                    if (tmp_column.parent) {
                        let parent_name = tmp_column.parent.name
                        if (tmp_columns[parent_name]) {
                            let parent_column = tmp_columns[parent_name]
                            let parent_children = parent_column.children
                            parent_children.push(tmp_column)
                        } else {
                            tmp_columns[tmp_column.parent.name] = {
                                name: parent_name,
                                children: [tmp_column],
                                parent: tmp_column.parent
                            }
                        }
                    } else {
                        tmp_columns[tmp_column.name] = {
                            name: tmp_column.name,
                            children: [tmp_column],
                            parent: null
                        }
                    }
                }
                cur_columns = tmp_columns_values
            }

            return cur_columns
        },

        _getTopColumns: function () {
            let optionalColumnsEnabled = this.optionalColumnsEnabled;
            let columns = this.columns;
            let all_columns = optionalColumnsEnabled.concat(columns);
            // generate tree
            let top_columns = this._get_column_tree(all_columns);
            this.top_columns = top_columns;
            return top_columns;
        },

        _initRowInfos() {
            this.rowInfos = this.state.data.map((item, index) => ({
                index: index,
                dataIndex: index,
                serial: index + 1,
                key: item.id,
                rowKey: item['id'],
                isExpandRow: false,
                defaultExpandHeight: this.defaultExpandHeight,
                nodeExpanded: true,
                virtualHide: false,
            }));
            // cache the item 
            this.rowInfoCache = {}
            for (var i = 0; i < this.rowInfos.length; i++) {
                var rowInfo = this.rowInfos[i];
                this.rowInfoCache[rowInfo.rowKey] = rowInfo;
            }
        },

        // scroll bar width
        getScrollBarWidth() {
            let result = 0;
            const { scrollBarWidth } = this;

            // use the cached scrollbar width
            if (scrollBarWidth) {
                result = scrollBarWidth;
            } else {
                result = advanced_dynamicGetScrollbarWidth();
                this.scrollBarWidth = result;
            }

            return result;
        },

        _checkAllChecked: function () {
            let datas = this.state.data;
            let res_ids = _.pluck(datas, 'id');
            let all_checked = _.every(res_ids, id => this.selection.indexOf(id) > -1);
            return all_checked;
        },

        _onSelectRecord: function (ev) {
            ev.stopPropagation();

            let $target = $(ev.target);
            let row = $target.closest('.o_data_row');
            let id = row.data('id');
            const previousSelection = JSON.stringify(this.selection);
            if ($target.prop('checked')) {
                this.selection.push(id);
            } else {
                this.selection = _.without(this.selection, id);
            }
            let allChecked = this._checkAllChecked();
            this.$('.advanced_dynamic_table_header table .o_list_record_selector input[type="checkbox"]').prop(
                'checked', allChecked);
            if (JSON.stringify(this.selection) !== previousSelection) {
                this.trigger_up('selection_changed', { allChecked, selection: this.selection });
            }
        },

        _onToggleSelection: function (ev) {
            const checked = $(ev.currentTarget).prop('checked') || false;
            this.$('tbody .o_list_record_selector input:not(":disabled")').prop('checked', checked);
            const previousSelection = JSON.stringify(this.selection);
            if (checked) {
                this.selection = _.pluck(this.state.data, 'id');
            } else {
                this.selection = [];
            }
            let allChecked = this._checkAllChecked();
            if (JSON.stringify(this.selection) !== previousSelection) {
                this.trigger_up('selection_changed', { allChecked, selection: this.selection });
            }
        },

        /**
         * toggle optional dropdown
         * @param {*} ev 
         */
        _onToggleOptionalColumnDropdown: function (ev) {
            if (!this.enableadvanced_dynamicList) {
                return this._super.apply(this, arguments);
            } else {
                ev.stopPropagation();
                ev.preventDefault();

                let header_arch = _.clone(this.header_arch[0]);
                let cols = this.$header_table.find('colgroup col');
                let raw_cols = this._getRawCols(header_arch);
                let pre_count = this._getPreCellCount();

                for (let i = 0; i < cols.length; i++) {
                    if (i < pre_count) {
                        continue;
                    }
                    if (i > raw_cols.length - 1) {
                        break;
                    }
                    let col = cols[i];
                    let width = col.style.width;
                    let tmp_raw_col = raw_cols[i - pre_count];
                    tmp_raw_col.current_width = width;
                    let parent_column = raw_cols[i - pre_count].parent_column;
                    while (parent_column
                        && parent_column.children
                        && parent_column.children.length == 1) {
                        parent_column.current_width = width;
                        parent_column = parent_column.parent_column;
                    }
                }
                this.configPanel.ensureDelayItems(
                    header_arch,
                    this.state.fields,
                    // get the values
                    _.values(this.hidden_fields),
                    _.values(this.invisible_fields),
                    this.advanced_dynamic_user_data
                );
                this.configPanel.show();
            }
        },

        _getRawCols: function (header_arch) {
            var raw_cols = [];

            var get_col = function (col) {
                if (!col.children || !col.children.length) {
                    raw_cols.push(col);
                } else {
                    _.each(col.children, function (child) {
                        get_col(child);
                    });
                }
            }

            for (var i = 0; i < header_arch.length; i++) {
                get_col(header_arch[i]);
            }

            return raw_cols;
        },

        _postUpdateUserData: function (event) {

            let data = event.data;
            let oldEnableadvanced_dynamicList = this.enableadvanced_dynamicList;

            // update the options
            this._updateOptions();

            // update custom user field decoration
            this._updateDecorations(this.advanced_dynamic_user_data);

            // setting the loading flag to avoid unnecessary rendering
            this.isLoading = true;

            // need optimization, need remove the listeners
            if (this.enableadvanced_dynamicList != oldEnableadvanced_dynamicList) {
                // clear the layout
                if (this.$layout) {
                    this.$layout = undefined;
                    if (this.configPanel) {
                        this.configPanel.destroy();
                        this.configPanel = null;
                    }
                }
            }

            // remove the content
            if (!oldEnableadvanced_dynamicList) {
                this.$el.empty();
            }

            if (!this.isX2ManyRender) {
                let controller = this.getParent();

                let model = controller.model;
                model.updateUserData(this.advanced_dynamic_user_data, controller.handle);

                this._processColumns({});

                // this will call the row infos
                if (!this.enableadvanced_dynamicList) {
                    this._renderView();
                }

                // must after the layout inited
                if (this.enableadvanced_dynamicList
                    && !oldEnableadvanced_dynamicList) {
                    // init the row infos
                    this._initRowInfos();
                    // renderview to avoid flicker
                    this._renderView();
                    // force the height to zero to bind the listeners
                    this.tableOffestHeight = 0;
                    this.bodyTableWidth = 0;
                    this._doPostStartInit();
                    // bind scroll container scroll
                    this.$table_body.on('scroll', this._onTableBodyScroll.bind(this));
                    // sync the header, mybe the scroll in not at start position
                    this._onTableBodyScroll();
                }
            } else {
                let x2mField = this.getParent();
                let formRender = x2mField.getParent();
                let formController = formRender.getParent();
                let formModel = formController.model;

                let tmp_field = _.clone(x2mField.field)
                tmp_field.name = x2mField.name

                formModel.updateX2ManyUserData(
                    formController.handle, data.fields, tmp_field, this.advanced_dynamic_user_data);

                // update data on render
                this.trigger_up("advanced_dynamic_update_x2many_user_data", {
                    field: x2mField.field,
                    advanced_dynamic_user_data: this.advanced_dynamic_user_data,
                });
            }

            // set the table_body scroll to 0
            if (this.$table_body) {
                this.$table_body.scrollLeft(0);
            }

            // force the table width to avoid flick, do not remove this
            if (!this.isX2ManyRender && this.enableadvanced_dynamicList) {
                this.updateColumnWidth();
                this._syncTableWidth();
            }

            // clear cache
            core.bus.trigger('clear_cache');

            // reload the list data, this will cause the x2manyfield to rerender
            this.trigger_up("reload");
        },

        /**
         * update the user setting, as some of the data are collect here, 
         * so we trigger up the message to this class
         * @param {*} event 
         */
        _onUpdateUserSettings: function (event) {

            let data = event.data;
            let columns = data.columns;
            let settings = data.settings;

            let userData = this._getUserData();
            userData = _.extend(userData, settings, {
                user_fields: columns
            });

            this._rpc({
                "model": "advanced_dynamic_list.user_data",
                "method": "update_user_data",
                "args": [userData],
            }).then((advanced_dynamic_user_data) => {
                this.advanced_dynamic_user_data = advanced_dynamic_user_data;
                this._postUpdateUserData(event);
            })
        },

        enableListManager: function () {
            let userData = this._getUserData();
            this._rpc({
                "model": "advanced_dynamic_list.user_data",
                "method": "enableListManager",
                "args": [userData],
            }).then((advanced_dynamic_user_data) => {
                this.advanced_dynamic_user_data = advanced_dynamic_user_data;
                if (this.isX2ManyRender) {
                    let model = this.state.model;
                    return this._rpc({
                        "model": model,
                        "method": "fields_get",
                        "args": []
                    }).then((fields) => {
                        // the field maybe do not has the name in odoo14
                        for (let key in fields) {
                            let field = fields[key];
                            field.name = key;
                        }
                        // need the fields to update the fields info
                        this._postUpdateUserData({
                            data: {
                                fields: fields
                            }
                        });
                    })
                } else {
                    this._postUpdateUserData({
                        data: {
                            fields: this.state.fields
                        }
                    });
                }
            })
        },

        /**
         * post udpate user data
         * @param {*} event 
         */
        _onResetSettings: function (event) {
            let self = this;
            let user_data = this._getUserData();
            this._rpc({
                "model": "advanced_dynamic_list.user_data",
                "method": "reset_user_settings",
                "args": [user_data]
            }).then(function (advanced_dynamic_user_data) {
                // update the advanced_dynamic user data
                self.advanced_dynamic_user_data = advanced_dynamic_user_data;

                // clear to rerender the header
                if (self.$header_table) {
                    self.$header_table.empty();
                }

                self._postUpdateUserData(event);
            })
        },

        /**
         * rewrite to change the default behavor.
         * @private
         * @param {Object} column
         * @returns {HTMLElement}
         */
        _getColumnHeader: function (column) {
            if (!this.enableadvanced_dynamicList) {
                return this._super.apply(this, arguments);
            } else {
                const { icon, name, string } = column.attrs;
                // change the header table
                var header_table = this.body_table;
                if (name) {
                    return header_table.querySelector(`thead th[data-name="${name}"]`);
                } else if (string) {
                    return header_table.querySelector(`thead th[data-string="${string}"]`);
                } else if (icon) {
                    return header_table.querySelector(`thead th[data-icon="${icon}"]`);
                }
            }
        },

        _renderAggregateCells: function (aggregateValues) {
            var self = this;
            var $cells = this._super.apply(this, arguments);
            if (this.enableadvanced_dynamicList) {
                _.each(this.columns, function (column, index) {
                    var $cell = $($cells[index]);
                    if (column.fixed_left) {
                        $cell.addClass('advanced_dynamic_fixed_left');
                        if (self._fixedLeftLast(index)) {
                            $cell.addClass('advanced_dynamic_fixed_left_last');
                        }
                    } else if (column.fixed_right) {
                        $cell.addClass('advanced_dynamic_fixed_right');
                        if (self._fixedRightFirst(index)) {
                            $cell.addClass('advanced_dynamic_fixed_right_first');
                        }
                    }
                });
            }
            return $cells;
        },

        async updateState(state, params) {

            if (!this.enableadvanced_dynamicList) {
                return this._super.apply(this, arguments);
            }

            if (this.isLoading) {
                this.isLoading = false;
                if (this.$header_table) {
                    this.$header_table.empty();
                }

                if (this.$table_body) {
                    this.$body_table.empty();
                }
            }

            let isGrouped = state && state.groupedBy.length > 0;
            if (!isGrouped) {
                this._setState(state);

                // this state must set before init row infos
                this.isGrouped = this.state.groupedBy.length > 0;

                // init the positions of ervery row
                this._initRowInfos();

                // set this flag to render the header
                //this.isLoading = false;
                return this._super(state, params).then(() => {
                    this._scrollPatch();
                    this.updateColumnWidth();
                    this._syncTableWidth();
                    // update fixed positions
                    this._updateAllFixedPositions();
                });
            } else {
                // hide the 
                this.$page_simulator.hide();
                this.isGrouped = this.state.groupedBy.length > 0;

                // init the positions of ervery row
                return this._super(state, params).then(() => {
                    this._scrollPatch();
                    this.updateColumnWidth();
                    this._syncTableWidth();
                    // update fixed positions
                    this._updateAllFixedPositions();
                });
            }
        },

        _storeColumnWidths: function () {
            if (!this.enableadvanced_dynamicList) {
                return this._super.apply(this, arguments);
            } else {
                this.columnWidths = this.$('thead colgroup col').toArray().map(function (col) {
                    return col.style.width
                });
            }
        },

        /**
         * When the user clicks on a cell, we simply select it.
         * @private
         * @param {MouseEvent} event
         */
        _onCellClick: function (event) {

            if (!this.enableadvanced_dynamicList) {
                return this._super.apply(this, arguments);
            }

            if (this.forceReadonly) {
                event.stopPropagation();
                event.preventDefault();
                let tr = $(event.currentTarget).closest('tr');
                // add the advanced_dynamic_selected row
                tr.addClass('advanced_dynamic_selected');
                // find the selector checkbox
                let checkbox = tr.find('input[type="checkbox"].o_list_record_selector');
                // check the checkbox
                checkbox.prop('checked', true);
            } else {
                this._super.apply(this, arguments);
            }
        },

        /**
         * get record id
         * @param {*} rowIndex 
         * @returns 
         */
        _getRecordID: function (rowIndex) {
            if (!this.enableadvanced_dynamicList) {
                return this._super.apply(this, arguments);
            } else {
                // convert to id
                var $tr = this.$('.advanced_dynamic_body_table > tbody > tr').eq(rowIndex);
                return $tr.data('id');
            }
        },

        _freezeColumnWidths: function () {
            // as the frreez column width is not good, so we replace it with the new one to avoid 
            // the width of the table is not correct
            if (!this.enableadvanced_dynamicList) {
                return this._super.apply(this, arguments);
            }
        },

        _save_arch: function (event) {
            let data = event.data;
            let columns = data.columns;
            let settings = data.settings;

            let userData = this._getUserData();
            userData = _.extend(userData, settings, {
                user_fields: columns
            });

            this._rpc({
                "model": "advanced_dynamic_list.user_data",
                "method": "update_user_data",
                "args": [userData],
            }).then((advanced_dynamic_user_data) => {
                this.advanced_dynamic_user_data = advanced_dynamic_user_data;
                this._postUpdateUserData(event);
            })
        },

        _getHeaderRawCells: function () {
            const trs = [...this.el.querySelectorAll('.advanced_dynamic_header_table tr')];
            if (trs.length === 1) {
                return [...trs[0].querySelectorAll('th')];
            }

            let rows = []
            for (let i = 0; i < trs.length; i++) {
                let tmp_tr = trs[i];
                let tmp_tr_cells = [...tmp_tr.querySelectorAll('th')];
                rows.push(tmp_tr_cells);
            }

            // revert rows
            for (let i = 0; i < rows.length; i++) {
                let cells = rows[i];
                for (let j = 0; j < cells.length; j++) {
                    let tmp_cell = cells[j];
                    let rows_span = parseInt(tmp_cell.getAttribute('rowspan'));
                    if (!rows_span || rows_span <= 1) {
                        continue;
                    }
                    // begin from 1
                    for (let m = 1; m < rows_span && i + m < rows.length; m++) {
                        let next_row_cells = rows[i + m];
                        // insert the cell
                        let new_cell = tmp_cell.cloneNode(false)
                        // set the rowspan to 1
                        new_cell.setAttribute('rowspan', 1);
                        next_row_cells.splice(j, 0, new_cell);
                    }
                }
            }
            // return the last
            return rows[rows.length - 1];
        },

        /**
         * rewrite to change the body check
         * @param {*} event 
         * @returns 
         */
        _onWindowClicked: function (event) {

            if (!this.enableadvanced_dynamicList) {
                return this._super.apply(this, arguments);
            }

            // ignore clicks on readonly lists with no selected rows
            if (!this.isEditable()) {
                return;
            }

            // ignore clicks if this renderer is not in the dom.
            if (!document.contains(this.el)) {
                return;
            }

            // there is currently no selected row
            if (this.currentRow === null) {
                return;
            }

            // ignore clicks in autocomplete dropdowns
            if ($(event.target).closest('.ui-autocomplete').length) {
                return;
            }

            // ignore clicks if there is a modal, except if the list is in the last
            // (active) modal
            const $modal = $('.modal[role="dialog"]:last');
            if ($modal.length) {
                var $listModal = this.$el.closest('.modal');
                if ($modal.prop('id') !== $listModal.prop('id')) {
                    return;
                }
            }

            // ignore clicks if target is no longer in dom.  For example, a click on
            // the 'delete' trash icon of a m2m tag.
            if (!document.contains(event.target)) {
                return;
            }

            // ignore clicks if target is inside the list. In that case, they are
            // handled directly by the renderer.
            if (this.$table_body.get(0).contains(event.target)
                && this.$table_body.get(0) !== event.target) {
                return;
            }

            // ignore click if search facet is removed as it will re-render whole
            // listview again
            if ($(event.target).hasClass('o_facet_remove')) {
                return;
            }
            this.unselectRow({
                canDiscard: ![...event.target.classList].includes('o_list_button_save')
            });
        },

        /**
         * need over write this function ?
         * @returns 
         */
        // _onSortColumn: function () {
        //     if (!this.enableadvanced_dynamicList) {
        //         return this._super.apply(this, arguments);
        //     }
        //     if (this.currentRow === null
        //         && !this.isResizing) {
        //         this._super.apply(this, arguments);
        //     }
        // },

        /**
         * fixed the precell count
         * @param {*} group 
         * @param {*} groupLevel 
         * @returns 
         */
        _renderGroupRow: function (group, groupLevel) {
            if (!this.enableadvanced_dynamicList) {
                return this._super.apply(this, arguments);
            }
            let $tr = this._super.apply(this, arguments);
            let $firstTh = $tr.find('th:first');
            let colSpan = parseInt($firstTh.attr('colspan'));
            let preCellCount = this._getPreCellCount();
            colSpan += preCellCount - 1;
            $firstTh.attr('colspan', colSpan);
            return $tr;
        },


        _onStartResize: function (ev) {

            if (!this.enableadvanced_dynamicList) {
                return this._super.apply(this, arguments);
            }

            // Only triggered by left mouse button
            if (ev.which !== 1) {
                return;
            }

            ev.preventDefault();
            ev.stopPropagation();

            this.isResizing = true;

            const headerTable = this.header_table;
            const bodyTable = this.body_table;
            const footerTable = this.footer_table;

            // as we change the header, so we need to 
            const th = ev.target.closest('th');
            const $th = $(th);
            let index = $th.data('col-index');
            // add the colspan to the index
            let colspan = parseInt(th.getAttribute('colspan'));
            if (colspan) {
                index += colspan - 1;
            }

            const cols = this.header_table.querySelectorAll('colgroup col');
            const col = cols[index];
            const bodyCols = this.body_table.querySelectorAll('colgroup col');
            const bodyCol = bodyCols[index];
            const footerCols = this.footer_table.querySelectorAll('colgroup col');
            const footerCol = footerCols[index];

            headerTable.style.width = `${headerTable.offsetWidth}px`;
            bodyTable.style.width = `${bodyTable.offsetWidth}px`;

            const thPosition = [...th.parentNode.children].indexOf(th);
            const resizingColumnElements = [...headerTable.getElementsByTagName('tr')]
                .filter(tr => tr.children.length === th.parentNode.children.length)
                .map(tr => tr.children[thPosition]);

            const initialX = ev.pageX;
            //const initialWidth = th.offsetWidth;
            const initialWidth = col.offsetWidth;
            const initialTableWidth = headerTable.offsetWidth;

            const resizeStoppingEvents = [
                'keydown',
                'mousedown',
                'mouseup',
            ];

            // Apply classes to table and selected column
            headerTable.classList.add('o_resizing');
            resizingColumnElements.forEach(el => el.classList.add('o_column_resizing'));

            // Mousemove event : resize header
            const resizeHeader = ev => {
                ev.preventDefault();
                ev.stopPropagation();

                const delta = ev.pageX - initialX;
                const newWidth = Math.max(10, initialWidth + delta);
                const tableDelta = newWidth - initialWidth;

                // change the table width
                headerTable.style.width = `${initialTableWidth + tableDelta}px`;
                bodyTable.style.width = `${initialTableWidth + tableDelta}px`;
                footerTable.style.width = `${initialTableWidth + tableDelta}px`;

                col.style.width = `${newWidth}px`;
                col.attributes.width.value = `${newWidth}px`;
                bodyCol.style.width = `${newWidth}px`;
                bodyCol.attributes.width.value = `${newWidth}px`;
                footerCol.style.width = `${newWidth}px`;
                footerCol.attributes.width.value = `${newWidth}px`;

                // check if we need to update the fixed positions
                if ($th.hasClass('advanced_dynamic_fixed_left') || $th.hasClass('advanced_dynamic_fixed_right')) {
                    this._updateAllFixedPositions();
                }
            };
            this._addEventListener('mousemove', window, resizeHeader);

            // Mouse or keyboard events : stop resize
            const stopResize = ev => {
                // Ignores the initial 'left mouse button down' event in order
                // to not instantly remove the listener
                if (ev.type === 'mousedown' && ev.which === 1) {
                    return;
                }
                ev.preventDefault();
                ev.stopPropagation();
                // We need a small timeout to not trigger a click on column header
                clearTimeout(this.resizeTimeout);
                this.resizeTimeout = setTimeout(() => {
                    this.isResizing = false;
                    // save the column width
                }, 100);
                window.removeEventListener('mousemove', resizeHeader);
                headerTable.classList.remove('o_resizing');
                resizingColumnElements.forEach(el => el.classList.remove('o_column_resizing'));
                resizeStoppingEvents.forEach(stoppingEvent => {
                    window.removeEventListener(stoppingEvent, stopResize);
                });
                document.activeElement.blur();
            };

            resizeStoppingEvents.forEach(stoppingEvent => {
                this._addEventListener(stoppingEvent, window, stopResize);
            });
        },

        _squeezeTable: function () {

            if (!this.enableadvanced_dynamicList) {
                return this._super.apply(this, arguments);
            }

            const table = this.el.querySelectorAll('.advanced_dynamic_table_body table')[0];
            table.classList.add('o_list_computing_widths');

            const thead = table.getElementsByTagName('thead')[0];
            const thElements = [...thead.querySelectorAll('.advanced_dynamic_raw_header th')];
            const columnWidths = thElements.map(th => th.offsetWidth);

            const getWidth = th => columnWidths[thElements.indexOf(th)] || 0;
            const getTotalWidth = () => thElements.reduce((tot, th, i) => tot + columnWidths[i], 0);
            const shrinkColumns = (columns, width) => {
                let thresholdReached = false;
                columns.forEach(th => {
                    const index = thElements.indexOf(th);
                    let maxWidth = columnWidths[index] - Math.ceil(width / columns.length);
                    // prevent the columns from shrinking under 92px (~ date field)
                    if (maxWidth < 92) {
                        maxWidth = 92;
                        thresholdReached = true;
                    }
                    th.style.maxWidth = `${maxWidth}px`;
                    columnWidths[index] = maxWidth;
                });
                return thresholdReached;
            };
            // Sort columns, largest first
            let ths = [...thead.querySelectorAll('.advanced_dynamic_raw_header th:not(.o_list_button)')]

            const sortedThs = ths.sort((a, b) => getWidth(b) - getWidth(a));
            const allowedWidth = table.parentNode.parentNode.offsetWidth;

            let totalWidth = getTotalWidth();
            let stop = false;
            let index = 0;
            while (totalWidth > allowedWidth && !stop) {
                // Find the largest columns
                index++;
                const largests = sortedThs.slice(0, index);
                while (getWidth(largests[0]) === getWidth(sortedThs[index])) {
                    largests.push(sortedThs[index]);
                    index++;
                }

                // Compute the number of px to remove from the largest columns
                const nextLargest = sortedThs[index]; // largest column when omitting those in largests
                const totalToRemove = totalWidth - allowedWidth;
                const canRemove = (getWidth(largests[0]) - getWidth(nextLargest)) * largests.length;

                // Shrink the largests columns
                stop = shrinkColumns(largests, Math.min(totalToRemove, canRemove));
                totalWidth = getTotalWidth();
            }

            // We are no longer computing widths, so restore the normal style
            table.classList.remove('o_list_computing_widths');
            return columnWidths;
        },

        /**
         * as we change the header to support groups, we need to deal this
         * @param {*} ev 
         */
        _onSortColumn: function (ev) {

            if (!this.enableadvanced_dynamicList) {
                return this._super.apply(this, arguments);
            }

            if (this.currentRow != null || this.isResizing) {
                return;
            }

            let $target = $(ev.currentTarget);
            let $tr = $target.closest('tr');
            let rowIndex = $tr.index();
            let $table = $tr.closest('table');
            let $trs = $table.find('tr');
            let colSpan = parseInt($target.attr('colspan'));
            if (colSpan > 1) {
                return;
            }
            let rowSpan = parseInt($target.attr('rowspan'));
            let totalRow = $trs.length;
            if (this.showSearchRow) {
                totalRow -= 1;
            }
            if (rowSpan > 1 && rowIndex + rowSpan != totalRow) {
                return;
            }

            var name = $(ev.currentTarget).data('name');
            var fields = this.state.fields;
            if (!fields[name]) {
                return;
            }

            let field = fields[name];
            let sortable = field.sortable || false
            if (this.state.fieldsInfo.list[name]
                && this.state.fieldsInfo.list[name].options.allow_order
                && this.state.fieldsInfo.list[name].options) {
                sortable = true;
            }

            if (!sortable) {
                return;
            }

            var order = this.state.orderedBy;
            var isNodeSorted = order[0] && order[0].name === name;
            var isAsc = isNodeSorted && order[0].asc;

            // remove the asc/desc icon
            $tr.find('.o-sort-down').removeClass('o-sort-down');
            $tr.find('.o-sort-up').removeClass('o-sort-up');

            if (!isAsc) {
                $target.addClass('o-sort-down');
            } else {
                $target.addClass('o-sort-up');
            }

            this.trigger_up('toggle_column_order', { id: this.state.id, name: name });
        }
    }

    if (advanced_dynamicListMode == 'global') {
        ListRenderer.include(advanced_dynamicListRender);
    } else {
        advanced_dynamicListRender = ListRenderer.extend(advanced_dynamicListRender);
        return advanced_dynamicListRender;
    }
});
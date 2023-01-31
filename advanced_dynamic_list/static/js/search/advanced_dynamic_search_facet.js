odoo.define('advanced_dynamic_list.search_facet', function (require) {
    "use strict";

    var core = require('web.core');
    var Widget = require('web.Widget');

    var _t = core._t;

    var SearchFacet = Widget.extend({
        template: 'advanced_dynamic_list.search_facet',
        events: _.extend({}, Widget.prototype.events, {
            'click .o_facet_remove': '_onFacetRemove',
            'compositionend': '_onCompositionend',
            'compositionstart': '_onCompositionstart',
            'keydown': '_onKeydown',
        }),

        /**
         * @override
         * @param {Object} facet
         */
        init: function (parent, facet) {
            this._super.apply(this, arguments);

            this.facet = facet;
            this.facetValues =[this._getFilterDescription(facet.filter)]
            this.separator = this._getSeparator();
            this.icon = this._getIcon();
            this._isComposing = false;
        },

        get_domain: function () {
            return this.facet.filter.domain;
        },

        /**
         * Get the correct description according to filter.
         *
         * @private
         * @returns {string}
         */
        _getFilterDescription: function (filter) {
            var values = _.pluck(filter.autoCompleteValues, 'label');
            return values.join(_t(' or '));
        },

        /**
         * Get the correct icon according to facet type.
         *
         * @private
         * @returns {string}
         */
        _getIcon: function () {
            return 'fa-filter';
        },

        /**
         * Get the correct separator according to facet type.
         * @private
         * @returns {string}
         */
        _getSeparator: function () {
            var separator = _t('or');
            return separator;
        },

        /**
         * @private
         * @param {CompositionEvent} ev
         */
        _onCompositionend: function (ev) {
            this._isComposing = false;
        },

        /**
         * @private
         * @param {CompositionEvent} ev
         */
        _onCompositionstart: function (ev) {
            this._isComposing = true;
        },

        /**
         * @private
         */
        _onFacetRemove: function () {
            this.trigger_up('facet_removed', { facet: this });
            this.destroy();
        },

        /**
         * @private
         * @param {KeyboardEvent} ev
         */
        _onKeydown: function (ev) {
            if (this._isComposing) {
                return;
            }
            switch (ev.which) {
                case $.ui.keyCode.BACKSPACE:
                    this.trigger_up('facet_removed', { facet: this });
                    this.destroy();
                    break;
            }
        },
    });

    return SearchFacet;
});

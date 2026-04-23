sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("mmui5.controller.Inventory", {
        onInit: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteInventory").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
            this.byId("inventoryTable").getBinding("items").refresh();
        },

        onNavBack: function () {
            window.history.go(-1);
        }
    });
});
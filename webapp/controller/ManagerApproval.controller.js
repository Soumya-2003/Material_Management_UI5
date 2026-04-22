sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("mmui5.controller.ManagerApproval", {
        
        onInit: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteManagerApproval").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
            // Refresh both tables to ensure data is up to date when entering the view
            this.byId("pendingTable").getBinding("items").refresh();
            this.byId("processedTable").getBinding("items").refresh();
        },

        onNavBack: function () {
            window.history.go(-1);
        },

        onApprove: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var sPrID = oContext.getProperty("ID");
            
            this._processApprovalAction("/approvePR(...)", sPrID, "PR Approved successfully. PO Created!");
        },

        onReject: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var sPrID = oContext.getProperty("ID");
            
            MessageBox.confirm("Are you sure you want to reject this PR?", {
                title: "Confirm Rejection",
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        this._processApprovalAction("/rejectPR(...)", sPrID, "PR has been Rejected.");
                    }
                }.bind(this)
            });
        },

        _processApprovalAction: function (sActionPath, sPrID, sSuccessMessage) {
            var oModel = this.getView().getModel();
            var oAction = oModel.bindContext(sActionPath);
            
            oAction.setParameter("prID", sPrID);
            
            this.getView().setBusy(true);

            oAction.execute().then(function () {
                this.getView().setBusy(false);
                MessageToast.show(sSuccessMessage);
                oModel.refresh();
                // Refresh both tables to move the item from "Pending" to "Processed" visually
                this.byId("pendingTable").getBinding("items").refresh();
                this.byId("processedTable").getBinding("items").refresh();
                
            }.bind(this)).catch(function (oError) {
                this.getView().setBusy(false);
                MessageBox.error("Action failed: " + oError.message);
            }.bind(this));
        }
    });
});
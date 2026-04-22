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
            this.byId("pendingTable").getBinding("items").refresh();
            this.byId("processedTable").getBinding("items").refresh();
        },

        onNavBack: function () {
            window.history.go(-1);
        },

        onApprove: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var sItemID = oContext.getProperty("ID");
            
            this._processApprovalAction("/approvePRItem(...)", sItemID, "Item Approved successfully. PO Created!");
        },

        onReject: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var sItemID = oContext.getProperty("ID");
            
            MessageBox.confirm("Are you sure you want to reject this item?", {
                title: "Confirm Rejection",
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        this._processApprovalAction("/rejectPRItem(...)", sItemID, "Item has been Rejected.");
                    }
                }.bind(this)
            });
        },

        _processApprovalAction: function (sActionPath, sItemID, sSuccessMessage) {
            var oModel = this.getView().getModel();
            var oAction = oModel.bindContext(sActionPath);
            
            oAction.setParameter("itemID", sItemID);
            if (sActionPath.includes("reject")) {
                oAction.setParameter("reason", "Rejected by Manager via Dashboard");
            }
            
            this.getView().setBusy(true);

            oAction.execute().then(function () {
                this.getView().setBusy(false);
                MessageToast.show(sSuccessMessage);
                oModel.refresh();
                
                this.byId("pendingTable").getBinding("items").refresh();
                this.byId("processedTable").getBinding("items").refresh();
                
            }.bind(this)).catch(function (oError) {
                this.getView().setBusy(false);
                MessageBox.error("Action failed: " + oError.message);
            }.bind(this));
        }
    });
});
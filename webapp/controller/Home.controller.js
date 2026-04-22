sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel"
], function (Controller, Fragment, Filter, FilterOperator, MessageToast, JSONModel) {
    "use strict";

    return Controller.extend("mmui5.controller.Home", {
        onInit: function () {
            var oWizardModel = new JSONModel({
                prId: "",
                prNumber: "",
                materialId: "",
                materialText: "",
                vendorId: "",
                vendorText: "",
                quantity: 0,
                unitPrice: 0,
                totalPrice: "0.00",
                isFirstStep: true,
                isLastStep: false,
                isConfirmed: false,
                nextEnabled: false
            });
            this.getView().setModel(oWizardModel, "wizardModel");

            var oDashboardModel = new JSONModel({
                draftItems: [],
                approvalItems: [],
                poItems: []
            });

            this.getView().setModel(oDashboardModel, "dashboardModel");

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.attachRouteMatched(this._onRouteMatched, this);

            this._loadDashboardData();
        },

        _onRouteMatched: function (oEvent) {
            var sRouteName = oEvent.getParameter("name");
            if (sRouteName === "RouteHome" || sRouteName === "") {
                this._loadDashboardData();
            }
        },

        _loadDashboardData: function () {
            var oView = this.getView();
            var oModel = this.getOwnerComponent().getModel();
            var oDashboardModel = oView.getModel("dashboardModel");

            if (!oModel) {
                console.error("Default OData V4 model is not available.");
                return;
            }

            var oDraftsList = oModel.bindList("/DraftPurchaseRequisitions", null, null, null, {
                $select: "ID,prNumber,totalAmount,status"
            });

            oDraftsList.requestContexts(0, 3).then(function (aContexts) {
                var aDrafts = aContexts.map(function (oContext) {
                    var oData = oContext.getObject();
                    var sAmount = oData.totalAmount || oData.totalPrice || "0.00";
                    return {
                        title: oData.prNumber || "New Draft",
                        subtitle: "Action Required",
                        amount: parseFloat(sAmount).toFixed(2),
                        statusSchema: "None",
                        id: oData.ID
                    };
                });
                oDashboardModel.setProperty("/draftItems", aDrafts);
            }).catch(function (err) {
                console.error("Failed to load Drafts:", err);
            });

            var oApprovalsList = oModel.bindList("/PurchaseRequisitions", null, null, null, {
                $filter: "status eq 'IN_APPROVAL'",
                $select: "ID,prNumber,totalAmount,status"
            });

            oApprovalsList.requestContexts(0, 3).then(function (aContexts) {
                var aApprovals = aContexts.map(function (oContext) {
                    var oData = oContext.getObject();
                    return {
                        title: oData.prNumber,
                        subtitle: "Awaiting Manager",
                        amount: oData.totalAmount ? parseFloat(oData.totalAmount).toFixed(2) : "0.00",
                        statusSchema: "Warning",
                        id: oData.ID
                    };
                });
                oDashboardModel.setProperty("/approvalItems", aApprovals);
            }).catch(function (err) {
                console.error("Failed to load Approvals:", err);
            });

            var oPoList = oModel.bindList("/PurchaseOrders", null, null, null, {
                $select: "ID,poNumber,totalAmount,status"
            });

            oPoList.requestContexts(0, 3).then(function (aContexts) {
                var aPOs = aContexts.map(function (oContext) {
                    var oData = oContext.getObject();
                    return {
                        title: oData.poNumber || "PO Document",
                        subtitle: "Sent to Vendor",
                        amount: oData.totalAmount ? parseFloat(oData.totalAmount).toFixed(2) : "0.00",
                        statusSchema: "Success",
                        id: oData.ID
                    };
                });
                oDashboardModel.setProperty("/poItems", aPOs);
            }).catch(function (err) {
                console.error("Failed to load POs:", err);
            });
        },

        onNavToManagerApproval: function () {
            this.getOwnerComponent().getRouter().navTo("RouteManagerApproval");
        },

        // onTilePress: function (oEvent) {
        //     var sHeader = oEvent.getSource().getHeader();
        //     MessageToast.show("Navigating to: " + sHeader);
        //     // Example: this.getOwnerComponent().getRouter().navTo("RouteDetails", { type: sHeader });
        // },

        onCardItemPress: function (oEvent) {
            // Find out which specific item inside the card was clicked
            var oBindingContext = oEvent.getSource().getBindingContext("dashboardModel");
            var oSelectedData = oBindingContext.getObject();

            // MessageToast.show("Navigating to detail for: " + oSelectedData.title);
            if (oSelectedData.id) {
                // Example router nav (adjust "PurchaseRequisitionDetails" to match your manifest.json routes)
                // this.getOwnerComponent().getRouter().navTo("PurchaseRequisitionDetails", { ID: oSelectedData.id });
                MessageToast.show("Selected PR UUID: " + oSelectedData.id);
            }

            // Example Routing:
            // this.getOwnerComponent().getRouter().navTo("ObjectPage", { id: oSelectedData.title });
        },

        onOpenPRWizard: function () {
            var oView = this.getView();
            var oModel = oView.getModel();
            var oWizardModel = oView.getModel("wizardModel");

            var oAction = oModel.bindContext("/createDraft(...)");

            oAction.execute().then(function () {
                var oResult = oAction.getBoundContext().getObject();
                if (oResult && oResult.value) {
                    oResult = oResult.value;
                }
                if (!oResult || !oResult.ID) {
                    MessageToast.show("Failed to initialize PR.");
                    return;
                }

                oWizardModel.setProperty("/prId", oResult.ID);
                oWizardModel.setProperty("/prNumber", oResult.prNumber);
                this._openDialog();
            }.bind(this)).catch(function (oError) {
                console.error("Action execution failed:", oError);
                MessageToast.show("Error creating PR.");
            });
        },

        _openDialog: function () {
            var oView = this.getView();

            if (!this._oWizardDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "mmui5.fragment.CreatePRWizard",
                    controller: this
                }).then(function (oDialog) {
                    this._oWizardDialog = oDialog;
                    oView.addDependent(this._oWizardDialog);
                    this._oWizardDialog.open();
                }.bind(this));
            } else {
                this._oWizardDialog.open();
            }
        },

        onCloseDialog: function () {
            if (this._oWizardDialog) {
                this._oWizardDialog.close();
                this._resetWizard();
            }
        },

        onShowMyPRs: function () {
            this.getOwnerComponent().getRouter().navTo("RouteDrafts");
        },

        onFormChange: function (oEvent) {
            var oSource = oEvent.getSource();
            var oWizardModel = this.getView().getModel("wizardModel");
            var oVendorSelect = this.byId("vendorSelect");
            var bIsValid = true;

            oSource.setValueState("None");
            oSource.setValueStateText("");

            if (oSource.getId().includes("materialSelect")) {
                var oSelectedItem = oSource.getSelectedItem();

                oVendorSelect.clearSelection();
                this.byId("quantityInput").setValue("");

                oWizardModel.setProperty("/vendorId", "");
                // oWizardModel.setProperty("/vendorText", "");
                oWizardModel.setProperty("/quantity", 0);
                oWizardModel.setProperty("/totalPrice", "0.00");
                // oWizardModel.setProperty("/nextEnabled", false);

                if (oSelectedItem) {
                    var sMaterialId = oSelectedItem.getKey();
                    oWizardModel.setProperty("/materialId", sMaterialId);
                    // oWizardModel.setProperty("/materialText", oSelectedItem.getText());

                    var oContext = oSelectedItem.getBindingContext();
                    var nPrice = oContext ? parseFloat(oContext.getProperty("price")) : 0;
                    oWizardModel.setProperty("/unitPrice", nPrice);

                    var oFilter = new Filter("material_ID", FilterOperator.EQ, sMaterialId);
                    oVendorSelect.getBinding("items").filter([oFilter]);
                    oVendorSelect.setEnabled(true);
                } else {
                    oVendorSelect.setEnabled(false);
                    oSource.setValueState("Error");
                    oSource.setValueStateText("Please select a material.");
                    bIsValid = false;
                    // oVendorSelect.clearSelection();
                    // oWizardModel.setProperty("/materialId", "");
                    // oVendorSelect.setEnabled(false);
                    // oWizardModel.setProperty("/vendorId", "");
                    // oWizardModel.setProperty("/unitPrice", 0);
                }
            }

            // if (oSource.getId().includes("vendorSelect")) {
            //     var oSelectedVendor = oSource.getSelectedItem();
            //     if (oSelectedVendor) {
            //         oWizardModel.setProperty("/vendorId", oSelectedVendor.getKey());
            //         oWizardModel.setProperty("/vendorText", oSelectedVendor.getText());
            //     } else {
            //         oWizardModel.setProperty("/vendorId", "");
            //     }
            // }

            if (oSource.getId().includes("quantityInput")) {
                var sValue = oSource.getValue();
                var nQuantity = parseInt(sValue, 10);
                // oWizardModel.setProperty("/quantity", nQuantity > 0 ? nQuantity : 0);
                if (isNaN(nQuantity) || nQuantity <= 0) {
                    oSource.setValueState("Error");
                    oSource.setValueStateText("Quantity must be greater than 0.");
                    oWizardModel.setProperty("/quantity", 0);
                    bIsValid = false;
                } else {
                    oWizardModel.setProperty("/quantity", nQuantity);
                }
            }

            var nTotal = oWizardModel.getProperty("/unitPrice") * oWizardModel.getProperty("/quantity");
            oWizardModel.setProperty("/totalPrice", nTotal.toFixed(2));

            var oData = oWizardModel.getData();
            if (oData.materialId && oData.vendorId && oData.quantity > 0 && bIsValid) {
                oWizardModel.setProperty("/nextEnabled", true);
            } else {
                oWizardModel.setProperty("/nextEnabled", false);
            }
        },

        onNextStep: function () {
            var oWizardModel = this.getView().getModel("wizardModel");
            oWizardModel.setProperty("/isFirstStep", false);
            oWizardModel.setProperty("/isLastStep", true);

            var oWizard = this.byId("CreatePRWizard");
            oWizard.nextStep();
        },

        onPrevStep: function () {
            var oWizardModel = this.getView().getModel("wizardModel");
            oWizardModel.setProperty("/isFirstStep", true);
            oWizardModel.setProperty("/isLastStep", false);

            var oWizard = this.byId("CreatePRWizard");
            oWizard.previousStep();
        },

        _resetWizard: function () {
            var oWizard = this.byId("CreatePRWizard");
            var oFirstStep = this.byId("DataEntryStep");
            oWizard.discardProgress(oFirstStep);

            this.byId("materialSelect").clearSelection();
            this.byId("vendorSelect").clearSelection();
            this.byId("vendorSelect").setEnabled(false);
            this.byId("quantityInput").setValue("");

            this.getView().getModel("wizardModel").setData({
                prId: "", prNumber: "", materialId: "", materialText: "", vendorId: "", vendorText: "",
                quantity: 0, unitPrice: 0, totalPrice: "0.00",
                isFirstStep: true, isLastStep: false, isConfirmed: false, nextEnabled: false
            });
        },

        onSubmitPR: function () {
            this._executePRCreation(true);
        },

        onSaveDraft: function () {
            this._executePRCreation(false);
        },

        _executePRCreation: function (bSubmit) {
            var oData = this.getView().getModel("wizardModel").getData();
            var oModel = this.getView().getModel();

            if (!oData.prId) {
                MessageToast.show("Error: Draft not initialized properly.");
                return;
            }

            var oAction = oModel.bindContext("/saveDraft(...)");

            oAction.setParameter("ID", oData.prId);
            oAction.setParameter("material_ID", oData.materialId || null);
            oAction.setParameter("vendor_ID", oData.vendorId || null);
            oAction.setParameter("quantity", parseInt(oData.quantity, 10) || 0);

            oAction.execute().then(function () {
                if (bSubmit) {
                    var oSubmit = oModel.bindContext("/submitDraft(...)");
                    oSubmit.setParameter("draftID", oData.prId);

                    oSubmit.execute().then(function () {
                        MessageToast.show("PR Submitted!");
                        this.onCloseDialog();
                        this._loadDashboardData();
                    }.bind(this)).catch(function () {
                        MessageToast.show("Error submitting PR.");
                    });
                } else {
                    MessageToast.show("Draft Saved!");
                    this.onCloseDialog();
                    this._loadDashboardData();
                }
            }.bind(this)).catch(function () {
                MessageToast.show("Error saving draft.");
            });
        }
    });
});
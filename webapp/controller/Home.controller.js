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
                currentItem: { materialId: "", materialText: "", vendorId: "", vendorText: "", quantity: 0, unitPrice: 0 },
                draftItems: [], // Array to hold multiple materials
                addItemEnabled: false,
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

        onNavToVendor: function () {
            this.getOwnerComponent().getRouter().navTo("RouteVendorPortal");
        },
        
        onNavToInventory: function() {
            this.getOwnerComponent().getRouter().navTo("RouteInventory");
        },

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
            // var oView = this.getView();
            // var oModel = oView.getModel();
            // var oWizardModel = oView.getModel("wizardModel");

            // var oAction = oModel.bindContext("/createDraft(...)");

            // oAction.execute().then(function () {
            //     var oResult = oAction.getBoundContext().getObject();
            //     if (oResult && oResult.value) {
            //         oResult = oResult.value;
            //     }
            //     if (!oResult || !oResult.ID) {
            //         MessageToast.show("Failed to initialize PR.");
            //         return;
            //     }

            //     oWizardModel.setProperty("/prId", oResult.ID);
            //     oWizardModel.setProperty("/prNumber", oResult.prNumber);
            //     this._openDialog();
            // }.bind(this)).catch(function (oError) {
            //     console.error("Action execution failed:", oError);
            //     MessageToast.show("Error creating PR.");
            // });

            // this._resetWizard();
            this._openDialog();
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
                    this._resetWizard();
                    this._oWizardDialog.open();
                }.bind(this));
            } else {
                this._resetWizard();
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
            var oMaterialSelect = this.byId("materialSelect");

            oSource.setValueState("None");
            oSource.setValueStateText("");

            if (oSource.getId().includes("materialSelect")) {
                var oSelectedItem = oSource.getSelectedItem();
                oVendorSelect.clearSelection();
                oWizardModel.setProperty("/currentItem/vendorId", "");
                oWizardModel.setProperty("/currentItem/vendorText", "");

                if (oSelectedItem) {
                    var sMaterialId = oSelectedItem.getKey();
                    oWizardModel.setProperty("/currentItem/materialId", sMaterialId);
                    oWizardModel.setProperty("/currentItem/materialText", oSelectedItem.getText());

                    var oContext = oSelectedItem.getBindingContext();
                    var nPrice = oContext ? parseFloat(oContext.getProperty("price")) : 0;
                    oWizardModel.setProperty("/currentItem/unitPrice", nPrice);

                    var oFilter = new Filter("material_ID", FilterOperator.EQ, sMaterialId);
                    oVendorSelect.getBinding("items").filter([oFilter]);
                    oVendorSelect.setEnabled(true);
                } else {
                    oVendorSelect.setEnabled(false);
                    oWizardModel.setProperty("/currentItem/materialId", "");
                }
            }

            if (oSource.getId().includes("vendorSelect")) {
                var oSelectedVendor = oSource.getSelectedItem();
                if (oSelectedVendor) {
                    // Extracting the key using binding context because selectedKey maps to vendor_ID in VendorMaterials
                    oWizardModel.setProperty("/currentItem/vendorId", oSelectedVendor.getBindingContext().getProperty("vendor_ID"));
                    oWizardModel.setProperty("/currentItem/vendorText", oSelectedVendor.getText());
                }
            }

            if (oSource.getId().includes("quantityInput")) {
                var sValue = oSource.getValue();
                var nQuantity = parseInt(sValue, 10);
                if (isNaN(nQuantity) || nQuantity <= 0) {
                    oSource.setValueState("Error");
                    oSource.setValueStateText("Quantity > 0");
                    oWizardModel.setProperty("/currentItem/quantity", 0);
                } else {
                    oWizardModel.setProperty("/currentItem/quantity", nQuantity);
                }
            }

            // Validate form to enable "Add Item" button
            var oCurrentItem = oWizardModel.getProperty("/currentItem");
            if (oCurrentItem.materialId && oCurrentItem.vendorId && oCurrentItem.quantity > 0) {
                oWizardModel.setProperty("/addItemEnabled", true);
            } else {
                oWizardModel.setProperty("/addItemEnabled", false);
            }
        },

        onAddItem: function () {
            var oWizardModel = this.getView().getModel("wizardModel");
            var oCurrentItem = Object.assign({}, oWizardModel.getProperty("/currentItem"));
            var aItems = oWizardModel.getProperty("/draftItems");

            // Calculate row total and add to array
            oCurrentItem.itemTotal = (oCurrentItem.quantity * oCurrentItem.unitPrice).toFixed(2);
            aItems.push(oCurrentItem);
            oWizardModel.setProperty("/draftItems", aItems);
            
            this._recalculateTotal(oWizardModel);

            // Reset form for next item
            oWizardModel.setProperty("/currentItem", { materialId: "", materialText: "", vendorId: "", vendorText: "", quantity: 0, unitPrice: 0 });
            oWizardModel.setProperty("/addItemEnabled", false);
            
            this.byId("materialSelect").clearSelection();
            this.byId("vendorSelect").clearSelection();
            this.byId("vendorSelect").setEnabled(false);
            this.byId("quantityInput").setValue("");
            
            // Enable next step if cart has items
            oWizardModel.setProperty("/nextEnabled", true);
        },

        onRemoveItem: function (oEvent) {
            var oItem = oEvent.getSource().getBindingContext("wizardModel").getObject();
            var oWizardModel = this.getView().getModel("wizardModel");
            var aItems = oWizardModel.getProperty("/draftItems");
            
            aItems = aItems.filter(function(i) { return i !== oItem; });
            oWizardModel.setProperty("/draftItems", aItems);
            
            this._recalculateTotal(oWizardModel);
            oWizardModel.setProperty("/nextEnabled", aItems.length > 0);
        },

        onEditItem: function(oEvent) {
            var oItem = oEvent.getSource().getBindingContext("wizardModel").getObject();
            var oWizardModel = this.getView().getModel("wizardModel");
            var oVendorSelect = this.byId("vendorSelect");
            
            // 1. Move the item data back into the form fields
            oWizardModel.setProperty("/currentItem", {
                materialId: oItem.materialId,
                materialText: oItem.materialText,
                vendorId: oItem.vendorId,
                vendorText: oItem.vendorText,
                quantity: oItem.quantity,
                unitPrice: parseFloat(oItem.unitPrice)
            });

            // 2. Re-apply the Vendor filter so the dropdown shows the correct vendors for this material
            var oFilter = new Filter("material_ID", FilterOperator.EQ, oItem.materialId);
            oVendorSelect.getBinding("items").filter([oFilter]);
            oVendorSelect.setEnabled(true);

            oWizardModel.setProperty("/addItemEnabled", true);

            // 3. Remove it from the cart array (so they don't get duplicates when they click 'Add' again)
            this.onRemoveItem(oEvent);
        },

        _recalculateTotal: function(oWizardModel) {
            var aItems = oWizardModel.getProperty("/draftItems");
            var nTotal = aItems.reduce(function(sum, item) { return sum + parseFloat(item.itemTotal); }, 0);
            oWizardModel.setProperty("/totalPrice", nTotal.toFixed(2));
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
            // oWizard.discardProgress(oFirstStep);
            if (oWizard && oFirstStep) {
                oWizard.discardProgress(oFirstStep);
            }

            var oMaterialSelect = this.byId("materialSelect");
            if (oMaterialSelect) oMaterialSelect.clearSelection();

            var oVendorSelect = this.byId("vendorSelect");
            if (oVendorSelect) {
                oVendorSelect.clearSelection();
                oVendorSelect.setEnabled(false);
            }

            var oQuantityInput = this.byId("quantityInput");
            if (oQuantityInput) oQuantityInput.setValue("");
            
            this.getView().getModel("wizardModel").setData({
                prId: "", prNumber: "Pending...", 
                currentItem: { materialId: "", materialText: "", vendorId: "", vendorText: "", quantity: 0, unitPrice: 0 },
                draftItems: [], addItemEnabled: false, totalPrice: "0.00",
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
            var oWizardModel = this.getView().getModel("wizardModel");
            var oData = oWizardModel.getData();
            var oModel = this.getView().getModel();

            if (oData.draftItems.length === 0) {
                MessageToast.show("Error: No items in the PR.");
                return;
            }

            this.getView().setBusy(true); // Lock UI while processing

            // STEP A: Create the Draft Header in the Database
            var oCreateAction = oModel.bindContext("/createDraft(...)");
            oCreateAction.execute().then(function () {
                var oResult = oCreateAction.getBoundContext().getObject();
                if (oResult && oResult.value) oResult = oResult.value;

                var sNewDraftId = oResult.ID; // Get the newly created DB ID
                
                // Map UI items to the payload
                var aPayloadItems = oData.draftItems.map(function(item) {
                    return {
                        material_ID: item.materialId,
                        vendor_ID: item.vendorId,
                        quantity: item.quantity
                    };
                });

                // STEP B: Save the items directly into the newly created Draft Header
                var oSaveAction = oModel.bindContext("/saveDraft(...)");
                oSaveAction.setParameter("ID", sNewDraftId);
                oSaveAction.setParameter("items", aPayloadItems);

                oSaveAction.execute().then(function () {
                    // STEP C: If they clicked 'Submit', forward it to Approval
                    if (bSubmit) {
                        var oSubmit = oModel.bindContext("/submitDraft(...)");
                        oSubmit.setParameter("draftID", sNewDraftId);

                        oSubmit.execute().then(function () {
                            this.getView().setBusy(false);
                            MessageToast.show("PR Submitted!");
                            this.onCloseDialog();
                            this._loadDashboardData();
                        }.bind(this)).catch(function () {
                            this.getView().setBusy(false);
                            MessageToast.show("Error submitting PR.");
                        }.bind(this));
                    } else {
                        // They just clicked 'Save as Draft'
                        this.getView().setBusy(false);
                        MessageToast.show("Draft Saved!");
                        this.onCloseDialog();
                        this._loadDashboardData();
                    }
                }.bind(this)).catch(function () {
                    this.getView().setBusy(false);
                    MessageToast.show("Error saving draft items.");
                }.bind(this));

            }.bind(this)).catch(function () {
                this.getView().setBusy(false);
                MessageToast.show("Error creating draft header.");
            }.bind(this));
        }
    });
});
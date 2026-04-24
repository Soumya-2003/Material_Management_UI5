sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox" // <-- Added MessageBox for the popup
], function (Controller, Fragment, Filter, FilterOperator, MessageToast, JSONModel, MessageBox) {
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
                poItems: [],
                rejectedItems: []
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

            // --- LOAD REJECTED ITEMS FOR NOTIFICATIONS ---
            var oRejectedList = oModel.bindList("/PR_Items", null, null, null, {
                $filter: "status eq 'REJECTED'",
                $expand: "material,vendor,pr" // Expand to get names and PR Number
            });

            oRejectedList.requestContexts(0, 10).then(function (aContexts) {
                var aRejected = aContexts.map(function (oContext) {
                    var oData = oContext.getObject();
                    var sMatName = oData.material ? oData.material.name : "Item";
                    var sPrNum = oData.pr ? oData.pr.prNumber : "PR";
                    
                    return {
                        title: sMatName + " (" + sPrNum + ")",
                        subtitle: oData.rejectionReason || "No reason provided",
                        amount: oData.quantity + " units",
                        id: oData.ID // The ITEM ID
                    };
                });
                oDashboardModel.setProperty("/rejectedItems", aRejected);
            }).catch(function (err) {
                console.error("Failed to load Rejected Items:", err);
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

        onRejectedItemPress: function(oEvent) {
            var oBindingContext = oEvent.getSource().getBindingContext("dashboardModel");
            var oSelectedData = oBindingContext.getObject();
            var oModel = this.getView().getModel();
            
            this.getView().setBusy(true);
            
            // Call the backend action to extract the item and make a new Draft
            var oAction = oModel.bindContext("/editRejectedItem(...)");
            oAction.setParameter("itemID", oSelectedData.id);
            
            oAction.execute().then(function() {
                this.getView().setBusy(false);
                this._loadDashboardData(); // Refresh the dashboard
                
                sap.m.MessageToast.show("Item converted to Draft! Please edit your vendor or quantity.");
                
                // Automatically route to Drafts page so they can edit it
                this.getOwnerComponent().getRouter().navTo("RouteDrafts");
                
            }.bind(this)).catch(function(err) {
                this.getView().setBusy(false);
                sap.m.MessageBox.error("Failed to reopen rejected item.");
            }.bind(this));
        },

        // onNavToManagerApproval: function () {
        //     this.getOwnerComponent().getRouter().navTo("RouteManagerApproval");
        // },

        onNavToVendor: function () {
            this.getOwnerComponent().getRouter().navTo("RouteVendorPortal");
        },
        
        onNavToInventory: function() {
            this.getOwnerComponent().getRouter().navTo("RouteInventory");
        },

        onViewAllApprovals: function () {
            // Placeholder: Navigate to a dedicated all-approvals route later
            // this.getOwnerComponent().getRouter().navTo("RouteAllApprovals");
            MessageToast.show("Navigating to All Approvals List...");
        },

        onCardItemPress: function (oEvent) {
            var oBindingContext = oEvent.getSource().getBindingContext("dashboardModel");
            var oSelectedData = oBindingContext.getObject();

            var oView = this.getView();
            
            // Create a temporary model to hold the selected item's data for the Dialog
            var oDetailModel = new JSONModel(oSelectedData);
            oView.setModel(oDetailModel, "detailModel");

            if (!this._oItemDetailsDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "mmui5.fragment.ItemDetails", 
                    controller: this
                }).then(function (oDialog) {
                    this._oItemDetailsDialog = oDialog;
                    oView.addDependent(this._oItemDetailsDialog);
                    this._oItemDetailsDialog.open();
                }.bind(this));
            } else {
                this._oItemDetailsDialog.open();
            }
        },

        onCloseDetailsDialog: function () {
            if (this._oItemDetailsDialog) {
                this._oItemDetailsDialog.close();
            }
        },

        onOpenPRWizard: function () {
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

            var oCurrentItem = oWizardModel.getProperty("/currentItem");
            
            // --- NEW: Dynamic Debounced Duplicate Check ---
            if (oCurrentItem.materialId && oCurrentItem.vendorId && oCurrentItem.quantity > 0) {
                // Disable button immediately while we wait for the backend check
                oWizardModel.setProperty("/addItemEnabled", false);
                
                // Clear existing timeout (prevents spamming DB on every keystroke)
                if (this._duplicateCheckTimeout) {
                    clearTimeout(this._duplicateCheckTimeout);
                }
                
                // Wait 500ms after user stops typing to check the database
                this._duplicateCheckTimeout = setTimeout(function() {
                    this._checkDuplicate(oCurrentItem, oWizardModel);
                }.bind(this), 500);

            } else {
                oWizardModel.setProperty("/addItemEnabled", false);
            }
        },

        // --- NEW: Database 24hr Duplicate Validation ---
        _checkDuplicate: function (oCurrentItem, oWizardModel) {
            var oModel = this.getView().getModel();

            // Calculate exact time 24 hours ago
            var dYesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

            // Filter PR Items: Same Material AND Vendor AND Quantity AND Parent PR was created in last 24hrs
            var aFilters = [
                new Filter("material_ID", FilterOperator.EQ, oCurrentItem.materialId),
                new Filter("vendor_ID", FilterOperator.EQ, oCurrentItem.vendorId),
                new Filter("quantity", FilterOperator.EQ, oCurrentItem.quantity),
                new Filter("pr/createdAt", FilterOperator.GE, dYesterday.toISOString()) // Follows association to parent
            ];

            var oBinding = oModel.bindList("/PR_Items", null, null, aFilters, { $$groupId: "$direct" });

            oBinding.requestContexts(0, 1).then(function (aContexts) {
                if (aContexts && aContexts.length > 0) {
                    // Database Duplicate Found!
                    oWizardModel.setProperty("/addItemEnabled", false);
                    MessageBox.error(
                        "A Purchase Requisition for this exact material, vendor, and quantity was already submitted within the last 24 hours.\n\nDuplicate requests are strictly prohibited.",
                        { title: "Duplicate PR Detected" }
                    );
                } else {
                    // Safety check: Ensure they don't already have it in their local cart as well
                    var aCartItems = oWizardModel.getProperty("/draftItems");
                    var bInCart = aCartItems.some(function(item) {
                        return item.materialId === oCurrentItem.materialId && 
                               item.vendorId === oCurrentItem.vendorId && 
                               item.quantity === oCurrentItem.quantity;
                    });

                    if (bInCart) {
                        oWizardModel.setProperty("/addItemEnabled", false);
                        MessageBox.warning("This exact item is already in your current PR draft cart.", { title: "Duplicate Item" });
                    } else {
                        // Safe to proceed!
                        oWizardModel.setProperty("/addItemEnabled", true);
                    }
                }
            }).catch(function (err) {
                console.error("Duplicate validation check failed:", err);
                // If network fails, allow them to proceed so UX doesn't freeze
                oWizardModel.setProperty("/addItemEnabled", true); 
            });
        },

        onAddItem: function () {
            var oWizardModel = this.getView().getModel("wizardModel");
            var oCurrentItem = Object.assign({}, oWizardModel.getProperty("/currentItem"));
            var aItems = oWizardModel.getProperty("/draftItems");

            oCurrentItem.itemTotal = (oCurrentItem.quantity * oCurrentItem.unitPrice).toFixed(2);
            aItems.push(oCurrentItem);
            oWizardModel.setProperty("/draftItems", aItems);
            
            this._recalculateTotal(oWizardModel);

            oWizardModel.setProperty("/currentItem", { materialId: "", materialText: "", vendorId: "", vendorText: "", quantity: 0, unitPrice: 0 });
            oWizardModel.setProperty("/addItemEnabled", false);
            
            this.byId("materialSelect").clearSelection();
            this.byId("vendorSelect").clearSelection();
            this.byId("vendorSelect").setEnabled(false);
            this.byId("quantityInput").setValue("");
            
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
            
            oWizardModel.setProperty("/currentItem", {
                materialId: oItem.materialId,
                materialText: oItem.materialText,
                vendorId: oItem.vendorId,
                vendorText: oItem.vendorText,
                quantity: oItem.quantity,
                unitPrice: parseFloat(oItem.unitPrice)
            });

            var oFilter = new Filter("material_ID", FilterOperator.EQ, oItem.materialId);
            oVendorSelect.getBinding("items").filter([oFilter]);
            oVendorSelect.setEnabled(true);

            oWizardModel.setProperty("/addItemEnabled", true);
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

            this.getView().setBusy(true);

            var oCreateAction = oModel.bindContext("/createDraft(...)");
            oCreateAction.execute().then(function () {
                var oResult = oCreateAction.getBoundContext().getObject();
                if (oResult && oResult.value) oResult = oResult.value;

                var sNewDraftId = oResult.ID; 
                
                var aPayloadItems = oData.draftItems.map(function(item) {
                    return {
                        material_ID: item.materialId,
                        vendor_ID: item.vendorId,
                        quantity: item.quantity
                    };
                });

                var oSaveAction = oModel.bindContext("/saveDraft(...)");
                oSaveAction.setParameter("ID", sNewDraftId);
                oSaveAction.setParameter("items", aPayloadItems);

                oSaveAction.execute().then(function () {
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
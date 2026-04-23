sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox" // <-- Added MessageBox
], function (Controller, History, Fragment, Filter, FilterOperator, MessageToast, JSONModel, MessageBox) {
    "use strict";

    return Controller.extend("mmui5.controller.Drafts", {
        onInit: function () {
            var oWizardModel = new JSONModel({
                mode: "EDIT",
                prId: "",
                prNumber: "",
                currentItem: { materialId: "", materialText: "", vendorId: "", vendorText: "", quantity: 0, unitPrice: 0 },
                draftItems: [],
                addItemEnabled: false,
                totalPrice: "0.00",
                isFirstStep: true,
                isLastStep: false,
                isConfirmed: false,
                nextEnabled: false
            });
            this.getView().setModel(oWizardModel, "wizardModel");

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteDrafts").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
            var oTable = this.byId("draftsTable");
            if (oTable && oTable.getBinding("items")) {
                oTable.getBinding("items").refresh(); 
            }
        },

        onNavBack: function () {
            window.history.go(-1);
        },

        onDraftSelect: function (oEvent) {
            var oItem = oEvent.getSource(); 
            var oContext = oItem.getBindingContext();
            var oData = oContext.getObject();
            var oWizardModel = this.getView().getModel("wizardModel");

            // Map the backend items into our UI5 array
            var aDraftItems = (oData.items || []).map(function(item) {
                var nPrice = parseFloat(item.price) || 0;
                return {
                    materialId: item.material_ID,
                    materialText: item.material ? item.material.name : "Unknown Material",
                    vendorId: item.vendor_ID,
                    vendorText: item.vendor ? item.vendor.name : "Unknown Vendor",
                    quantity: item.quantity,
                    unitPrice: nPrice.toFixed(2),
                    itemTotal: (item.quantity * nPrice).toFixed(2)
                };
            });

            oWizardModel.setData({
                mode: "EDIT",
                prId: oData.ID,
                prNumber: oData.prNumber,
                currentItem: { materialId: "", materialText: "", vendorId: "", vendorText: "", quantity: 0, unitPrice: 0 },
                draftItems: aDraftItems,
                addItemEnabled: false,
                totalPrice: parseFloat(oData.totalAmount || 0).toFixed(2),
                isFirstStep: true,
                isLastStep: false,
                isConfirmed: false,
                nextEnabled: aDraftItems.length > 0
            });

            this.onOpenPRWizard();
        },

        onOpenPRWizard: function () {
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
                var oWizard = this.byId("CreatePRWizard");
                var oFirstStep = this.byId("DataEntryStep");
                if (oWizard && oFirstStep) {
                    oWizard.discardProgress(oFirstStep);
                }
                this._oWizardDialog.open();
            }
        },

        onCloseDialog: function () {
            if (this._oWizardDialog) {
                this._oWizardDialog.close();
            }
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

            // Calculate current total
            var nUnit = oWizardModel.getProperty("/currentItem/unitPrice") || 0;
            var nQty = oWizardModel.getProperty("/currentItem/quantity") || 0;
            oWizardModel.setProperty("/currentItem/itemTotal", (nUnit * nQty).toFixed(2));

            // Validate form to enable "Add Item" button using debounce
            var oCurrentItem = oWizardModel.getProperty("/currentItem");
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
            this.byId("CreatePRWizard").nextStep();
        },

        onPrevStep: function () {
            var oWizardModel = this.getView().getModel("wizardModel");
            oWizardModel.setProperty("/isFirstStep", true);
            oWizardModel.setProperty("/isLastStep", false);
            this.byId("CreatePRWizard").previousStep();
        },

        onSaveDraft: function () {
            this._executeUpdate(false);
        },

        onSubmitPR: function () {
            this._executeUpdate(true);
        },

        _executeUpdate: function (bSubmit) {
            var oData = this.getView().getModel("wizardModel").getData();
            var oModel = this.getView().getModel();

            if (!oData.prId || oData.draftItems.length === 0) {
                MessageToast.show("Error: No items in the Draft.");
                return;
            }

            var aPayloadItems = oData.draftItems.map(function(item) {
                return {
                    material_ID: item.materialId,
                    vendor_ID: item.vendorId,
                    quantity: item.quantity
                };
            });

            var oAction = oModel.bindContext("/saveDraft(...)");
            oAction.setParameter("ID", oData.prId);
            oAction.setParameter("items", aPayloadItems);

            oAction.execute().then(function () {
                if (bSubmit) {
                    var oSubmit = oModel.bindContext("/submitDraft(...)");
                    oSubmit.setParameter("draftID", oData.prId);

                    oSubmit.execute().then(function () {
                        MessageToast.show("Draft submitted and Sent for Approval!");
                        oModel.refresh();
                        this.onCloseDialog();
                    }.bind(this)).catch(function () {
                        MessageToast.show("Error submitting PR.");
                    });
                } else {
                    MessageToast.show("Draft Updated Successfully!");
                    oModel.refresh();
                    this.onCloseDialog();
                }
            }.bind(this)).catch(function () {
                MessageToast.show("Error saving draft.");
            });
        }
    });
});
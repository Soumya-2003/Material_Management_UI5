sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel"
], function (Controller, History, Fragment, Filter, FilterOperator, MessageToast, JSONModel) {
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

        // --- Reused from Home.controller.js to support Adding/Removing in Draft mode ---
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
                    oWizardModel.setProperty("/currentItem/quantity", 0);
                } else {
                    oWizardModel.setProperty("/currentItem/quantity", nQuantity);
                }
            }

            var oCurrentItem = oWizardModel.getProperty("/currentItem");
            oWizardModel.setProperty("/addItemEnabled", !!(oCurrentItem.materialId && oCurrentItem.vendorId && oCurrentItem.quantity > 0));
        },

        onAddItem: function () {
            var oWizardModel = this.getView().getModel("wizardModel");
            var oCurrentItem = Object.assign({}, oWizardModel.getProperty("/currentItem"));
            var aItems = oWizardModel.getProperty("/draftItems");

            oCurrentItem.itemTotal = (oCurrentItem.quantity * oCurrentItem.unitPrice).toFixed(2);
            aItems.push(oCurrentItem);
            oWizardModel.setProperty("/draftItems", aItems);
            
            var nTotal = aItems.reduce(function(sum, item) { return sum + parseFloat(item.itemTotal); }, 0);
            oWizardModel.setProperty("/totalPrice", nTotal.toFixed(2));

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
            
            var nTotal = aItems.reduce(function(sum, item) { return sum + parseFloat(item.itemTotal); }, 0);
            oWizardModel.setProperty("/totalPrice", nTotal.toFixed(2));
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
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
                materialId: "",
                materialText: "Loading...",
                vendorId: "",
                vendorText: "Loading...",
                quantity: 0,
                unitPrice: 0,
                totalPrice: "0.00",
                isFirstStep: true,
                isLastStep: false,
                isConfirmed: false,
                nextEnabled: true
            });
            this.getView().setModel(oWizardModel, "wizardModel");
        },

        onNavBack: function () {
            var oHistory = History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.getOwnerComponent().getRouter().navTo("RouteHome", {}, true);
            }
        },

        onDraftSelect: function (oEvent) {
            var oItem = oEvent.getSource(); 
            var oContext = oItem.getBindingContext();
            var oData = oContext.getObject();

            var oWizardModel = this.getView().getModel("wizardModel");

            // Calculate unit price for display
            var nUnitPrice = (oData.quantity > 0) ? (parseFloat(oData.totalAmount / oData.quantity)) : 0;

            oWizardModel.setData({
                mode: "EDIT",
                prId: oData.ID,
                materialId: oData.material_ID || "",
                vendorId: oData.vendor_ID || "",
                quantity: oData.quantity || 0,
                unitPrice: nUnitPrice,
                totalPrice: oData.totalAmount,
                materialText: "Material Selected",
                vendorText: "Vendor Selected",
                isFirstStep: true,
                isLastStep: false,
                isConfirmed: false,
                nextEnabled: true
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
                    this._applyFiltersForEdit();
                    this._oWizardDialog.open();
                }.bind(this));
            } else {
                var oWizard = this.byId("CreatePRWizard");
                var oFirstStep = this.byId("DataEntryStep");
                if (oWizard && oFirstStep) {
                    oWizard.discardProgress(oFirstStep);
                }
                this._applyFiltersForEdit();
                this._oWizardDialog.open();
            }
        },

        _applyFiltersForEdit: function () {
            var oWizardModel = this.getView().getModel("wizardModel");
            var sMaterialId = oWizardModel.getProperty("/materialId");
            var oVendorSelect = this.byId("vendorSelect");

            if (sMaterialId) {
                // var oVendorSelect = this.byId("vendorSelect");
                var oFilter = new Filter("material_ID", FilterOperator.EQ, sMaterialId);
                oVendorSelect.getBinding("items").filter([oFilter]);
                oVendorSelect.setEnabled(true);
            }
            else {
                oVendorSelect.setEnabled(false);
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

            if (oSource.getId().includes("materialSelect")) {
                var oSelectedItem = oSource.getSelectedItem();

                oVendorSelect.clearSelection();
                this.byId("quantityInput").setValue("");
                
                oWizardModel.setProperty("/vendorId", "");
                oWizardModel.setProperty("/vendorText", "");
                oWizardModel.setProperty("/quantity", 0);
                oWizardModel.setProperty("/totalPrice", "0.00");
                oWizardModel.setProperty("/nextEnabled", false);

                if (oSelectedItem) {
                    oWizardModel.setProperty("/materialId", oSelectedItem.getKey());
                    oWizardModel.setProperty("/materialText", oSelectedItem.getText());

                    var nPrice = parseFloat(oSelectedItem.getBindingContext().getProperty("price"));
                    oWizardModel.setProperty("/unitPrice", nPrice);

                    var oFilter = new Filter("material_ID", FilterOperator.EQ, oSelectedItem.getKey());
                    oVendorSelect.getBinding("items").filter([oFilter]);
                    oVendorSelect.setEnabled(true);
                } else {
                    oWizardModel.setProperty("/materialId", "");
                    oVendorSelect.setEnabled(false);
                }
            }

            if (oSource.getId().includes("vendorSelect")) {
                var oSelectedVendor = oSource.getSelectedItem();
                if (oSelectedVendor) {
                    oWizardModel.setProperty("/vendorId", oSelectedVendor.getKey());
                    oWizardModel.setProperty("/vendorText", oSelectedVendor.getText());
                } else {
                    oWizardModel.setProperty("/vendorId", "");
                }
            }

            if (oSource.getId().includes("quantityInput")) {
                var nQuantity = parseInt(oSource.getValue(), 10);
                oWizardModel.setProperty("/quantity", nQuantity > 0 ? nQuantity : 0);
            }

            var nTotal = oWizardModel.getProperty("/unitPrice") * oWizardModel.getProperty("/quantity");
            oWizardModel.setProperty("/totalPrice", nTotal.toFixed(2));

            var oData = oWizardModel.getData();
            oWizardModel.setProperty("/nextEnabled", !!(oData.materialId && oData.vendorId && oData.quantity > 0));
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
                        MessageToast.show("Draft submitted and Sent for Approval!");
                        this.byId("draftsTable").getBinding("items").refresh();
                        this.onCloseDialog();
                    }.bind(this)).catch(function () {
                        MessageToast.show("Error submitting PR.");
                    });
                } else {
                    MessageToast.show("Draft Updated Successfully!");
                    this.byId("draftsTable").getBinding("items").refresh();
                    this.onCloseDialog();
                }
            }.bind(this)).catch(function () {
                MessageToast.show("Error saving draft.");
            });
        }
    });
});
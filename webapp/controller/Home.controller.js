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
                    var sMaterialId = oSelectedItem.getKey();
                    oWizardModel.setProperty("/materialId", sMaterialId);
                    oWizardModel.setProperty("/materialText", oSelectedItem.getText());

                    var oContext = oSelectedItem.getBindingContext();
                    var nPrice = oContext ? parseFloat(oContext.getProperty("price")) : 0;
                    oWizardModel.setProperty("/unitPrice", nPrice);

                    var oFilter = new Filter("material_ID", FilterOperator.EQ, sMaterialId);
                    oVendorSelect.getBinding("items").filter([oFilter]);
                    oVendorSelect.setEnabled(true);
                } else {
                    // oVendorSelect.clearSelection();
                    oWizardModel.setProperty("/materialId", "");
                    oVendorSelect.setEnabled(false);
                    // oWizardModel.setProperty("/vendorId", "");
                    // oWizardModel.setProperty("/unitPrice", 0);
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
            if (oData.materialId && oData.vendorId && oData.quantity > 0) {
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
                    }.bind(this)).catch(function () {
                        MessageToast.show("Error submitting PR.");
                    });
                } else {
                    MessageToast.show("Draft Saved!");
                    this.onCloseDialog();
                }
            }.bind(this)).catch(function () {
                MessageToast.show("Error saving draft.");
            });
        }
    });
});
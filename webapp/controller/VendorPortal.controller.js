sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("mmui5.controller.VendorPortal", {
        
        onInit: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteVendorPortal").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
            this.byId("vendorPoTable").getBinding("items").refresh();
            if (this.byId("goodsReceiptTable")) {
                this.byId("goodsReceiptTable").getBinding("items").refresh();
            }
        },

        onNavBack: function () {
            window.history.go(-1);
        },

        // --- 1. Accept PO Flow ---
        onAcceptPO: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var sPoID = oContext.getProperty("ID");
            var oPoData = oContext.getObject(); 
            var oModel = this.getView().getModel();

            MessageBox.confirm("Accept this Order and generate Goods Receipt?", {
                title: "Confirm Delivery",
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        this._executeAcceptPO(oModel, sPoID, oPoData);
                    }
                }.bind(this)
            });
        },

        _executeAcceptPO: function (oModel, sPoID, oPoData) {
            this.getView().setBusy(true);
            var oAction = oModel.bindContext("/acceptPO(...)");
            oAction.setParameter("poID", sPoID);

            oAction.execute().then(function () {
                this.getView().setBusy(false);
                MessageToast.show("Order Accepted & Goods Receipt Generated!");
                
                oModel.refresh(); 
                this.byId("vendorPoTable").getBinding("items").refresh();
                this.byId("goodsReceiptTable").getBinding("items").refresh();

                // Trigger Dynamic PDF Loader
                var sDate = new Date().toLocaleDateString();
                this._loadPdfLibraryAndGenerate(oPoData.poNumber, oPoData.totalAmount, sDate);

            }.bind(this)).catch(function (oError) {
                this.getView().setBusy(false);
                MessageBox.error("Action failed: " + oError.message);
            }.bind(this));
        },

        // --- 2. On-Demand Download Flow ---
        onDownloadReceipt: function(oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var oGrData = oContext.getObject();
            
            var sPoNumber = oGrData.po ? oGrData.po.poNumber : "Unknown PO";
            var sAmount = oGrData.po ? oGrData.po.totalAmount : "0.00";
            var sDate = new Date(oGrData.postedAt).toLocaleDateString();

            // Trigger Dynamic PDF Loader
            this._loadPdfLibraryAndGenerate(sPoNumber, sAmount, sDate);
        },

        // --- 3. Dynamic Script Loader ---
        _loadPdfLibraryAndGenerate: function(sPoNumber, sAmount, sDate) {
            var that = this;

            // If the library is already loaded, just generate the PDF immediately
            if (window.jspdf && window.jspdf.jsPDF) {
                that._generatePDF(sPoNumber, sAmount, sDate);
                return;
            }

            // Otherwise, show a busy indicator while we download the libraries
            this.getView().setBusy(true);

            // Load jsPDF core first
            jQuery.getScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js")
                .then(function() {
                    // Then load the autoTable plugin
                    return jQuery.getScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js");
                })
                .then(function() {
                    that.getView().setBusy(false);
                    // Libraries successfully loaded, generate the PDF!
                    that._generatePDF(sPoNumber, sAmount, sDate);
                })
                .catch(function() {
                    that.getView().setBusy(false);
                    MessageBox.error("Failed to load PDF libraries from the internet. Please check your connection.");
                });
        },

        // --- 4. PDF Generation Logic ---
        _generatePDF: function (sPoNumber, sAmount, sDate) {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            // 1. Add Header
            doc.setFontSize(22);
            doc.setTextColor(40, 40, 40);
            doc.text("Official Goods Receipt", 105, 20, { align: "center" });

            // 2. Add Company / Vendor Info
            doc.setFontSize(12);
            doc.setTextColor(100, 100, 100);
            doc.text("StockStream Material Management", 14, 40);
            doc.text("Date: " + sDate, 150, 40);
            
            // 3. Add Receipt Details
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.text("Reference Purchase Order: " + sPoNumber, 14, 60);
            doc.text("Status: DELIVERED & POSTED", 14, 70);

            // 4. Add a Table for the totals using autoTable plugin
            doc.autoTable({
                startY: 85,
                head: [['Description', 'Amount (EUR)']],
                body: [
                    ['Total Material Value', sAmount],
                    ['Shipping & Handling', 'Included'],
                    ['Total Paid', sAmount]
                ],
                theme: 'striped',
                headStyles: { fillColor: "#2980b9" } 
            });

            // 5. Add Footer
            doc.setFontSize(10);
            doc.setTextColor(150, 150, 150);
            doc.text("This is a system-generated document. No signature is required.", 105, 280, { align: "center" });

            // 6. Trigger Download
            doc.save("GoodsReceipt_" + sPoNumber + ".pdf");
            MessageToast.show("Downloading PDF...");
        }
    });
});
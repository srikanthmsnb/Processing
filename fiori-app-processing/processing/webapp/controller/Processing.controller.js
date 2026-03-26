sap.ui.define([
	"com/9b/processing/controller/BaseController",
	"sap/ui/core/Fragment",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"com/9b/processing/model/models",
	"sap/ui/core/format/DateFormat"

], function (BaseController, Fragment, Filter, FilterOperator, model, DateFormat) {
	"use strict";

	return BaseController.extend("com.9b.processing.controller.Processing", {
		formatter: model,

		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 **/
		onInit: function () {
			this.hanldeMessageDialog();
			var processingTable = this.getView().byId("processingTable");
			var tableHeader = this.byId("tableHeader");
			processingTable.addEventDelegate({
				onAfterRendering: function () {
					var oBinding = this.getBinding("rows");
					oBinding.attachChange(function (oEvent) {
						var oSource = oEvent.getSource();
						var count = oSource.iLength; //Will fetch you the filtered rows length
						var totalCount = oSource.oList.length;
						tableHeader.setText("Batch (" + count + "/" + totalCount + ")");
					});
				}
			}, processingTable);
			this.combinedFilter = [];
			var that = this;
			setInterval(function () {
				that.loadMasterData();
			}, 1800000);
			if (!this._busyDialog) {
				this._busyDialog = sap.ui.xmlfragment("busy", "com.9b.processing.view.fragments.BusyDialog", this);
				this.getView().addDependent(this._busyDialog);
			}
			this.getOwnerComponent().getRouter(this).attachRoutePatternMatched(this._objectMatched, this);
			sap.ui.core.BusyIndicator.show();
			this.loginCall()
				.then(function () {
					return Promise.all([
						that.getAppConfigData(),
						that.getUsersService()
					]);
				})
				.then(function () {
					return Promise.all([
						that.getMetricsCredentials(),
						that.loadLicenseData()
					]);
				})
				.then(function () {
					sap.ui.core.BusyIndicator.hide();
					console.log("All init calls completed");
				})
				.catch(function (err) {
					console.error("Init flow failed:", err);
				});
		},

		_objectMatched: function (oEvent) {
			if (oEvent.getParameter("name") == "managepackages") {
				this.getView().byId("processingTable").clearSelection();
				var jsonModel = this.getOwnerComponent().getModel("jsonModel");
				jsonModel.setProperty("/tagArray", []);
				jsonModel.setProperty("/isSingleSelect", false);
				jsonModel.setProperty("/sIconTab", "NREP");
				jsonModel.setProperty("/enableChangeGrowth", false);
			}
		},

		loadLicenseData: function () {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			jsonModel.setProperty("/licBusy", true);
			var that = this;
			var compressedLisence = [];
			var authModel = sap.ui.getCore().getModel("authModel");
			var sFilters = "?$filter=Inactive eq 'tNO' and not(startswith(Sublevel1,'SYSTEM'))";
			var sSelect = "&$select=BinCode,U_MetrcLicense,U_MetrcLocation,U_Branch,U_MetrcLocation";
			var order = "&$orderby=U_MetrcLicense asc,BinCode asc";

			var userAccessLicense = jsonModel.getProperty("/userAccessLicense");
			this.readServiecLayer("/b1s/v2/BinLocations" + sFilters + sSelect + order, function (data) {
				jsonModel.setProperty("/licBusy", false);
				if (userAccessLicense && userAccessLicense != undefined && userAccessLicense.length > 0) {
					$.each(userAccessLicense, function (i, m) {
						$.each(data.value, function (j, n) {
							if (m.key == n.U_MetrcLicense) {
								compressedLisence.push(n);
							}
						});

					});

					jsonModel.setProperty("/licenseList", compressedLisence);
					authModel.setProperty("/licenseList", compressedLisence);
					jsonModel.setProperty("/sLinObj", compressedLisence[0]);
					authModel.setProperty("/selectedLicense", compressedLisence[0].U_MetrcLicense);
					jsonModel.setProperty("/selectedLicense", compressedLisence[0].U_MetrcLicense);
					jsonModel.setProperty("/selectedLocation", compressedLisence[0].U_MetrcLocation);
					jsonModel.setProperty("/selectedBincode", compressedLisence[0].BinCode);
					jsonModel.setProperty("/selectedBranchNUM", compressedLisence[0].U_Branch);
					jsonModel.setProperty("/selectedLocationDesc", compressedLisence[0].BinCode + " - " + compressedLisence[0].U_MetrcLicense);
					that.loadMasterData(compressedLisence[0].U_MetrcLocation);
				} else {
					sap.m.MessageBox.error("Locations not available for this user");
				}
			}, false);
		},

		onSearchLicense: function (evt) {
			var oItem = evt.getParameter("suggestionItem");
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			if (oItem) {
				var sObj = oItem.getBindingContext("jsonModel").getObject();
				jsonModel.setProperty("/sLinObj", sObj);
				jsonModel.setProperty("/selectedLicense", sObj.U_MetrcLicense);
				jsonModel.setProperty("/selectedLocation", sObj.U_MetrcLocation);
				jsonModel.setProperty("/selectedBincode", sObj.BinCode);
				jsonModel.setProperty("/selectedWarehouse", sObj.Warehouse);
				jsonModel.setProperty("/selectedAbsEntry", sObj.AbsEntry);
				jsonModel.setProperty("/selectedBranchNUM", sObj.U_Branch);
				this.loadMasterData(sObj.U_MetrcLocation);
				this.loadlocationsData();
			} else if (evt.getParameter("clearButtonPressed")) {
				evt.getSource().fireSuggest();
			}
		},

		loadlocationsData: function () {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var licenseNo = jsonModel.getProperty("/selectedLicense");
			//	var filters = "?$filter=BarCode eq " + "'" + licenseNo + "'";
			var filters = "?$filter=U_MetrcLicense eq " + "'" + licenseNo + "' and not(startswith(BinCode,'LIC'))";
			var fields = "&$select=" + ["U_MetrcLicense", "Sublevel2", "BinCode", "AbsEntry", "Warehouse", "U_MetrcLocation"].join();
			this.readServiecLayer("/b1s/v2/BinLocations" + filters + fields, function (data) {
				jsonModel.setProperty("/binlocationsData", data.value);
			});
		},

		onSuggestLocation: function (event) {
			this.oSF = this.getView().byId("locDropDown");
			var sValue = event.getParameter("suggestValue"),
				aFilters = [];
			if (sValue) {
				aFilters = [
					new Filter([
						new Filter("BinCode", function (sText) {
							return (sText || "").toUpperCase().indexOf(sValue.toUpperCase()) > -1;
						}),
						new Filter("U_MetrcLicense", function (sDes) {
							return (sDes || "").toUpperCase().indexOf(sValue.toUpperCase()) > -1;
						})
					], false)
				];
			}
			this.oSF.getBinding("suggestionItems").filter(aFilters);
			this.oSF.suggest();
		},
		onTabChange: function (evt) {
			this.byId("processingTable").clearSelection();
			this.loadMasterData();
			this.loadlocationsData();
		},
		loadMasterData: function (licenseNo) {
			var that = this;
			var selectedLocation;
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var selectedLocation = jsonModel.getProperty("/selectedLocation");
			var selectedBincode = jsonModel.getProperty("/selectedBincode");
			// if (!selectedLocation && jsonModel.getProperty("/licenseList").length > 0) {
			// selectedLocation = jsonModel.getProperty("/licenseList")[0].U_MetrcLocation;
			// selectedBincode = jsonModel.getProperty("/licenseList")[0].BinCode;
			// }
			// this.loadTagsDataInPkg();
			var selTab = this.byId("metrcLog").getSelectedKey();
			var filters;
			if (selTab == "NREP") {
				filters = "?$filter=Status ne '1' and U_Phase eq 'Package' and endswith(ItemName,'Dry Cannabis') and BinLocationCode eq '" +
					selectedBincode + "'&$orderby=CreateDate desc,METRCUID desc";
			} else if (selTab == "HARV") {
				filters = "?$filter=Status ne '1' and U_Phase eq 'Package' and endswith(ItemName,'Bucked') and BinLocationCode eq '" +
					selectedBincode + "'&$orderby=CreateDate desc,METRCUID desc";
			}
			jsonModel.setProperty("/busyView", true);
			this.readServiecLayer("/b1s/v2/sml.svc/CV_GH_BATCHQUERY_VW" + filters, function (data) {
				jsonModel.setProperty("/busyView", false);
				$.each(data.value, function (i, e) {
					e.reportBusy = true;
					e.LABSTATUS = "Loading...";
				});
				var cDate = new Date();
				var dateFormat = DateFormat.getDateTimeInstance({
					pattern: "KK:mm:ss a"
				});
				var refreshText = dateFormat.format(cDate);
				jsonModel.setProperty("/refreshText", "Last Updated " + refreshText);
				jsonModel.setProperty("/refreshState", "Success");
				that.byId("tableHeader").setText("Batch (" + data.value.length + ")");
				that.byId("tableHeader1").setText("Batch (" + data.value.length + ")");
				jsonModel.setProperty("/packagesData", data.value);
				that.resourcesGetCall();
			});
		},
		resourcesGetCall: function () {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var selectedLocation = jsonModel.getProperty("/selectedLocation");
			var selectedBincode = jsonModel.getProperty("/selectedBincode");
			var filter = "?$filter=Name eq 'Flower' or Name eq 'Smalls'";
			var fields = "&$select=Code,Name,Cost1,Cost2,Cost3,Cost4";
			this.readServiecLayer("/b1s/v2/Resources" + filter + fields, function (data) {
				var arrData = [];
				$.each(data.value, function (i, obj) {
					var add = obj.Cost1 + obj.Cost2 + obj.Cost3;
					arrData.push({
						"Name": obj.Name,
						"sumCost": add
					});

				});
				jsonModel.setProperty("/resourcesGetCallData", arrData);

			});
		},

		loadTagsDataInPkg: function (evt) {
			var that = this;
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var metrcUrl = "/tags/v2/package/available?licenseNumber=" + jsonModel.getProperty("/selectedLicense");
			this.callMetricsGETService(metrcUrl, function (itemData) {
				var pObj = {
					Label: "Select Package Tag"
				};
				itemData.unshift(pObj);
				jsonModel.setProperty("/harvestTagsData", itemData);
			}, function (error) {
				sap.m.MessageToast.show(JSON.stringify(error));
			});
		},

		/*Methods for multiInput for sarch field for scan functionality start*/
		fillFilterLoad: function (elementC, removedText) { //changed by susmita for filter
			var orFilter = [];
			var andFilter = [];
			$.each(elementC.getTokens(), function (i, info) {
				var value = info.getText();
				if (value !== removedText) {
					orFilter.push(new sap.ui.model.Filter("METRCUID", "Contains", value.toLowerCase())); //tag
					orFilter.push(new sap.ui.model.Filter("ItemName", "Contains", value.toLowerCase()));
					orFilter.push(new sap.ui.model.Filter("SourceUID", "Contains", value.toLowerCase())); // location  
					orFilter.push(new sap.ui.model.Filter("WhsName", "Contains", value.toLowerCase()));
					orFilter.push(new sap.ui.model.Filter("HarvestName", "Contains", value.toLowerCase())); // location
					orFilter.push(new sap.ui.model.Filter("CreateDate", "Contains", value.toLowerCase())); //harvest batch 
					orFilter.push(new sap.ui.model.Filter("BinLocationCode", "Contains", value.toLowerCase()));
					orFilter.push(new sap.ui.model.Filter("BinLocationName", "Contains", value.toLowerCase()));
					orFilter.push(new sap.ui.model.Filter("Quantity", "EQ", value.toLowerCase()));
					andFilter.push(new sap.ui.model.Filter({
						filters: orFilter,
						and: false,
						caseSensitive: false
					}));
				}
			});
			this.byId("processingTable").getBinding("rows").filter(andFilter);
		},

		/***method for Buck button function start**/

		onRemoveSelectedTagBuck: function () {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var buckObj = jsonModel.getProperty("/buckObj");
			buckObj.BuckedPackage = "";
			jsonModel.setProperty("/buckObj", buckObj);
		},

		onRemoveSelectedTagTrim: function () {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var buckObj = jsonModel.getProperty("/buckObj");
			buckObj.TrimPackage = "";
			jsonModel.setProperty("/buckObj", buckObj);
		},

		beggingTagScan: function (evt) {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var packageTag = evt.getSource().getValue();
			// jsonModel.setProperty("/beggingTagScanId", packageTag);
			jsonModel.setProperty("/buckObj/BuckedPackage", packageTag);
		},
		beggingTag1Scan: function (evt) {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var packageTag = evt.getSource().getValue();
			jsonModel.setProperty("/buckObj/TrimPackage", packageTag);
		},

		handleBuckButton: function () {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			// this.loadTagsDataInPkg();
			if (!this.toBuck) {
				this.toBuck = sap.ui.xmlfragment("toBuck", "com.9b.processing.view.fragments.Buck", this);
				this.getView().addDependent(this.toBuck);
			}
			var sArrayObj = [],
				that = this;
			this.loadlocationsData();
			var harvestTable = this.byId("processingTable");
			if (harvestTable.getSelectedIndices().length === 0) {
				sap.m.MessageToast.show("Please select a batch");
				return;
			} else {
				var updateObject = harvestTable.getContextByIndex(harvestTable.getSelectedIndex()).getObject();
				jsonModel.setProperty("/batchAbsEntry", updateObject.BatchAbsEntry);
				var buckObj = {
					METRCUID: updateObject.METRCUID,
					Quantity: updateObject.Quantity,
					ItemName: updateObject.ItemName,
					ItemCode: updateObject.ItemCode,
					SourceUID: updateObject.SourceUID,
					HarvestName: updateObject.HarvestName,
					WhsCode: updateObject.WhsCode,
					BinLocationCode: updateObject.BinLocationCode,
					BinLocationName: updateObject.BinLocationName,
					U_MetrcLocation: updateObject.U_MetrcLocation,
					CreateDate: updateObject.CreateDate,
					BuckedItemNum: "",
					BuckedItemName: "",
					BuckedUOMCode: "",
					BtrimItemNum: "",
					BtrimUOMCode: "",
					BtrimItemName: "",
					BuckedQty: "",
					BuckedPackage: "", //"Select Package Tag",
					TrimQty: "",
					TrimPackage: "", //"Select Package Tag",
					WasteQty: "",
					moistLoss: "",
					MainitemUOMCode: ""
				};
				jsonModel.setProperty("/buckObj", buckObj);
				jsonModel.setProperty("/buckObj/BuckedPackage", "");
				jsonModel.setProperty("/buckObj/TrimPackage", "");
				sap.ui.core.Fragment.byId("toBuck", "beggingTag").setSelectedKey("");
				sap.ui.core.Fragment.byId("toBuck", "beggingTag1").setSelectedKey("");
				// var itemCodeList = jsonModel.getProperty("/allItemsList");
				var itemCodeList;
				var jsonModel = this.getOwnerComponent().getModel("jsonModel");
				var encodedStrainName = updateObject.StrainName.replace(/'/g, "''");
				encodedStrainName = encodeURIComponent(encodedStrainName);

				var filters = "?$filter=U_NSTNM eq '" + encodedStrainName + "'";
				var fieldsItem = "&$select=" + ["ItemName", "ItemsGroupCode", "ItemCode", "InventoryUOM", "ProdStdCost", "U_NSTNM"].join();
				this.readServiecLayer("/b1s/v2/Items" + filters + fieldsItem, function (data1) {
					itemCodeList = data1.value;

					var rObj3 = $.grep(itemCodeList, function (item1) {
						if (item1.ItemName && updateObject.ItemName && item1.ItemName.search(updateObject.ItemName) !== -1) {
							return item1;
						}
					});
					buckObj.MainitemUOMCode = rObj3[0].InventoryUOM;

					var rObj1 = $.grep(itemCodeList, function (item1) {
						if (item1.ItemName && updateObject.StrainName && item1.ItemName.search("Bucked") !== -1 && item1.ItemName.search(
								updateObject.StrainName) !==
							-1) {
							return item1;
						}
					});
					if (rObj1.length > 0) {
						var buckedItemName = rObj1[0].ItemName;
						sap.ui.core.Fragment.byId("toBuck", "buckedItemName").setLabel(buckedItemName);
						buckObj.BuckedItemNum = rObj1[0].ItemCode;
						buckObj.BuckedUOMCode = rObj1[0].InventoryUOM;
						buckObj.BuckedItemName = rObj1[0].ItemName;
					} else {
						sap.m.MessageToast.show("Buck Item not found for Selected Item");
					}
					var rObj = $.grep(itemCodeList, function (item) {
						if (item.ItemName && updateObject.StrainName && item.ItemName.search("B-Trim") !== -1 && item.ItemName.search(updateObject.StrainName) !==
							-1) {
							return item;
						}
					});
					if (rObj.length > 0) {
						var trimItemName = rObj[0].ItemName;
						sap.ui.core.Fragment.byId("toBuck", "trimItemName").setLabel(trimItemName);
						buckObj.BtrimItemNum = rObj[0].ItemCode;
						buckObj.BtrimUOMCode = rObj[0].InventoryUOM;
						buckObj.BtrimItemName = rObj[0].ItemName;
					} else {
						sap.m.MessageToast.show("Trim Item not found for Selected Item");
					}

					this.toBuck.open();

				});
			}

		},

		createBuckCancel: function () {
			this.toBuck.close();
		},

		onconfirmBuck: function () {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var bucktoObj = jsonModel.getProperty("/buckObj");
			var binlocationData = jsonModel.getProperty("/binlocationsData");
			var cDate = this.convertUTCDate(new Date());
			var metrcData = jsonModel.getProperty("/metrcData");
			var that = this;
			var toBuck = this.toBuck;
			var count = bucktoObj.length;
			// validation
			var selectedPackages = [];
			var isValidated = true,
				isMoisture = false,
				isWaste = false,
				isTrimEmty = false;

			var qty = Number(Number(bucktoObj.BuckedQty) + Number(bucktoObj.moistLoss) + Number(bucktoObj.TrimQty) + Number(bucktoObj.WasteQty))
			qty = Number(qty.toFixed(3));

			if (qty > bucktoObj.Quantity) {
				isValidated = false;
				sap.m.MessageToast.show("Entered qty is more than available qty.");
				return;
			}
			if (qty < bucktoObj.Quantity) {
				isValidated = false;
				sap.m.MessageToast.show("Entered qty is less than available qty.");
				return;
			}
			if (bucktoObj.Quantity === "") {
				isValidated = false;
				sap.m.MessageToast.show("Entered qty is more than available qty.");
				return;
			}

			if (bucktoObj.moistLoss === "" || bucktoObj.moistLoss === "0") {
				// isValidated = false;
				// sap.m.MessageToast.show("Please enter moisture loss");
				isMoisture = true;
				//	return;
			}
			if (bucktoObj.WasteQty == "" || bucktoObj.WasteQty == "0") {
				isValidated = false;
				sap.m.MessageToast.show("Please enter waste");
				isWaste = true;
				return;
			}

			if (bucktoObj.ItemName.search("Dry Cannabis") === -1 && (bucktoObj.TrimPackage == "" || bucktoObj.TrimPackage ==
					"Select Package Tag")) {
				isValidated = false;
				sap.m.MessageToast.show("Please scan Trim Tag");
				return;
			}
			if (bucktoObj.ItemName.search("Dry Cannabis") === -1 && (bucktoObj.TrimQty == "" || bucktoObj.TrimQty == "0")) {
				isTrimEmty = true;
				return;
			}
			if (Number(bucktoObj.TrimQty) !== 0 && (bucktoObj.TrimPackage == "" || bucktoObj.TrimPackage == "Select Package Tag")) {
				sap.m.MessageToast.show("Please scan Trim Tag");
				return;
			}
			if (Number(bucktoObj.TrimQty) === 0) {
				isTrimEmty = true;
			}
			if ((bucktoObj.TrimPackage !== "" && bucktoObj.TrimPackage !== "Select Package Tag") && Number(bucktoObj.TrimQty) === 0) {
				sap.m.MessageToast.show("Please enter trim quantity");
				return;
			}

			if (bucktoObj.BuckedQty == "" || Number(bucktoObj.BuckedQty) == 0) {
				sap.m.MessageToast.show("Please enter bucked quantity");
				isValidated = false;
				return;
			}
			if (bucktoObj.BuckedPackage == "" || bucktoObj.BuckedPackage == "Select Package Tag") {
				sap.m.MessageToast.show("Please scan Bucked Tag");
				isValidated = false;
				return;
			}
			if ((bucktoObj.BuckedPackage && bucktoObj.TrimPackage) && (bucktoObj.BuckedPackage == bucktoObj.TrimPackage)) {
				sap.m.MessageToast.show("Please scan unique package tags");
				isValidated = false;
				return;
			}

			if (isValidated) {

				var payLoadInventoryEntry = {};
				var payLoadInventoryExit = {};
				var metricPayload = [];

				var adjustMetrc = [{
					Label: bucktoObj.METRCUID,
					Quantity: -Number(bucktoObj.WasteQty),
					UnitOfMeasure: bucktoObj.MainitemUOMCode,
					AdjustmentReason: "Waste (Unusable Product)",
					AdjustmentDate: that.getSystemDate(),
					ReasonNote: "waste"
				}, {
					Label: bucktoObj.METRCUID,
					Quantity: -Number(bucktoObj.moistLoss),
					UnitOfMeasure: bucktoObj.MainitemUOMCode,
					AdjustmentReason: "Weight Change Due to Moisture",
					AdjustmentDate: that.getSystemDate(),
					ReasonNote: "Moisture"
				}];

				if (isMoisture) {
					adjustMetrc.splice(1, 1);
				}
				if (isWaste) {
					adjustMetrc.splice(0, 1);
				}

				var pObj = [{
					//buck metrc payload
					Tag: bucktoObj.BuckedPackage,
					Location: bucktoObj.U_MetrcLocation, //sObj.U_MetrcLocation,
					Item: bucktoObj.BuckedItemName, //sObj.ItemName,
					Quantity: Number(bucktoObj.BuckedQty),
					UnitOfMeasure: bucktoObj.BuckedUOMCode,
					// PatientLicenseNumber: null,
					// Note: sObj.U_NNOTE,
					// IsProductionBatch: false,
					// IsDonation: false,
					// ProductRequiresRemediation: false,
					// UseSameItem: false,
					ActualDate: that.getSystemDate(),
					Ingredients: [{
						Package: bucktoObj.METRCUID,
						Quantity: Number(bucktoObj.BuckedQty),
						UnitOfMeasure: bucktoObj.BuckedUOMCode
					}]
				}, {
					//B-trim metrc payload
					Tag: bucktoObj.TrimPackage,
					Location: bucktoObj.U_MetrcLocation, //sObj.U_MetrcLocation,
					Item: bucktoObj.BtrimItemName, //sObj.ItemName,
					Quantity: Number(bucktoObj.TrimQty),
					UnitOfMeasure: bucktoObj.BtrimUOMCode,
					// PatientLicenseNumber: null,
					// Note: sObj.U_NNOTE,
					// IsProductionBatch: false,
					// IsDonation: false,
					// ProductRequiresRemediation: false,
					// UseSameItem: false,
					ActualDate: that.getSystemDate(),
					Ingredients: [{
						Package: bucktoObj.METRCUID,
						Quantity: Number(bucktoObj.TrimQty),
						UnitOfMeasure: bucktoObj.BtrimUOMCode
					}]
				}];

				if (isTrimEmty) {
					pObj.splice(1, 1);
				}

				// 		metricPayload.push(pObj);
				// 	}
				// });
				this._busyDialog.open();
				jsonModel.setProperty("/busyTitle", "Hang tight...");
				jsonModel.setProperty(
					"/busyText",
					"Processing in progress. Please do not close this window or navigate away until the operation is complete"
				);
				that.readServiecLayer("/b1s/v2/UsersService_GetCurrentUser", function (resP) {
					if (metrcData && metrcData.U_NACST === "X") {
						var metrcUrl = "/packages/v2/?licenseNumber=" + jsonModel.getProperty("/selectedLicense");
						var metrcUrl22 = "/packages/v2/adjust?licenseNumber=" + jsonModel.getProperty("/selectedLicense");
						that.callMetricsService(metrcUrl, "POST", pObj, function () {
							// sap.m.MessageToast.show("METRC sync completed successfully");
							that.callMetricsService(metrcUrl22, "POST", adjustMetrc, function () {
								//		sap.m.MessageToast.show("METRC sync completed successfully");
								that.toBuckTable(isTrimEmty, bucktoObj, that);
							}, function (error) {
								//	sap.m.MessageToast.show(JSON.stringify(error));
							});

							// that.toBuckTable(isTrimEmty, bucktoObj, that);
						}, function (error) {
							//	sap.m.MessageToast.show(JSON.stringify(error));
						}, false);
					} else {
						that.toBuckTable(isTrimEmty, bucktoObj, that);
					}
				});
			}
		},

		toBuckTable: function (isTrimEmty) {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var cDate = this.convertUTCDate(new Date());
			var bucktoObj = jsonModel.getProperty("/buckObj");
			var binlocationData = jsonModel.getProperty("/binlocationsData");
			var metrcData = jsonModel.getProperty("/metrcData");
			var that = this;

			var rObj = $.grep(binlocationData, function (sLoc) {
				if (sLoc.BinCode && sLoc.BinCode == bucktoObj.BinLocationCode) {
					return sLoc;
				}
			});
			var absEntry = rObj[0].AbsEntry;
			var promises = [];
			var payLoadProduction = {
				"ItemNo": bucktoObj.BuckedItemNum, //<Bucked Item>
				"DistributionRule": "PROC",
				"PlannedQuantity": bucktoObj.BuckedQty, //<Bucked Qty>
				"ProductionOrderType": "bopotSpecial",
				"PostingDate": cDate,
				"DueDate": cDate,
				"Warehouse": bucktoObj.WhsCode,
				"Remarks": "Processing - Buck",
				"ProductionOrderLines": [{
					"ItemNo": "L07",
					"ItemType": "pit_Resource",
					"PlannedQuantity": bucktoObj.Quantity, //<Source Package Qty>
					"ProductionOrderIssueType": "im_Backflush",
					"Warehouse": bucktoObj.WhsCode
				}, {
					"ItemNo": bucktoObj.ItemCode, //<Dry Cannabis Item> <Source Package Item Number>
					"DistributionRule": "PROC",
					"PlannedQuantity": Number(bucktoObj.Quantity) - Number(bucktoObj.TrimQty), //<Source Package Qty>
					"ProductionOrderIssueType": "im_Manual",
					"Warehouse": bucktoObj.WhsCode
				}, {
					"ItemNo": "600000", //<Waste Item>
					"PlannedQuantity": -Number(Number(bucktoObj.WasteQty) + Number(bucktoObj.moistLoss)), //<Qty as waste>
					"ProductionOrderIssueType": "im_Manual",
					"Warehouse": bucktoObj.WhsCode

				}]
			};
			var payLoadProduction2 = {
				ItemNo: bucktoObj.BtrimItemNum,
				DistributionRule: "PROC",
				PlannedQuantity: Number(bucktoObj.TrimQty),
				ProductionOrderType: "bopotSpecial",
				PostingDate: cDate,
				DueDate: cDate,
				Warehouse: bucktoObj.WhsCode,
				Remarks: "Processing - Buck",
				ProductionOrderLines: [{
					ItemNo: bucktoObj.ItemCode,
					DistributionRule: "PROC",
					PlannedQuantity: Number(bucktoObj.TrimQty),
					ProductionOrderIssueType: "im_Manual",
					Warehouse: bucktoObj.WhsCode
				}]
			};
			promises.push(that.buckedProOrderCall(bucktoObj, absEntry, payLoadProduction));
			if (!isTrimEmty) {
				promises.push(that.bTrimProOrderCall(bucktoObj, absEntry, payLoadProduction2));
			}

			Promise.all(promises).then(function () {
				var batchAbsEntry = jsonModel.getProperty("/batchAbsEntry");
				var updatePayload = {
					Status: "bdsStatus_NotAccessible"
				};
				that.updateServiecLayer(
					"/b1s/v2/BatchNumberDetails(" + batchAbsEntry + ")",
					function () {

						that.toBuck.close();
						that.byId("processingTable").clearSelection();
						that.loadMasterData();

						jsonModel.setProperty("/busyTitle", "✅ All set!");
						jsonModel.setProperty("/busyText", "Processing completed successfully.");

						setTimeout(function () {
							that._busyDialog.close();
						}, 1000);

					},
					updatePayload,
					"PATCH"
				);

			});

		},

		buckedProOrderCall: function (bucktoObj, absEntry, payLoadProduction) {
			var that = this;
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			return new Promise(function (resolve, reject) {
				var batchUrl = [];
				that.updateServiecLayer("/b1s/v2/ProductionOrders", function (res) {
					var docNUM = res.AbsoluteEntry;
					var fisrtPatchCall = {
						ProductionOrderStatus: "boposReleased"
					};
					batchUrl.push({
						url: "/b1s/v2/ProductionOrders(" + Number(docNUM) + ")",
						data: fisrtPatchCall,
						method: "PATCH"
					});
					// -------- Inventory Entry Payload --------
					var payLoadInventoryEntry = {
						"BPL_IDAssignedToInvoice": jsonModel.getProperty("/sLinObj").U_Branch,
						"Comments": "processing - Buck - Entry",
						"DocumentLines": [{
							"LineNum": 0,
							"BaseType": 202,
							"BaseEntry": Number(docNUM),
							// "BaseLine": 1,
							"WarehouseCode": bucktoObj.WhsCode,
							"Quantity": bucktoObj.BuckedQty,
							"BatchNumbers": [{
								"BatchNumber": bucktoObj.BuckedPackage, // <THIS IS TAG> 
								"Quantity": bucktoObj.BuckedQty, //<THIS IS THE QTY OF CLONES>
								"Location": bucktoObj.BinLocationCode,
								"ManufacturerSerialNumber": bucktoObj.HarvestName,
								"U_BatAttr3": bucktoObj.METRCUID,
								"U_IsPackage": "YES",
								"U_Phase": "Package",
							}],
							"DocumentLinesBinAllocations": [{
								"BinAbsEntry": Number(absEntry), //
								"Quantity": bucktoObj.BuckedQty,
								"SerialAndBatchNumbersBaseLine": 0
							}]
						}, {

							"LineNum": 1,
							"BaseType": 202,
							"BaseEntry": Number(docNUM),
							"BaseLine": 2,
							//"ItemCode": itemObj.U_NITCD, //<THIS IS SELECTED ITEM> 
							"WarehouseCode": bucktoObj.WhsCode,
							"Quantity": bucktoObj.WasteQty,
							//"UnitPrice": ProdStdCost,
							"BatchNumbers": [{
								"BatchNumber": bucktoObj.METRCUID, //
								"Quantity": bucktoObj.WasteQty, //<THIS IS THE QTY OF CLONE
								"Location": bucktoObj.BinLocationCode,
								"ManufacturerSerialNumber": bucktoObj.HarvestName, //harvest name
								"U_BatAttr3": bucktoObj.METRCUID,
								// "U_IsPackage": "YES",
								// "U_Phase": "Package",
							}],
							"DocumentLinesBinAllocations": [{
								"BinAbsEntry": Number(absEntry), //
								"Quantity": bucktoObj.WasteQty,
								"SerialAndBatchNumbersBaseLine": 0
							}]

						}]
					};

					var payLoadInventoryExit = {
						"BPL_IDAssignedToInvoice": jsonModel.getProperty("/sLinObj").U_Branch,
						"Comments": "Processing - Buck - Exit",
						"DocumentLines": [{
							"LineNum": 0,
							"BaseType": 202,
							"BaseEntry": Number(docNUM),
							"BaseLine": 1,
							"Quantity": Number(bucktoObj.Quantity) - Number(bucktoObj.TrimQty),
							"WarehouseCode": bucktoObj.WhsCode,
							"BatchNumbers": [{
								"BatchNumber": bucktoObj.METRCUID, // <THIS IS TAG>
								"Quantity": Number(bucktoObj.Quantity) - Number(bucktoObj.TrimQty),
								"Location": bucktoObj.BinLocationCode //<THIS IS FROM CLONE ROOM>
							}],
							"DocumentLinesBinAllocations": [{
								"BinAbsEntry": Number(absEntry),
								"Quantity": Number(bucktoObj.Quantity) - Number(bucktoObj.TrimQty),
								"SerialAndBatchNumbersBaseLine": 0
							}]
						}]
					};

					batchUrl.push({
						url: "/b1s/v2/InventoryGenEntries",
						data: payLoadInventoryEntry,
						method: "POST"
					});

					batchUrl.push({
						url: "/b1s/v2/InventoryGenExits",
						data: payLoadInventoryExit,
						method: "POST"
					});

					var secondPatchCall = {
						ProductionOrderStatus: "boposClosed"
					};

					batchUrl.push({
						url: "/b1s/v2/ProductionOrders(" + Number(docNUM) + ")",
						data: secondPatchCall,
						method: "PATCH"
					});

					if (batchUrl.length > 0) {
						that.BatchCall(batchUrl, function (res) {
							if (res && res.length > 0) {
								reject();
							} else {
								resolve();
							}

						});

					} else {
						reject();
					}

				}.bind(that), payLoadProduction, "POST");
			});
		},

		bTrimProOrderCall: function (bucktoObj, absEntry, payLoadProduction2) {
			var that = this;
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var cDate = this.convertUTCDate(new Date());
			return new Promise(function (resolve, reject) {
				var batchUrl2 = [];
				that.updateServiecLayer("/b1s/v2/ProductionOrders", function (res) {
					var docNUM = res.AbsoluteEntry;
					var fisrtPatchCall2 = {
						ProductionOrderStatus: "boposReleased"
					};
					batchUrl2.push({
						url: "/b1s/v2/ProductionOrders(" + Number(docNUM) + ")",
						data: fisrtPatchCall2,
						method: "PATCH"
					});

					var payLoadInventoryEntry2 = {
						"BPL_IDAssignedToInvoice": jsonModel.getProperty("/sLinObj").U_Branch,
						"Comments": "processing - Buck - Entry",
						"DocumentLines": [{
							"LineNum": 0,
							"BaseType": 202,
							"BaseEntry": Number(docNUM),
							//	"BaseLine": 3,
							//"ItemCode": itemObj.U_NITCD, //<THIS IS SELECTED ITEM> 
							"WarehouseCode": bucktoObj.WhsCode,
							"Quantity": bucktoObj.TrimQty,
							//"UnitPrice": ProdStdCost,
							"BatchNumbers": [{
								"BatchNumber": bucktoObj.TrimPackage, // 
								"Quantity": bucktoObj.TrimQty, //<THIS IS THE QTY OF CLONE
								"Location": bucktoObj.BinLocationCode,
								"ManufacturerSerialNumber": bucktoObj.HarvestName, //harvest name
								"U_BatAttr3": bucktoObj.METRCUID,
								"U_IsPackage": "YES",
								"U_Phase": "Package",
							}],
							"DocumentLinesBinAllocations": [{
								"BinAbsEntry": Number(absEntry), //
								"Quantity": bucktoObj.TrimQty,
								"SerialAndBatchNumbersBaseLine": 0
							}]
						}]
					};

					var payLoadInventoryExit2 = {
						"BPL_IDAssignedToInvoice": jsonModel.getProperty("/sLinObj").U_Branch,
						"Comments": "Processing - Buck - Exit",
						"DocumentLines": [{
							"LineNum": 0,
							"BaseType": 202,
							"BaseEntry": Number(docNUM),
							"BaseLine": 0,
							"Quantity": Number(bucktoObj.TrimQty),
							"WarehouseCode": bucktoObj.WhsCode,
							"BatchNumbers": [{
								"BatchNumber": bucktoObj.METRCUID, // <THIS IS TAG>
								"Quantity": Number(bucktoObj.TrimQty), //<THIS IS THE QTY OF CLONES>
								"Location": bucktoObj.BinLocationCode //<THIS IS FROM CLONE ROOM>
							}],
							"DocumentLinesBinAllocations": [{
								"BinAbsEntry": Number(absEntry),
								"Quantity": Number(bucktoObj.TrimQty),
								"SerialAndBatchNumbersBaseLine": 0
							}]
						}]
					};

					batchUrl2.push({
						url: "/b1s/v2/InventoryGenEntries",
						data: payLoadInventoryEntry2,
						method: "POST"
					});
					batchUrl2.push({
						url: "/b1s/v2/InventoryGenExits",
						data: payLoadInventoryExit2,
						method: "POST"
					});

					var secondPatchCall2 = {
						ProductionOrderStatus: "boposClosed"
					};

					batchUrl2.push({
						url: "/b1s/v2/ProductionOrders(" + Number(docNUM) + ")",
						data: secondPatchCall2,
						method: "PATCH"
					});

					if (batchUrl2.length > 0) {
						that.BatchCall(batchUrl2, function (res) {
							if (res && res.length > 0) {
								reject();
							} else {
								resolve();
							}
						});
					} else {
						reject();
					}
				}.bind(that), payLoadProduction2, "POST");
			});

		},

		/***method for Buck button function end**/

		/******* Report completion Mold starts *****/

		beggingTagMoldScan: function (evt) {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var packageTag = evt.getSource().getValue();
			jsonModel.setProperty("/moldObj/moldTag", packageTag);
		},

		handleReportCompletionMold: function () {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			jsonModel.setProperty("/moldObj/moldTag", "");
			var that = this;
			// this.loadTagsDataInPkg();
			if (!this.reportCompletionMold) {
				this.reportCompletionMold = sap.ui.xmlfragment("reportCompletionMold", "com.9b.processing.view.fragments.ReportCompletionMold",
					this);
				this.getView().addDependent(this.reportCompletionMold);
			}
			sap.ui.core.Fragment.byId("reportCompletionMold", "beggingTagMold").setSelectedKey("");
			var sArrayObj = [];
			this.loadlocationsData();
			var harvestTable = this.byId("processingTable");
			if (harvestTable.getSelectedIndices().length === 0) {
				sap.m.MessageToast.show("Please select a batch");
				return;
			} else {
				var updateObject = harvestTable.getContextByIndex(harvestTable.getSelectedIndex()).getObject();
				jsonModel.setProperty("/batchAbsEntry", updateObject.BatchAbsEntry);
				var moldObj = {
					METRCUID: updateObject.METRCUID,
					Quantity: updateObject.Quantity,
					ItemName: updateObject.ItemName,
					ItemCode: updateObject.ItemCode,
					SourceUID: updateObject.SourceUID,
					HarvestName: updateObject.HarvestName,
					WhsCode: updateObject.WhsCode,
					BinLocationCode: updateObject.BinLocationCode,
					BinLocationName: updateObject.BinLocationName,
					U_MetrcLocation: updateObject.U_MetrcLocation,
					CreateDate: updateObject.CreateDate,
					BuckedUOMCode: "",
					moldItemCode: "",
					moldItemName: "",
					moldUOMCode: "",
					moldQty: "",
					moldTag: "", //"Select Package Tag",
					WasteQty: "",
				};
				jsonModel.setProperty("/moldObj", moldObj);
				// var itemCodeList = jsonModel.getProperty("/allItemsList");

				var itemCodeList;
				var jsonModel = this.getOwnerComponent().getModel("jsonModel");
				var encodedStrainName = updateObject.StrainName.replace(/'/g, "''");
				encodedStrainName = encodeURIComponent(encodedStrainName);
				var filters = "?$filter=U_NSTNM eq '" + encodedStrainName + "'";
				var fieldsItem = "&$select=" + ["ItemName", "ItemsGroupCode", "ItemCode", "InventoryUOM", "ProdStdCost", "U_NSTNM"].join();;
				that.readServiecLayer("/b1s/v2/Items" + filters + fieldsItem, function (data1) {

					itemCodeList = data1.value;

					var rObj3 = $.grep(itemCodeList, function (item1) {
						if (item1.ItemName && updateObject.ItemName && item1.ItemName !== "" && item1.ItemName.search(updateObject.ItemName) !== -
							1) {
							return item1;
						}
					});
					moldObj.BuckedUOMCode = rObj3[0].InventoryUOM;

					var rObj = $.grep(itemCodeList, function (item) {
						if (item.ItemName && updateObject.StrainName && item.ItemName !== "" && item.ItemName.search("Mold") !== -1 && item.ItemName
							.search(
								updateObject.StrainName) !== -1) {
							return item;
						}
					});
					if (rObj.length > 0) {
						var trimItemName = rObj[0].ItemName;
						// sap.ui.core.Fragment.byId("reportCompletionMold", "reportMold").setLabel(trimItemName);
						moldObj.moldItemCode = rObj[0].ItemCode;
						moldObj.moldUOMCode = rObj[0].InventoryUOM;
						moldObj.moldItemName = rObj[0].ItemName;
					} else {
						sap.m.MessageToast.show("Mold Item not found for Selected Item");
					}

					this.reportCompletionMold.open();

				});
			}

		},

		ReportCompletionMoldCancel: function () {
			this.reportCompletionMold.close();
		},

		onconfirmReportCompletionMold: function () {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var moldtoObj = jsonModel.getProperty("/moldObj");
			var binlocationData = jsonModel.getProperty("/binlocationsData");
			var cDate = this.convertUTCDate(new Date());
			var metrcData = jsonModel.getProperty("/metrcData");
			var that = this;
			var reportCompletionMold = this.reportCompletionMold;
			var count = moldtoObj.length;
			// validation
			var selectedPackages = [];
			var isValidated = true,
				isWaste = true,
				qty = Number(Number(moldtoObj.moldQty) + Number(moldtoObj.WasteQty));
			qty = Number(qty.toFixed(3));

			if (moldtoObj.Quantity === "") {
				isValidated = false;
				sap.m.MessageToast.show("Select a package with more than 0 qty.");
				return;
			}
			if (moldtoObj.Quantity != "" && moldtoObj.moldTag == "") {
				isValidated = false;
				sap.m.MessageToast.show("please Scan package tag");
				return;
			}
			if (qty > moldtoObj.Quantity) {
				isValidated = false;
				sap.m.MessageToast.show("Entered qty is more than available qty.");
				return;
			}
			if (qty < moldtoObj.Quantity) {
				isValidated = false;
				sap.m.MessageToast.show("Entered qty is less than available qty.");
				return;
			}

			if (moldtoObj.WasteQty == "" || moldtoObj.WasteQty == "0") {
				isWaste = false;
			}

			if (isValidated) {
				var metricPayload = [];
				var adjustMetrc = [{
					Label: moldtoObj.METRCUID,
					Quantity: -Number(moldtoObj.WasteQty),
					UnitOfMeasure: moldtoObj.BuckedUOMCode,
					AdjustmentReason: "Waste (Unusable Product)",
					AdjustmentDate: that.getSystemDate(),
					ReasonNote: "waste"
				}];

				var pObj = [{
					//mold metrc payload
					Tag: moldtoObj.moldTag,
					Location: moldtoObj.U_MetrcLocation, //sObj.U_MetrcLocation,
					Item: moldtoObj.moldItemName, //sObj.ItemName,
					Quantity: Number(moldtoObj.moldQty),
					UnitOfMeasure: moldtoObj.moldUOMCode,
					// PatientLicenseNumber: null,
					// Note: sObj.U_NNOTE,
					// IsProductionBatch: false,
					// IsDonation: false,
					// ProductRequiresRemediation: false,
					// UseSameItem: false,
					ActualDate: that.getSystemDate(),
					Ingredients: [{
						Package: moldtoObj.METRCUID,
						Quantity: Number(moldtoObj.moldQty),
						UnitOfMeasure: moldtoObj.moldUOMCode
					}]
				}];

				// 		metricPayload.push(pObj);
				// 	}
				// });
				this._busyDialog.open();
				jsonModel.setProperty("/busyTitle", "Hang tight...");
				jsonModel.setProperty(
					"/busyText",
					"Record Completion(Mold) in progress. Please do not close this window or navigate away until the operation is complete"
				);
				if (metrcData && metrcData.U_NACST === "X") {
					var metrcUrl = "/packages/v2/?licenseNumber=" + jsonModel.getProperty("/selectedLicense");
					var metrcUrl22 = "/packages/v2/adjust?licenseNumber=" + jsonModel.getProperty("/selectedLicense");
					that.callMetricsService(metrcUrl, "POST", pObj, function () {
						// sap.m.MessageToast.show("METRC sync completed successfully");
						if (isWaste) {
							that.callMetricsService(metrcUrl22, "POST", adjustMetrc, function () {
								sap.m.MessageToast.show("METRC sync completed successfully");
							}, function (error) {
								//	sap.m.MessageToast.show(JSON.stringify(error));

							});
						}

						that.reportCompletionMoldTable(isWaste);
					}, function (error) {
						sap.m.MessageToast.show(JSON.stringify(error));

					});
				} else {
					that.reportCompletionMoldTable(isWaste);
				}
			}
		},

		reportCompletionMoldTable: function (isWaste) {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var cDate = this.convertUTCDate(new Date());
			var moldtoObj = jsonModel.getProperty("/moldObj");
			var binlocationData = jsonModel.getProperty("/binlocationsData");
			var metrcData = jsonModel.getProperty("/metrcData");
			var that = this;
			var batchUrl = [];
			var payLoadProduction = {
				"ItemNo": moldtoObj.moldItemCode, //<main Item>
				"DistributionRule": "PROC",
				"PlannedQuantity": Number(moldtoObj.moldQty), //<main Qty>
				"ProductionOrderType": "bopotSpecial",
				"PostingDate": cDate,
				"DueDate": cDate,
				"Warehouse": moldtoObj.WhsCode,
				"ProductionOrderLines": [{
					"ItemNo": moldtoObj.ItemCode, //<bucked Item> <Source Package Item Number>
					"DistributionRule": "PROC",
					"PlannedQuantity": Number(moldtoObj.Quantity), //<Source Package Qty>
					"ProductionOrderIssueType": "im_Manual",
					"Warehouse": moldtoObj.WhsCode
				}, {
					"ItemNo": "600000", //<Waste Item>
					"PlannedQuantity": -Number(moldtoObj.WasteQty), //<Qty as waste>
					"ProductionOrderIssueType": "im_Manual",
					"Warehouse": moldtoObj.WhsCode

				}]
			};

			if (!isWaste) {
				payLoadProduction.ProductionOrderLines.splice(1, 1);
			}

			var rObj = $.grep(binlocationData, function (sLoc) {
				if (sLoc.BinCode && sLoc.BinCode == moldtoObj.BinLocationCode) {
					return sLoc;
				}
			});
			var absEntry = rObj[0].AbsEntry;
			that.updateServiecLayer("/b1s/v2/ProductionOrders", function (res) {
				var docNUM = res.AbsoluteEntry;
				var fisrtPatchCall = {
					"ProductionOrderStatus": "boposReleased",
				};
				batchUrl.push({
					url: "/b1s/v2/ProductionOrders(" + Number(docNUM) + ")",
					data: fisrtPatchCall,
					method: "PATCH"
				});

				var payLoadInventoryEntry = {
					"BPL_IDAssignedToInvoice": jsonModel.getProperty("/sLinObj").U_Branch,
					"Comments": "Processing app - report completion(Mold) - Entry",
					"DocumentLines": [{
						"LineNum": 0,
						"BaseType": 202,
						"BaseEntry": Number(docNUM),
						"WarehouseCode": moldtoObj.WhsCode,
						"Quantity": Number(moldtoObj.moldQty),
						"BatchNumbers": [{
							"BatchNumber": moldtoObj.moldTag, // <THIS IS TAG> 
							"Quantity": Number(moldtoObj.moldQty), //<THIS IS THE QTY OF CLONES>
							"Location": moldtoObj.BinLocationCode,
							"ManufacturerSerialNumber": moldtoObj.HarvestName,
							"U_BatAttr3": moldtoObj.METRCUID,
							"U_IsPackage": "YES",
							"U_Phase": "Package",
						}],
						"DocumentLinesBinAllocations": [{
							"BinAbsEntry": Number(absEntry), //
							"Quantity": Number(moldtoObj.moldQty),
							"SerialAndBatchNumbersBaseLine": 0
						}]
					}, {

						"LineNum": 1,
						"BaseType": 202,
						"BaseEntry": Number(docNUM),
						"BaseLine": 1,
						//"ItemCode": itemObj.U_NITCD, //<THIS IS SELECTED ITEM> 
						"WarehouseCode": moldtoObj.WhsCode,
						"Quantity": Number(moldtoObj.WasteQty),
						//"UnitPrice": ProdStdCost,
						"BatchNumbers": [{
							"BatchNumber": moldtoObj.METRCUID, //
							"Quantity": Number(moldtoObj.WasteQty), //<THIS IS THE QTY OF CLONE
							"Location": moldtoObj.BinLocationCode,
							"ManufacturerSerialNumber": moldtoObj.HarvestName, //harvest name
							"U_BatAttr3": moldtoObj.METRCUID,
							// "U_IsPackage": "YES",
							// "U_Phase": "Package",
						}],
						"DocumentLinesBinAllocations": [{
							"BinAbsEntry": Number(absEntry), //
							"Quantity": Number(moldtoObj.WasteQty),
							"SerialAndBatchNumbersBaseLine": 0
						}]

					}]
				};

				if (!isWaste) {
					payLoadInventoryEntry.DocumentLines.splice(1, 1);
				}

				var payLoadInventoryExit = {
					"BPL_IDAssignedToInvoice": jsonModel.getProperty("/sLinObj").U_Branch,
					"Comments": "Processing app - report completion(Mold) - Exit",
					"DocumentLines": [{
						"BaseType": 202,
						"BaseEntry": Number(docNUM),
						"BaseLine": 0,
						"Quantity": moldtoObj.Quantity,
						"WarehouseCode": moldtoObj.WhsCode,
						"BatchNumbers": [{
							"BatchNumber": moldtoObj.METRCUID, // <THIS IS TAG>
							"Quantity": moldtoObj.Quantity, //<THIS IS THE QTY OF CLONES>
							"Location": moldtoObj.BinLocationCode //<THIS IS FROM CLONE ROOM>
						}],
						"DocumentLinesBinAllocations": [{
							"BinAbsEntry": Number(absEntry),
							"Quantity": moldtoObj.Quantity,
							"SerialAndBatchNumbersBaseLine": 0
						}]
					}]
				};

				batchUrl.push({
					url: "/b1s/v2/InventoryGenEntries",
					data: payLoadInventoryEntry,
					method: "POST"
				});

				batchUrl.push({
					url: "/b1s/v2/InventoryGenExits",
					data: payLoadInventoryExit,
					method: "POST"
				});

				var secondPatchCall = {
					"ProductionOrderStatus": "boposClosed",
				};
				batchUrl.push({
					url: "/b1s/v2/ProductionOrders(" + Number(docNUM) + ")",
					data: secondPatchCall,
					method: "PATCH"
				});

				if (batchUrl.length > 0) {

					that.createBatchCall(batchUrl, function () {

						var batchAbsEntry = jsonModel.getProperty("/batchAbsEntry");
						var finishObj = {
							Label: moldtoObj.METRCUID,
							ActualDate: that.getSystemDate()
						};

						var updatePayload = {
							"Status": "bdsStatus_NotAccessible"
						};

						var metricFinishPayload = [];
						metricFinishPayload.push(finishObj);

						if (metrcData && metrcData.U_NACST === "X") {
							var metrcFinishUrl = "/packages/v2/finish?licenseNumber=" + jsonModel.getProperty("/selectedLicense");
							that.callMetricsService(metrcFinishUrl, "PUT", metricFinishPayload, function () {

								that.updateServiecLayer("/b1s/v2/BatchNumberDetails(" + batchAbsEntry + ")", function () {
									that.reportCompletionMold.close();
									/*	sap.m.MessageToast.show("Package created successfully");
											jsonModel.setProperty("/busyView", false);*/
									jsonModel.setProperty("/busyTitle", "✅ All set!");
									jsonModel.setProperty("/busyText", "Record Completion(Mold) completed successfully.");
									setTimeout(function () {
										that._busyDialog.close();
									}, 1000);
									that.byId("processingTable").clearSelection();
									that.loadMasterData();

								}, updatePayload, "PATCH");

							}, function (error) {
								/*	sap.m.MessageToast.show(JSON.stringify(error));
									that.reportCompletionMold.close();
									sap.m.MessageToast.show("Package created successfully");
									that.byId("processingTable").clearSelection();
									that.loadMasterData();*/
							});

						} else {

							that.updateServiecLayer("/b1s/v2/BatchNumberDetails(" + batchAbsEntry + ")", function () {
								that.reportCompletionMold.close();
								/*	jsonModel.setProperty("/busyView", false);
									sap.m.MessageToast.show("Package created successfully");*/
								jsonModel.setProperty("/busyTitle", "✅ All set!");
								jsonModel.setProperty("/busyText", "Record Completion(Mold) completed successfully.");
								setTimeout(function () {
									that._busyDialog.close();
								}, 1000);
								that.byId("processingTable").clearSelection();
								that.loadMasterData();

							}, updatePayload, "PATCH");
						}

					});
				}
			}.bind(that), payLoadProduction, "POST");

		},

		/******* Report completion Mold ends *****/

		/***method for RecordTrimEvent button function start**/
		handleRecordTrimEvent: function () {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var harvestPlannerTable = this.getView().byId("processingTable");
			if (harvestPlannerTable.getSelectedIndices().length === 0) {
				sap.m.MessageToast.show("Please select atleast one batch");
				return;
			} else {
				if (!this.recordTrimDialog) {
					this.recordTrimDialog = sap.ui.xmlfragment("editHarvest", "com.9b.processing.view.fragments.RecordTrimEvent", this);
					this.getView().addDependent(this.recordTrimDialog);
				}
				var updateObject = harvestPlannerTable.getContextByIndex(harvestPlannerTable.getSelectedIndex()).getObject();
				var recTrimObj = {
					METRCUID: updateObject.METRCUID,
					Quantity: updateObject.Quantity,
					ItemName: updateObject.ItemName,
					Flower: "",
					Smalls: "",
					Atrim: "",
					Popcorn: "",
					Kief: "",
					Waste: ""
				};
				jsonModel.setProperty("/recTrimObj", recTrimObj);
				this.loadDataTorecordTrim();
				this.recordTrimDialog.open();
			}
		},
		createRecordTrimCancel: function () {
			this.recordTrimDialog.close();
		},
		onChange: function (evt) {
			var sModel = this.recordTrimDialog.getModel();
			var trimEventFields = sModel.getProperty("/trimEventFields");
			var payLoadCreateHarvest = this.buildPayload(trimEventFields);
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var bulkHarvestObj = jsonModel.getProperty("/recTrimObj");
			var Total = 0;
			for (var key in payLoadCreateHarvest) {
				Total = Total + Number(payLoadCreateHarvest[key]);
			}
			var Quantity = bulkHarvestObj.Quantity;

			if (Quantity > Total) {
				sap.m.MessageToast.show("Entered qty is less than available qty.");
				return;
			}
			if (Quantity < Total) {
				sap.m.MessageToast.show("Entered qty is more than available qty.");
				return;
			}
			//	}
		},
		confirmRecordTrim: function () {
			var that = this;
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var bulkHarvestObj = jsonModel.getProperty("/recTrimObj");
			var payLoadCreateHarvestHeader = {
				U_METRCUID: bulkHarvestObj.METRCUID,
				U_NQTY: bulkHarvestObj.Quantity,
				U_NITEM: bulkHarvestObj.ItemName
			};
			var Quantity = Number(bulkHarvestObj.Quantity);
			var sModel = this.recordTrimDialog.getModel();
			var trimEventFields = sModel.getProperty("/trimEventFields");
			var payLoadCreateHarvestTable = this.buildPayload(trimEventFields);
			const payLoadCreateHarvest = Object.assign({}, payLoadCreateHarvestHeader, payLoadCreateHarvestTable);

			var Total = 0;
			for (var key in payLoadCreateHarvest) {
				Total = Total + Number(payLoadCreateHarvest[key]);
			}

			if (Quantity > Total) {
				sap.m.MessageToast.show("Entered qty is less than available qty.");
				return;
			}
			if (Quantity < Total) {
				sap.m.MessageToast.show("Entered qty is more than available qty.");
				return;
			}

			var licenseNo = jsonModel.getProperty("/selectedLicense");

			jsonModel.setProperty("/errorTxt", []);
			jsonModel.setProperty("/busyTitle", "Hang tight...");
			this._busyDialog.open();
			jsonModel.setProperty(
				"/busyText",
				"Record trimming is in progress. Please keep this window open until the operation completes."
			);
			that.updateServiecLayer("/b1s/v2/NTREL", function () {
				var errorTxt = jsonModel.getProperty("/errorTxt");
				if (errorTxt.length > 0) {
					sap.m.MessageBox.error(errorTxt.join("\n"));
				} else {
					sap.m.MessageToast.show("Trim event is recorded.");
				}
				jsonModel.setProperty("/busyTitle", "✅ All set!");
				jsonModel.setProperty("/busyText", "The record trim event completed successfully");
				setTimeout(function () {
					that._busyDialog.close();
				}, 1000);
				that.recordTrimDialog.close();
				that.loadMasterData();
				that.byId("processingTable").setSelectedIndex(-1);
			}.bind(that), payLoadCreateHarvest, "POST");
		},
		/***method for RecordTrimEvent button function end**/

		/***method for ViewTrimEvent button function start**/
		handleViewTrimEvent: function () {
			var harvestPlannerTable = this.getView().byId("processingTable");
			if (harvestPlannerTable.getSelectedIndices().length === 0) {
				sap.m.MessageToast.show("Please select atleast one batch");
				return;
			} else {

				// if (!this.viewTrimDialog) {
				// 	this.viewTrimDialog = sap.ui.xmlfragment("viewTrim", "com.9b.processing.view.fragments.ViewTrimEvent", this);
				// 	this.getView().addDependent(this.viewTrimDialog);
				// }
				var updateObject = harvestPlannerTable.getContextByIndex(harvestPlannerTable.getSelectedIndex()).getObject();
				this.loadViewTrimData(updateObject.METRCUID);
				// this.viewTrimDialog.open();
			}
		},
		loadViewTrimData: function (METRCUID) {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var that = this;

			var orderlines = "&$orderby=DocNum asc";
			var filtersLine = "?$filter=U_METRCUID eq '" + METRCUID + "'";
			jsonModel.setProperty("/busyView", true);
			that.readServiecLayer("/b1s/v2/NTREL" + filtersLine + orderlines, function (data) {
				jsonModel.setProperty("/trimData", data.value);
					jsonModel.setProperty("/busyView", false);
				that.handleExportToExcel();
			});
		},
		templateTransClose: function () {
			this.viewTrimDialog.close();
		},
		handleExportToExcel: function () {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var metrcdiscrepancyData = jsonModel.getProperty("/trimData");
			var MDexportData = [],
				SBexportData = [];
			var that = this;
			if (metrcdiscrepancyData.length > 0) {
				//Plants Report

				const wb = XLSX.utils.book_new();
				metrcdiscrepancyData.forEach((record, index) => {
					const rows = that._convertToTableFormat(record);
					// Convert JSON → Sheet
					const ws = XLSX.utils.json_to_sheet(rows);
					ws['!cols'] = [{
						wch: 20
					}, {
						wch: 20
					}, {
						wch: 10
					}, {
						wch: 10
					}, {
						wch: 10
					}, {
						wch: 10
					}];
					// Sheet name (max 31 chars)
					const sheetName = "Record_" + (index + 1);
					XLSX.utils.book_append_sheet(wb, ws, sheetName);
				});

				// Download Excel
				XLSX.writeFile(wb, "Trim Event.xlsx");
			} else {
				sap.m.MessageToast.show("Data not present to export");
				return;
			}

		},
		/***method for ViewTrimEvent button function end**/

		/***method for RecordCompletation button function start**/

		beggingTag11Scan: function (evt) {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var packageTag = evt.getSource().getValue();
			jsonModel.setProperty("/displayrecCompletionObj/0/flowerTag", packageTag);
		},
		beggingTag2Scan: function (evt) {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var packageTag = evt.getSource().getValue();
			jsonModel.setProperty("/displayrecCompletionObj/1/BflowerTag", packageTag);
		},
		beggingTag3Scan: function (evt) {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var packageTag = evt.getSource().getValue();
			jsonModel.setProperty("/displayrecCompletionObj/2/smallTag", packageTag);
		},
		beggingTag4Scan: function (evt) {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var packageTag = evt.getSource().getValue();
			jsonModel.setProperty("/displayrecCompletionObj/3/BsmallTag", packageTag);
		},
		beggingTag5Scan: function (evt) {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var packageTag = evt.getSource().getValue();
			jsonModel.setProperty("/displayrecCompletionObj/4/popcornTag", packageTag);
		},
		beggingTag6Scan: function (evt) {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var packageTag = evt.getSource().getValue();
			jsonModel.setProperty("/displayrecCompletionObj/5/AtrimTag", packageTag);
		},
		beggingTag7Scan: function (evt) {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var packageTag = evt.getSource().getValue();
			jsonModel.setProperty("/displayrecCompletionObj/6/BtrimTag", packageTag);
		},
		beggingTag8Scan: function (evt) {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var packageTag = evt.getSource().getValue();
			jsonModel.setProperty("/displayrecCompletionObj/7/moldTag", packageTag);
		},

		onChangeValue: function (evt) {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var recCompObj = jsonModel.getProperty("/recCompletionObj");
			var Quantity = recCompObj.Quantity;
			var Flower = Number(recCompObj.Flower);
			var Flower1 = Number(recCompObj.Flower1)
			var Smalls = Number(recCompObj.Smalls);
			var Smalls1 = Number(recCompObj.Smalls1);
			var Popcorn = Number(recCompObj.Popcorn);
			var Atrim = Number(recCompObj.Atrim);
			var Btrim = Number(recCompObj.Btrim);
			var Mold = Number(recCompObj.Mold);
			var Waste = Number(recCompObj.Waste);
			var Total = Flower + Flower1 + Smalls + Smalls1 + Popcorn + Atrim + Btrim + Mold + Waste;
			if (Flower != "" && Flower1 != "" && Smalls != "" && Smalls1 != "" && Popcorn != "" && Atrim != "" && Btrim != "" && Mold != "" &&
				Waste != "") {
				if (Quantity > Total) {
					sap.m.MessageToast.show("Entered qty is less than available qty.");
					return;
				}
				if (Quantity < Total) {
					sap.m.MessageToast.show("Entered qty is more than available qty.");
					return;
				}
			}
		},

		recordCompletionCancel: function () {
			this.recordCompDialog.close();
		},

		handleRecordCompletion: function () {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var harvestPlannerTable = this.getView().byId("processingTable");
			var that = this;
			// this.loadTagsDataInPkg();
			this.loadlocationsData();

			if (harvestPlannerTable.getSelectedIndices().length === 0) {
				sap.m.MessageToast.show("Please select atleast one batch");
				return;
			} else {
				if (!this.recordCompDialog) {
					this.recordCompDialog = sap.ui.xmlfragment("recordCompletion", "com.9b.processing.view.fragments.RecordCompletion", this);
					this.getView().addDependent(this.recordCompDialog);
				}
				var updateObject = harvestPlannerTable.getContextByIndex(harvestPlannerTable.getSelectedIndex()).getObject();
				jsonModel.setProperty("/batchAbsEntry", updateObject.BatchAbsEntry);
				var encodedStrainName = updateObject.StrainName.replace(/'/g, "''");
				encodedStrainName = encodeURIComponent(encodedStrainName);
				var filters = "?$filter=U_NSTNM eq '" + encodedStrainName + "'";
				var fieldsItem = "&$select=" + ["ItemName", "ItemsGroupCode", "ItemCode", "InventoryUOM", "ProdStdCost", "U_NSTNM"].join();;
				this.readServiecLayer("/b1s/v2/Items" + filters + fieldsItem, function (data1) {

					jsonModel.setProperty("/selectedItemData", data1.value);
				});

				var recCompletionObj = {
					METRCUID: updateObject.METRCUID,
					Quantity: updateObject.Quantity,
					ItemName: updateObject.ItemName,
					ItemCode: updateObject.ItemCode,
					StrainName: updateObject.StrainName,
					SourceUID: updateObject.SourceUID,
					HarvestName: updateObject.HarvestName,
					WhsCode: updateObject.WhsCode,
					CreateDate: updateObject.CreateDate,
					BinLocationCode: updateObject.BinLocationCode,
					BinLocationName: updateObject.BinLocationName,
					U_MetrcLocation: updateObject.U_MetrcLocation,
					productionObj: [],
				};

				recCompletionObj.productionObj = [{
						flowerQty: "",
						flowerTag: "",
						ItemCode: "",
						ItemName: "",
						UOMCode: "",
						BaseLine: ""
					}, {
						BflowerQty: "",
						BflowerTag: "",
						ItemCode: "",
						ItemName: "",
						UOMCode: "",
						BaseLine: ""
					}, {
						smallQty: "",
						smallTag: "",
						ItemCode: "",
						ItemName: "",
						UOMCode: "",
						BaseLine: ""
					}, {
						BsmallQty: "",
						BsmallTag: "",
						ItemCode: "",
						ItemName: "",
						UOMCode: "",
						BaseLine: ""
					}, {
						popcornQty: "",
						popcornTag: "",
						ItemCode: "",
						ItemName: "",
						UOMCode: "",
						BaseLine: ""
					}, {
						AtrimQty: "",
						AtrimTag: "",
						ItemCode: "",
						ItemName: "",
						UOMCode: "",
						BaseLine: ""
					}, {
						BtrimQty: "",
						BtrimTag: "",
						ItemCode: "",
						ItemName: "",
						UOMCode: "",
						BaseLine: ""
					}, {
						moldQty: "",
						moldTag: "",
						ItemCode: "",
						ItemName: "",
						UOMCode: "",
						BaseLine: ""
					}, {
						wasteQty: "",
						ItemCode: "",
						ItemName: "",
						UOMCode: "",
						BaseLine: ""
					}],
					sap.ui.core.Fragment.byId("recordCompletion", "beggingTag11").setSelectedKey("");
				sap.ui.core.Fragment.byId("recordCompletion", "beggingTag2").setSelectedKey("");
				sap.ui.core.Fragment.byId("recordCompletion", "beggingTag3").setSelectedKey("");
				sap.ui.core.Fragment.byId("recordCompletion", "beggingTag4").setSelectedKey("");
				sap.ui.core.Fragment.byId("recordCompletion", "beggingTag5").setSelectedKey("");
				sap.ui.core.Fragment.byId("recordCompletion", "beggingTag6").setSelectedKey("");
				sap.ui.core.Fragment.byId("recordCompletion", "beggingTag7").setSelectedKey("");
				sap.ui.core.Fragment.byId("recordCompletion", "beggingTag8").setSelectedKey("");
				jsonModel.setProperty("/recCompletionObj", recCompletionObj);
				jsonModel.setProperty("/displayrecCompletionObj", recCompletionObj.productionObj);

				this.recordCompDialog.open();
			}
		},

		confirmRecordCompletion: function () {
			var that = this;
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var recCompObj = jsonModel.getProperty("/recCompletionObj");
			var displayRec = jsonModel.getProperty("/displayrecCompletionObj");
			// var itemCodeList = jsonModel.getProperty("/allItemsList");
			var itemCodeList = jsonModel.getProperty("/selectedItemData");
			var metrcData = jsonModel.getProperty("/metrcData");
			var metrcPayload = [],
				adjustCall = false,
				adjustMetrc = [];

			if (displayRec[displayRec.length - 1].wasteQty != "" && displayRec[displayRec.length - 1].wasteQty != "0") {
				adjustCall = true;
			}

			// if (displayRec[0].flowerQty == "" || displayRec[0].flowerQty == undefined) {
			// 	sap.m.MessageToast.show("Enter flower qty");
			// 	return;
			// }
			// if (displayRec[0].flowerTag == "" || displayRec[0].flowerTag == undefined) {
			// 	sap.m.MessageToast.show("Scan flower tag");
			// 	return;
			// }

			let Total, Amt;
			let sum = displayRec.reduce((acc, obj) => {
				let firstKey2 = Object.keys(obj)[0];
				Total = Number(obj[firstKey2]);
				Total = Number(Total.toFixed(3));
				Amt = acc + Total;
				return Number(Amt.toFixed(3));
			}, 0);

			if (sum > recCompObj.Quantity) {
				sap.m.MessageToast.show("Entered qty is more than available qty.");
				return;
			}

			if (sum < recCompObj.Quantity) {
				sap.m.MessageToast.show("Entered qty is less than available qty.");
				return;
			}

			const filteredData = displayRec.filter(item => {
				const firstKey = Object.keys(item)[0];
				return item[firstKey] !== '';
			});

			let secondKeyValues = filteredData.reduce((acc, obj) => {
				let secondKey = Object.keys(obj)[1];
				if (obj[secondKey] !== '') {
					acc.push(obj[secondKey]);
				}
				return acc;
			}, []);

			if (secondKeyValues.length == 0) {
				sap.m.MessageToast.show("Please enter atleast one Quantity");
				return false;
			}

			var uniquePackages = secondKeyValues.filter(function (item, pos) {
				return secondKeyValues.indexOf(item) == pos;
			});
			if (secondKeyValues.length !== uniquePackages.length) {
				sap.m.MessageToast.show("Please scan unique package tags");
				return false;
			}

			$.each(filteredData, function (i, obj) {
				if (obj.flowerQty != "" && obj.flowerQty != undefined) {
					let rObj1 = $.grep(itemCodeList, function (item1) {
						if (item1.ItemName !== null && item1.ItemName !== "" && item1.ItemName.search(recCompObj.StrainName) !== -1 && item1.ItemName
							.endsWith("Flower") ==
							true &&
							item1.ItemName.endsWith("B-Flower") == false) {
							return item1;
						}
					});
					if (rObj1.length > 0) {
						obj.ItemCode = rObj1[0].ItemCode;
						obj.ItemName = rObj1[0].ItemName;
						obj.UOMCode = rObj1[0].InventoryUOM;
					}
				}

				if (obj.BflowerQty != "" && obj.BflowerQty != undefined) {
					let rObj2 = $.grep(itemCodeList, function (item1) {
						if (item1.ItemName !== null && item1.ItemName !== "" && item1.ItemName.search(recCompObj.StrainName) !== -1 && item1.ItemName
							.endsWith("B-Flower") ==
							true) {
							return item1;
						}
					});
					if (rObj2.length > 0) {
						obj.ItemCode = rObj2[0].ItemCode;
						obj.ItemName = rObj2[0].ItemName;
						obj.UOMCode = rObj2[0].InventoryUOM;
					}
				}

				if (obj.smallQty != "" && obj.smallQty != undefined) {
					let rObj3 = $.grep(itemCodeList, function (item1) {
						if (item1.ItemName !== null && item1.ItemName !== "" && item1.ItemName.search(recCompObj.StrainName) !== -1 && item1.ItemName
							.endsWith("Smalls") ==
							true &&
							item1.ItemName.endsWith("B-Smalls") == false) {
							return item1;
						}
					});
					if (rObj3.length > 0) {
						obj.ItemCode = rObj3[0].ItemCode;
						obj.ItemName = rObj3[0].ItemName;
						obj.UOMCode = rObj3[0].InventoryUOM;
					}
				}

				if (obj.BsmallQty != "" && obj.BsmallQty != undefined) {
					let rObj4 = $.grep(itemCodeList, function (item1) {
						if (item1.ItemName !== null && item1.ItemName !== "" && item1.ItemName.search(recCompObj.StrainName) !== -1 && item1.ItemName
							.endsWith("B-Smalls") ==
							true) {
							return item1;
						}
					});
					if (rObj4.length > 0) {
						obj.ItemCode = rObj4[0].ItemCode;
						obj.ItemName = rObj4[0].ItemName;
						obj.UOMCode = rObj4[0].InventoryUOM;
					}
				}
				if (obj.popcornQty != "" && obj.popcornQty != undefined) {
					let rObj5 = $.grep(itemCodeList, function (item1) {
						if (item1.ItemName !== null && item1.ItemName !== "" && item1.ItemName.search(recCompObj.StrainName) !== -1 && item1.ItemName
							.endsWith("Popcorn") ==
							true) {
							return item1;
						}
					});
					if (rObj5.length > 0) {
						obj.ItemCode = rObj5[0].ItemCode;
						obj.ItemName = rObj5[0].ItemName;
						obj.UOMCode = rObj5[0].InventoryUOM;

					}
				}

				if (obj.AtrimQty != "" && obj.AtrimQty != undefined) {
					let rObj6 = $.grep(itemCodeList, function (item1) {
						if (item1.ItemName !== null && item1.ItemName !== "" && item1.ItemName.search(recCompObj.StrainName) !== -1 && item1.ItemName
							.endsWith("A-Trim") ==
							true) {
							return item1;
						}
					});
					if (rObj6.length > 0) {
						obj.ItemCode = rObj6[0].ItemCode;
						obj.ItemName = rObj6[0].ItemName;
						obj.UOMCode = rObj6[0].InventoryUOM;
					}
				}
				if (obj.BtrimQty != "" && obj.BtrimQty != undefined) {
					let rObj7 = $.grep(itemCodeList, function (item1) {
						if (item1.ItemName !== null && item1.ItemName !== "" && item1.ItemName.search(recCompObj.StrainName) !== -1 && item1.ItemName
							.endsWith("B-Trim") ==
							true) {
							return item1;
						}
					});
					if (rObj7.length > 0) {
						obj.ItemCode = rObj7[0].ItemCode;
						obj.ItemName = rObj7[0].ItemName;
						obj.UOMCode = rObj7[0].InventoryUOM;
					}
				}
				if (obj.moldQty != "" && obj.moldQty != undefined) {
					let rObj8 = $.grep(itemCodeList, function (item1) {
						if (item1.ItemName !== null && item1.ItemName !== "" && item1.ItemName.search(recCompObj.StrainName) !== -1 && item1.ItemName
							.endsWith("Mold") == true) {
							return item1;
						}
					});
					if (rObj8.length > 0) {
						obj.ItemCode = rObj8[0].ItemCode;
						obj.ItemName = rObj8[0].ItemName;
						obj.UOMCode = rObj8[0].InventoryUOM;
					}
				}

				if (obj.wasteQty != "" && obj.wasteQty != "0" && obj.wasteQty != undefined) {
					obj.ItemCode = "600000";
					let rObj9 = $.grep(itemCodeList, function (item1) {
						if (item1.ItemName !== null && item1.ItemName !== "" && item1.ItemName.search(recCompObj.ItemName) !== -1) {
							return item1;
						}
					});
					if (rObj9.length > 0) {
						obj.ItemName = rObj9[0].ItemName;
						obj.UOMCode = rObj9[0].InventoryUOM;
					}
				}

			});

			$.each(filteredData, function (i, obj) {

				if (obj.flowerQty != "" && obj.flowerQty != undefined) {
					metrcPayload.push({
						Tag: obj.flowerTag,
						Location: recCompObj.U_MetrcLocation, //sObj.U_MetrcLocation,
						Item: obj.ItemName, //sObj.ItemName,
						Quantity: Number(obj.flowerQty),
						UnitOfMeasure: obj.UOMCode,
						// PatientLicenseNumber: null,
						// Note: sObj.U_NNOTE,
						// IsProductionBatch: false,
						// IsDonation: false,
						// ProductRequiresRemediation: false,
						// UseSameItem: false,
						ActualDate: that.getSystemDate(),
						Ingredients: [{
							Package: recCompObj.METRCUID,
							Quantity: Number(obj.flowerQty),
							UnitOfMeasure: obj.UOMCode
						}]
					});
				}

				if (obj.BflowerQty != "" && obj.BflowerQty != undefined) {

					metrcPayload.push({
						Tag: obj.BflowerTag,
						Location: recCompObj.U_MetrcLocation, //sObj.U_MetrcLocation,
						Item: obj.ItemName, //sObj.ItemName,
						Quantity: Number(obj.BflowerQty),
						UnitOfMeasure: obj.UOMCode,
						// PatientLicenseNumber: null,
						// Note: sObj.U_NNOTE,
						// IsProductionBatch: false,
						// IsDonation: false,
						// ProductRequiresRemediation: false,
						// UseSameItem: false,
						ActualDate: that.getSystemDate(),
						Ingredients: [{
							Package: recCompObj.METRCUID,
							Quantity: Number(obj.BflowerQty),
							UnitOfMeasure: obj.UOMCode
						}]
					});

				}

				if (obj.smallQty != "" && obj.smallQty != undefined) {

					metrcPayload.push({
						Tag: obj.smallTag,
						Location: recCompObj.U_MetrcLocation, //sObj.U_MetrcLocation,
						Item: obj.ItemName, //sObj.ItemName,
						Quantity: Number(obj.smallQty),
						UnitOfMeasure: obj.UOMCode,
						// PatientLicenseNumber: null,
						// Note: sObj.U_NNOTE,
						// IsProductionBatch: false,
						// IsDonation: false,
						// ProductRequiresRemediation: false,
						// UseSameItem: false,
						ActualDate: that.getSystemDate(),
						Ingredients: [{
							Package: recCompObj.METRCUID,
							Quantity: Number(obj.smallQty),
							UnitOfMeasure: obj.UOMCode
						}]
					});
				}
				if (obj.BsmallQty != "" && obj.BsmallQty != undefined) {
					metrcPayload.push({
						Tag: obj.BsmallTag,
						Location: recCompObj.U_MetrcLocation, //sObj.U_MetrcLocation,
						Item: obj.ItemName, //sObj.ItemName,
						Quantity: Number(obj.BsmallQty),
						UnitOfMeasure: obj.UOMCode,
						// PatientLicenseNumber: null,
						// Note: sObj.U_NNOTE,
						// IsProductionBatch: false,
						// IsDonation: false,
						// ProductRequiresRemediation: false,
						// UseSameItem: false,
						ActualDate: that.getSystemDate(),
						Ingredients: [{
							Package: recCompObj.METRCUID,
							Quantity: Number(obj.BsmallQty),
							UnitOfMeasure: obj.UOMCode
						}]
					});
				}

				if (obj != undefined && obj.popcornQty != "" && obj.popcornQty != undefined) {
					metrcPayload.push({
						Tag: obj.popcornTag,
						Location: recCompObj.U_MetrcLocation, //sObj.U_MetrcLocation,
						Item: obj.ItemName, //sObj.ItemName,
						Quantity: Number(obj.popcornQty),
						UnitOfMeasure: obj.UOMCode,
						// PatientLicenseNumber: null,
						// Note: sObj.U_NNOTE,
						// IsProductionBatch: false,
						// IsDonation: false,
						// ProductRequiresRemediation: false,
						// UseSameItem: false,
						ActualDate: that.getSystemDate(),
						Ingredients: [{
							Package: recCompObj.METRCUID,
							Quantity: Number(obj.popcornQty),
							UnitOfMeasure: obj.UOMCode
						}]
					});
				}

				if (obj != undefined && obj.AtrimQty != "" && obj.AtrimQty != undefined) {
					metrcPayload.push({
						Tag: obj.AtrimTag,
						Location: recCompObj.U_MetrcLocation, //sObj.U_MetrcLocation,
						Item: obj.ItemName, //sObj.ItemName,
						Quantity: Number(obj.AtrimQty),
						UnitOfMeasure: obj.UOMCode,
						// PatientLicenseNumber: null,
						// Note: sObj.U_NNOTE,
						// IsProductionBatch: false,
						// IsDonation: false,
						// ProductRequiresRemediation: false,
						// UseSameItem: false,
						ActualDate: that.getSystemDate(),
						Ingredients: [{
							Package: recCompObj.METRCUID,
							Quantity: Number(obj.AtrimQty),
							UnitOfMeasure: obj.UOMCode
						}]
					});
				}

				if (obj != undefined && obj.BtrimQty != "" && obj.BtrimQty != undefined) {
					metrcPayload.push({
						Tag: obj.BtrimTag,
						Location: recCompObj.U_MetrcLocation, //sObj.U_MetrcLocation,
						Item: obj.ItemName, //sObj.ItemName,
						Quantity: Number(obj.BtrimQty),
						UnitOfMeasure: obj.UOMCode,
						// PatientLicenseNumber: null,
						// Note: sObj.U_NNOTE,
						// IsProductionBatch: false,
						// IsDonation: false,
						// ProductRequiresRemediation: false,
						// UseSameItem: false,
						ActualDate: that.getSystemDate(),
						Ingredients: [{
							Package: recCompObj.METRCUID,
							Quantity: Number(obj.BtrimQty),
							UnitOfMeasure: obj.UOMCode
						}]
					});
				}

				if (obj != undefined && obj.moldQty != "" && obj.moldQty != undefined) {
					metrcPayload.push({
						Tag: obj.moldTag,
						Location: recCompObj.U_MetrcLocation, //sObj.U_MetrcLocation,
						Item: obj.ItemName, //sObj.ItemName,
						Quantity: Number(obj.moldQty),
						UnitOfMeasure: obj.UOMCode,
						// PatientLicenseNumber: null,
						// Note: sObj.U_NNOTE,
						// IsProductionBatch: false,
						// IsDonation: false,
						// ProductRequiresRemediation: false,
						// UseSameItem: false,
						ActualDate: that.getSystemDate(),
						Ingredients: [{
							Package: recCompObj.METRCUID,
							Quantity: Number(obj.moldQty),
							UnitOfMeasure: obj.UOMCode
						}]
					});

				}
				if (obj.wasteQty != "" && obj.wasteQty != "0" && obj.wasteQty != undefined) {
					adjustMetrc.push({
						Label: recCompObj.METRCUID,
						Quantity: -Number(obj.wasteQty),
						UnitOfMeasure: obj.UOMCode,
						AdjustmentReason: "Waste (Unusable Product)",
						AdjustmentDate: that.getSystemDate(),
						ReasonNote: "Waste"
					});
				}

			});
			this._busyDialog.open();
			jsonModel.setProperty("/busyTitle", "Hang tight...");
			jsonModel.setProperty(
				"/busyText",
				"Record Completion in progress. Please do not close this window or navigate away until the operation is complete"
			);
			that.readServiecLayer("/b1s/v2/UsersService_GetCurrentUser", function (resP) {
				if (metrcData && metrcData.U_NACST === "X") {
					var metrcUrl = "/packages/v2/?licenseNumber=" + jsonModel.getProperty("/selectedLicense");
					var metrcUrl22 = "/packages/v2/adjust?licenseNumber=" + jsonModel.getProperty("/selectedLicense");
					that.callMetricsService(metrcUrl, "POST", metrcPayload, function () {
						// sap.m.MessageToast.show("METRC sync completed successfully");
						if (adjustCall) {
							that.callMetricsService(metrcUrl22, "POST", adjustMetrc, function () {
								//sap.m.MessageToast.show("METRC sync completed successfully");
							}, function (error) {
								//	sap.m.MessageToast.show(JSON.stringify(error));

							});
						}

						that.recordComplitiontoTable(filteredData);

					}, function (error) {
						sap.m.MessageToast.show(JSON.stringify(error));

					});
				} else {
					that.recordComplitiontoTable(filteredData);
				}
			});

		},

		recordComplitiontoTable: function (filteredData) {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var bucktoObj = jsonModel.getProperty("/recCompletionObj");
			var MaindisplayRec = jsonModel.getProperty("/displayrecCompletionObj");
			// var cDate = this.convertUTCDate(bucktoObj.CreateDate);
			var binlocationData = jsonModel.getProperty("/binlocationsData");
			// var itemCodeList = jsonModel.getProperty("/allItemsList");
			var itemCodeList = jsonModel.getProperty("/selectedItemData");
			var BinAbsEntryData = jsonModel.getProperty("/BinAbsEntry");
			var resourcesGetCalls = jsonModel.getProperty("/resourcesGetCallData");
			var metrcData = jsonModel.getProperty("/metrcData");
			var configAbsEntry = BinAbsEntryData[0].key;
			var configLocation = BinAbsEntryData[0].text;
			var cDate = this.convertUTCDate(new Date());
			var that = this;
			var batchUrl = [];
			var rObj = $.grep(binlocationData, function (sLoc) {
				if (sLoc.BinCode == bucktoObj.BinLocationCode) {
					return sLoc;
				}
			});
			var absEntry = rObj[0].AbsEntry;
			var totalProductionOrder = [];

			$.each(filteredData, function (i, obj) {

				if (obj != undefined && obj.flowerQty != "" && obj.flowerQty != undefined) {

					var payLoadProduction = {
						"ItemNo": obj.ItemCode, //<Bucked Item>
						"DistributionRule": "PROC",
						"PlannedQuantity": Number(obj.flowerQty), //<Bucked Qty>
						"ProductionOrderType": "bopotSpecial",
						"PostingDate": cDate,
						"DueDate": cDate,
						"Warehouse": bucktoObj.WhsCode,
						"Remarks": "Processing - Record Completion",
						"ProductionOrderLines": []
					};

					payLoadProduction.ProductionOrderLines.push({
						"ItemNo": "L08",
						"ItemType": "pit_Resource",
						"PlannedQuantity": Number(obj.flowerQty), //<Source Package Qty>
						"ProductionOrderIssueType": "im_Backflush",
						"Warehouse": bucktoObj.WhsCode
					}, {
						"ItemNo": bucktoObj.ItemCode, //filteredData[0].ItemCode,
						"DistributionRule": "PROC",
						"PlannedQuantity": Number(obj.flowerQty), //bucktoObj.Quantity, //Number(filteredData[0].flowerQty),
						"ProductionOrderIssueType": "im_Manual",
						"Warehouse": bucktoObj.WhsCode
					});

					totalProductionOrder.push(payLoadProduction);

				}

				if (obj != undefined && obj.BflowerQty != "" && obj.BflowerQty != undefined) {

					var payLoadProduction = {
						"ItemNo": obj.ItemCode, //<Bucked Item>
						"DistributionRule": "PROC",
						"PlannedQuantity": Number(obj.BflowerQty), //<Bucked Qty>
						"ProductionOrderType": "bopotSpecial",
						"PostingDate": cDate,
						"DueDate": cDate,
						"Warehouse": bucktoObj.WhsCode,
						"Remarks": "Processing - Record Completion",
						"ProductionOrderLines": []
					};

					payLoadProduction.ProductionOrderLines.push({
						"ItemNo": "L08",
						"ItemType": "pit_Resource",
						"PlannedQuantity": Number(obj.BflowerQty), //<Source Package Qty>
						"ProductionOrderIssueType": "im_Backflush",
						"Warehouse": bucktoObj.WhsCode
					}, {
						"ItemNo": bucktoObj.ItemCode, //filteredData[0].ItemCode,
						"DistributionRule": "PROC",
						"PlannedQuantity": Number(obj.BflowerQty), //bucktoObj.Quantity, //Number(filteredData[0].flowerQty),
						"ProductionOrderIssueType": "im_Manual",
						"Warehouse": bucktoObj.WhsCode
					});

					totalProductionOrder.push(payLoadProduction);

				}

				if (obj != undefined && obj.smallQty != "" && obj.smallQty != undefined) {

					var payLoadProduction = {
						"ItemNo": obj.ItemCode, //<Bucked Item>
						"DistributionRule": "PROC",
						"PlannedQuantity": Number(obj.smallQty), //<Bucked Qty>
						"ProductionOrderType": "bopotSpecial",
						"PostingDate": cDate,
						"DueDate": cDate,
						"Warehouse": bucktoObj.WhsCode,
						"Remarks": "Processing - Record Completion",
						"ProductionOrderLines": []
					};

					payLoadProduction.ProductionOrderLines.push({
						"ItemNo": "L09",
						"ItemType": "pit_Resource",
						"PlannedQuantity": Number(obj.smallQty), //<Source Package Qty>
						"ProductionOrderIssueType": "im_Backflush",
						"Warehouse": bucktoObj.WhsCode
					}, {
						"ItemNo": bucktoObj.ItemCode, //filteredData[0].ItemCode,
						"DistributionRule": "PROC",
						"PlannedQuantity": Number(obj.smallQty), //bucktoObj.Quantity, //Number(filteredData[0].flowerQty),
						"ProductionOrderIssueType": "im_Manual",
						"Warehouse": bucktoObj.WhsCode
					});

					totalProductionOrder.push(payLoadProduction);

				}

				if (obj != undefined && obj.BsmallQty != "" && obj.BsmallQty != undefined) {

					var payLoadProduction = {
						"ItemNo": obj.ItemCode, //<Bucked Item>
						"DistributionRule": "PROC",
						"PlannedQuantity": Number(obj.BsmallQty), //<Bucked Qty>
						"ProductionOrderType": "bopotSpecial",
						"PostingDate": cDate,
						"DueDate": cDate,
						"Warehouse": bucktoObj.WhsCode,
						"Remarks": "Processing - Record Completion",
						"ProductionOrderLines": []
					};

					payLoadProduction.ProductionOrderLines.push({
						"ItemNo": "L09",
						"ItemType": "pit_Resource",
						"PlannedQuantity": Number(obj.BsmallQty), //<Source Package Qty>
						"ProductionOrderIssueType": "im_Backflush",
						"Warehouse": bucktoObj.WhsCode
					}, {
						"ItemNo": bucktoObj.ItemCode, //filteredData[0].ItemCode,
						"DistributionRule": "PROC",
						"PlannedQuantity": Number(obj.BsmallQty), //bucktoObj.Quantity, //Number(filteredData[0].flowerQty),
						"ProductionOrderIssueType": "im_Manual",
						"Warehouse": bucktoObj.WhsCode
					});

					totalProductionOrder.push(payLoadProduction);

				}

				if (obj != undefined && obj.popcornQty != "" && obj.popcornQty != undefined) {

					var payLoadProduction = {
						"ItemNo": obj.ItemCode, //<Bucked Item>
						"DistributionRule": "PROC",
						"PlannedQuantity": Number(obj.popcornQty), //<Bucked Qty>
						"ProductionOrderType": "bopotSpecial",
						"PostingDate": cDate,
						"DueDate": cDate,
						"Warehouse": bucktoObj.WhsCode,
						"Remarks": "Processing - Record Completion",
						"ProductionOrderLines": []
					};
					payLoadProduction.ProductionOrderLines.push({
						"ItemNo": bucktoObj.ItemCode, //filteredData[0].ItemCode,
						"DistributionRule": "PROC",
						"PlannedQuantity": Number(obj.popcornQty), //bucktoObj.Quantity, //Number(filteredData[0].flowerQty),
						"ProductionOrderIssueType": "im_Manual",
						"Warehouse": bucktoObj.WhsCode
					});

					totalProductionOrder.push(payLoadProduction);

				}

				if (obj != undefined && obj.AtrimQty != "" && obj.AtrimQty != undefined) {

					var payLoadProduction = {
						"ItemNo": obj.ItemCode, //<Bucked Item>
						"DistributionRule": "PROC",
						"PlannedQuantity": Number(obj.AtrimQty), //<Bucked Qty>
						"ProductionOrderType": "bopotSpecial",
						"PostingDate": cDate,
						"DueDate": cDate,
						"Warehouse": bucktoObj.WhsCode,
						"Remarks": "Processing - Record Completion",
						"ProductionOrderLines": []
					};

					payLoadProduction.ProductionOrderLines.push({
						"ItemNo": bucktoObj.ItemCode, //filteredData[0].ItemCode,
						"DistributionRule": "PROC",
						"PlannedQuantity": Number(obj.AtrimQty), //bucktoObj.Quantity, //Number(filteredData[0].flowerQty),
						"ProductionOrderIssueType": "im_Manual",
						"Warehouse": bucktoObj.WhsCode
					});

					totalProductionOrder.push(payLoadProduction);

				}

				if (obj != undefined && obj.BtrimQty != "" && obj.BtrimQty != undefined) {

					var payLoadProduction = {
						"ItemNo": obj.ItemCode, //<Bucked Item>
						"DistributionRule": "PROC",
						"PlannedQuantity": Number(obj.BtrimQty), //<Bucked Qty>
						"ProductionOrderType": "bopotSpecial",
						"PostingDate": cDate,
						"DueDate": cDate,
						"Warehouse": bucktoObj.WhsCode,
						"Remarks": "Processing - Record Completion",
						"ProductionOrderLines": []
					};

					payLoadProduction.ProductionOrderLines.push({
						"ItemNo": bucktoObj.ItemCode, //filteredData[0].ItemCode,
						"DistributionRule": "PROC",
						"PlannedQuantity": Number(obj.BtrimQty), //bucktoObj.Quantity, //Number(filteredData[0].flowerQty),
						"ProductionOrderIssueType": "im_Manual",
						"Warehouse": bucktoObj.WhsCode
					});

					totalProductionOrder.push(payLoadProduction);

				}

				if (obj != undefined && obj.moldQty != "" && obj.moldQty != undefined) {

					var payLoadProduction = {
						"ItemNo": obj.ItemCode, //<Bucked Item>
						"DistributionRule": "PROC",
						"PlannedQuantity": Number(obj.moldQty), //<Bucked Qty>
						"ProductionOrderType": "bopotSpecial",
						"PostingDate": cDate,
						"DueDate": cDate,
						"Warehouse": bucktoObj.WhsCode,
						"Remarks": "Processing - Record Completion",
						"ProductionOrderLines": []
					};

					payLoadProduction.ProductionOrderLines.push({
						"ItemNo": bucktoObj.ItemCode, //filteredData[0].ItemCode,
						"DistributionRule": "PROC",
						"PlannedQuantity": Number(obj.moldQty), //bucktoObj.Quantity, //Number(filteredData[0].flowerQty),
						"ProductionOrderIssueType": "im_Manual",
						"Warehouse": bucktoObj.WhsCode
					});

					totalProductionOrder.push(payLoadProduction);

				}

				if (obj != undefined && obj.wasteQty != "" && obj.wasteQty != undefined && obj.wasteQty != "0") {

					var payLoadProduction = {
						"ItemNo": obj.ItemCode, //<Bucked Item>
						"DistributionRule": "PROC",
						"PlannedQuantity": Number(obj.wasteQty), //<Bucked Qty>
						"ProductionOrderType": "bopotSpecial",
						"PostingDate": cDate,
						"DueDate": cDate,
						"Warehouse": bucktoObj.WhsCode,
						"Remarks": "Processing - Record Completion",
						"ProductionOrderLines": []
					};

					payLoadProduction.ProductionOrderLines.push({
						"ItemNo": bucktoObj.ItemCode, //filteredData[0].ItemCode,
						"DistributionRule": "PROC",
						"PlannedQuantity": Number(obj.wasteQty), //bucktoObj.Quantity, //Number(filteredData[0].flowerQty),
						"ProductionOrderIssueType": "im_Manual",
						"Warehouse": bucktoObj.WhsCode
					});

					totalProductionOrder.push(payLoadProduction);

				}

			});

			var countproduction = totalProductionOrder.length;

			$.each(totalProductionOrder, function (i, sObj) {

				that.updateServiecLayer("/b1s/v2/ProductionOrders", function (res) {
					countproduction--;
					var docNUM = res.AbsoluteEntry;

					$.each(filteredData, function (j, obj) {

						if (i == j && obj != undefined && obj.flowerQty != "" && obj.flowerQty != undefined) {

							var fisrtPatchCall = {
								"ProductionOrderStatus": "boposReleased",
							};
							batchUrl.push({
								url: "/b1s/v2/ProductionOrders(" + Number(docNUM) + ")",
								data: fisrtPatchCall,
								method: "PATCH"
							});

							var payLoadInventoryEntry = {
								"BPL_IDAssignedToInvoice": jsonModel.getProperty("/sLinObj").U_Branch,
								"Comments": "processing - record completion - Entry",
								"DocumentLines": []
							};

							payLoadInventoryEntry.DocumentLines.push({
								"BaseType": 202,
								"BaseEntry": Number(docNUM),
								"WarehouseCode": configLocation, //"GHCCPH1", //bucktoObj.WhsCode,
								"Quantity": Number(obj.flowerQty),
								// "UnitPrice": "",
								"BatchNumbers": [{
									"BatchNumber": obj.flowerTag, // <THIS IS TAG>
									"Quantity": Number(obj.flowerQty), //<THIS IS THE QTY OF CLONES>
									"Location": configLocation, //"GHCCPH1", //bucktoObj.BinLocationCode,
									"ManufacturerSerialNumber": bucktoObj.HarvestName,
									"U_BatAttr3": bucktoObj.METRCUID,
									"U_IsPackage": "YES",
									"U_Phase": "Package",
								}],
								"DocumentLinesBinAllocations": [{
									"BinAbsEntry": Number(configAbsEntry), //298, //Number(absEntry), //
									"Quantity": Number(obj.flowerQty),
									"SerialAndBatchNumbersBaseLine": 0
								}]
							});
							batchUrl.push({
								url: "/b1s/v2/InventoryGenEntries",
								data: payLoadInventoryEntry,
								method: "POST"
							});

							var payLoadInventoryExit = {
								"BPL_IDAssignedToInvoice": jsonModel.getProperty("/sLinObj").U_Branch,
								"Comments": "Processing - record Completion - Exit",
								"DocumentLines": [{
									"LineNum": 0,
									"BaseType": 202,
									"BaseEntry": Number(docNUM),
									"BaseLine": 1,
									"Quantity": Number(obj.flowerQty), //bucktoObj.Quantity,
									"WarehouseCode": bucktoObj.WhsCode,
									"BatchNumbers": [{
										"BatchNumber": bucktoObj.METRCUID, // <THIS IS TAG>
										"Quantity": Number(obj.flowerQty), //bucktoObj.Quantity, //<THIS IS THE QTY OF CLONES>
										"Location": bucktoObj.BinLocationCode //<THIS IS FROM CLONE ROOM>
									}],
									"DocumentLinesBinAllocations": [{
										"BinAbsEntry": Number(absEntry),
										"Quantity": Number(obj.flowerQty), //bucktoObj.Quantity,
										"SerialAndBatchNumbersBaseLine": 0
									}]
								}]
							};

							batchUrl.push({
								url: "/b1s/v2/InventoryGenExits",
								data: payLoadInventoryExit,
								method: "POST"
							});

							var secondPatchCall = {
								"ProductionOrderStatus": "boposClosed",
							};

							batchUrl.push({
								url: "/b1s/v2/ProductionOrders(" + Number(docNUM) + ")",
								data: secondPatchCall,
								method: "PATCH"
							});
						}

					});

					$.each(filteredData, function (j, obj) {
						if (i == j && obj != undefined && obj.BflowerQty != "" && obj.BflowerQty != undefined) {

							var fisrtPatchCall = {
								"ProductionOrderStatus": "boposReleased",
							};
							batchUrl.push({
								url: "/b1s/v2/ProductionOrders(" + Number(docNUM) + ")",
								data: fisrtPatchCall,
								method: "PATCH"
							});

							var payLoadInventoryEntry = {
								"BPL_IDAssignedToInvoice": jsonModel.getProperty("/sLinObj").U_Branch,
								"Comments": "processing - record completion - Entry",
								"DocumentLines": []
							};

							payLoadInventoryEntry.DocumentLines.push({
								"BaseType": 202,
								"BaseEntry": Number(docNUM),
								"WarehouseCode": configLocation, //"GHCCPH1", //bucktoObj.WhsCode,
								"Quantity": Number(obj.BflowerQty),
								// "UnitPrice": "",
								"BatchNumbers": [{
									"BatchNumber": obj.BflowerTag, // <THIS IS TAG>
									"Quantity": Number(obj.BflowerQty), //<THIS IS THE QTY OF CLONES>
									"Location": configLocation, //"GHCCPH1", //bucktoObj.BinLocationCode,
									"ManufacturerSerialNumber": bucktoObj.HarvestName,
									"U_BatAttr3": bucktoObj.METRCUID,
									"U_IsPackage": "YES",
									"U_Phase": "Package",
								}],
								"DocumentLinesBinAllocations": [{
									"BinAbsEntry": Number(configAbsEntry), //298, //Number(absEntry), //
									"Quantity": Number(obj.BflowerQty),
									"SerialAndBatchNumbersBaseLine": 0
								}]
							});
							batchUrl.push({
								url: "/b1s/v2/InventoryGenEntries",
								data: payLoadInventoryEntry,
								method: "POST"
							});

							var payLoadInventoryExit = {
								"BPL_IDAssignedToInvoice": jsonModel.getProperty("/sLinObj").U_Branch,
								"Comments": "Processing - record Completion - Exit",
								"DocumentLines": [{
									"LineNum": 0,
									"BaseType": 202,
									"BaseEntry": Number(docNUM),
									"BaseLine": 1,
									"Quantity": Number(obj.BflowerQty), //bucktoObj.Quantity,
									"WarehouseCode": bucktoObj.WhsCode,
									"BatchNumbers": [{
										"BatchNumber": bucktoObj.METRCUID, // <THIS IS TAG>
										"Quantity": Number(obj.BflowerQty), //bucktoObj.Quantity, //<THIS IS THE QTY OF CLONES>
										"Location": bucktoObj.BinLocationCode //<THIS IS FROM CLONE ROOM>
									}],
									"DocumentLinesBinAllocations": [{
										"BinAbsEntry": Number(absEntry),
										"Quantity": Number(obj.BflowerQty), //bucktoObj.Quantity,
										"SerialAndBatchNumbersBaseLine": 0
									}]
								}]
							};

							batchUrl.push({
								url: "/b1s/v2/InventoryGenExits",
								data: payLoadInventoryExit,
								method: "POST"
							});

							var secondPatchCall = {
								"ProductionOrderStatus": "boposClosed",
							};

							batchUrl.push({
								url: "/b1s/v2/ProductionOrders(" + Number(docNUM) + ")",
								data: secondPatchCall,
								method: "PATCH"
							});
						}
					});

					$.each(filteredData, function (j, obj) {
						if (i == j && obj != undefined && obj.smallQty != "" && obj.smallQty != undefined) {

							var fisrtPatchCall = {
								"ProductionOrderStatus": "boposReleased",
							};
							batchUrl.push({
								url: "/b1s/v2/ProductionOrders(" + Number(docNUM) + ")",
								data: fisrtPatchCall,
								method: "PATCH"
							});

							var payLoadInventoryEntry = {
								"BPL_IDAssignedToInvoice": jsonModel.getProperty("/sLinObj").U_Branch,
								"Comments": "processing - record completion - Entry",
								"DocumentLines": []
							};

							payLoadInventoryEntry.DocumentLines.push({
								"BaseType": 202,
								"BaseEntry": Number(docNUM),
								"WarehouseCode": configLocation, //"GHCCPH1", //bucktoObj.WhsCode,
								"Quantity": Number(obj.smallQty),
								// "UnitPrice": "",
								"BatchNumbers": [{
									"BatchNumber": obj.smallTag, // <THIS IS TAG>
									"Quantity": Number(obj.smallQty), //<THIS IS THE QTY OF CLONES>
									"Location": configLocation, //"GHCCPH1", //bucktoObj.BinLocationCode,
									"ManufacturerSerialNumber": bucktoObj.HarvestName,
									"U_BatAttr3": bucktoObj.METRCUID,
									"U_IsPackage": "YES",
									"U_Phase": "Package",
								}],
								"DocumentLinesBinAllocations": [{
									"BinAbsEntry": Number(configAbsEntry), //298, //Number(absEntry), //
									"Quantity": Number(obj.smallQty),
									"SerialAndBatchNumbersBaseLine": 0
								}]
							});
							batchUrl.push({
								url: "/b1s/v2/InventoryGenEntries",
								data: payLoadInventoryEntry,
								method: "POST"
							});

							var payLoadInventoryExit = {
								"BPL_IDAssignedToInvoice": jsonModel.getProperty("/sLinObj").U_Branch,
								"Comments": "Processing - record Completion - Exit",
								"DocumentLines": [{
									"LineNum": 0,
									"BaseType": 202,
									"BaseEntry": Number(docNUM),
									"BaseLine": 1,
									"Quantity": Number(obj.smallQty), //bucktoObj.Quantity,
									"WarehouseCode": bucktoObj.WhsCode,
									"BatchNumbers": [{
										"BatchNumber": bucktoObj.METRCUID, // <THIS IS TAG>
										"Quantity": Number(obj.smallQty), //bucktoObj.Quantity, //<THIS IS THE QTY OF CLONES>
										"Location": bucktoObj.BinLocationCode //<THIS IS FROM CLONE ROOM>
									}],
									"DocumentLinesBinAllocations": [{
										"BinAbsEntry": Number(absEntry),
										"Quantity": Number(obj.smallQty), //bucktoObj.Quantity,
										"SerialAndBatchNumbersBaseLine": 0
									}]
								}]
							};

							batchUrl.push({
								url: "/b1s/v2/InventoryGenExits",
								data: payLoadInventoryExit,
								method: "POST"
							});

							var secondPatchCall = {
								"ProductionOrderStatus": "boposClosed",
							};

							batchUrl.push({
								url: "/b1s/v2/ProductionOrders(" + Number(docNUM) + ")",
								data: secondPatchCall,
								method: "PATCH"
							});
						}
					});
					$.each(filteredData, function (j, obj) {
						if (i == j && obj != undefined && obj.BsmallQty != "" && obj.BsmallQty != undefined) {

							var fisrtPatchCall = {
								"ProductionOrderStatus": "boposReleased",
							};
							batchUrl.push({
								url: "/b1s/v2/ProductionOrders(" + Number(docNUM) + ")",
								data: fisrtPatchCall,
								method: "PATCH"
							});

							var payLoadInventoryEntry = {
								"BPL_IDAssignedToInvoice": jsonModel.getProperty("/sLinObj").U_Branch,
								"Comments": "processing - record completion - Entry",
								"DocumentLines": []
							};

							payLoadInventoryEntry.DocumentLines.push({
								"BaseType": 202,
								"BaseEntry": Number(docNUM),
								"WarehouseCode": configLocation, //"GHCCPH1", //bucktoObj.WhsCode,
								"Quantity": Number(obj.BsmallQty),
								// "UnitPrice": "",
								"BatchNumbers": [{
									"BatchNumber": obj.BsmallTag, // <THIS IS TAG>
									"Quantity": Number(obj.BsmallQty), //<THIS IS THE QTY OF CLONES>
									"Location": configLocation, //"GHCCPH1", //bucktoObj.BinLocationCode,
									"ManufacturerSerialNumber": bucktoObj.HarvestName,
									"U_BatAttr3": bucktoObj.METRCUID,
									"U_IsPackage": "YES",
									"U_Phase": "Package",
								}],
								"DocumentLinesBinAllocations": [{
									"BinAbsEntry": Number(configAbsEntry), //298, //Number(absEntry), //
									"Quantity": Number(obj.BsmallQty),
									"SerialAndBatchNumbersBaseLine": 0
								}]
							});
							batchUrl.push({
								url: "/b1s/v2/InventoryGenEntries",
								data: payLoadInventoryEntry,
								method: "POST"
							});

							var payLoadInventoryExit = {
								"BPL_IDAssignedToInvoice": jsonModel.getProperty("/sLinObj").U_Branch,
								"Comments": "Processing - record Completion - Exit",
								"DocumentLines": [{
									"LineNum": 0,
									"BaseType": 202,
									"BaseEntry": Number(docNUM),
									"BaseLine": 1,
									"Quantity": Number(obj.BsmallQty), //bucktoObj.Quantity,
									"WarehouseCode": bucktoObj.WhsCode,
									"BatchNumbers": [{
										"BatchNumber": bucktoObj.METRCUID, // <THIS IS TAG>
										"Quantity": Number(obj.BsmallQty), //bucktoObj.Quantity, //<THIS IS THE QTY OF CLONES>
										"Location": bucktoObj.BinLocationCode //<THIS IS FROM CLONE ROOM>
									}],
									"DocumentLinesBinAllocations": [{
										"BinAbsEntry": Number(absEntry),
										"Quantity": Number(obj.BsmallQty), //bucktoObj.Quantity,
										"SerialAndBatchNumbersBaseLine": 0
									}]
								}]
							};

							batchUrl.push({
								url: "/b1s/v2/InventoryGenExits",
								data: payLoadInventoryExit,
								method: "POST"
							});

							var secondPatchCall = {
								"ProductionOrderStatus": "boposClosed",
							};

							batchUrl.push({
								url: "/b1s/v2/ProductionOrders(" + Number(docNUM) + ")",
								data: secondPatchCall,
								method: "PATCH"
							});
						}
					});
					$.each(filteredData, function (j, obj) {
						if (i == j && obj != undefined && obj.popcornQty != "" && obj.popcornQty != undefined) {

							var fisrtPatchCall = {
								"ProductionOrderStatus": "boposReleased",
							};
							batchUrl.push({
								url: "/b1s/v2/ProductionOrders(" + Number(docNUM) + ")",
								data: fisrtPatchCall,
								method: "PATCH"
							});

							var payLoadInventoryEntry = {
								"BPL_IDAssignedToInvoice": jsonModel.getProperty("/sLinObj").U_Branch,
								"Comments": "processing - record completion - Entry",
								"DocumentLines": []
							};

							payLoadInventoryEntry.DocumentLines.push({
								"BaseType": 202,
								"BaseEntry": Number(docNUM),
								"WarehouseCode": configLocation, //"GHCCPH1", //bucktoObj.WhsCode,
								"Quantity": Number(obj.popcornQty),
								// "UnitPrice": "",
								"BatchNumbers": [{
									"BatchNumber": obj.popcornTag, // <THIS IS TAG>
									"Quantity": Number(obj.popcornQty), //<THIS IS THE QTY OF CLONES>
									"Location": configLocation, //"GHCCPH1", //bucktoObj.BinLocationCode,
									"ManufacturerSerialNumber": bucktoObj.HarvestName,
									"U_BatAttr3": bucktoObj.METRCUID,
									"U_IsPackage": "YES",
									"U_Phase": "Package",
								}],
								"DocumentLinesBinAllocations": [{
									"BinAbsEntry": Number(configAbsEntry), //298, //Number(absEntry), //
									"Quantity": Number(obj.popcornQty),
									"SerialAndBatchNumbersBaseLine": 0
								}]
							});
							batchUrl.push({
								url: "/b1s/v2/InventoryGenEntries",
								data: payLoadInventoryEntry,
								method: "POST"
							});

							var payLoadInventoryExit = {
								"BPL_IDAssignedToInvoice": jsonModel.getProperty("/sLinObj").U_Branch,
								"Comments": "Processing - record Completion - Exit",
								"DocumentLines": [{
									"LineNum": 0,
									"BaseType": 202,
									"BaseEntry": Number(docNUM),
									"BaseLine": 0,
									"Quantity": Number(obj.popcornQty), //bucktoObj.Quantity,
									"WarehouseCode": bucktoObj.WhsCode,
									"BatchNumbers": [{
										"BatchNumber": bucktoObj.METRCUID, // <THIS IS TAG>
										"Quantity": Number(obj.popcornQty), //bucktoObj.Quantity, //<THIS IS THE QTY OF CLONES>
										"Location": bucktoObj.BinLocationCode //<THIS IS FROM CLONE ROOM>
									}],
									"DocumentLinesBinAllocations": [{
										"BinAbsEntry": Number(absEntry),
										"Quantity": Number(obj.popcornQty), //bucktoObj.Quantity,
										"SerialAndBatchNumbersBaseLine": 0
									}]
								}]
							};

							batchUrl.push({
								url: "/b1s/v2/InventoryGenExits",
								data: payLoadInventoryExit,
								method: "POST"
							});

							var secondPatchCall = {
								"ProductionOrderStatus": "boposClosed",
							};

							batchUrl.push({
								url: "/b1s/v2/ProductionOrders(" + Number(docNUM) + ")",
								data: secondPatchCall,
								method: "PATCH"
							});
						}
					});
					$.each(filteredData, function (j, obj) {
						if (i == j && obj != undefined && obj.AtrimQty != "" && obj.AtrimQty != undefined) {

							var fisrtPatchCall = {
								"ProductionOrderStatus": "boposReleased",
							};
							batchUrl.push({
								url: "/b1s/v2/ProductionOrders(" + Number(docNUM) + ")",
								data: fisrtPatchCall,
								method: "PATCH"
							});

							var payLoadInventoryEntry = {
								"BPL_IDAssignedToInvoice": jsonModel.getProperty("/sLinObj").U_Branch,
								"Comments": "processing - record completion - Entry",
								"DocumentLines": []
							};

							payLoadInventoryEntry.DocumentLines.push({
								"BaseType": 202,
								"BaseEntry": Number(docNUM),
								"WarehouseCode": configLocation, //"GHCCPH1", //bucktoObj.WhsCode,
								"Quantity": Number(obj.AtrimQty),
								// "UnitPrice": "",
								"BatchNumbers": [{
									"BatchNumber": obj.AtrimTag, // <THIS IS TAG>
									"Quantity": Number(obj.AtrimQty), //<THIS IS THE QTY OF CLONES>
									"Location": configLocation, //"GHCCPH1", //bucktoObj.BinLocationCode,
									"ManufacturerSerialNumber": bucktoObj.HarvestName,
									"U_BatAttr3": bucktoObj.METRCUID,
									"U_IsPackage": "YES",
									"U_Phase": "Package",
								}],
								"DocumentLinesBinAllocations": [{
									"BinAbsEntry": Number(configAbsEntry), //298, //Number(absEntry), //
									"Quantity": Number(obj.AtrimQty),
									"SerialAndBatchNumbersBaseLine": 0
								}]
							});
							batchUrl.push({
								url: "/b1s/v2/InventoryGenEntries",
								data: payLoadInventoryEntry,
								method: "POST"
							});

							var payLoadInventoryExit = {
								"BPL_IDAssignedToInvoice": jsonModel.getProperty("/sLinObj").U_Branch,
								"Comments": "Processing - record Completion - Exit",
								"DocumentLines": [{
									"LineNum": 0,
									"BaseType": 202,
									"BaseEntry": Number(docNUM),
									"BaseLine": 0,
									"Quantity": Number(obj.AtrimQty), //bucktoObj.Quantity,
									"WarehouseCode": bucktoObj.WhsCode,
									"BatchNumbers": [{
										"BatchNumber": bucktoObj.METRCUID, // <THIS IS TAG>
										"Quantity": Number(obj.AtrimQty), //bucktoObj.Quantity, //<THIS IS THE QTY OF CLONES>
										"Location": bucktoObj.BinLocationCode //<THIS IS FROM CLONE ROOM>
									}],
									"DocumentLinesBinAllocations": [{
										"BinAbsEntry": Number(absEntry),
										"Quantity": Number(obj.AtrimQty), //bucktoObj.Quantity,
										"SerialAndBatchNumbersBaseLine": 0
									}]
								}]
							};

							batchUrl.push({
								url: "/b1s/v2/InventoryGenExits",
								data: payLoadInventoryExit,
								method: "POST"
							});

							var secondPatchCall = {
								"ProductionOrderStatus": "boposClosed",
							};

							batchUrl.push({
								url: "/b1s/v2/ProductionOrders(" + Number(docNUM) + ")",
								data: secondPatchCall,
								method: "PATCH"
							});
						}
					});
					$.each(filteredData, function (j, obj) {
						if (i == j && obj != undefined && obj.BtrimQty != "" && obj.BtrimQty != undefined) {

							var fisrtPatchCall = {
								"ProductionOrderStatus": "boposReleased",
							};
							batchUrl.push({
								url: "/b1s/v2/ProductionOrders(" + Number(docNUM) + ")",
								data: fisrtPatchCall,
								method: "PATCH"
							});

							var payLoadInventoryEntry = {
								"BPL_IDAssignedToInvoice": jsonModel.getProperty("/sLinObj").U_Branch,
								"Comments": "processing - record completion - Entry",
								"DocumentLines": []
							};

							payLoadInventoryEntry.DocumentLines.push({
								"BaseType": 202,
								"BaseEntry": Number(docNUM),
								"WarehouseCode": configLocation, //"GHCCPH1", //bucktoObj.WhsCode,
								"Quantity": Number(obj.BtrimQty),
								// "UnitPrice": "",
								"BatchNumbers": [{
									"BatchNumber": obj.BtrimTag, // <THIS IS TAG>
									"Quantity": Number(obj.BtrimQty), //<THIS IS THE QTY OF CLONES>
									"Location": configLocation, //"GHCCPH1", //bucktoObj.BinLocationCode,
									"ManufacturerSerialNumber": bucktoObj.HarvestName,
									"U_BatAttr3": bucktoObj.METRCUID,
									"U_IsPackage": "YES",
									"U_Phase": "Package",
								}],
								"DocumentLinesBinAllocations": [{
									"BinAbsEntry": Number(configAbsEntry), //298, //Number(absEntry), //
									"Quantity": Number(obj.BtrimQty),
									"SerialAndBatchNumbersBaseLine": 0
								}]
							});
							batchUrl.push({
								url: "/b1s/v2/InventoryGenEntries",
								data: payLoadInventoryEntry,
								method: "POST"
							});

							var payLoadInventoryExit = {
								"BPL_IDAssignedToInvoice": jsonModel.getProperty("/sLinObj").U_Branch,
								"Comments": "Processing - record Completion - Exit",
								"DocumentLines": [{
									"LineNum": 0,
									"BaseType": 202,
									"BaseEntry": Number(docNUM),
									"BaseLine": 0,
									"Quantity": Number(obj.BtrimQty), //bucktoObj.Quantity,
									"WarehouseCode": bucktoObj.WhsCode,
									"BatchNumbers": [{
										"BatchNumber": bucktoObj.METRCUID, // <THIS IS TAG>
										"Quantity": Number(obj.BtrimQty), //bucktoObj.Quantity, //<THIS IS THE QTY OF CLONES>
										"Location": bucktoObj.BinLocationCode //<THIS IS FROM CLONE ROOM>
									}],
									"DocumentLinesBinAllocations": [{
										"BinAbsEntry": Number(absEntry),
										"Quantity": Number(obj.BtrimQty), //bucktoObj.Quantity,
										"SerialAndBatchNumbersBaseLine": 0
									}]
								}]
							};

							batchUrl.push({
								url: "/b1s/v2/InventoryGenExits",
								data: payLoadInventoryExit,
								method: "POST"
							});

							var secondPatchCall = {
								"ProductionOrderStatus": "boposClosed",
							};

							batchUrl.push({
								url: "/b1s/v2/ProductionOrders(" + Number(docNUM) + ")",
								data: secondPatchCall,
								method: "PATCH"
							});
						}
					});
					$.each(filteredData, function (j, obj) {
						if (i == j && obj != undefined && obj.moldQty != "" && obj.moldQty != undefined) {

							var fisrtPatchCall = {
								"ProductionOrderStatus": "boposReleased",
							};
							batchUrl.push({
								url: "/b1s/v2/ProductionOrders(" + Number(docNUM) + ")",
								data: fisrtPatchCall,
								method: "PATCH"
							});

							var payLoadInventoryEntry = {
								"BPL_IDAssignedToInvoice": jsonModel.getProperty("/sLinObj").U_Branch,
								"Comments": "processing - record completion - Entry",
								"DocumentLines": []
							};

							payLoadInventoryEntry.DocumentLines.push({
								"BaseType": 202,
								"BaseEntry": Number(docNUM),
								"WarehouseCode": configLocation, //"GHCCPH1", //bucktoObj.WhsCode,
								"Quantity": Number(obj.moldQty),
								// "UnitPrice": "",
								"BatchNumbers": [{
									"BatchNumber": obj.moldTag, // <THIS IS TAG>
									"Quantity": Number(obj.moldQty), //<THIS IS THE QTY OF CLONES>
									"Location": configLocation, //"GHCCPH1", //bucktoObj.BinLocationCode,
									"ManufacturerSerialNumber": bucktoObj.HarvestName,
									"U_BatAttr3": bucktoObj.METRCUID,
									"U_IsPackage": "YES",
									"U_Phase": "Package",
								}],
								"DocumentLinesBinAllocations": [{
									"BinAbsEntry": Number(configAbsEntry), //298, //Number(absEntry), //
									"Quantity": Number(obj.moldQty),
									"SerialAndBatchNumbersBaseLine": 0
								}]
							});
							batchUrl.push({
								url: "/b1s/v2/InventoryGenEntries",
								data: payLoadInventoryEntry,
								method: "POST"
							});

							var payLoadInventoryExit = {
								"BPL_IDAssignedToInvoice": jsonModel.getProperty("/sLinObj").U_Branch,
								"Comments": "Processing - record Completion - Exit",
								"DocumentLines": [{
									"LineNum": 0,
									"BaseType": 202,
									"BaseEntry": Number(docNUM),
									"BaseLine": 0,
									"Quantity": Number(obj.moldQty), //bucktoObj.Quantity,
									"WarehouseCode": bucktoObj.WhsCode,
									"BatchNumbers": [{
										"BatchNumber": bucktoObj.METRCUID, // <THIS IS TAG>
										"Quantity": Number(obj.moldQty), //bucktoObj.Quantity, //<THIS IS THE QTY OF CLONES>
										"Location": bucktoObj.BinLocationCode //<THIS IS FROM CLONE ROOM>
									}],
									"DocumentLinesBinAllocations": [{
										"BinAbsEntry": Number(absEntry),
										"Quantity": Number(obj.moldQty), //bucktoObj.Quantity,
										"SerialAndBatchNumbersBaseLine": 0
									}]
								}]
							};

							batchUrl.push({
								url: "/b1s/v2/InventoryGenExits",
								data: payLoadInventoryExit,
								method: "POST"
							});

							var secondPatchCall = {
								"ProductionOrderStatus": "boposClosed",
							};

							batchUrl.push({
								url: "/b1s/v2/ProductionOrders(" + Number(docNUM) + ")",
								data: secondPatchCall,
								method: "PATCH"
							});
						}
					});
					$.each(filteredData, function (j, obj) {
						if (i == j && obj != undefined && obj.wasteQty != "" && obj.wasteQty != undefined && obj.wasteQty != "0") {

							var fisrtPatchCall = {
								"ProductionOrderStatus": "boposReleased",
							};
							batchUrl.push({
								url: "/b1s/v2/ProductionOrders(" + Number(docNUM) + ")",
								data: fisrtPatchCall,
								method: "PATCH"
							});

							var payLoadInventoryEntry = {
								"BPL_IDAssignedToInvoice": jsonModel.getProperty("/sLinObj").U_Branch,
								"Comments": "processing - record completion - Entry",
								"DocumentLines": []
							};

							payLoadInventoryEntry.DocumentLines.push({
								"BaseType": 202,
								"BaseEntry": Number(docNUM),
								"WarehouseCode": configLocation, //"GHCCPH1", //bucktoObj.WhsCode,
								"Quantity": Number(obj.wasteQty),
								// "UnitPrice": "",
								"BatchNumbers": [{
									"BatchNumber": bucktoObj.METRCUID, // <THIS IS TAG>
									"Quantity": Number(obj.wasteQty), //<THIS IS THE QTY OF CLONES>
									"Location": configLocation, //"GHCCPH1", //bucktoObj.BinLocationCode,
									"ManufacturerSerialNumber": bucktoObj.HarvestName,
									"U_BatAttr3": bucktoObj.METRCUID,
									"U_IsPackage": "YES",
									"U_Phase": "Package",
								}],
								"DocumentLinesBinAllocations": [{
									"BinAbsEntry": Number(configAbsEntry), //298, //Number(absEntry), //
									"Quantity": Number(obj.wasteQty),
									"SerialAndBatchNumbersBaseLine": 0
								}]
							});
							batchUrl.push({
								url: "/b1s/v2/InventoryGenEntries",
								data: payLoadInventoryEntry,
								method: "POST"
							});

							var payLoadInventoryExit = {
								"BPL_IDAssignedToInvoice": jsonModel.getProperty("/sLinObj").U_Branch,
								"Comments": "Processing - record Completion - Exit",
								"DocumentLines": [{
									"LineNum": 0,
									"BaseType": 202,
									"BaseEntry": Number(docNUM),
									"BaseLine": 0,
									"Quantity": Number(obj.wasteQty), //bucktoObj.Quantity,
									"WarehouseCode": bucktoObj.WhsCode,
									"BatchNumbers": [{
										"BatchNumber": bucktoObj.METRCUID, // <THIS IS TAG>
										"Quantity": Number(obj.wasteQty), //bucktoObj.Quantity, //<THIS IS THE QTY OF CLONES>
										"Location": bucktoObj.BinLocationCode //<THIS IS FROM CLONE ROOM>
									}],
									"DocumentLinesBinAllocations": [{
										"BinAbsEntry": Number(absEntry),
										"Quantity": Number(obj.wasteQty), //bucktoObj.Quantity,
										"SerialAndBatchNumbersBaseLine": 0
									}]
								}]
							};

							batchUrl.push({
								url: "/b1s/v2/InventoryGenExits",
								data: payLoadInventoryExit,
								method: "POST"
							});

							var secondPatchCall = {
								"ProductionOrderStatus": "boposClosed",
							};

							batchUrl.push({
								url: "/b1s/v2/ProductionOrders(" + Number(docNUM) + ")",
								data: secondPatchCall,
								method: "PATCH"
							});
						}
					});

					if (countproduction == 0) {
						var batchAbsEntry = jsonModel.getProperty("/batchAbsEntry");
						that.createBatchCall(batchUrl, function () {
							var finishObj = {
								Label: bucktoObj.METRCUID,
								ActualDate: that.getSystemDate()
							};

							var updatePayload = {
								"Status": "bdsStatus_NotAccessible"
							};

							var metricFinishPayload = [];
							metricFinishPayload.push(finishObj);

							if (metrcData && metrcData.U_NACST === "X") {
								var metrcFinishUrl = "/packages/v2/finish?licenseNumber=" + jsonModel.getProperty("/selectedLicense");
								that.callMetricsService(metrcFinishUrl, "PUT", metricFinishPayload, function () {
									that.updateServiecLayer("/b1s/v2/BatchNumberDetails(" + batchAbsEntry + ")", function () {
										that.recordCompDialog.close();
										//	jsonModel.setProperty("/busyView", false);
										//	sap.m.MessageToast.show("Package created successfully");
										jsonModel.setProperty("/busyTitle", "✅ All set!");
										jsonModel.setProperty("/busyText", "Record Completion completed successfully.");
										setTimeout(function () {
											that._busyDialog.close();
										}, 1000);
										that.byId("processingTable").clearSelection();
										that.loadMasterData();

									}, updatePayload, "PATCH");

								}, function (error) {
									/*	sap.m.MessageToast.show(JSON.stringify(error));
										that.recordCompDialog.close();
										sap.m.MessageToast.show("Package created successfully");
										that.byId("processingTable").clearSelection();
										that.loadMasterData();*/
								});

							} else {

								that.updateServiecLayer("/b1s/v2/BatchNumberDetails(" + batchAbsEntry + ")", function () {
									that.recordCompDialog.close();
									/*	jsonModel.setProperty("/busyView", false);
										sap.m.MessageToast.show("Package created successfully");*/
									jsonModel.setProperty("/busyTitle", "✅ All set!");
									jsonModel.setProperty("/busyText", "Record Completion completed successfully.");
									that.byId("processingTable").clearSelection();
									that.loadMasterData();

								}, updatePayload, "PATCH");
							}

							// var batchAbsEntry = jsonModel.getProperty("/batchAbsEntry");
							// that.updateServiecLayer("/b1s/v2/BatchNumberDetails(" + batchAbsEntry + ")", function () {
							// 	that.loadMasterData();
							// }, updatePayload, "PATCH");
						});

					}

				}.bind(that), sObj, "POST");

			});

		},

		/***method for RecordCompletation button function end**/

		validateEnteredQty: function (evt) {
			var value = evt.getParameter("newValue");
			value = value.replace(/[^.\d]/g, '').replace(/^(\d*\.?)|(\d*)\.?/g, "$1$2");
			//value = value.replace(/\D/, "");
			evt.getSource().setValue(value);
			var sObj = evt.getSource().getBindingContext("jsonModel").getObject();
			if (isNaN(value)) {
				sObj.STATUSQTY = "Error";
				sObj.QTYTXT = "enter numeric value only";
				evt.getSource().focus();
			} else if (Number(sObj.U_NLQTY) < Number(value)) {
				sObj.STATUSQTY = "Error";
				sObj.QTYTXT = "Entered Quantity is more than Available Quantity";
				evt.getSource().focus();
			} else {
				sObj.STATUSQTY = "None";
			}
		},

		removefilters: function () {
			var filterTable = this.getView().byId("processingTable");
			var aColumns = filterTable.getColumns();
			for (var i = 0; i <= aColumns.length; i++) {
				filterTable.filter(aColumns[i], null);
				filterTable.sort(aColumns[i], null);
			}
			this.byId("searchFieldTable").removeAllTokens();
		},
		clearAllFilters: function () {
			this.removefilters();
			this.getView().byId("processingTable").clearSelection();
		},
		refreshData: function () {
			this.byId("searchFieldTable").removeAllTokens();
			this.byId("searchFieldTable2").removeAllTokens();
			this.clearAllFilters();
			this.loadMasterData();
			this.loadlocationsData();
		},

		onChanageNavigate: function () {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var serLayerTargetUrl = jsonModel.getProperty("/target");
			var pageTo = this.byId("navigate").getSelectedKey();
			var AppNavigator;
			if (pageTo === "Strain") {
				AppNavigator = serLayerTargetUrl.Strain;
			}
			if (pageTo === "ClonePlanner") {
				AppNavigator = serLayerTargetUrl.ClonePlanner;
			}
			if (pageTo === "VegPlanner") {
				AppNavigator = serLayerTargetUrl.VegPlanner;
			}
			if (pageTo === "FlowerPlanner") {
				AppNavigator = serLayerTargetUrl.FlowerPlanner;
			}
			if (pageTo === "Harvest") {
				AppNavigator = serLayerTargetUrl.Harvest;
			}
			if (pageTo === "MotherPlanner") {
				AppNavigator = serLayerTargetUrl.MotherPlanner;
			}
			if (pageTo === "DestroyedPlants") {
				AppNavigator = serLayerTargetUrl.DestroyedPlants;
			}
			if (pageTo === "Waste") {
				AppNavigator = serLayerTargetUrl.Waste;
			}
			if (pageTo === "ManagePackages") {
				AppNavigator = serLayerTargetUrl.ManagePackages;
			}
			if (pageTo === "METRCTag") {
				AppNavigator = serLayerTargetUrl.METRCTag;
			}
			var oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation"); // get a handle on the global XAppNav service
			oCrossAppNavigator.toExternal({
				target: {
					shellHash: AppNavigator
				}
			});
		}

	});
});
/*global history */
sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/UIComponent",
	"sap/ui/core/routing/History",
	"sap/m/MessageBox",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/core/format/DateFormat"
], function (Controller, UIComponent, History, MessageBox, Filter, FilterOperator, DateFormat) {
	"use strict";

	return Controller.extend("com.9b.processing.controller.BaseController", {
		/**
		 * Convenience method for accessing the router.
		 * @public
		 * @returns {sap.ui.core.routing.Router} the router for this component
		 **/
		getRouter: function () {
			return UIComponent.getRouterFor(this);
		},
		DateformateChange: function (date) {
			var dateFormat = DateFormat.getDateInstance({
				pattern: "yyyy-MM-dd",
				UTC: true
			});
			var postingDate = dateFormat.format(new Date(date));
			return postingDate;
		},
		/**
		 * Convenience method for getting the view model by name.
		 * @public
		 * @param {string} [sName] the model name
		 * @returns {sap.ui.model.Model} the model instance
		 */
		getModel: function (sName) {
			return this.getView().getModel(sName);
		},
		/**
		 * Convenience method for setting the view model.
		 * @public
		 * @param {sap.ui.model.Model} oModel the model instance
		 * @param {string} sName the model name
		 * @returns {sap.ui.mvc.View} the view instance
		 */
		setModel: function (oModel, sName) {
			return this.getView().setModel(oModel, sName);
		},
		validateTag: function (evt) {
			let sValue = evt.getParameter("value");
			sValue = sValue.toUpperCase();
			evt.getSource().setValue(sValue);
			var jsonModel = this.getView().getModel("jsonModel");
			var custData = evt.getSource().getCustomData();
			var fieldValue = custData[0].getValue();
			if (fieldValue === "begin1") {
				jsonModel.setProperty("/buckObj/BuckedPackage", sValue);
			} else {
				jsonModel.setProperty("/buckObj/TrimPackage", sValue);
			}

		},

		getUsersService: function () {
			var that = this;
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			return new Promise(function (resolve, reject) {
				that.readServiecLayer("/b1s/v2/UsersService_GetCurrentUser", function (data) {
					resolve();
					var userAccessLicense = JSON.parse(data.U_License);
					if (userAccessLicense != null) {
						jsonModel.setProperty("/userAccessLicense", userAccessLicense);
					}
					jsonModel.setProperty("/apiKey", data.U_APIKey);
					if (data.UserActionRecord.length) {
						var sTime = data.UserActionRecord[0].ActionTime;
						var sDate = data.UserActionRecord[0].ActionDate;
						sDate = sDate.replace("Z", "");
						var dateObj = new Date(sDate);
						dateObj.setHours(sTime.split(":")[0], sTime.split(":")[1], sTime.split(":")[2]);
						jsonModel.setProperty("/systemDate", dateObj);
						jsonModel.setProperty("/systemTime", sTime);
					} else {
						jsonModel.setProperty("/systemDate", new Date());
					}

				});
			});
		},
		getSystemDate: function (sDate) {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var dateFormat = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "yyyy-MM-dd",
				UTC: false
			});
			var systemDate;
			if (sDate) {
				var systemTime = jsonModel.getProperty("/systemTime");
				if (systemTime) {
					var sDate = new Date(sDate);
					sDate.setHours(systemTime.split(":")[0], systemTime.split(":")[1], systemTime.split(":")[2]);
				}
				systemDate = sDate;
			} else {
				systemDate = jsonModel.getProperty("/systemDate");
			}
			systemDate = dateFormat.format(new Date());
			return systemDate;
		},

		adjustQuantity: function (evt) {
			var sObj = evt.getSource().getBindingContext("jsonModel").getObject();
			var aQty = sObj.Quantity;
			var sQty = evt.getParameter("value");
			if (Number(sQty) + Number(aQty) < 0) {
				sap.m.MessageToast.show("Adjust Quantity is Less than Available Quantity");
			} else {
				sObj.NEWQTY = Number(aQty) + (Number(sQty));
				//	var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			}
		},

		cellClick: function (evt) {
			//	evt.getParameter("cellControl").getParent()._setSelected(true);
			var cellControl = evt.getParameter("cellControl");
			var isBinded = cellControl.getBindingContext("jsonModel");
			if (isBinded) {
				var oTable = evt.getParameter("cellControl").getParent().getParent();
				var sIndex = cellControl.getParent().getIndex();
				var sIndices = oTable.getSelectedIndices();
				if (sIndices.includes(sIndex)) {
					sIndices.splice(sIndices.indexOf(sIndex), 1);
				} else {
					sIndices.push(sIndex);
				}
				if (sIndices.length > 0) {
					jQuery.unique(sIndices);
					$.each(sIndices, function (i, e) {
						oTable.addSelectionInterval(e, e);
					});
				} else {
					oTable.clearSelection();
				}
			}

			//	oTable.setSelectionInterval(sIndex, sIndex);
		},
		loadCustomerData: function () {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			this.getOwnerComponent().getModel("BP").read("/OCRD", {
				success: function (data) {
					jsonModel.setProperty("/customerList", data.results);
				}
			});
		},
		onCustSearch: function (evt) {
			var oTableSearchState = [],
				sQuery = evt.getParameter("query");
			if (sQuery && sQuery.length > 0) {
				oTableSearchState = [
					new sap.ui.model.Filter("CardCode", FilterOperator.Contains, sQuery),
					new sap.ui.model.Filter("CardName", FilterOperator.Contains, sQuery),
					new sap.ui.model.Filter("Balance", FilterOperator.Contains, sQuery),
					new sap.ui.model.Filter("Currency", FilterOperator.Contains, sQuery)
				];
				var combinedFilter = new Filter({
					filters: oTableSearchState,
					and: false
				});

				evt.getSource().getParent().getParent().getBinding("items").filter([combinedFilter]);
			} else {
				evt.getSource().getParent().getParent().getBinding("items").filter([]);
			}
			//	this.getOwnerComponent().getModel("jsonModel").setProperty("/custCount", 2);
		},

		loadItems: function () {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			this.getOwnerComponent().getModel("OITM").read("/OITM", {
				success: function (data) {
					jsonModel.setProperty("/itemsList", data.results);
				}
			});
		},
		getAppConfigData: function () {
			var that = this;
			return new Promise(function (resolve, reject) {
				var jsonModel = that.getOwnerComponent().getModel("jsonModel");
				var filters = "?$filter=U_NAPP eq 'Processing' or U_NAPP eq 'AllApps'";
				that.readServiecLayer("/b1s/v2/U_NCNFG" + filters, function (data) {
					resolve(data);
					if (data.value.length > 0) {
						var configObj = {};
						$.each(data.value, function (i, e) {
							if (e.U_NFLDS === "Create Lab Sample") {
								configObj.V_CLS = e.U_NVSBL === "Y" ? true : false;
							} else if (e.U_NFLDS === "Create Transfer") {
								configObj.V_CTR = e.U_NVSBL === "Y" ? true : false;
							} else if (e.U_NFLDS === "Adjust") {
								configObj.V_ADJ = e.U_NVSBL === "Y" ? true : false;
							} else if (e.U_NFLDS === "Finish") {
								configObj.V_FIN = e.U_NVSBL === "Y" ? true : false;
							} else if (e.U_NFLDS === "Status") {
								configObj.V_STS = e.U_NVSBL === "Y" ? true : false;
							} else if (e.U_NFLDS === "METRC Status") {
								var MetrcOnOff = e.U_NVSBL === "Y" ? true : false;
								jsonModel.setProperty("/MetrcOnOff", MetrcOnOff);
							} else if (e.U_NFLDS === "Item Group Code") {
								var itemGrpCodes = e.U_NVALUE;
								jsonModel.setProperty("/itemGrpCodes", itemGrpCodes);
							} else if (e.U_NFLDS === "binAbsEntry") {
								var absEntry = e.U_NVALUE;
								jsonModel.setProperty("/BinAbsEntry", JSON.parse(absEntry));
							}

						});
						jsonModel.setProperty("/configData", configObj);
					} else {
						jsonModel.setProperty("/configData", {});
					}
				});
			});
		},

		onItemSearch: function (evt) {
			var oTableSearchState = [],
				sQuery = evt.getParameter("query");
			if (sQuery && sQuery.length > 0) {
				oTableSearchState = [
					new sap.ui.model.Filter("ItemCode", FilterOperator.Contains, sQuery),
					new sap.ui.model.Filter("ItemName", FilterOperator.Contains, sQuery),
					new sap.ui.model.Filter("OnHand", FilterOperator.Contains, sQuery),
					new sap.ui.model.Filter("ItmsGrpCod", FilterOperator.EQ, sQuery)
				];
				var combinedFilter = new Filter({
					filters: oTableSearchState,
					and: false
				});

				evt.getSource().getParent().getParent().getBinding("items").filter([combinedFilter]);
			} else {
				evt.getSource().getParent().getParent().getBinding("items").filter([]);
			}
			//	this.getOwnerComponent().getModel("jsonModel").setProperty("/custCount", 2);
		},

		clearTableFilters: function (fId, table, search) {
			//	sap.ui.core.Fragment.byId(fId, table).removeSelections();
			sap.ui.core.Fragment.byId(fId, search).setValue();
			sap.ui.core.Fragment.byId(fId, table).getBinding("items").filter([]);
		},
		loadLicenseData: function () {
			var that = this;
			var filters = [];
			filters.push(new sap.ui.model.Filter("WarehouseCode", "StartsWith", "LIC"));
			this.getOwnerComponent().getModel("Facilities").read("/OWHS", {
				filters: filters,
				success: function (data) {
					that.getOwnerComponent().getModel("jsonModel").setProperty("/licenseList", data.results);
					//that.getView().byId('license').setModel(that.getOwnerComponent().getModel("jsonModel"));
				}
			});
		},
		convertUTCDate: function (date) {
			date.setHours(new Date().getHours());
			date.setMinutes(new Date().getMinutes());
			date.setSeconds(new Date().getSeconds());
			var utc = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
			return utc;
		},
		convertUTCDatePost: function (date) {
			date.setHours(new Date().getHours());
			date.setMinutes(new Date().getMinutes());
			date.setSeconds(new Date().getSeconds());
			var utc = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
			return utc;
		},

		convertUTCDateTime: function (date) {
			var dateFormat = DateFormat.getDateInstance({
				pattern: 'yyyy-MM-ddThh:mm:ss',
				UTC: true
			});
			var postingDate = dateFormat.format(new Date(date), true);
			var finalDate = "/Date(" + new Date(postingDate + "Z").getTime() + ")/";
			return finalDate;
		},

		convertUTCDateTimeNew: function (date) {
			var dateFormat = DateFormat.getDateInstance({
				pattern: "yyyy-MM-ddTHH:mm:ss",
				UTC: true
			});

			var addTime = 6 * 60 * 60 * 1000;
			var date1 = new Date(date);
			var date2 = date1.getTime() - addTime;
			var date3 = dateFormat.format(new Date(date2), true);
			var finalDate = "/Date(" + new Date(date3 + "Z").getTime() + ")/";

			//var postingDate = dateFormat.format(new Date(date), true);
			//var finalDate = "/Date(" + new Date(postingDate + "Z").getTime() + ")/";
			//var finalDate =  "/Date(" + new Date(postingDate +"Z").getTime() + (6 * 60 * 60 * 1000)+ ")/";
			//var biki = riki.getTime() + (6 * 60 * 60 * 1000);
			//var raja = biki + "Z";
			//var finalDate = "/Date(" + riki + ")/";
			//var rr = new Date(postingDate + "Z").getTime()+addTime;
			//var finalDate = "/Date(" + riki + ")/";
			//new Date(biki);
			//Sun Sep 19 2021 07:07:19 GMT+0530 (India Standard Time)
			//var postingDateCST = new Date(date).addHours(6);
			//var postingDate = dateFormat.format(postingDateCST, true);
			//var postingDate = dateFormat.format(new Date(date), true);
			// var test = postingDate.split("T")[1];
			// var test1 = test.split(":")[0];
			// var datafinal = Number(test1) + 6;
			// var data = postingDate.split("T")[0];
			// var FinalpostingDate = data + "T" + datafinal + ":" + test.split(":")[1] + ":" + test.split(":")[2];
			//var finalDate = "/Date(" + new Date(postingDate + "Z").getTime() + ")/";
			return finalDate;
		},

		addLeadingZeros: function (num, size) {
			num = num.toString();
			while (num.length < size) num = "0" + num;
			return num;
		},
		formatTagIDString: function (bTagValue) {
			if (bTagValue !== undefined && bTagValue) {
				var lastNos = [];
				var withChar = false;
				var strtNos = [];
				$.each(bTagValue.split("").reverse(), function (i, e) {
					if (!isNaN(e) && !withChar && i < 10) {
						lastNos.push(e);
					} else {
						withChar = true;
						strtNos.push(e);
					}
				});
				return [lastNos.reverse().join(""), strtNos.reverse().join("")];
			}
		},

		generatePlantID: function (data, noOfPlants) {
			var maxValue, returnValue;
			if (data.length > 0) {
				/*	maxValue = Math.max.apply(Math, data.map((data) => {
						returnValue = data.NPLID.replace(/^\D+/g, '');
						return returnValue;
					}));*/
			} else {
				maxValue = 0;
			}
			var plantIDs = [],
				n, s;
			for (n = maxValue + 1; n <= (noOfPlants + maxValue); n++) {
				s = n + "";
				while (s.length < 4) s = "0" + s;
				plantIDs.push("P" + s);
			}
			return plantIDs;
		},

		generateMasterPlantID: function (data, noOfPlants, strainID) {
			var maxValue, returnValue;
			if (data.length > 0) {
				var existingStrain = $.grep(data, function (e) {
					if (e.Code.search(strainID) === 0) {
						return e;
					}
				});
				if (existingStrain.length > 0) {
					maxValue = Math.max.apply(Math, existingStrain.map(function (existingStrain) {
						var plantId = existingStrain.Code.split("-")[existingStrain.Code.split("-").length - 1];
						returnValue = plantId.replace(/^\D+/g, '');
						return returnValue;
					}));
				} else {
					maxValue = 0;
				}
			} else {
				maxValue = 0;
			}
			var plantIDs = [],
				n, s;
			for (n = maxValue + 1; n <= (noOfPlants + maxValue); n++) {
				s = n + "";
				while (s.length < 4) s = "0" + s;
				plantIDs.push(strainID + "-P" + s);
				var obj = {
					NPLID: strainID + "-P" + s
				};
				data.push(obj);
			}
			return plantIDs;
		},
		generateExInputIDsID: function (data, noOfPlants) {
			var maxValue, returnValue;
			if (data.length > 0) {
				maxValue = Math.max.apply(Math, data.map(function (data) {
					var plantId = data.NITID.split("-")[data.NITID.split("-").length - 1];
					returnValue = plantId.replace(/^\D+/g, '');
					return returnValue;
				}));

			} else {
				maxValue = 0;
			}
			var plantIDs = [],
				n, s;
			for (n = maxValue + 1; n <= (noOfPlants + maxValue); n++) {
				s = n + "";
				while (s.length < 4) s = "0" + s;
				plantIDs.push(s);
				var obj = {
					NITID: s
				}
				data.push(obj);
			}
			return plantIDs;
		},

		generateCloneBatchID: function (text, strainID, data) {
			var maxValue, returnValue;
			if (data.length > 0) {
				var existingBatches = $.grep(data, function (e) {
					if (e.U_NBTID.search(strainID) > -1) {
						return e;
					}
				});
				if (existingBatches.length > 0) {
					maxValue = Math.max.apply(Math, existingBatches.map(function (existingBatches) {
						var bId = existingBatches.U_NBTID.split("-")[existingBatches.U_NBTID.split("-").length - 1];
						returnValue = bId.replace(/^\D+/g, '');
						return returnValue;
					}));
				} else {
					maxValue = 0;
				}
			} else {
				maxValue = 0;
			}
			var n, s, id;
			for (n = maxValue; n <= (maxValue + 1); n++) {
				s = n + "";
				while (s.length < 3) s = "0" + s;
				id = text + "-" + strainID + "-B" + s;
			}
			return id;
		},
		generateLotIDs: function (productId, data) {

			var id = productId + "-QA" + (data.length + 1);

			return id;
		},
		generateLabSampleIDs: function (batchId, data, qty) {
			var maxValue = 0;
			var n, s, id;
			var lotIDs = [],
				n, s;
			for (n = maxValue + 1; n <= (qty + maxValue); n++) {
				s = n + "";
				while (s.length < 2) s = "0" + s;
				lotIDs.push(batchId + "-SA" + s);
				var obj = {
					NPLID: batchId + "-SA" + s
				};
				data.push(obj);
			}
			return lotIDs;
		},

		generateHarvestBatchID: function (text, strainID, data) { //changes to existingBatches from data by susmita
			var maxValue, returnValue;
			if (data.length > 0) {
				var existingBatches = $.grep(data, function (e) {
					if (e.NHBID.search(strainID) > -1) {
						return e;
					}
				});
				if (existingBatches.length > 0) {
					maxValue = Math.max.apply(Math, existingBatches.map((existingBatches) => {
						var bId = existingBatches.NHBID.split("-")[existingBatches.NHBID.split("-").length - 1];
						returnValue = bId.replace(/^\D+/g, '');
						return returnValue;
					}));
				} else {
					maxValue = 0;
				}
			} else {
				maxValue = 0;
			}
			var n, s, id;
			for (n = maxValue; n <= (maxValue + 1); n++) {
				s = n + "";
				while (s.length < 3) s = "0" + s;
				id = text + "-" + strainID + "-B" + s;
			}
			return id;
		},
		errorHandler: function (error) {
			var resText = JSON.parse(error.responseText).error.message.value;
			MessageBox.error(resText);
			that.getView().setBusy(false);
		},
		successHandler: function (text, resText) {
			MessageBox.success(text + resText + " created successfully", {
				closeOnNavigation: false,
				onClose: function () {}
			});
		},

		createFilter: function (key, operator, value, useToLower) {
			return new Filter(useToLower ? "tolower(" + key + ")" : key, operator, useToLower ? "'" + value.toLowerCase() + "'" : value);
		},

		/**
		 * Getter for the resource bundle.
		 * @public
		 * @returns {sap.ui.model.resource.ResourceModel} the resourceModel of the component
		 */
		getResourceBundle: function () {
			return this.getOwnerComponent().getModel("i18n").getResourceBundle();
		},

		/**
		 * Handler for the Avatar button press event
		 * @public
		 */
		onAvatarPress: function () {
			var sMessage = this.getResourceBundle().getText("avatarButtonMessageToastText");
			sap.m.MessageToast.show(sMessage);
		},

		/**
		 * React to FlexibleColumnLayout resize events
		 * Hides navigation buttons and switches the layout as needed
		 * @param {sap.ui.base.Event} oEvent the change event
		 */
		onStateChange: function (oEvent) {
			var sLayout = oEvent.getParameter("layout"),
				iColumns = oEvent.getParameter("maxColumnsCount");

			if (iColumns === 1) {
				this.getModel("appView").setProperty("/smallScreenMode", true);
			} else {
				this.getModel("appView").setProperty("/smallScreenMode", false);
				// swich back to two column mode when device orientation is changed
				if (sLayout === "OneColumn") {
					this._setLayout("Two");
				}
			}
		},

		/**
		 * Sets the flexible column layout to one, two, or three columns for the different scenarios across the app
		 * @param {string} sColumns the target amount of columns
		 * @private
		 */
		_setLayout: function (sColumns) {
			if (sColumns) {
				this.getModel("appView").setProperty("/layout", sColumns + "Column" + (sColumns === "One" ? "" : "sMidExpanded"));
			}
		},

		/**
		 * Apparently, the middle page stays hidden on phone devices when it is navigated to a second time
		 * @private
		 */
		_unhideMiddlePage: function () {
			// bug in sap.f router, open ticket and remove this method afterwards
			setTimeout(function () {
				this.getView().getParent().getParent().getCurrentMidColumnPage().removeStyleClass("sapMNavItemHidden");
			}.bind(this), 0);
		},

		onChangeMultiInput: function (oEvent) {
			oEvent.getSource()._bUseDialog = false;
			var value = oEvent.getSource().getValue();
			if (value.indexOf("^") !== -1) {
				value = value.replace(/\^/g, "");
				oEvent.getSource().addToken(new sap.m.Token({
					key: value,
					text: value
				}));
				//	var orFilter = [];
				//	var andFilter = [];
				oEvent.getSource().setValue("");
				this.fillFilterLoad(oEvent.getSource());
			}
		},

		/*Methods for multiInput for sarch field for scan functionality start*/

		onSubmitMultiInput: function (oEvent) {
			oEvent.getSource()._bUseDialog = false;
			var value = oEvent.getSource().getValue();
			if (!value) {
				this.fillFilterLoad(oEvent.getSource());
				return;
			}
			value = value.replace(/\^/g, "");
			oEvent.getSource().addToken(new sap.m.Token({
				key: value,
				text: value
			}));
			// var orFilter = [];
			// var andFilter = [];
			oEvent.getSource().setValue("");
			this.fillFilterLoad(oEvent.getSource());
		},

		tokenUpdateMultiInput: function (oEvent) {
			this.fillFilterLoad(oEvent.getSource(), oEvent.getParameter("removedTokens")[0].getText());
		},
		readServiecLayer: function (entity, callBack) {
			var that = this;
			var jsonModel = that.getOwnerComponent().getModel("jsonModel");
			if (location.host.includes("webide") == true) {
				var sessionID = jsonModel.getProperty("/sessionID");
				if (sessionID === undefined) {
					var loginPayLoad = jsonModel.getProperty("/userAuthPayload");
					loginPayLoad = JSON.stringify(loginPayLoad);
					$.ajax({
						url: jsonModel.getProperty("/serLayerbaseUrl") + "/b1s/v2/Login",
						data: loginPayLoad,
						type: "POST",
						xhrFields: {
							withCredentials: true
						},
						dataType: "json", // expecting json response
						success: function (data) {
							jsonModel.setProperty("/sessionID", data.SessionId);
							//	var sessionID = that.getOwnerComponent().getModel("jsonModel").getProperty("/sessionID");
							$.ajax({
								type: "GET",
								xhrFields: {
									withCredentials: true
								},
								url: jsonModel.getProperty("/serLayerbaseUrl") + entity,
								setCookies: "B1SESSION=" + data.SessionId,
								dataType: "json",
								success: function (res) {
									callBack.call(that, res);
								},
								error: function (error) {
									MessageBox.error(error.responseJSON.error.message);
								}
							});
						},
						error: function () {
							sap.m.MessageToast.show("Error with authentication");
						}
					});
				} else {

					$.ajax({
						type: "GET",
						xhrFields: {
							withCredentials: true
						},
						url: jsonModel.getProperty("/serLayerbaseUrl") + entity,
						setCookies: "B1SESSION=" + sessionID,
						dataType: "json",
						success: function (res) {
							callBack.call(that, res);
						},
						error: function (error) {
							jsonModel.setProperty("/busyView", false);
							MessageBox.error(error.responseJSON.error.message);
						}
					});
				}
			} else {

				setTimeout(function () {
					$.ajax({
						type: "GET",
						xhrFields: {
							withCredentials: true
						},
						url: entity,
						//	setCookies: "B1SESSION=" + sessionID,
						dataType: "json",
						success: function (res) {
							callBack.call(that, res);
						},
						error: function (error) {
							jsonModel.setProperty("/busyView", false);
							MessageBox.error(error.responseJSON.error.message);
						}
					});
				}, 0);
			}
		},

		updateServiecLayer: function (entity, callBack, payLoad, method) {
			var that = this;
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			payLoad = JSON.stringify(payLoad);

			var sUrl;
			if (location.host.includes("webide") == true) {
				sUrl = jsonModel.getProperty("/serLayerbaseUrl") + entity;
			} else {
				sUrl = entity;
			}
			setTimeout(function () {
				$.ajax({
					type: method,
					xhrFields: {
						withCredentials: true
					},
					url: sUrl,
					//	setCookies: "B1SESSION=" + sessionID,
					dataType: "json",
					data: payLoad,
					success: function (res) {
						callBack.call(that, res);
						var docEntry;
						if (res == undefined) {
							docEntry = "";
						} else {
							docEntry = res.DocEntry;
						}
						var logData = {
							Api: entity,
							methodType: method,
							Desttype: "SL",
							errorText: docEntry,
							data: payLoad,
							statusTxt: 200
						};
						that.CaptureLog(logData);

					},
					error: function (error) {
						if (that._busyDialog) {
							that._busyDialog.close();
						}
						var logData = {
							Api: entity,
							methodType: method,
							Desttype: "SL",
							errorText: error.responseJSON.error.message,
							data: payLoad,
							statusTxt: 400
						};
						that.CaptureLog(logData);
						jsonModel.setProperty("/busyView", false);
						MessageBox.error(error.responseJSON.error.message);
					}
				});
			}, 0);
		},
		updateServiceLayerBatch: function (entity, callBack, payLoad, method) {
			var that = this;
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var sessionID = jsonModel.getProperty("/sessionID");
			payLoad = JSON.stringify(payLoad);
			$.ajax({
				type: method,
				xhrFields: {
					withCredentials: true
				},
				url: jsonModel.getProperty("/serLayerbaseUrl") + entity,
				setCookies: "B1SESSION=" + sessionID,
				dataType: "json",
				data: payLoad,
				success: function (res) {
					callBack.call(that, res);
				},
				error: function (error) {
					callBack.call(that, error);
				}
			});

		},

		CaptureLog: function (LogData) {
			if (LogData.statusTxt !== 200) {
				var jsonModel = this.getOwnerComponent().getModel("jsonModel");
				// var errorLogData = jsonModel.getProperty("/ErrorLogData");
				// errorLogData.push({
				// 	Api: LogData.Api,
				// 	Desttype: LogData.Desttype,
				// 	errorText: LogData.errorText,
				// 	//	colorCode: colorCode
				// });
				// jsonModel.setProperty("/ErrorLogData", errorLogData);
			}
			if (LogData.Desttype === "METRC") {
				this.createMetricLog(LogData.Api, LogData.methodType, LogData.data, LogData.errorText, LogData.statusTxt);
			} else {
				this.createSLLog(LogData.Api, LogData.methodType, LogData.data, LogData.errorText, LogData.statusTxt);
			}
		},

		createSLLog: function (sUrl, method, reqPayload, resPayload, statusCode) {
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var payLoad = {
				U_NDTTM: this.convertUTCDate(new Date()),
				U_NUSID: jsonModel.getProperty("/userName"),
				U_NLGMT: method,
				U_NLURL: sUrl,
				U_NLGBD: JSON.stringify(reqPayload),
				U_NLGRP: JSON.stringify(resPayload),
				U_NLGST: statusCode,
				U_NAPP: "PROCESSING"
			};
			var that = this;
			payLoad = JSON.stringify(payLoad);
			var sUrl, entity = "/b1s/v2/NBNLG";
			if (location.host.indexOf("webide") !== -1) {
				sUrl = jsonModel.getProperty("/serLayerbaseUrl") + entity;
			} else {
				sUrl = entity;
			}

			$.ajax({
				type: "POST",
				xhrFields: {
					withCredentials: true
				},
				url: sUrl,
				//	setCookies: "B1SESSION=" + sessionID,
				dataType: "json",
				data: payLoad,
				success: function (res) {

				},
				error: function (error) {

				}
			});

		},
		createMetricLog: function (sUrl, method, reqPayload, resPayload, statusCode) {
			var payLoad = {
				U_NDTTM: this.convertUTCDate(new Date()),
				U_NUSID: this.getView().getModel("jsonModel").getProperty("/userName"),
				U_NLGMT: method,
				U_NLURL: sUrl,
				U_NLGBD: JSON.stringify(reqPayload),
				U_NLGRP: JSON.stringify(resPayload),
				U_NLGST: statusCode,
				U_NAPP: "PROCESSING"
			};
			var that = this;
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			payLoad = JSON.stringify(payLoad);
			var sUrl, entity = "/b1s/v2/NMTLG";
			if (location.host.indexOf("webide") !== -1) {
				sUrl = jsonModel.getProperty("/serLayerbaseUrl") + entity;
			} else {
				sUrl = entity;
			}

			$.ajax({
				type: "POST",
				xhrFields: {
					withCredentials: true
				},
				url: sUrl,
				//	setCookies: "B1SESSION=" + sessionID,
				dataType: "json",
				data: payLoad,
				success: function (res) {},
				error: function (error) {}
			});

		},

		createBatchCall: function (batchUrl, callBack) {
			var jsonModel = this.getView().getModel("jsonModel");
			var splitBatch, count;
			count = Math.ceil(batchUrl.length / 100);
			jsonModel.setProperty("/count", count);
			if (batchUrl.length > 100) {
				do {
					splitBatch = batchUrl.splice(0, 100);
					this.callBatchService(splitBatch, callBack);
				} while (batchUrl.length > 100);
				if (batchUrl.length > 0) {
					this.callBatchService(batchUrl, callBack);
				}
			} else {
				this.callBatchService(batchUrl, callBack);
			}

			//	callBack.call(this, errorMessage);
		},
		callBatchService: function (batchUrl, callBack) {
			var reqHeader = "--clone_batch--\r\nContent-Type: application/http \r\nContent-Transfer-Encoding:binary\r\n\r\n";
			var payLoad = reqHeader;
			$.each(batchUrl, function (i, sObj) {
				payLoad = payLoad + sObj.method + " " + sObj.url + "\r\n\r\n";
				payLoad = payLoad + JSON.stringify(sObj.data) + "\r\n\r\n";
				if (batchUrl.length - 1 === i) {
					payLoad = payLoad + "\r\n--clone_batch--";
				} else {
					payLoad = payLoad + reqHeader;
				}
			});
			var that = this;
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var baseUrl = jsonModel.getProperty("/serLayerbaseUrl");
			//	var sessionID = jsonModel.getProperty("/sessionID");
			//	jsonModel.setProperty("/busyView", true);
			if (location.host.indexOf("webide") === -1) {
				baseUrl = "";
			}
			var settings = {
				"url": baseUrl + "/b1s/v2/$batch",
				"method": "POST",
				xhrFields: {
					withCredentials: true
				},
				//"timeout": 0,
				"headers": {
					"Content-Type": "multipart/mixed;boundary=clone_batch"
				},
				//	setCookies: "B1SESSION=" + sessionID,
				"data": payLoad,
				success: function (res) {
					var count = jsonModel.getProperty("/count");
					count--;
					jsonModel.setProperty("/count", count);
					try {
						var pResponse = that.parseBatchResponse(res);
						var errorMessages = [];
						pResponse.forEach(function (e) {
							if (Number(e.status) >= 400) {
								if (e.message) {
									errorMessages.push(e.message);
								} else {
									errorMessages.push("Unknown error occurred");
								}
							}
						});

					} catch (err) {
						errorMessages = ["Batch response parsing failed"];
					}

					var logData;
					if (errorMessages.length > 0) {
						if (that._busyDialog) {
							that._busyDialog.close();
						}

						logData = {
							Api: "Batch calls",
							methodType: "POST",
							Desttype: "SL",
							errorText: errorMessages.join("\n"),
							data: payLoad,
							statusTxt: 400
						};
						sap.m.MessageBox.error(errorMessages.join("\n"));

					} else {
						logData = {
							Api: "Batch calls",
							methodType: "POST",
							Desttype: "SL",
							errorText: "",
							data: payLoad,
							statusTxt: 200
						};
					}
					that.CaptureLog(logData);
					if (count === 0) {
						callBack.call(that, errorMessages);
					}
				},
				error: function (error) {
					if (that._busyDialog) {
						that._busyDialog.close();
					}
					var count = jsonModel.getProperty("/count");
					count--;
					jsonModel.setProperty("/count", count);
					if (count === 0) {
						callBack.call(that);
						jsonModel.setProperty("/busyView", false);
					}
					if (error.statusText) {
						MessageBox.error(error.statusText);
					} else if (error.responseJSON) {
						MessageBox.error(error.responseJSON.error.message.value);
					}

				}
			};

			//	const text = '{"name":"John\n", "birth":"14/12/1989\t"}';
			//	const result = text.escapeSpecialCharsInJSONString();
			//	console.log(result);
			$.ajax(settings).done(function () {
				//	console.log(response);
			});
		},
		BatchCall: function (batchUrl, callBack) {
			var reqHeader = "--clone_batch--\r\nContent-Type: application/http \r\nContent-Transfer-Encoding:binary\r\n\r\n";
			var payLoad = reqHeader;
			$.each(batchUrl, function (i, sObj) {
				payLoad = payLoad + sObj.method + " " + sObj.url + "\r\n\r\n";
				payLoad = payLoad + JSON.stringify(sObj.data) + "\r\n\r\n";
				if (batchUrl.length - 1 === i) {
					payLoad = payLoad + "\r\n--clone_batch--";
				} else {
					payLoad = payLoad + reqHeader;
				}
			});
			var that = this;
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var baseUrl = jsonModel.getProperty("/serLayerbaseUrl");
			//	var sessionID = jsonModel.getProperty("/sessionID");
			//	jsonModel.setProperty("/busyView", true);
			if (location.host.indexOf("webide") === -1) {
				baseUrl = "";
			}
			var settings = {
				"url": baseUrl + "/b1s/v2/$batch",
				"method": "POST",
				xhrFields: {
					withCredentials: true
				},
				//"timeout": 0,
				"headers": {
					"Content-Type": "multipart/mixed;boundary=clone_batch"
				},
				//	setCookies: "B1SESSION=" + sessionID,
				"data": payLoad,
				success: function (res) {
					var errorMessages = [];
					try {
						var pResponse = that.parseBatchResponse(res);
						pResponse.forEach(function (e) {
							if (Number(e.status) >= 400) {
								if (e.message) {
									errorMessages.push(e.message);
								} else {
									errorMessages.push("Unknown error occurred");
								}
							}
						});

					} catch (err) {
						errorMessages = ["Batch response parsing failed"];
					}

					var logData;
					if (errorMessages.length > 0) {
						if (that._busyDialog) {
							that._busyDialog.close();
						}

						logData = {
							Api: "Batch calls",
							methodType: "POST",
							Desttype: "SL",
							errorText: errorMessages.join("\n"),
							data: payLoad,
							statusTxt: 400
						};
						sap.m.MessageBox.error(errorMessages.join("\n"));

					} else {
						logData = {
							Api: "Batch calls",
							methodType: "POST",
							Desttype: "SL",
							errorText: "",
							data: payLoad,
							statusTxt: 200
						};
					}
					that.CaptureLog(logData);
					callBack.call(that, errorMessages);
				},
				error: function (error) {
					if (that._busyDialog) {
						that._busyDialog.close();
					}
					var errorMessages = [];
					jsonModel.setProperty("/busyView", false);
					if (error.statusText) {
						MessageBox.error(error.statusText);
						errorMessages.push(error.statusText);
					} else if (error.responseJSON) {
						MessageBox.error(error.responseJSON.error.message.value);
						errorMessages.push(error.responseJSON.error.message.value);
					}
					callBack.call(that, errorMessages);
				}
			};

			//	const text = '{"name":"John\n", "birth":"14/12/1989\t"}';
			//	const result = text.escapeSpecialCharsInJSONString();
			//	console.log(result);
			$.ajax(settings).done(function () {
				//	console.log(response);
			});
		},

		loadPackageData: function () {
			var data;
			if (this.getOwnerComponent().getModel("jsonModel").getData().licenseList1 == undefined) {
				data = this.getOwnerComponent().getModel("jsonModel").getData().licenseList[0];
			} else {
				data = this.getOwnerComponent().getModel("jsonModel").getData().licenseList1[0];
			}
			var licenseNo = data.U_License_Number;
			var that = this;
			var filters = [];
			//filters.push(new sap.ui.model.Filter("U_License_Number", "EQ", licenseNo)); //code for facility
			filters.push(new sap.ui.model.Filter("WarehouseCode", "NotContains", "LIC")); //code for not displaying LIC
			this.getOwnerComponent().getModel("Facilities").read("/OWHS", {
				filters: filters,
				success: function (res) {
					that.getOwnerComponent().getModel("jsonModel").setProperty("/plannerLicenseList", res.results);
				}
			});
		},

		removeDuplicates: function (data, key) {
			var newArray = [];
			var obj = {};
			for (var i in data) {
				obj[data[i][key]] = data[i];
			}
			for (i in obj) {
				newArray.push(obj[i]);
			}
			return newArray;
		},
		onDateSelect: function (evt) {
			var sDate = evt.getParameter("value");
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");

			// sap.ui.core.Fragment.byId("createTransferDialog", "wRecDate").setValue(newdateT);
			jsonModel.setProperty("/createTras/deliveryDate", new Date(sDate));

		},

		loginCall: function () {
			var that = this;
			return new Promise(function (resolve, reject) {
				// run login only in webide
				if (location.host.indexOf("webide") !== -1) {
					var jsonModel = that.getOwnerComponent().getModel("jsonModel");
					var loginPayLoad = jsonModel.getProperty("/userAuthPayload");
					loginPayLoad = JSON.stringify(loginPayLoad);
					$.ajax({
						url: jsonModel.getProperty("/serLayerbaseUrl") + "/b1s/v2/Login",
						data: loginPayLoad,
						type: "POST",
						xhrFields: {
							withCredentials: true
						},
						dataType: "json",
						success: function (data) {
							jsonModel.setProperty("/sessionID", data.SessionId);
							resolve(data);
						},
						error: function (err) {
							reject(err);
						}
					});
				} else {
					// not in webide → skip login
					resolve();
				}
			});
		},
		getMetricsCredentials: function () {
			var that = this;
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			return new Promise(function (resolve, reject) {
				var filters = "?$filter=U_NITTP eq 'METRC'";
				jsonModel.setProperty("/metrcBusy", true);
				jsonModel.setProperty("/enableSyncNow", false);
				that.readServiecLayer("/b1s/v2/NINGT" + filters, function (data) {
					resolve();
					jsonModel.setProperty("/metrcBusy", false);
					if (data.value.length > 0) {
						jsonModel.setProperty("/metrcData", data.value[0]);
						if (data.value[0].U_NACST === "X") {
							jsonModel.setProperty("/METRCText", "Metrc Sync is ON");
							jsonModel.setProperty("/METRCColorCode", 7);
							that.getCurrentFacilties();
						} else {
							jsonModel.setProperty("/METRCText", "Metrc Sync is OFF");
							jsonModel.setProperty("/METRCColorCode", 3);
							jsonModel.setProperty("/METRCKey", "METRC Key Invalid");
							jsonModel.setProperty("/METRCColorKey", 3);
							// that.loadLicenseData();
						}
					} else {
						jsonModel.setProperty("/metrcData", {});
						jsonModel.setProperty("/METRCText", "Metrc Sync is OFF");
						jsonModel.setProperty("/METRCColorCode", 3);
						jsonModel.setProperty("/METRCKey", "METRC Key Invalid");
						jsonModel.setProperty("/METRCColorKey", 3);
						// that.loadLicenseData();
					}

				});
			});
		},

		callMetricsService: function (entity, methodType, data, success, error) {
			var that = this;
			// var obj = this.getView().getModel("jsonModel").getProperty("/selectedMetrics");
			var jsonModel = this.getView().getModel("jsonModel");
			var metricConfig = jsonModel.getProperty("/metrcData");
			var apiKey = jsonModel.getProperty("/apiKey");

			setTimeout(function () {
				$.ajax({
					data: JSON.stringify(data),
					type: methodType,
					async: false,
					url: metricConfig.U_NIURL + entity,
					contentType: "application/json",
					headers: {
						"Authorization": "Basic " + btoa(metricConfig.U_NVNDK + ":" + apiKey)
					},
					success: function (sRes) {
						that.createMetricLog(entity, methodType, data, sRes, "200");
						success.call(that, sRes);
					},
					error: function (eRes) {
						jsonModel.setProperty("/busyView", false);
						var errorMsg = "";
						if (eRes.responseJSON && eRes.responseJSON.length > 0) {
							$.each(eRes.responseJSON, function (i, e) {
								errorMsg = errorMsg + e.message + "\n";
								that.popUpData(e.message, "E");
							});
						} else if (eRes.responseJSON && eRes.responseJSON.Message) {
							errorMsg = eRes.responseJSON.Message;
							that.popUpData(errorMsg, "E");
						} else if (eRes.statusText && eRes.status === 401) {
							errorMsg = "Unauthorized";
							that.popUpData(errorMsg, "E");
						} else if (eRes.statusText) {
							errorMsg = eRes.statusText;
							that.popUpData(errorMsg, "E");
						}
						error.call(that, errorMsg);
						jsonModel.setProperty("/busyTitle", "❌ Something went wrong!");
						jsonModel.setProperty("/busyText", "Error occurred! Please check the log for details.");
						if (that._busyDialog) {
							setTimeout(function () {
								that._busyDialog.close();
							}, 1000);
						}

						that.createMetricLog(entity, methodType, data, errorMsg, eRes.status);
						//	sap.m.MessageToast.show(errorMsg);
					}
				});
			}, 0);
		},
		callMetricsGETService: function (entity, success, error) {
			var that = this;
			// var obj = this.getView().getModel("jsonModel").getProperty("/selectedMetrics");
			var jsonModel = this.getView().getModel("jsonModel");
			var metricConfig = jsonModel.getProperty("/metrcData");
			var apiKey = jsonModel.getProperty("/apiKey");

			setTimeout(function () {
				$.ajax({
					type: "GET",
					async: false,
					url: metricConfig.U_NIURL + entity,
					contentType: "application/json",
					headers: {
						"Authorization": "Basic " + btoa(metricConfig.U_NVNDK + ":" + apiKey)
					},
					success: function (sRes) {
						success.call(that, sRes);
					},
					error: function (eRes) {
						jsonModel.setProperty("/busyView", false);
						var errorMsg = "";
						if (eRes.responseJSON && eRes.responseJSON.length > 0) {
							$.each(eRes.responseJSON, function (i, e) {
								errorMsg = errorMsg + e.message + "\n";
								that.popUpData(e.message, "E");
							});
						} else if (eRes.responseJSON && eRes.responseJSON.Message) {
							errorMsg = eRes.responseJSON.Message;
							that.popUpData(errorMsg, "E");
						} else if (eRes.statusText && eRes.status === 401) {
							errorMsg = "Unauthorized";
							that.popUpData(errorMsg, "E");
						} else if (eRes.statusText) {
							errorMsg = eRes.statusText;
							that.popUpData(errorMsg, "E");
						}

						error.call(that, errorMsg);
						sap.m.MessageToast.show(errorMsg);
					}
				});
			}, 0);
		},

		getCurrentFacilties: function () {
			var that = this;
			var jsonModel = this.getOwnerComponent().getModel("jsonModel");
			var apiKey = jsonModel.getProperty("/apiKey");
			var metrcData = jsonModel.getProperty("/metrcData");
			if (metrcData !== undefined && !jQuery.isEmptyObject(metrcData)) {
				$.ajax({
					type: "GET",
					async: false,
					url: metrcData.U_NIURL + "/facilities/v2",
					contentType: "application/json",
					headers: {
						"Authorization": "Basic " + btoa(metrcData.U_NVNDK + ":" + apiKey)
					},
					success: function (facilities) {
						jsonModel.setProperty("/METRCKey", "METRC Key Valid");
						jsonModel.setProperty("/METRCColorKey", 7);
					},
					error: function () {
						jsonModel.setProperty("/METRCKey", "METRC Key Invalid");
						jsonModel.setProperty("/METRCColorKey", 3);
					}
				});
			}

		},
		// capture metric log

		getLabStatus: function (tag) {
			//var localModel = this.getModel("localModel");
			if (tag) {
				var metricConfig = this.getView().getModel("jsonModel").getProperty("/metrcData");
				var license = this.getView().getModel("jsonModel").getProperty("/selectedLicense");
				return new Promise(
					function (resolve, reject) {
						var entity = "/packages/v1/" + tag + "?licenseNumber=" + license;
						//console.log(url);
						$.ajax({
							type: "GET",
							async: false,
							url: metricConfig.U_NIURL + entity,
							contentType: "application/json",
							headers: {
								"Authorization": "Basic " + btoa(metricConfig.U_NVNDK + ":" + metricConfig.U_NUSRK)
							},
							success: function (sRes) {
								resolve(sRes);
							},
							error: function (eRes) {
								//	error.bind(this);
								var errorMsg = "";
								/*if (eRes.statusText) {
									errorMsg = eRes.statusText;
								} else*/
								if (eRes.responseJSON && eRes.responseJSON.length > 0) {
									$.each(eRes.responseJSON, function (i, e) {
										errorMsg = e.message + "\n";
									});
								} else if (eRes.responseJSON && eRes.responseJSON.Message) {
									errorMsg = eRes.responseJSON.Message;
								} else if (eRes.statusText && eRes.status === 401) {
									errorMsg = "Unauthorized";
								} else if (eRes.statusText) {
									errorMsg = "Network Error";
								}
								reject(errorMsg);
							}
						});
					}).then(
					function (value) {
						return value;
					},
					function (error) {
						return error;
					}
				);
			}
		},
		convertUTCDateMETRC: function (date) {

			var inputDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
				pattern: "MMM-dd-yyyy hh:mm a",
				UTC: false
			});
			var parsedDate = inputDateFormat.parse(date);

			var outputDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
				pattern: "yyyy-MM-dd'T'HH:mm:ss'Z'",
				UTC: false
			});
			return outputDateFormat.format(parsedDate);
		},

		// 		convertUTCDateMETRC: function (date) {
		//   var dateFormat = DateFormat.getDateInstance({
		//     pattern: "yyyy-MM-dd'T'HH:mm:ss'Z'",
		//     UTC: true
		//   });
		//   var utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()));
		//   var finalDate = dateFormat.format(utcDate);
		//   return finalDate;
		// },

		hanldeMessageDialog: function (evt) {
			var that = this;
			var oMessageTemplate = new sap.m.MessageItem({
				type: '{type}',
				title: '{title}',
				description: '{description}'
			});
			this.oMessageView = new sap.m.MessageView({
				showDetailsPageHeader: true,
				itemSelect: function () {},
				items: {
					path: "/responseData",
					template: oMessageTemplate
				}
			});
			var resModel = new sap.ui.model.json.JSONModel();
			resModel.setProperty("/responseData", []);
			this.resModel = resModel;
			var oCloseButton = new sap.m.Button({
					text: "Close",
					press: function () {
						that._oPopover.close();
					}
				}).addStyleClass("sapUiTinyMarginEnd"),
				clearButton = new sap.m.Button({
					text: "Clear",
					press: function () {
						that.resModel.setProperty("/responseData", []);
					}
				}),
				oPopoverFooter = new sap.m.Bar({
					contentRight: [clearButton, oCloseButton]
				}),
				oPopoverBar = new sap.m.Bar({
					//	contentLeft: [oBackButton],
					contentMiddle: [
						new sap.m.Title({
							text: "Messages"
						})
					]
				});
			this._oPopover = new sap.m.Popover({
				customHeader: oPopoverBar,
				contentWidth: "440px",
				contentHeight: "440px",
				verticalScrolling: false,
				modal: true,
				content: [this.oMessageView],
				footer: oPopoverFooter
			});
			this._oPopover.setModel(resModel);
		},
		handleOpenPopOver: function (evt) {
			this._oPopover.openBy(evt.getSource());
		},
		popUpData: function (title, type) {
			var sObj = {
				type: type === "E" ? "Error" : "Success",
				title: title
			};
			var responseData = this.resModel.getProperty("/responseData");
			responseData.push(sObj);
			this.resModel.setProperty("/responseData", responseData);
			this._oPopover.setModel(this.resModel);
			var resPop = this.getView().byId("resPop");
			this.oMessageView.navigateBack();
			resPop.firePress();
		},

		parseBatchResponse: function (responseText) {
			var results = [];
			// split by batch boundary
			var parts = responseText.split("--batchresponse");
			parts.forEach(function (part) {
				if (part.includes("HTTP/1.1")) {
					// extract status
					var statusMatch = part.match(/HTTP\/1\.1\s(\d+)/);
					var status = statusMatch ? statusMatch[1] : "";
					var obj = {
						status: status,
						message: ""
					};
					// if error exists
					if (part.includes('"error"')) {
						try {
							var jsonStart = part.indexOf("{");
							var jsonStr = part.substring(jsonStart);
							var errorObj = JSON.parse(jsonStr);
							obj.message = errorObj.error.message;
						} catch (e) {
							obj.message = "Unknown error";
						}
					} else {
						obj.message = "Success";
					}

					results.push(obj);
				}
			});
			return results;
		},

		loadDataTorecordTrim: function () {
			var jsonModel2 = new sap.ui.model.json.JSONModel();
			var oData = [{
				type: "Regular",
				Bulk: "",
				Larges: "",
				Mediums: "",
				Smalls: ""
			}, {
				type: "Bottom",
				Bulk: "",
				Larges: "",
				Mediums: "",
				Smalls: ""
			}, {
				type: "C/D",
				Bulk: "",
				Larges: "",
				Mediums: "",
				Smalls: ""
			}, {
				type: "HLV",
				Bulk: "",
				Larges: "",
				Mediums: "",
				Smalls: ""
			}, {
				type: "PM",
				Bulk: "",
				Larges: "",
				Mediums: "",
				Smalls: ""
			}, {
				type: "Seed/Herm",
				Bulk: "",
				Larges: "",
				Mediums: "",
				Smalls: ""
			}, {
				type: "Bugs",
				Bulk: "",
				Larges: "",
				Mediums: "",
				Smalls: ""
			}, {
				type: "Burn",
				Bulk: "",
				Larges: "",
				Mediums: "",
				Smalls: ""
			}, {
				type: "Multiple QC Issues",
				Bulk: "",
				Larges: "",
				Mediums: "",
				Smalls: ""
			}, {
				type: "Glass",
				Bulk: "",
				Larges: "",
				Mediums: "",
				Smalls: ""
			}, {
				type: "Mixed Strains",
				Bulk: "",
				Larges: "",
				Mediums: "",
				Smalls: ""
			}];
			jsonModel2.setProperty("/trimEventFields", oData)
			this.recordTrimDialog.setModel(jsonModel2);
		},

		buildPayload: function (aItems) {
			const fieldMap = {
				"Regular": {
					Bulk: "U_REG_BULK",
					Larges: "U_NLRGS",
					Mediums: "U_NMEDUS",
					Smalls: "U_NSMLS"
				},
				"Bottom": {
					Bulk: "U_BOT_BULK",
					Larges: "U_NBTLRG",
					Mediums: "U_NBTMDS",
					Smalls: "U_NBTSM"
				},
				"C/D": {
					Bulk: "U_C_D_BULK",
					Larges: "U_NCLRG",
					Mediums: "U_NCDMDS",
					Smalls: "U_NCDSM"
				},
				"HLV": {
					Bulk: "U_HLV_BULK",
					Larges: "U_HLV_LARGE",
					Mediums: "U_HLV_MED",
					Smalls: "U_HLV_SMALL"
				},
				"PM": {
					Bulk: "U_PM_BULK",
					Larges: "U_NPMLRG",
					Mediums: "U_NPMMDS",
					Smalls: "U_NPMSM"
				},
				"Seed/Herm": {
					Bulk: "U_SD_HM_BULK",
					Larges: "U_SD_HM_LARGE",
					Mediums: "U_SD_HM_MED",
					Smalls: "U_SD_HM_SMALL"
				},
				"Bugs": {
					Bulk: "U_BUGS_BULK",
					Larges: "U_NBGLRG",
					Mediums: "U_NBGMDS",
					Smalls: "U_NBGSM"
				},
				"Burn": {
					Bulk: "U_BURN_BULK",
					Larges: "U_NBULRG",
					Mediums: "U_NBRMDS",
					Smalls: "U_NBRSM"
				},
				"Multiple QC Issues": {
					Bulk: "U_MQCI_BULK",
					Larges: "U_NQCLRG",
					Mediums: "U_NQCMDS",
					Smalls: "U_NQCISM"
				},
				"Glass": {
					Bulk: "U_GLASS_BULK",
					Larges: "U_GLASS_LARGE",
					Mediums: "U_GLASS_MED",
					Smalls: "U_GLASS_SMALL"
				},
				"Mixed Strains": {
					Bulk: "U_MX_ST_BULK",
					Larges: "U_MX_ST_LARGE",
					Mediums: "U_MX_ST_MED",
					Smalls: "U_MX_ST_SMALL"
				}
			};
			const payload = {};
			aItems.forEach(item => {
				const map = fieldMap[item.type];

				if (map) {
					payload[map.Bulk] = Number(item.Bulk) || 0;
					payload[map.Larges] = Number(item.Larges) || 0;
					payload[map.Mediums] = Number(item.Mediums) || 0;
					payload[map.Smalls] = Number(item.Smalls) || 0;
				}
			});

			return payload;
		},
		_convertToTableFormat: function (record) {
			const date = this.DateformateChange(record.CreateDate);
			const time = record.CreateTime;
			const eventDateTime = date + " " + time;
			const result = [];
			const fieldMap = {
				"Regular": {
					Bulk: "U_REG_BULK",
					Larges: "U_NLRGS",
					Mediums: "U_NMEDUS",
					Smalls: "U_NSMLS"
				},
				"Bottom": {
					Bulk: "U_BOT_BULK",
					Larges: "U_NBTLRG",
					Mediums: "U_NBTMDS",
					Smalls: "U_NBTSM"
				},
				"C/D": {
					Bulk: "U_C_D_BULK",
					Larges: "U_NCLRG",
					Mediums: "U_NCDMDS",
					Smalls: "U_NCDSM"
				},
				"HLV": {
					Bulk: "U_HLV_BULK",
					Larges: "U_HLV_LARGE",
					Mediums: "U_HLV_MED",
					Smalls: "U_HLV_SMALL"
				},
				"PM": {
					Bulk: "U_PM_BULK",
					Larges: "U_NPMLRG",
					Mediums: "U_NPMMDS",
					Smalls: "U_NPMSM"
				},
				"Seed/Herm": {
					Bulk: "U_SD_HM_BULK",
					Larges: "U_SD_HM_LARGE",
					Mediums: "U_SD_HM_MED",
					Smalls: "U_SD_HM_SMALL"
				},
				"Bugs": {
					Bulk: "U_BUGS_BULK",
					Larges: "U_NBGLRG",
					Mediums: "U_NBGMDS",
					Smalls: "U_NBGSM"
				},
				"Burn": {
					Bulk: "U_BURN_BULK",
					Larges: "U_NBULRG",
					Mediums: "U_NBRMDS",
					Smalls: "U_NBRSM"
				},
				"Multiple QC Issues": {
					Bulk: "U_MQCI_BULK",
					Larges: "U_NQCLRG",
					Mediums: "U_NQCMDS",
					Smalls: "U_NQCISM"
				},
				"Glass": {
					Bulk: "U_GLASS_BULK",
					Larges: "U_GLASS_LARGE",
					Mediums: "U_GLASS_MED",
					Smalls: "U_GLASS_SMALL"
				},
				"Mixed Strains": {
					Bulk: "U_MX_ST_BULK",
					Larges: "U_MX_ST_LARGE",
					Mediums: "U_MX_ST_MED",
					Smalls: "U_MX_ST_SMALL"
				}
			};
			Object.keys(fieldMap).forEach(type => {
				const map = fieldMap[type];
				result.push({
					Event_Date_Time: eventDateTime,
					Type: type,
					Bulk: record[map.Bulk] || 0,
					Larges: record[map.Larges] || 0,
					Mediums: record[map.Mediums] || 0,
					Smalls: record[map.Smalls] || 0
				});

			});

			return result;
		}
	});
});
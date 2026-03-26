sap.ui.define([
	"sap/ui/core/UIComponent",
	"sap/ui/Device",
	"com/9b/processing/model/models",
	"sap/f/FlexibleColumnLayoutSemanticHelper",
	"sap/ui/model/json/JSONModel"

], function (UIComponent, Device, models, FlexibleColumnLayoutSemanticHelper, JSONModel) {
	"use strict";

	return UIComponent.extend("com.9b.processing.Component", {

		metadata: {
			manifest: "json"
		},

		/**
		 * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
		 * @public
		 * @override
		 */
		init: function () {
		/*	window.onbeforeunload = function () {
				return "Are you sure you want to leave? Unsaved data may be lost.";
			};

		
			window.addEventListener("popstate", function (event) {
				const leave = confirm("Are you sure you want to go back? Unsaved data may be lost.");
				if (!leave) {
					history.pushState(null, null, location.href);
				}
			});

			// Initial push so that popstate can be intercepted
			history.pushState(null, null, location.href);*/

			// call the base component's init function
			UIComponent.prototype.init.apply(this, arguments);

			// enable routing
			this.getRouter().initialize();

			// set the device model
			this.setModel(models.createDeviceModel(), "device");
			var appModel = new JSONModel({
				busy: true,
				delay: 0,
				layout: "OneColumn",
				previousLayout: "",
				actionButtonsInfo: {
					midColumn: {
						fullScreen: false
					}
				},
				strainList: []
			});
			appModel.setSizeLimit(1000);
			this.setModel(appModel, "appModel");

			var jsonModel = new JSONModel({
				versionInfo: "v1.124.41",
				strainList: [],
				createMode: false,
				//	serLayerbaseUrl: "https://demo.seedandbeyond.com:50000",
				// serLayerbaseUrl: "https://glasshouseweb.seedandbeyond.com:50000",
				// userAuthPayload: {
				// 	"CompanyDB": "QAS",
				// 	"UserName": "aag11153",
				// 	"Password": "#!GLaSs@HoUsE!#3579!#"
				// },
				serLayerbaseUrl: "https://ghdev.seedandbeyond.com:20100",
				userAuthPayload: {
					//"CompanyDB": "__QAS",
					"CompanyDB": "DEV",
					"UserName": "RajuG",
					"Password": "AlliRaz@9"
				},

				//set the app navigation URL model
				target: {
					Strain: "webclient-ext-strainlist-app-content-sapb1strainlist",
					ClonePlanner: "webclient-ext-clone-planner2-app-content-sapb1cloneplanner",
					VegPlanner: "webclient-ext-veg-planner-app-content-sapb1vegplanner",
					FlowerPlanner: "webclient-ext-flowering-app-v2-content-sapb1flowering",
					Harvest: "webclient-ext-harvest-planner-app-content-sapb1harvest-planner",
					MotherPlanner: "webclient-ext-motherplanner2-app-content-sapb1motherplanner",
					DestroyedPlants: "webclient-ext-destroy-plant-app-content-sapb1destroy-plant",
					Waste: "webclient-ext-waste-record-app-content-sapb1waste-record",
					ManagePackages: "webclient-ext-manage-packages-v2-app-content-sapb1manage-packages",
					METRCTag: "webclient-ext-metrc-tag-app-content-sapb1metrctag",
					ReceiveProducts: "webclient-ext-receive-products-app-content-sapb1receive-products"
				}
			});
			jsonModel.setSizeLimit(10000);
			this.setModel(jsonModel, "jsonModel");
			if (!sap.ui.getCore().getModel("authModel")) {
				var authModel = new JSONModel({
					serLayerbaseUrl: "https://demo.seedandbeyond.com:50000",
					userAuthPayload: {
						"CompanyDB": "CAL",
						"UserName": "manager",
						"Password": "Welcome@9"
					}
				});
				sap.ui.getCore().setModel(authModel, "authModel");
			}
			// update browser title
			this.getRouter().attachTitleChanged(function (oEvent) {
				var sTitle = oEvent.getParameter("title");
				document.addEventListener('DOMContentLoaded', function () {
					document.title = sTitle;
				});
			});
		},

		//session timeout by susmita
		getSessionTimeOut: function () {
			var fiveMinutesLater = new Date();
			var scs = fiveMinutesLater.setMinutes(fiveMinutesLater.getMinutes() + 1);
			var countdowntime = scs;
			var that = this;
			var x = setInterval(function () {
				var now = new Date().getTime();
				var cTime = countdowntime - now;
				if (cTime < 0) {
					that._getDialog().open();
					clearInterval(x);
				}
			});
		},
		onClose: function () {
			this._getDialog().close();
			//this.getSessionTimeOut();
			clearInterval();
		},
		onSubmit: function () {
			this.getRouter().navTo("dashBoard");
			this._getDialog().close();
			//this.getSessionTimeOut();
			clearInterval();
		},
		_getDialog: function () {
			if (!this.dialog) {
				//this.dialog = sap.ui.xmlfragment("login.view.otp", this);
				this.dialog = sap.ui.xmlfragment("sessionDialog", "com.9b.processing.view.fragments.SessionTimeoutDialog", this);
			}
			return this.dialog;
		},
		// onSessionPress: function () {
		// 	if (!this.sessionDialog) {
		// 		this.sessionDialog = sap.ui.xmlfragment("sessionDialog", "com.9b.itemGroup.view.fragments.SessionTimeoutDialog", this);
		// 		this.getView().addDependent(this.sessionDialog);
		// 	}
		// 	this.sessionDialog.open();
		// },

		getHelper: function (oFCL) {
			//	var oFCL = this.getRootControl().byId("layout"),
			var oParams = jQuery.sap.getUriParameters(),
				oSettings = {
					defaultTwoColumnLayoutType: sap.f.LayoutType.TwoColumnsMidExpanded,
					mode: oParams.get("mode"),
					initialColumnsCount: oParams.get("initial"),
					maxColumnsCount: oParams.get("max")
				};

			return FlexibleColumnLayoutSemanticHelper.getInstanceFor(oFCL, oSettings);
		},
		getContentDensityClass: function () {
			/*	if (this._sContentDensityClass === undefined) {
					// check whether FLP has already set the content density class; do nothing in this case
					if (jQuery(document.body).hasClass("sapUiSizeCozy") || jQuery(document.body).hasClass("sapUiSizeCompact")) {
						this._sContentDensityClass = "";
					} else if (!Device.support.touch) { // apply "compact" mode if touch is not supported
						this._sContentDensityClass = "sapUiSizeCompact";
					} else {
						// "cozy" in case of touch support; default for most sap.m controls, but needed for desktop-first controls like sap.ui.table.Table
						this._sContentDensityClass = "sapUiSizeCozy";
					}
				}*/
			this._sContentDensityClass = "sapUiSizeCompact";
			return this._sContentDensityClass;
		}
	});
});
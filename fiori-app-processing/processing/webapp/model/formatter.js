sap.ui.define([
	"sap/ui/core/format/NumberFormat"
], function (NumberFormat) {
	"use strict";

	var mStatusState = {
		"A": "Success",
		"O": "Warning",
		"D": "Error"
	};

	var formatter = {
		/**
		 * Formats the price
		 * @param {string} sValue model price value
		 * @return {string} formatted price
		 */
		price: function (sValue) {
			if (!sValue) {
				sValue = "200";
			}
			var numberFormat = NumberFormat.getFloatInstance({
				maxFractionDigits: 2,
				minFractionDigits: 2,
				groupingEnabled: true,
				groupingSeparator: ".",
				decimalSeparator: ","
			});
			return numberFormat.format(sValue);
		},
		/*	format discount value*/

		formatDiscount: function (dValue) {
			if (dValue) {
				return (dValue).toFixed(2);
			}
		},
		/**
		 * Sums up the price for all products in the cart
		 * @param {object} oCartEntries current cart entries
		 * @return {string} string with the total value
		 */
		totalPrice: function (oCartEntries) {
			var oBundle = this.getResourceBundle(),
				fTotalPrice = 0;
			var cartLength = 0;
			Object.keys(oCartEntries).forEach(function (sProductId) {
				var oProduct = oCartEntries[sProductId];
				fTotalPrice += parseFloat(200) * oProduct.Quantity;
				cartLength += 1;
			});
			this.getModel("jsonModel").setProperty("/cartCount", cartLength);
			return oBundle.getText("cartTotalPrice", [formatter.price(fTotalPrice)]);
		},

		/**
		 * Returns the status text based on the product status
		 * @param {string} sStatus product status
		 * @return {string} the corresponding text if found or the original value
		 */
		statusText: function (sStatus) {
			var oBundle = this.getResourceBundle();

			var mStatusText = {
				"A": oBundle.getText("statusA"),
				"O": oBundle.getText("statusO"),
				"D": oBundle.getText("statusD")
			};

			return mStatusText[sStatus] || sStatus;
		},

		/**
		 * Returns the product state based on the status
		 * @param {string} sStatus product status
		 * @return {string} the state text
		 */
		statusState: function (sStatus) {
			return mStatusState[sStatus] || "None";
		},

		/**
		 * Returns the relative URL to a product picture
		 * @param {string} sUrl image URL
		 * @return {string} relative image URL
		 */
		pictureUrl: function (sUrl) {
			if (sUrl) {
				return sap.ui.require.toUrl(sUrl);
			} else {
				return undefined;
			}
		},

		/**
		 * Checks if one of the collections contains items.
		 * @param {object} oCollection1 First array or object to check
		 * @param {object} oCollection2 Second array or object to check
		 * @return {boolean} true if one of the collections is not empty, otherwise - false.
		 */
		hasItems: function (oCollection1, oCollection2) {
			var bCollection1Filled = !!(oCollection1 && Object.keys(oCollection1).length),
				bCollection2Filled = !!(oCollection2 && Object.keys(oCollection2).length);

			return bCollection1Filled || bCollection2Filled;
		},
		enableWaste: function (aQty, eQty) {

		},
		decimal: function (d) {
			return parseFloat(d).toFixed(2); // if value is string
			// if number use below statement
			// return d.toFixed(2)
		},

		NumberDecimalFormat: function (d) {
			var oCurrencyFormat = NumberFormat.getCurrencyInstance();
			return oCurrencyFormat.format(d);
		},

		formatWMImage: function (sUrl) {
			return sUrl + "?w=250&h=250";
		},
		/**
		 * Converts the timestamp back to date
		 * @public
		 * @param {string} sDateTimeUTC a date in UTC string format
		 * @returns {object} new date object created from sDateTimeUTC string
		 */
		utcToLocalDateTime: function (sDateTimeUTC) {

			if (!sDateTimeUTC) {
				return null;
			}

			return new Date(sDateTimeUTC);
		},

		fixImagePath: function () {
			return "";
		},
		formatCurrency: function (sValue) {
			if (sValue) {
				var numberFormat = NumberFormat.getFloatInstance({
					maxFractionDigits: 2,
					minFractionDigits: 2,
					groupingEnabled: true,
					groupingSeparator: ",",
					decimalSeparator: "."
				});
				return "$" + numberFormat.format(sValue);
			} else {
				return "$0.00";
			}
		},
		processFlowState: function (flag) {
			if (flag === "-2") {
				return "Warning";
			} else if (flag === "-3") {
				return "Success";
			} else if (flag === "1") {
				return "Information";
			}
		},
		processFlowStatusText: function (flag) {
			if (flag === "-2" || flag === null) {
				return "Not Started";
			} else if (flag === "-3") {
				return "Completed";
			} else if (flag === "1") {
				return "In Progress";
			}
		},
		taskStatusText: function (flag) {
			if (flag === "-2" || flag === null) {
				return "Start Task";
			} else if (flag === "-3") {
				return "Completed";
			} else if (flag === "1") {
				return "Complete Task";
			}
		},
		taskState: function (flag) {
			if (flag === "-2" || flag === null) {
				return "Attention";
			} else if (flag === "-3") {
				return "Transparent";
			} else if (flag === "1") {
				return "Accept";
			}
		},
		iconStatus: function (tasks) {
			var comTasks = 0;
			var runningTasks = 0;
			var noTasks = 0;
			$.each(tasks, function (x, y) {
				if (y.NPRST === "-3") {
					comTasks++;
				} else if (y.NPRST === "1") {
					runningTasks++;
				} else if (y.NPRST === "-2" || y.NPRST === null) {
					noTasks++;
				}
			});
			return [{
				state: "Positive",
				value: comTasks
			},{
				state: "Critical",
				value: runningTasks
			},{
				state: "Negative",
				value: noTasks
			}];

		}

	};

	return formatter;
});
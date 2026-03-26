sap.ui.define([
	"sap/m/MessageBox",
	"sap/m/MessageToast"
], function (
	MessageBox,
	MessageToast) {
	"use strict";

	return {

	callMetricsService: function (entity, methodType, metricPayLoad,payLoad,context,dialog,metricSync, success, error) {
			// var obj = this.getView().getModel("jsonModel").getProperty("/selectedMetrics");
			var metricConfig = context.getView().getModel("jsonModel").getProperty("/selectedMetrics");
			if (metricConfig.length === 0) {
				MessageBox.error("Please configure the Metric.");
				return;
			}
			$.ajax({
				data: JSON.stringify(metricPayLoad),
				type: methodType,
				async: false,
				url: metricConfig[0].NURL + entity,
				contentType: "application/json",
				headers: {
					"Authorization": "Basic " + btoa(metricConfig[0].NVNDK + ":" + metricConfig[0].NUSRK)
				},
				success: function(res){
					success.call(context,metricConfig[0].NURL + entity,metricPayLoad,payLoad,dialog,metricSync,res);
				},
				error: function(res){
					error.call(context,dialog,res);
				}
			});
		},
		callMetricGetService: function (entity,context,dialog, success, error) {
			// var obj = this.getView().getModel("jsonModel").getProperty("/selectedMetrics");
			var metricConfig = context.getView().getModel("jsonModel").getProperty("/selectedMetrics");
			if (metricConfig.length === 0) {
				MessageBox.error("Please configure the Metric.");
				return;
			}
			$.ajax({
				type: "GET",
				async: false,
				url: metricConfig[0].NURL + entity,
				contentType: "application/json",
				headers: {
					"Authorization": "Basic " + btoa(metricConfig[0].NVNDK + ":" + metricConfig[0].NUSRK)
				},
				success: function(data){
					success.call(context,dialog,data);
				},
				error: function(res){
					error.call(context,dialog,res);
				}
			});
		}
	};
});
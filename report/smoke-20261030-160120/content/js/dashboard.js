/*
   Licensed to the Apache Software Foundation (ASF) under one or more
   contributor license agreements.  See the NOTICE file distributed with
   this work for additional information regarding copyright ownership.
   The ASF licenses this file to You under the Apache License, Version 2.0
   (the "License"); you may not use this file except in compliance with
   the License.  You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
var showControllersOnly = false;
var seriesFilter = "";
var filtersOnlySampleSeries = true;

/*
 * Add header in statistics table to group metrics by category
 * format
 *
 */
function summaryTableHeader(header) {
    var newRow = header.insertRow(-1);
    newRow.className = "tablesorter-no-sort";
    var cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Requests";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 3;
    cell.innerHTML = "Executions";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 7;
    cell.innerHTML = "Response Times (ms)";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Throughput";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 2;
    cell.innerHTML = "Network (KB/sec)";
    newRow.appendChild(cell);
}

/*
 * Populates the table identified by id parameter with the specified data and
 * format
 *
 */
function createTable(table, info, formatter, defaultSorts, seriesIndex, headerCreator) {
    var tableRef = table[0];

    // Create header and populate it with data.titles array
    var header = tableRef.createTHead();

    // Call callback is available
    if(headerCreator) {
        headerCreator(header);
    }

    var newRow = header.insertRow(-1);
    for (var index = 0; index < info.titles.length; index++) {
        var cell = document.createElement('th');
        cell.innerHTML = info.titles[index];
        newRow.appendChild(cell);
    }

    var tBody;

    // Create overall body if defined
    if(info.overall){
        tBody = document.createElement('tbody');
        tBody.className = "tablesorter-no-sort";
        tableRef.appendChild(tBody);
        var newRow = tBody.insertRow(-1);
        var data = info.overall.data;
        for(var index=0;index < data.length; index++){
            var cell = newRow.insertCell(-1);
            cell.innerHTML = formatter ? formatter(index, data[index]): data[index];
        }
    }

    // Create regular body
    tBody = document.createElement('tbody');
    tableRef.appendChild(tBody);

    var regexp;
    if(seriesFilter) {
        regexp = new RegExp(seriesFilter, 'i');
    }
    // Populate body with data.items array
    for(var index=0; index < info.items.length; index++){
        var item = info.items[index];
        if((!regexp || filtersOnlySampleSeries && !info.supportsControllersDiscrimination || regexp.test(item.data[seriesIndex]))
                &&
                (!showControllersOnly || !info.supportsControllersDiscrimination || item.isController)){
            if(item.data.length > 0) {
                var newRow = tBody.insertRow(-1);
                for(var col=0; col < item.data.length; col++){
                    var cell = newRow.insertCell(-1);
                    cell.innerHTML = formatter ? formatter(col, item.data[col]) : item.data[col];
                }
            }
        }
    }

    // Add support of columns sort
    table.tablesorter({sortList : defaultSorts});
}

$(document).ready(function() {

    // Customize table sorter default options
    $.extend( $.tablesorter.defaults, {
        theme: 'blue',
        cssInfoBlock: "tablesorter-no-sort",
        widthFixed: true,
        widgets: ['zebra']
    });

    var data = {"OkPercent": 96.7741935483871, "KoPercent": 3.225806451612903};
    var dataset = [
        {
            "label" : "FAIL",
            "data" : data.KoPercent,
            "color" : "#FF6347"
        },
        {
            "label" : "PASS",
            "data" : data.OkPercent,
            "color" : "#9ACD32"
        }];
    $.plot($("#flot-requests-summary"), dataset, {
        series : {
            pie : {
                show : true,
                radius : 1,
                label : {
                    show : true,
                    radius : 3 / 4,
                    formatter : function(label, series) {
                        return '<div style="font-size:8pt;text-align:center;padding:2px;color:white;">'
                            + label
                            + '<br/>'
                            + Math.round10(series.percent, -2)
                            + '%</div>';
                    },
                    background : {
                        opacity : 0.5,
                        color : '#000'
                    }
                }
            }
        },
        legend : {
            show : true
        }
    });

    // Creates APDEX table
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.8611111111111112, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.0, 500, 1500, "0604 GET 001s3 (verify)"], "isController": false}, {"data": [0.5, 500, 1500, "01 Login (config gate; captcha disabled)"], "isController": true}, {"data": [1.0, 500, 1500, "0103 POST index (preAction=login)"], "isController": false}, {"data": [1.0, 500, 1500, "0102 POST checkResult (browser config gate)"], "isController": false}, {"data": [1.0, 500, 1500, "0301 GET 001s1"], "isController": false}, {"data": [1.0, 500, 1500, "03 Wizard 001s1 Terms"], "isController": true}, {"data": [1.0, 500, 1500, "0602 POST 001s3 Back-1"], "isController": false}, {"data": [1.0, 500, 1500, "99 Run summary"], "isController": false}, {"data": [1.0, 500, 1500, "0602 POST 001s3 Back-0"], "isController": false}, {"data": [1.0, 500, 1500, "0107 POST security/login"], "isController": false}, {"data": [1.0, 500, 1500, "0600 WARN persist mode"], "isController": false}, {"data": [1.0, 500, 1500, "0107 POST security/login-0"], "isController": false}, {"data": [1.0, 500, 1500, "0107 POST security/login-1"], "isController": false}, {"data": [0.0, 500, 1500, "0601 POST 001s2 Next (persist rows)"], "isController": false}, {"data": [1.0, 500, 1500, "0602 POST 001s3 Back"], "isController": false}, {"data": [0.75, 500, 1500, "0401 POST bUpload_x"], "isController": false}, {"data": [1.0, 500, 1500, "0302 POST 001s1 accept terms"], "isController": false}, {"data": [1.0, 500, 1500, "0101 GET index"], "isController": false}, {"data": [1.0, 500, 1500, "0604 GET 001s3 (verify)-1"], "isController": false}, {"data": [0.0, 500, 1500, "0601 POST 001s2 Next (persist rows)-0"], "isController": false}, {"data": [1.0, 500, 1500, "0604 GET 001s3 (verify)-0"], "isController": false}, {"data": [1.0, 500, 1500, "0601 POST 001s2 Next (persist rows)-1"], "isController": false}, {"data": [1.0, 500, 1500, "0603 POST 001s2 Empty All (TR1_count=0)"], "isController": false}, {"data": [1.0, 500, 1500, "0202 POST 001s0 Next"], "isController": false}, {"data": [0.5, 500, 1500, "04 Upload transaction data (x N)"], "isController": true}, {"data": [1.0, 500, 1500, "05 Verify upload list (no persistence)"], "isController": true}, {"data": [0.5, 500, 1500, "00 Pre-flight"], "isController": false}, {"data": [1.0, 500, 1500, "0104 GET security/login (load login form)"], "isController": false}, {"data": [1.0, 500, 1500, "0201 GET 001s0"], "isController": false}, {"data": [1.0, 500, 1500, "0302 POST 001s1 accept terms-1"], "isController": false}, {"data": [1.0, 500, 1500, "0302 POST 001s1 accept terms-0"], "isController": false}, {"data": [1.0, 500, 1500, "0202 POST 001s0 Next-0"], "isController": false}, {"data": [1.0, 500, 1500, "02 Wizard 001s0 Overview"], "isController": true}, {"data": [1.0, 500, 1500, "0202 POST 001s0 Next-1"], "isController": false}, {"data": [1.0, 500, 1500, "0501 GET 001s2 reload"], "isController": false}]}, function(index, item){
        switch(index){
            case 0:
                item = item.toFixed(3);
                break;
            case 1:
            case 2:
                item = formatDuration(item);
                break;
        }
        return item;
    }, [[0, 0]], 3);

    // Create statistics table
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 31, 1, 3.225806451612903, 277.5483870967742, 6, 2468, 65.0, 846.6000000000003, 2431.4, 2468.0, 5.278392644304444, 80.3381869359782, 9981.904411608206], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["0604 GET 001s3 (verify)", 1, 1, 100.0, 85.0, 85, 85, 85.0, 85.0, 85.0, 85.0, 11.76470588235294, 284.5703125, 5.376838235294117], "isController": false}, {"data": ["01 Login (config gate; captcha disabled)", 1, 0, 0.0, 564.0, 564, 564, 564.0, 564.0, 564.0, 564.0, 1.7730496453900708, 203.66868905141845, 3.674229831560284], "isController": true}, {"data": ["0103 POST index (preAction=login)", 1, 0, 0.0, 51.0, 51, 51, 51.0, 51.0, 51.0, 51.0, 19.607843137254903, 629.2700674019608, 7.7167585784313735], "isController": false}, {"data": ["0102 POST checkResult (browser config gate)", 1, 0, 0.0, 45.0, 45, 45, 45.0, 45.0, 45.0, 45.0, 22.22222222222222, 175.15190972222223, 15.559895833333334], "isController": false}, {"data": ["0301 GET 001s1", 1, 0, 0.0, 75.0, 75, 75, 75.0, 75.0, 75.0, 75.0, 13.333333333333334, 303.75, 3.046875], "isController": false}, {"data": ["03 Wizard 001s1 Terms", 1, 0, 0.0, 212.0, 212, 212, 212.0, 212.0, 212.0, 212.0, 4.716981132075471, 221.54610112028303, 4.09511350235849], "isController": true}, {"data": ["0602 POST 001s3 Back-1", 1, 0, 0.0, 58.0, 58, 58, 58.0, 58.0, 58.0, 58.0, 17.241379310344826, 390.06936961206895, 3.939924568965517], "isController": false}, {"data": ["99 Run summary", 1, 0, 0.0, 11.0, 11, 11, 11.0, 11.0, 11.0, 11.0, 90.9090909090909, 1.7755681818181819, 0.0], "isController": false}, {"data": ["0602 POST 001s3 Back-0", 1, 0, 0.0, 6.0, 6, 6, 6.0, 6.0, 6.0, 6.0, 166.66666666666666, 260.7421875, 63.639322916666664], "isController": false}, {"data": ["0107 POST security/login", 1, 0, 0.0, 191.0, 191, 191, 191.0, 191.0, 191.0, 191.0, 5.235602094240838, 130.89005235602093, 3.3284931282722514], "isController": false}, {"data": ["0600 WARN persist mode", 1, 0, 0.0, 13.0, 13, 13, 13.0, 13.0, 13.0, 13.0, 76.92307692307693, 1.5024038461538463, 0.0], "isController": false}, {"data": ["0107 POST security/login-0", 1, 0, 0.0, 42.0, 42, 42, 42.0, 42.0, 42.0, 42.0, 23.809523809523807, 37.109375, 9.835379464285714], "isController": false}, {"data": ["0107 POST security/login-1", 1, 0, 0.0, 147.0, 147, 147, 147.0, 147.0, 147.0, 147.0, 6.802721088435374, 159.46534863945578, 1.5146683673469388], "isController": false}, {"data": ["0601 POST 001s2 Next (persist rows)", 1, 0, 0.0, 2468.0, 2468, 2468, 2468.0, 2468.0, 2468.0, 2468.0, 0.4051863857374392, 9.619615452795786, 0.34899842990275526], "isController": false}, {"data": ["0602 POST 001s3 Back", 1, 0, 0.0, 65.0, 65, 65, 65.0, 65.0, 65.0, 65.0, 15.384615384615385, 372.13040865384613, 9.390024038461538], "isController": false}, {"data": ["0401 POST bUpload_x", 2, 0, 0.0, 656.5, 394, 919, 656.5, 919.0, 919.0, 919.0, 1.4705882352941175, 2.431353400735294, 43098.2421875], "isController": false}, {"data": ["0302 POST 001s1 accept terms", 1, 0, 0.0, 137.0, 137, 137, 137.0, 137.0, 137.0, 137.0, 7.299270072992701, 176.54396669708026, 4.668966697080291], "isController": false}, {"data": ["0101 GET index", 1, 0, 0.0, 237.0, 237, 237, 237.0, 237.0, 237.0, 237.0, 4.219409282700422, 135.42078718354432, 0.5397877109704642], "isController": false}, {"data": ["0604 GET 001s3 (verify)-1", 1, 0, 0.0, 64.0, 64, 64, 64.0, 64.0, 64.0, 64.0, 15.625, 353.5003662109375, 3.570556640625], "isController": false}, {"data": ["0601 POST 001s2 Next (persist rows)-0", 1, 0, 0.0, 2407.0, 2407, 2407, 2407.0, 2407.0, 2407.0, 2407.0, 0.4154549231408392, 0.6499597528043207, 0.24302490132945576], "isController": false}, {"data": ["0604 GET 001s3 (verify)-0", 1, 0, 0.0, 20.0, 20, 20, 20.0, 20.0, 20.0, 20.0, 50.0, 78.22265625, 11.42578125], "isController": false}, {"data": ["0601 POST 001s2 Next (persist rows)-1", 1, 0, 0.0, 60.0, 60, 60, 60.0, 60.0, 60.0, 60.0, 16.666666666666668, 369.61263020833337, 4.606119791666667], "isController": false}, {"data": ["0603 POST 001s2 Empty All (TR1_count=0)", 1, 0, 0.0, 53.0, 53, 53, 53.0, 53.0, 53.0, 53.0, 18.867924528301884, 426.9052181603774, 7.241303066037736], "isController": false}, {"data": ["0202 POST 001s0 Next", 1, 0, 0.0, 92.0, 92, 92, 92.0, 92.0, 92.0, 92.0, 10.869565217391305, 264.6272078804348, 6.528108016304348], "isController": false}, {"data": ["04 Upload transaction data (x N)", 1, 0, 0.0, 1313.0, 1313, 1313, 1313.0, 1313.0, 1313.0, 1313.0, 0.7616146230007617, 2.518385853008378, 44640.98200685453], "isController": true}, {"data": ["05 Verify upload list (no persistence)", 1, 0, 0.0, 65.0, 65, 65, 65.0, 65.0, 65.0, 65.0, 15.384615384615385, 348.03185096153845, 3.515625], "isController": true}, {"data": ["00 Pre-flight", 1, 0, 0.0, 557.0, 557, 557, 557.0, 557.0, 557.0, 557.0, 1.7953321364452424, 0.02279230251346499, 0.0], "isController": false}, {"data": ["0104 GET security/login (load login form)", 1, 0, 0.0, 40.0, 40, 40, 40.0, 40.0, 40.0, 40.0, 25.0, 444.9951171875, 5.37109375], "isController": false}, {"data": ["0201 GET 001s0", 1, 0, 0.0, 75.0, 75, 75, 75.0, 75.0, 75.0, 75.0, 13.333333333333334, 256.9140625, 3.046875], "isController": false}, {"data": ["0302 POST 001s1 accept terms-1", 1, 0, 0.0, 99.0, 99, 99, 99.0, 99.0, 99.0, 99.0, 10.101010101010102, 228.5057607323232, 2.3082386363636362], "isController": false}, {"data": ["0302 POST 001s1 accept terms-0", 1, 0, 0.0, 37.0, 37, 37, 37.0, 37.0, 37.0, 37.0, 27.027027027027028, 42.282516891891895, 11.111697635135135], "isController": false}, {"data": ["0202 POST 001s0 Next-0", 1, 0, 0.0, 35.0, 35, 35, 35.0, 35.0, 35.0, 35.0, 28.57142857142857, 44.69866071428571, 10.630580357142856], "isController": false}, {"data": ["02 Wizard 001s0 Overview", 1, 0, 0.0, 167.0, 167, 167, 167.0, 167.0, 167.0, 167.0, 5.9880239520958085, 261.16322043413174, 4.964680014970059], "isController": true}, {"data": ["0202 POST 001s0 Next-1", 1, 0, 0.0, 56.0, 56, 56, 56.0, 56.0, 56.0, 56.0, 17.857142857142858, 406.8080357142857, 4.080636160714286], "isController": false}, {"data": ["0501 GET 001s2 reload", 1, 0, 0.0, 65.0, 65, 65, 65.0, 65.0, 65.0, 65.0, 15.384615384615385, 348.03185096153845, 3.515625], "isController": false}]}, function(index, item){
        switch(index){
            // Errors pct
            case 3:
                item = item.toFixed(2) + '%';
                break;
            // Mean
            case 4:
            // Mean
            case 7:
            // Median
            case 8:
            // Percentile 1
            case 9:
            // Percentile 2
            case 10:
            // Percentile 3
            case 11:
            // Throughput
            case 12:
            // Kbytes/s
            case 13:
            // Sent Kbytes/s
                item = item.toFixed(2);
                break;
        }
        return item;
    }, [[0, 0]], 0, summaryTableHeader);

    // Create error table
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": [{"data": ["001s3 not reachable after the persist run", 1, 100.0, 3.225806451612903], "isController": false}]}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 31, 1, "001s3 not reachable after the persist run", 1, "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": ["0604 GET 001s3 (verify)", 1, 1, "001s3 not reachable after the persist run", 1, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});

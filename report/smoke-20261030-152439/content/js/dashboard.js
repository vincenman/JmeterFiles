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

    var data = {"OkPercent": 100.0, "KoPercent": 0.0};
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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.94, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [1.0, 500, 1500, "0107 POST security/login-0"], "isController": false}, {"data": [0.5, 500, 1500, "01 Login (config gate; captcha disabled)"], "isController": true}, {"data": [1.0, 500, 1500, "0107 POST security/login-1"], "isController": false}, {"data": [1.0, 500, 1500, "0103 POST index (preAction=login)"], "isController": false}, {"data": [1.0, 500, 1500, "0102 POST checkResult (browser config gate)"], "isController": false}, {"data": [1.0, 500, 1500, "0301 GET 001s1"], "isController": false}, {"data": [1.0, 500, 1500, "0401 POST bUpload_x"], "isController": false}, {"data": [1.0, 500, 1500, "0302 POST 001s1 accept terms"], "isController": false}, {"data": [1.0, 500, 1500, "0101 GET index"], "isController": false}, {"data": [1.0, 500, 1500, "03 Wizard 001s1 Terms"], "isController": true}, {"data": [1.0, 500, 1500, "0202 POST 001s0 Next"], "isController": false}, {"data": [0.5, 500, 1500, "04 Upload transaction data (x N)"], "isController": true}, {"data": [1.0, 500, 1500, "05 Verify upload list (no persistence)"], "isController": true}, {"data": [0.5, 500, 1500, "00 Pre-flight"], "isController": false}, {"data": [1.0, 500, 1500, "0104 GET security/login (load login form)"], "isController": false}, {"data": [1.0, 500, 1500, "99 Run summary"], "isController": false}, {"data": [1.0, 500, 1500, "0201 GET 001s0"], "isController": false}, {"data": [1.0, 500, 1500, "0302 POST 001s1 accept terms-1"], "isController": false}, {"data": [1.0, 500, 1500, "0107 POST security/login"], "isController": false}, {"data": [1.0, 500, 1500, "0302 POST 001s1 accept terms-0"], "isController": false}, {"data": [1.0, 500, 1500, "0202 POST 001s0 Next-0"], "isController": false}, {"data": [1.0, 500, 1500, "02 Wizard 001s0 Overview"], "isController": true}, {"data": [1.0, 500, 1500, "0202 POST 001s0 Next-1"], "isController": false}, {"data": [1.0, 500, 1500, "0501 GET 001s2 reload"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 20, 0, 0.0, 134.2, 16, 555, 64.0, 433.2000000000002, 549.4499999999999, 555.0, 7.9113924050632916, 120.61396731606013, 23188.086787356606], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["0107 POST security/login-0", 1, 0, 0.0, 48.0, 48, 48, 48.0, 48.0, 48.0, 48.0, 20.833333333333332, 32.470703125, 8.60595703125], "isController": false}, {"data": ["01 Login (config gate; captcha disabled)", 1, 0, 0.0, 560.0, 560, 560, 560.0, 560.0, 560.0, 560.0, 1.7857142857142856, 205.1234654017857, 3.7004743303571423], "isController": true}, {"data": ["0107 POST security/login-1", 1, 0, 0.0, 149.0, 149, 149, 149.0, 149.0, 149.0, 149.0, 6.7114093959731544, 157.32487416107384, 1.4943372483221478], "isController": false}, {"data": ["0103 POST index (preAction=login)", 1, 0, 0.0, 51.0, 51, 51, 51.0, 51.0, 51.0, 51.0, 19.607843137254903, 629.2700674019608, 7.7167585784313735], "isController": false}, {"data": ["0102 POST checkResult (browser config gate)", 1, 0, 0.0, 51.0, 51, 51, 51.0, 51.0, 51.0, 51.0, 19.607843137254903, 154.54580269607845, 13.729319852941178], "isController": false}, {"data": ["0301 GET 001s1", 1, 0, 0.0, 58.0, 58, 58, 58.0, 58.0, 58.0, 58.0, 17.241379310344826, 392.7801724137931, 3.939924568965517], "isController": false}, {"data": ["0401 POST bUpload_x", 2, 0, 0.0, 390.0, 336, 444, 390.0, 444.0, 444.0, 444.0, 2.3837902264600714, 3.941168802145411, 69861.27458283672], "isController": false}, {"data": ["0302 POST 001s1 accept terms", 1, 0, 0.0, 109.0, 109, 109, 109.0, 109.0, 109.0, 109.0, 9.174311926605505, 221.79615825688074, 5.868334288990826], "isController": false}, {"data": ["0101 GET index", 1, 0, 0.0, 229.0, 229, 229, 229.0, 229.0, 229.0, 229.0, 4.366812227074235, 140.15164437772924, 0.558644923580786], "isController": false}, {"data": ["03 Wizard 001s1 Terms", 1, 0, 0.0, 167.0, 167, 167, 167.0, 167.0, 167.0, 167.0, 5.9880239520958085, 281.1798278443114, 5.198587200598802], "isController": true}, {"data": ["0202 POST 001s0 Next", 1, 0, 0.0, 88.0, 88, 88, 88.0, 88.0, 88.0, 88.0, 11.363636363636363, 276.6557173295455, 6.824840198863637], "isController": false}, {"data": ["04 Upload transaction data (x N)", 1, 0, 0.0, 780.0, 780, 780, 780.0, 780.0, 780.0, 780.0, 1.2820512820512822, 4.239282852564102, 75145.6530448718], "isController": true}, {"data": ["05 Verify upload list (no persistence)", 1, 0, 0.0, 55.0, 55, 55, 55.0, 55.0, 55.0, 55.0, 18.18181818181818, 411.1150568181818, 4.154829545454546], "isController": true}, {"data": ["00 Pre-flight", 1, 0, 0.0, 555.0, 555, 555, 555.0, 555.0, 555.0, 555.0, 1.8018018018018018, 0.022874436936936936, 0.0], "isController": false}, {"data": ["0104 GET security/login (load login form)", 1, 0, 0.0, 31.0, 31, 31, 31.0, 31.0, 31.0, 31.0, 32.25806451612903, 574.187247983871, 6.930443548387097], "isController": false}, {"data": ["99 Run summary", 1, 0, 0.0, 16.0, 16, 16, 16.0, 16.0, 16.0, 16.0, 62.5, 1.220703125, 0.0], "isController": false}, {"data": ["0201 GET 001s0", 1, 0, 0.0, 70.0, 70, 70, 70.0, 70.0, 70.0, 70.0, 14.285714285714285, 275.26506696428567, 3.2645089285714284], "isController": false}, {"data": ["0302 POST 001s1 accept terms-1", 1, 0, 0.0, 72.0, 72, 72, 72.0, 72.0, 72.0, 72.0, 13.888888888888888, 314.04622395833337, 3.1738281250000004], "isController": false}, {"data": ["0107 POST security/login", 1, 0, 0.0, 198.0, 198, 198, 198.0, 198.0, 198.0, 198.0, 5.050505050505051, 126.26262626262626, 3.2108191287878785], "isController": false}, {"data": ["0302 POST 001s1 accept terms-0", 1, 0, 0.0, 37.0, 37, 37, 37.0, 37.0, 37.0, 37.0, 27.027027027027028, 42.282516891891895, 11.111697635135135], "isController": false}, {"data": ["0202 POST 001s0 Next-0", 1, 0, 0.0, 30.0, 30, 30, 30.0, 30.0, 30.0, 30.0, 33.333333333333336, 52.1484375, 12.40234375], "isController": false}, {"data": ["02 Wizard 001s0 Overview", 1, 0, 0.0, 158.0, 158, 158, 158.0, 158.0, 158.0, 158.0, 6.329113924050633, 276.0396064082278, 5.247478243670886], "isController": true}, {"data": ["0202 POST 001s0 Next-1", 1, 0, 0.0, 57.0, 57, 57, 57.0, 57.0, 57.0, 57.0, 17.543859649122805, 399.67105263157896, 4.009046052631579], "isController": false}, {"data": ["0501 GET 001s2 reload", 1, 0, 0.0, 55.0, 55, 55, 55.0, 55.0, 55.0, 55.0, 18.18181818181818, 411.1150568181818, 4.154829545454546], "isController": false}]}, function(index, item){
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
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": []}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 20, 0, "", "", "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});

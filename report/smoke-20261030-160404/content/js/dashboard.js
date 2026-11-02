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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.88, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [1.0, 500, 1500, "0107 POST security/login-0"], "isController": false}, {"data": [0.5, 500, 1500, "01 Login (config gate; captcha disabled)"], "isController": true}, {"data": [1.0, 500, 1500, "0107 POST security/login-1"], "isController": false}, {"data": [1.0, 500, 1500, "0103 POST index (preAction=login)"], "isController": false}, {"data": [1.0, 500, 1500, "0102 POST checkResult (browser config gate)"], "isController": false}, {"data": [1.0, 500, 1500, "0301 GET 001s1"], "isController": false}, {"data": [0.5, 500, 1500, "0401 POST bUpload_x"], "isController": false}, {"data": [1.0, 500, 1500, "0302 POST 001s1 accept terms"], "isController": false}, {"data": [1.0, 500, 1500, "0101 GET index"], "isController": false}, {"data": [1.0, 500, 1500, "03 Wizard 001s1 Terms"], "isController": true}, {"data": [1.0, 500, 1500, "0202 POST 001s0 Next"], "isController": false}, {"data": [0.0, 500, 1500, "04 Upload transaction data (x N)"], "isController": true}, {"data": [1.0, 500, 1500, "05 Verify upload list (no persistence)"], "isController": true}, {"data": [0.5, 500, 1500, "00 Pre-flight"], "isController": false}, {"data": [1.0, 500, 1500, "0104 GET security/login (load login form)"], "isController": false}, {"data": [1.0, 500, 1500, "99 Run summary"], "isController": false}, {"data": [1.0, 500, 1500, "0201 GET 001s0"], "isController": false}, {"data": [1.0, 500, 1500, "0302 POST 001s1 accept terms-1"], "isController": false}, {"data": [1.0, 500, 1500, "0107 POST security/login"], "isController": false}, {"data": [1.0, 500, 1500, "0302 POST 001s1 accept terms-0"], "isController": false}, {"data": [1.0, 500, 1500, "0202 POST 001s0 Next-0"], "isController": false}, {"data": [1.0, 500, 1500, "02 Wizard 001s0 Overview"], "isController": true}, {"data": [1.0, 500, 1500, "0202 POST 001s0 Next-1"], "isController": false}, {"data": [1.0, 500, 1500, "0501 GET 001s2 reload"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 20, 0, 0.0, 207.69999999999996, 18, 967, 83.0, 784.1000000000004, 958.6999999999998, 967.0, 5.138746145940391, 78.35283112795479, 15061.531215875515], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["0107 POST security/login-0", 1, 0, 0.0, 65.0, 65, 65, 65.0, 65.0, 65.0, 65.0, 15.384615384615385, 23.978365384615383, 6.3251201923076925], "isController": false}, {"data": ["01 Login (config gate; captcha disabled)", 1, 0, 0.0, 728.0, 728, 728, 728.0, 728.0, 728.0, 728.0, 1.3736263736263736, 157.7859396462912, 2.8438358516483517], "isController": true}, {"data": ["0107 POST security/login-1", 1, 0, 0.0, 215.0, 215, 215, 215.0, 215.0, 215.0, 215.0, 4.651162790697675, 109.02979651162791, 1.0356104651162792], "isController": false}, {"data": ["0103 POST index (preAction=login)", 1, 0, 0.0, 76.0, 76, 76, 76.0, 76.0, 76.0, 76.0, 13.157894736842104, 422.2733347039474, 5.178351151315789], "isController": false}, {"data": ["0102 POST checkResult (browser config gate)", 1, 0, 0.0, 78.0, 78, 78, 78.0, 78.0, 78.0, 78.0, 12.82051282051282, 101.04917868589743, 8.97686298076923], "isController": false}, {"data": ["0301 GET 001s1", 1, 0, 0.0, 88.0, 88, 88, 88.0, 88.0, 88.0, 88.0, 11.363636363636363, 258.87784090909093, 2.5967684659090913], "isController": false}, {"data": ["0401 POST bUpload_x", 2, 0, 0.0, 884.0, 801, 967, 884.0, 967.0, 967.0, 967.0, 1.1001100110011, 1.8188342271727171, 32240.709227172716], "isController": false}, {"data": ["0302 POST 001s1 accept terms", 1, 0, 0.0, 128.0, 128, 128, 128.0, 128.0, 128.0, 128.0, 7.8125, 188.97247314453125, 4.99725341796875], "isController": false}, {"data": ["0101 GET index", 1, 0, 0.0, 250.0, 250, 250, 250.0, 250.0, 250.0, 250.0, 4.0, 128.37890625, 0.51171875], "isController": false}, {"data": ["03 Wizard 001s1 Terms", 1, 0, 0.0, 216.0, 216, 216, 216.0, 216.0, 216.0, 216.0, 4.62962962962963, 217.45243778935185, 4.01927806712963], "isController": true}, {"data": ["0202 POST 001s0 Next", 1, 0, 0.0, 93.0, 93, 93, 93.0, 93.0, 93.0, 93.0, 10.752688172043012, 261.78175403225805, 6.457913306451613], "isController": false}, {"data": ["04 Upload transaction data (x N)", 1, 0, 0.0, 1768.0, 1768, 1768, 1768.0, 1768.0, 1768.0, 1768.0, 0.5656108597285069, 1.870271846719457, 33152.49399038462], "isController": true}, {"data": ["05 Verify upload list (no persistence)", 1, 0, 0.0, 123.0, 123, 123, 123.0, 123.0, 123.0, 123.0, 8.130081300813009, 183.935149898374, 1.8578506097560976], "isController": true}, {"data": ["00 Pre-flight", 1, 0, 0.0, 632.0, 632, 632, 632.0, 632.0, 632.0, 632.0, 1.5822784810126582, 0.020087519778481014, 0.0], "isController": false}, {"data": ["0104 GET security/login (load login form)", 1, 0, 0.0, 42.0, 42, 42, 42.0, 42.0, 42.0, 42.0, 23.809523809523807, 423.7816220238095, 5.1153273809523805], "isController": false}, {"data": ["99 Run summary", 1, 0, 0.0, 18.0, 18, 18, 18.0, 18.0, 18.0, 18.0, 55.55555555555555, 1.0850694444444444, 0.0], "isController": false}, {"data": ["0201 GET 001s0", 1, 0, 0.0, 76.0, 76, 76, 76.0, 76.0, 76.0, 76.0, 13.157894736842104, 253.53361430921052, 3.006784539473684], "isController": false}, {"data": ["0302 POST 001s1 accept terms-1", 1, 0, 0.0, 73.0, 73, 73, 73.0, 73.0, 73.0, 73.0, 13.698630136986301, 309.9181292808219, 3.1303510273972606], "isController": false}, {"data": ["0107 POST security/login", 1, 0, 0.0, 282.0, 282, 282, 282.0, 282.0, 282.0, 282.0, 3.5460992907801416, 88.65248226950355, 2.247478945035461], "isController": false}, {"data": ["0302 POST 001s1 accept terms-0", 1, 0, 0.0, 54.0, 54, 54, 54.0, 54.0, 54.0, 54.0, 18.51851851851852, 28.971354166666668, 7.613570601851852], "isController": false}, {"data": ["0202 POST 001s0 Next-0", 1, 0, 0.0, 30.0, 30, 30, 30.0, 30.0, 30.0, 30.0, 33.333333333333336, 52.1484375, 12.40234375], "isController": false}, {"data": ["02 Wizard 001s0 Overview", 1, 0, 0.0, 169.0, 169, 169, 169.0, 169.0, 169.0, 169.0, 5.9171597633136095, 258.07253143491124, 4.905926405325443], "isController": true}, {"data": ["0202 POST 001s0 Next-1", 1, 0, 0.0, 63.0, 63, 63, 63.0, 63.0, 63.0, 63.0, 15.873015873015872, 361.60714285714283, 3.627232142857143], "isController": false}, {"data": ["0501 GET 001s2 reload", 1, 0, 0.0, 123.0, 123, 123, 123.0, 123.0, 123.0, 123.0, 8.130081300813009, 183.935149898374, 1.8578506097560976], "isController": false}]}, function(index, item){
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

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

    var data = {"OkPercent": 86.20689655172414, "KoPercent": 13.793103448275861};
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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.8235294117647058, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.0, 500, 1500, "0604 GET 001s3 (verify)"], "isController": false}, {"data": [0.5, 500, 1500, "01 Login (config gate; captcha disabled)"], "isController": true}, {"data": [1.0, 500, 1500, "0103 POST index (preAction=login)"], "isController": false}, {"data": [1.0, 500, 1500, "0102 POST checkResult (browser config gate)"], "isController": false}, {"data": [1.0, 500, 1500, "0301 GET 001s1"], "isController": false}, {"data": [1.0, 500, 1500, "03 Wizard 001s1 Terms"], "isController": true}, {"data": [1.0, 500, 1500, "0602 POST 001s3 Back-1"], "isController": false}, {"data": [1.0, 500, 1500, "99 Run summary"], "isController": false}, {"data": [1.0, 500, 1500, "0602 POST 001s3 Back-0"], "isController": false}, {"data": [1.0, 500, 1500, "0107 POST security/login"], "isController": false}, {"data": [1.0, 500, 1500, "0600 WARN persist mode"], "isController": false}, {"data": [1.0, 500, 1500, "0107 POST security/login-0"], "isController": false}, {"data": [1.0, 500, 1500, "0107 POST security/login-1"], "isController": false}, {"data": [0.0, 500, 1500, "0601 POST 001s2 Next (persist rows)"], "isController": false}, {"data": [1.0, 500, 1500, "0602 POST 001s3 Back"], "isController": false}, {"data": [0.0, 500, 1500, "0401 POST bUpload_x"], "isController": false}, {"data": [1.0, 500, 1500, "0302 POST 001s1 accept terms"], "isController": false}, {"data": [1.0, 500, 1500, "0101 GET index"], "isController": false}, {"data": [1.0, 500, 1500, "0604 GET 001s3 (verify)-1"], "isController": false}, {"data": [1.0, 500, 1500, "0604 GET 001s3 (verify)-0"], "isController": false}, {"data": [1.0, 500, 1500, "0603 POST 001s2 Empty All (TR1_count=0)"], "isController": false}, {"data": [1.0, 500, 1500, "0202 POST 001s0 Next"], "isController": false}, {"data": [0.0, 500, 1500, "04 Upload transaction data (x N)"], "isController": true}, {"data": [1.0, 500, 1500, "05 Verify upload list (no persistence)"], "isController": true}, {"data": [0.5, 500, 1500, "00 Pre-flight"], "isController": false}, {"data": [1.0, 500, 1500, "0104 GET security/login (load login form)"], "isController": false}, {"data": [1.0, 500, 1500, "0201 GET 001s0"], "isController": false}, {"data": [1.0, 500, 1500, "0302 POST 001s1 accept terms-1"], "isController": false}, {"data": [1.0, 500, 1500, "0302 POST 001s1 accept terms-0"], "isController": false}, {"data": [1.0, 500, 1500, "0202 POST 001s0 Next-0"], "isController": false}, {"data": [1.0, 500, 1500, "02 Wizard 001s0 Overview"], "isController": true}, {"data": [1.0, 500, 1500, "0202 POST 001s0 Next-1"], "isController": false}, {"data": [1.0, 500, 1500, "0501 GET 001s2 reload"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 29, 4, 13.793103448275861, 113.75862068965517, 7, 530, 65.0, 406.0, 477.5, 530.0, 9.586776859504132, 147.8441373966942, 19379.367252066117], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["0604 GET 001s3 (verify)", 1, 1, 100.0, 88.0, 88, 88, 88.0, 88.0, 88.0, 88.0, 11.363636363636363, 274.86905184659093, 5.1935369318181825], "isController": false}, {"data": ["01 Login (config gate; captcha disabled)", 1, 0, 0.0, 580.0, 580, 580, 580.0, 580.0, 580.0, 580.0, 1.7241379310344827, 198.05024245689657, 3.5728717672413794], "isController": true}, {"data": ["0103 POST index (preAction=login)", 1, 0, 0.0, 51.0, 51, 51, 51.0, 51.0, 51.0, 51.0, 19.607843137254903, 629.2700674019608, 7.7167585784313735], "isController": false}, {"data": ["0102 POST checkResult (browser config gate)", 1, 0, 0.0, 51.0, 51, 51, 51.0, 51.0, 51.0, 51.0, 19.607843137254903, 154.54580269607845, 13.729319852941178], "isController": false}, {"data": ["0301 GET 001s1", 1, 0, 0.0, 65.0, 65, 65, 65.0, 65.0, 65.0, 65.0, 15.384615384615385, 350.4807692307692, 3.515625], "isController": false}, {"data": ["03 Wizard 001s1 Terms", 1, 0, 0.0, 167.0, 167, 167, 167.0, 167.0, 167.0, 167.0, 5.9880239520958085, 281.2558476796407, 5.198587200598802], "isController": true}, {"data": ["0602 POST 001s3 Back-1", 1, 0, 0.0, 63.0, 63, 63, 63.0, 63.0, 63.0, 63.0, 15.873015873015872, 359.1114831349206, 3.627232142857143], "isController": false}, {"data": ["99 Run summary", 1, 0, 0.0, 10.0, 10, 10, 10.0, 10.0, 10.0, 10.0, 100.0, 1.953125, 0.0], "isController": false}, {"data": ["0602 POST 001s3 Back-0", 1, 0, 0.0, 7.0, 7, 7, 7.0, 7.0, 7.0, 7.0, 142.85714285714286, 223.49330357142856, 54.54799107142857], "isController": false}, {"data": ["0107 POST security/login", 1, 0, 0.0, 208.0, 208, 208, 208.0, 208.0, 208.0, 208.0, 4.807692307692308, 120.1923076923077, 3.056452824519231], "isController": false}, {"data": ["0600 WARN persist mode", 1, 0, 0.0, 11.0, 11, 11, 11.0, 11.0, 11.0, 11.0, 90.9090909090909, 1.7755681818181819, 0.0], "isController": false}, {"data": ["0107 POST security/login-0", 1, 0, 0.0, 51.0, 51, 51, 51.0, 51.0, 51.0, 51.0, 19.607843137254903, 30.560661764705884, 8.099724264705882], "isController": false}, {"data": ["0107 POST security/login-1", 1, 0, 0.0, 156.0, 156, 156, 156.0, 156.0, 156.0, 156.0, 6.41025641025641, 150.26542467948718, 1.4272836538461537], "isController": false}, {"data": ["0601 POST 001s2 Next (persist rows)", 1, 1, 100.0, 111.0, 111, 111, 111.0, 111.0, 111.0, 111.0, 9.00900900900901, 204.88457207207207, 5.2699183558558556], "isController": false}, {"data": ["0602 POST 001s3 Back", 1, 0, 0.0, 71.0, 71, 71, 71.0, 71.0, 71.0, 71.0, 14.084507042253522, 340.6827684859155, 8.596500880281692], "isController": false}, {"data": ["0401 POST bUpload_x", 2, 2, 100.0, 415.5, 406, 425, 415.5, 425.0, 425.0, 425.0, 2.280501710376283, 3.9251799458380843, 66834.21710198118], "isController": false}, {"data": ["0302 POST 001s1 accept terms", 1, 0, 0.0, 102.0, 102, 102, 102.0, 102.0, 102.0, 102.0, 9.803921568627452, 237.14192708333334, 6.271063112745098], "isController": false}, {"data": ["0101 GET index", 1, 0, 0.0, 240.0, 240, 240, 240.0, 240.0, 240.0, 240.0, 4.166666666666667, 133.72802734375, 0.5330403645833334], "isController": false}, {"data": ["0604 GET 001s3 (verify)-1", 1, 0, 0.0, 61.0, 61, 61, 61.0, 61.0, 61.0, 61.0, 16.393442622950822, 370.88563012295083, 3.746157786885246], "isController": false}, {"data": ["0604 GET 001s3 (verify)-0", 1, 0, 0.0, 27.0, 27, 27, 27.0, 27.0, 27.0, 27.0, 37.03703703703704, 57.942708333333336, 8.463541666666666], "isController": false}, {"data": ["0603 POST 001s2 Empty All (TR1_count=0)", 1, 0, 0.0, 78.0, 78, 78, 78.0, 78.0, 78.0, 78.0, 12.82051282051282, 290.08914262820514, 4.920372596153846], "isController": false}, {"data": ["0202 POST 001s0 Next", 1, 0, 0.0, 121.0, 121, 121, 121.0, 121.0, 121.0, 121.0, 8.264462809917356, 201.20415805785126, 4.9635201446281], "isController": false}, {"data": ["04 Upload transaction data (x N)", 1, 1, 100.0, 831.0, 831, 831, 831.0, 831.0, 831.0, 831.0, 1.203369434416366, 4.142458258122744, 70533.82478753009], "isController": true}, {"data": ["05 Verify upload list (no persistence)", 1, 0, 0.0, 52.0, 52, 52, 52.0, 52.0, 52.0, 52.0, 19.230769230769234, 435.07737379807696, 4.39453125], "isController": true}, {"data": ["00 Pre-flight", 1, 0, 0.0, 530.0, 530, 530, 530.0, 530.0, 530.0, 530.0, 1.8867924528301887, 0.023953419811320754, 0.0], "isController": false}, {"data": ["0104 GET security/login (load login form)", 1, 0, 0.0, 30.0, 30, 30, 30.0, 30.0, 30.0, 30.0, 33.333333333333336, 593.3268229166667, 7.161458333333334], "isController": false}, {"data": ["0201 GET 001s0", 1, 0, 0.0, 61.0, 61, 61, 61.0, 61.0, 61.0, 61.0, 16.393442622950822, 315.8779456967213, 3.746157786885246], "isController": false}, {"data": ["0302 POST 001s1 accept terms-1", 1, 0, 0.0, 69.0, 69, 69, 69.0, 69.0, 69.0, 69.0, 14.492753623188406, 327.8843976449275, 3.3118206521739126], "isController": false}, {"data": ["0302 POST 001s1 accept terms-0", 1, 0, 0.0, 33.0, 33, 33, 33.0, 33.0, 33.0, 33.0, 30.303030303030305, 47.40767045454545, 12.458570075757574], "isController": false}, {"data": ["0202 POST 001s0 Next-0", 1, 0, 0.0, 53.0, 53, 53, 53.0, 53.0, 53.0, 53.0, 18.867924528301884, 29.51798349056604, 7.020194575471698], "isController": false}, {"data": ["02 Wizard 001s0 Overview", 1, 0, 0.0, 182.0, 182, 182, 182.0, 182.0, 182.0, 182.0, 5.4945054945054945, 239.63877918956044, 4.555503090659341], "isController": true}, {"data": ["0202 POST 001s0 Next-1", 1, 0, 0.0, 68.0, 68, 68, 68.0, 68.0, 68.0, 68.0, 14.705882352941176, 335.01838235294116, 3.3605238970588234], "isController": false}, {"data": ["0501 GET 001s2 reload", 1, 0, 0.0, 52.0, 52, 52, 52.0, 52.0, 52.0, 52.0, 19.230769230769234, 435.07737379807696, 4.39453125], "isController": false}]}, function(index, item){
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
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": [{"data": ["001s3 not reachable after the persist run", 1, 25.0, 3.4482758620689653], "isController": false}, {"data": ["463/Unknown", 2, 50.0, 6.896551724137931], "isController": false}, {"data": ["Next with the uploaded rows did not reach 001s3", 1, 25.0, 3.4482758620689653], "isController": false}]}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 29, 4, "463/Unknown", 2, "001s3 not reachable after the persist run", 1, "Next with the uploaded rows did not reach 001s3", 1, "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": ["0604 GET 001s3 (verify)", 1, 1, "001s3 not reachable after the persist run", 1, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": ["0601 POST 001s2 Next (persist rows)", 1, 1, "Next with the uploaded rows did not reach 001s3", 1, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": ["0401 POST bUpload_x", 2, 2, "463/Unknown", 2, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});

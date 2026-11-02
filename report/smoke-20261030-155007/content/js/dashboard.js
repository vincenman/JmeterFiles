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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.875, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.0, 500, 1500, "0604 GET 001s3 (verify)"], "isController": false}, {"data": [0.5, 500, 1500, "01 Login (config gate; captcha disabled)"], "isController": true}, {"data": [1.0, 500, 1500, "0103 POST index (preAction=login)"], "isController": false}, {"data": [1.0, 500, 1500, "0102 POST checkResult (browser config gate)"], "isController": false}, {"data": [1.0, 500, 1500, "0301 GET 001s1"], "isController": false}, {"data": [1.0, 500, 1500, "03 Wizard 001s1 Terms"], "isController": true}, {"data": [1.0, 500, 1500, "0602 POST 001s3 Back-1"], "isController": false}, {"data": [1.0, 500, 1500, "99 Run summary"], "isController": false}, {"data": [1.0, 500, 1500, "0602 POST 001s3 Back-0"], "isController": false}, {"data": [1.0, 500, 1500, "0107 POST security/login"], "isController": false}, {"data": [1.0, 500, 1500, "0600 WARN persist mode"], "isController": false}, {"data": [1.0, 500, 1500, "0107 POST security/login-0"], "isController": false}, {"data": [1.0, 500, 1500, "0107 POST security/login-1"], "isController": false}, {"data": [0.0, 500, 1500, "0601 POST 001s2 Next (persist rows)"], "isController": false}, {"data": [1.0, 500, 1500, "0602 POST 001s3 Back"], "isController": false}, {"data": [1.0, 500, 1500, "0401 POST bUpload_x"], "isController": false}, {"data": [1.0, 500, 1500, "0302 POST 001s1 accept terms"], "isController": false}, {"data": [1.0, 500, 1500, "0101 GET index"], "isController": false}, {"data": [1.0, 500, 1500, "0604 GET 001s3 (verify)-1"], "isController": false}, {"data": [0.0, 500, 1500, "0601 POST 001s2 Next (persist rows)-0"], "isController": false}, {"data": [1.0, 500, 1500, "0604 GET 001s3 (verify)-0"], "isController": false}, {"data": [1.0, 500, 1500, "0601 POST 001s2 Next (persist rows)-1"], "isController": false}, {"data": [1.0, 500, 1500, "0603 POST 001s2 Empty All (TR1_count=0)"], "isController": false}, {"data": [1.0, 500, 1500, "0202 POST 001s0 Next"], "isController": false}, {"data": [0.5, 500, 1500, "04 Upload transaction data (x N)"], "isController": true}, {"data": [1.0, 500, 1500, "05 Verify upload list (no persistence)"], "isController": true}, {"data": [0.5, 500, 1500, "00 Pre-flight"], "isController": false}, {"data": [1.0, 500, 1500, "0104 GET security/login (load login form)"], "isController": false}, {"data": [1.0, 500, 1500, "0201 GET 001s0"], "isController": false}, {"data": [1.0, 500, 1500, "0302 POST 001s1 accept terms-1"], "isController": false}, {"data": [1.0, 500, 1500, "0302 POST 001s1 accept terms-0"], "isController": false}, {"data": [1.0, 500, 1500, "0202 POST 001s0 Next-0"], "isController": false}, {"data": [1.0, 500, 1500, "02 Wizard 001s0 Overview"], "isController": true}, {"data": [1.0, 500, 1500, "0202 POST 001s0 Next-1"], "isController": false}, {"data": [1.0, 500, 1500, "0501 GET 001s2 reload"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 31, 1, 3.225806451612903, 250.54838709677423, 7, 2196, 64.0, 622.4000000000001, 2160.0, 2196.0, 5.616959594129371, 85.48558106088059, 10622.15931611252], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["0604 GET 001s3 (verify)", 1, 1, 100.0, 74.0, 74, 74, 74.0, 74.0, 74.0, 74.0, 13.513513513513514, 326.87130489864865, 6.176097972972974], "isController": false}, {"data": ["01 Login (config gate; captcha disabled)", 1, 0, 0.0, 605.0, 605, 605, 605.0, 605.0, 605.0, 605.0, 1.6528925619834711, 189.8663481404959, 3.425232438016529], "isController": true}, {"data": ["0103 POST index (preAction=login)", 1, 0, 0.0, 52.0, 52, 52, 52.0, 52.0, 52.0, 52.0, 19.230769230769234, 617.1687199519231, 7.568359375], "isController": false}, {"data": ["0102 POST checkResult (browser config gate)", 1, 0, 0.0, 54.0, 54, 54, 54.0, 54.0, 54.0, 54.0, 18.51851851851852, 145.95992476851853, 12.96657986111111], "isController": false}, {"data": ["0301 GET 001s1", 1, 0, 0.0, 67.0, 67, 67, 67.0, 67.0, 67.0, 67.0, 14.925373134328359, 340.01865671641787, 3.4106809701492535], "isController": false}, {"data": ["03 Wizard 001s1 Terms", 1, 0, 0.0, 194.0, 194, 194, 194.0, 194.0, 194.0, 194.0, 5.154639175257732, 242.04655283505153, 4.475072487113402], "isController": true}, {"data": ["0602 POST 001s3 Back-1", 1, 0, 0.0, 57.0, 57, 57, 57.0, 57.0, 57.0, 57.0, 17.543859649122805, 396.9126918859649, 4.009046052631579], "isController": false}, {"data": ["99 Run summary", 1, 0, 0.0, 12.0, 12, 12, 12.0, 12.0, 12.0, 12.0, 83.33333333333333, 1.6276041666666667, 0.0], "isController": false}, {"data": ["0602 POST 001s3 Back-0", 1, 0, 0.0, 7.0, 7, 7, 7.0, 7.0, 7.0, 7.0, 142.85714285714286, 223.49330357142856, 54.54799107142857], "isController": false}, {"data": ["0107 POST security/login", 1, 0, 0.0, 207.0, 207, 207, 207.0, 207.0, 207.0, 207.0, 4.830917874396135, 120.77294685990339, 3.0712182971014492], "isController": false}, {"data": ["0600 WARN persist mode", 1, 0, 0.0, 11.0, 11, 11, 11.0, 11.0, 11.0, 11.0, 90.9090909090909, 1.7755681818181819, 0.0], "isController": false}, {"data": ["0107 POST security/login-0", 1, 0, 0.0, 45.0, 45, 45, 45.0, 45.0, 45.0, 45.0, 22.22222222222222, 34.63541666666667, 9.1796875], "isController": false}, {"data": ["0107 POST security/login-1", 1, 0, 0.0, 157.0, 157, 157, 157.0, 157.0, 157.0, 157.0, 6.369426751592357, 149.30832006369425, 1.4181926751592357], "isController": false}, {"data": ["0601 POST 001s2 Next (persist rows)", 1, 0, 0.0, 2196.0, 2196, 2196, 2196.0, 2196.0, 2196.0, 2196.0, 0.4553734061930783, 10.811116091757741, 0.3922259221311475], "isController": false}, {"data": ["0602 POST 001s3 Back", 1, 0, 0.0, 64.0, 64, 64, 64.0, 64.0, 64.0, 64.0, 15.625, 377.9449462890625, 9.5367431640625], "isController": false}, {"data": ["0401 POST bUpload_x", 2, 0, 0.0, 433.0, 370, 496, 433.0, 496.0, 496.0, 496.0, 2.092050209205021, 3.458829105648536, 61311.27827536611], "isController": false}, {"data": ["0302 POST 001s1 accept terms", 1, 0, 0.0, 126.0, 126, 126, 126.0, 126.0, 126.0, 126.0, 7.936507936507936, 191.87127976190476, 5.076574900793651], "isController": false}, {"data": ["0101 GET index", 1, 0, 0.0, 245.0, 245, 245, 245.0, 245.0, 245.0, 245.0, 4.081632653061225, 130.99888392857144, 0.5221619897959183], "isController": false}, {"data": ["0604 GET 001s3 (verify)-1", 1, 0, 0.0, 55.0, 55, 55, 55.0, 55.0, 55.0, 55.0, 18.18181818181818, 411.3458806818182, 4.154829545454546], "isController": false}, {"data": ["0601 POST 001s2 Next (persist rows)-0", 1, 0, 0.0, 2136.0, 2136, 2136, 2136.0, 2136.0, 2136.0, 2136.0, 0.4681647940074906, 0.732421875, 0.2738581168071161], "isController": false}, {"data": ["0604 GET 001s3 (verify)-0", 1, 0, 0.0, 18.0, 18, 18, 18.0, 18.0, 18.0, 18.0, 55.55555555555555, 86.9140625, 12.695312500000002], "isController": false}, {"data": ["0601 POST 001s2 Next (persist rows)-1", 1, 0, 0.0, 59.0, 59, 59, 59.0, 59.0, 59.0, 59.0, 16.949152542372882, 375.8772510593221, 4.684189618644068], "isController": false}, {"data": ["0603 POST 001s2 Empty All (TR1_count=0)", 1, 0, 0.0, 55.0, 55, 55, 55.0, 55.0, 55.0, 55.0, 18.18181818181818, 411.39914772727275, 6.977982954545454], "isController": false}, {"data": ["0202 POST 001s0 Next", 1, 0, 0.0, 126.0, 126, 126, 126.0, 126.0, 126.0, 126.0, 7.936507936507936, 193.21986607142858, 4.766555059523809], "isController": false}, {"data": ["04 Upload transaction data (x N)", 1, 0, 0.0, 866.0, 866, 866, 866.0, 866.0, 866.0, 866.0, 1.1547344110854503, 3.8182917147806004, 67683.1201284642], "isController": true}, {"data": ["05 Verify upload list (no persistence)", 1, 0, 0.0, 60.0, 60, 60, 60.0, 60.0, 60.0, 60.0, 16.666666666666668, 376.85546875, 3.80859375], "isController": true}, {"data": ["00 Pre-flight", 1, 0, 0.0, 654.0, 654, 654, 654.0, 654.0, 654.0, 654.0, 1.529051987767584, 0.019411792813455658, 0.0], "isController": false}, {"data": ["0104 GET security/login (load login form)", 1, 0, 0.0, 47.0, 47, 47, 47.0, 47.0, 47.0, 47.0, 21.27659574468085, 378.7192486702128, 4.571143617021277], "isController": false}, {"data": ["0201 GET 001s0", 1, 0, 0.0, 67.0, 67, 67, 67.0, 67.0, 67.0, 67.0, 14.925373134328359, 287.59036847014926, 3.4106809701492535], "isController": false}, {"data": ["0302 POST 001s1 accept terms-1", 1, 0, 0.0, 87.0, 87, 87, 87.0, 87.0, 87.0, 87.0, 11.494252873563218, 259.9003232758621, 2.626616379310345], "isController": false}, {"data": ["0302 POST 001s1 accept terms-0", 1, 0, 0.0, 37.0, 37, 37, 37.0, 37.0, 37.0, 37.0, 27.027027027027028, 42.282516891891895, 11.111697635135135], "isController": false}, {"data": ["0202 POST 001s0 Next-0", 1, 0, 0.0, 45.0, 45, 45, 45.0, 45.0, 45.0, 45.0, 22.22222222222222, 34.765625, 8.268229166666668], "isController": false}, {"data": ["02 Wizard 001s0 Overview", 1, 0, 0.0, 193.0, 193, 193, 193.0, 193.0, 193.0, 193.0, 5.181347150259067, 225.98061042746113, 4.295863018134715], "isController": true}, {"data": ["0202 POST 001s0 Next-1", 1, 0, 0.0, 81.0, 81, 81, 81.0, 81.0, 81.0, 81.0, 12.345679012345679, 281.25, 2.8211805555555554], "isController": false}, {"data": ["0501 GET 001s2 reload", 1, 0, 0.0, 60.0, 60, 60, 60.0, 60.0, 60.0, 60.0, 16.666666666666668, 376.85546875, 3.80859375], "isController": false}]}, function(index, item){
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

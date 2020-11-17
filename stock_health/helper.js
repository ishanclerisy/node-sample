"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var axios_1 = require("axios");
var moment = require("moment");
var ARGS = process.argv;
var noOfDays = 8;
if (ARGS.length > 0) {
    if (ARGS[ARGS.length - 2] && ARGS[ARGS.length - 2] === "-n" && ARGS[ARGS.length - 1]) {
        noOfDays = parseInt(ARGS[ARGS.length - 1], 10);
    }
}
var LANG = "en";
exports.METADATA_URL = "https://metadata.jibla.io/metadata/universe/country-equities/Kuwait";
exports.PAGES_URL = "https://kuwait.jibla.io/pages";
exports.ERROR_MSG = "There is some problem with this endpoint. Please try again later";
exports.START_DATE = moment().subtract(noOfDays, 'days').format('YYYY-MM-DD');
exports.END_DATE = moment().format('YYYY-MM-DD');
exports.MONTHS = {
    "يناير": "January",
    "فبراير": "February",
    "مارس": 'March',
    "أبريل": "April",
    "مايو": "May",
    "يونيو": "June",
    "يوليو": "July",
    "أغسطس": "August",
    "سبتمبر": "September",
    "أكتوبر": "October",
    "نوفمبر": "November",
    "ديسمبر": "December"
};
exports.MERIDIEM = {
    "ص": "PM",
    "م": "AM"
};
exports.STOCK_URL = [
    {
        key: "stockAnnouncements",
        url: exports.PAGES_URL + "/stock-announcements/" + LANG + "?startDate=" + exports.START_DATE + "&toDate=" + exports.END_DATE + "&symbol=",
        marketSymbol: ""
    },
    {
        key: "equityHistoricalPrices",
        url: exports.PAGES_URL + "/equity-historical-prices?startDate=" + exports.START_DATE + "&toDate=" + exports.END_DATE + "&symbol=",
        marketSymbol: ""
    },
    {
        key: "sectorsHistoricalPrices",
        url: exports.PAGES_URL + "/sectors-historical-prices?symbol=",
        marketSymbol: ""
    },
    {
        key: "financials",
        url: exports.PAGES_URL + "/financials/",
        marketSymbol: ""
    }
];
/**
 *
 * Process to verify the health
 * of equilty and sector records.
 *
 */
function verifyEquityAndSectorsHistoricalPrices(item) {
    return __awaiter(this, void 0, void 0, function () {
        var STOCKS_URL, status, result, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    STOCKS_URL = item.url + item.marketSymbol;
                    status = "Not Updated";
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, axios_1["default"](STOCKS_URL)];
                case 2:
                    result = _a.sent();
                    if (result.data.length) {
                        result.data.reverse();
                        result.data.some(function (x) {
                            if (x.date && (moment(x.date, 'DD/MM/YYYY').isAfter(moment(exports.START_DATE, 'YYYY-MM-DD')))) {
                                status = "Updated";
                            }
                        });
                    }
                    else {
                        status = "No data found.";
                    }
                    return [2 /*return*/, status];
                case 3:
                    e_1 = _a.sent();
                    status = exports.ERROR_MSG;
                    return [2 /*return*/, status];
                case 4: return [2 /*return*/];
            }
        });
    });
}
exports.verifyEquityAndSectorsHistoricalPrices = verifyEquityAndSectorsHistoricalPrices;
/**
 *
 * Process to verify the health
 * of financial records.
 *
 */
function verifyFinancials(item) {
    return __awaiter(this, void 0, void 0, function () {
        var STOCKS_URL, status, result, e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    STOCKS_URL = item.url + item.marketSymbol;
                    status = "Not Updated";
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, axios_1["default"](STOCKS_URL)];
                case 2:
                    result = _a.sent();
                    if (result.data.length) {
                        result.data.reverse();
                        result.data.some(function (equity) {
                            if (equity.period.year && (moment(equity.period.year, 'YYYY').isAfter(moment(exports.START_DATE, 'YYYY').subtract(3, 'years')))) {
                                status = "Updated";
                            }
                        });
                    }
                    else {
                        status = "No data found.";
                    }
                    return [2 /*return*/, status];
                case 3:
                    e_2 = _a.sent();
                    status = exports.ERROR_MSG;
                    return [2 /*return*/, status];
                case 4: return [2 /*return*/];
            }
        });
    });
}
exports.verifyFinancials = verifyFinancials;
/**
 *
 * Process to verify the health
 * of stock announcement records.
 *
 */
function verifyStockAnnouncements(item) {
    return __awaiter(this, void 0, void 0, function () {
        var STOCKS_URL, status, result, e_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    STOCKS_URL = item.url + item.marketSymbol;
                    status = "Not Updated";
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, axios_1["default"](STOCKS_URL)];
                case 2:
                    result = _a.sent();
                    if (result.data.length) {
                        result.data.reverse();
                        result.data.some(function (stock) {
                            var STOCK_DATE = getFormattedDate(stock.date);
                            if (STOCK_DATE && (moment(STOCK_DATE, 'DD MMMM, YYYY / hh:mm A').isAfter(moment(exports.START_DATE, 'YYYY-MM-DD')))) {
                                status = "Updated";
                            }
                        });
                    }
                    else {
                        status = "No data found.";
                    }
                    return [2 /*return*/, status];
                case 3:
                    e_3 = _a.sent();
                    status = exports.ERROR_MSG;
                    return [2 /*return*/, status];
                case 4: return [2 /*return*/];
            }
        });
    });
}
exports.verifyStockAnnouncements = verifyStockAnnouncements;
/**
 *
 * To verify date format in arabic.
 *
 */
function getFormattedDate(date) {
    var ARR = date.split(" ");
    var MONTHS_KEY = ARR[1].replace(",", "");
    var TIME_KEY = ARR[5];
    var formattedDate = date.replace(MONTHS_KEY, exports.MONTHS[MONTHS_KEY]);
    formattedDate = formattedDate.replace(TIME_KEY, exports.MERIDIEM[TIME_KEY]);
    return formattedDate;
}

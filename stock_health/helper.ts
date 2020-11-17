import axios from 'axios'
import * as moment from 'moment'

const ARGS = process.argv
let noOfDays = 8
if (ARGS.length > 0) {
  if (ARGS[ARGS.length - 2] && ARGS[ARGS.length - 2] === "-n" && ARGS[ARGS.length - 1]) {
    noOfDays = parseInt(ARGS[ARGS.length - 1], 10)
  }
}

const LANG = "en"
export const METADATA_URL = "https://metadata.jibla.io/metadata/universe/country-equities/Kuwait"
export const PAGES_URL = "https://kuwait.jibla.io/pages"
export const ERROR_MSG = "There is some problem with this endpoint. Please try again later"
export const START_DATE = moment().subtract(noOfDays, 'days').format('YYYY-MM-DD')
export const END_DATE = moment().format('YYYY-MM-DD')

export const MONTHS = {
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
}
export const MERIDIEM = {
  "ص": "PM",
  "م": "AM"
}

export const STOCK_URL = [
  {
    key: "stockAnnouncements",
    url: `${PAGES_URL}/stock-announcements/${LANG}?startDate=${START_DATE}&toDate=${END_DATE}&symbol=`,
    marketSymbol:""
  },
  {
    key: "equityHistoricalPrices",
    url: `${PAGES_URL}/equity-historical-prices?startDate=${START_DATE}&toDate=${END_DATE}&symbol=`,
    marketSymbol:""
  },
  {
    key: "sectorsHistoricalPrices",
    url: `${PAGES_URL}/sectors-historical-prices?symbol=`,
    marketSymbol:""
  },
  {
    key: "financials",
    url: `${PAGES_URL}/financials/`,
    marketSymbol:""
  }
]

/**
 * 
 * Process to verify the health 
 * of equilty and sector records.
 * 
 */
export async function verifyEquityAndSectorsHistoricalPrices(item) {
  const STOCKS_URL=item.url+item.marketSymbol
  let status = "Not Updated"
  try {
    const result = await axios(STOCKS_URL)
    if (result.data.length) {
      result.data.reverse()
      result.data.some(x => {
        if (x.date && (moment(x.date, 'DD/MM/YYYY').isAfter(moment(START_DATE, 'YYYY-MM-DD')))) {
          status = "Updated"
        }
      })
    } else {
      status = "No data found."
    }
    return status
  } catch (e) {
    status = ERROR_MSG
    return status
  }
}

/**
 * 
 * Process to verify the health 
 * of financial records.
 * 
 */
export async function verifyFinancials(item) {
  const STOCKS_URL=item.url+item.marketSymbol
  let status = "Not Updated"
  try {
    const result = await axios(STOCKS_URL)
    if (result.data.length) {
      result.data.reverse()
      result.data.some(equity => {
        if (equity.period.year && (moment(equity.period.year, 'YYYY').isAfter(moment(START_DATE, 'YYYY').subtract(3, 'years')))) {
          status = "Updated"
        }
      })
    } else {
      status = "No data found."
    }
    return status
  } catch (e) {
    status = ERROR_MSG
    return status
  }
}

/**
 * 
 * Process to verify the health 
 * of stock announcement records.
 * 
 */
export async function verifyStockAnnouncements(item) {
  const STOCKS_URL=item.url+item.marketSymbol
  let status = "Not Updated"
  try {
    const result = await axios(STOCKS_URL)

    if (result.data.length) {
      result.data.reverse()
      result.data.some(stock => {
        const STOCK_DATE = getFormattedDate(stock.date)
        if (STOCK_DATE && (moment(STOCK_DATE, 'DD MMMM, YYYY / hh:mm A').isAfter(moment(START_DATE, 'YYYY-MM-DD')))) {
          status = "Updated"
        }
      })
    } else {
      status = "No data found."
    }
    return status
  } catch (e) {
    status = ERROR_MSG
    return status
  }
}

/**
 * 
 * To verify date format in arabic.
 * 
 */
function getFormattedDate(date) {
  const ARR = date.split(" ")
  const MONTHS_KEY = ARR[1].replace(",", "")
  const TIME_KEY = ARR[5]

  let formattedDate = date.replace(MONTHS_KEY, MONTHS[MONTHS_KEY])
  formattedDate = formattedDate.replace(TIME_KEY, MERIDIEM[TIME_KEY])
  return formattedDate
}

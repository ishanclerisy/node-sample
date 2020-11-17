import * as async from 'async'
import axios from 'axios'
import * as helper from "./helper"

/**
 * Script to verify Jibla Stock Health
 * 
 * stockAnnouncements, equityHistoricalPrices,
 * sectorsHistoricalPrices, financials
 * 
 */
(async () => {
  const METADATA = await axios(helper.METADATA_URL)
  const equityMetadata = METADATA.data
  if (equityMetadata && equityMetadata.length) {
    async.eachSeries(equityMetadata, (data, outerCallback) => {
      if (data.keys && data.keys.ric) {
        const marketSymbol = data.keys.ric
        const REPORT_OBJECT = {}
        async.eachSeries(helper.STOCK_URL, async (item, innerCallback2) => {
          item.marketSymbol = marketSymbol
          switch (item.key) {
            case "sectorsHistoricalPrices":
              REPORT_OBJECT[item.key] = await helper.verifyEquityAndSectorsHistoricalPrices(item)
              if (REPORT_OBJECT[item.key] === 'Updated' || REPORT_OBJECT[item.key] === 'No data found.') {
                delete REPORT_OBJECT[item.key]
              }
              innerCallback2()
              break

            case "equityHistoricalPrices":
              REPORT_OBJECT[item.key] = await helper.verifyEquityAndSectorsHistoricalPrices(item)
              if (REPORT_OBJECT[item.key] === 'Updated' || REPORT_OBJECT[item.key] === 'No data found.') {
                delete REPORT_OBJECT[item.key]
              }
              innerCallback2()
              break

            case "financials":
              REPORT_OBJECT[item.key] = await helper.verifyFinancials(item)
              if (REPORT_OBJECT[item.key] === 'Updated' || REPORT_OBJECT[item.key] === 'No data found.') {
                delete REPORT_OBJECT[item.key]
              }
              innerCallback2()
              break

            case "stockAnnouncements":
              REPORT_OBJECT[item.key] = await helper.verifyStockAnnouncements(item)
              if (REPORT_OBJECT[item.key] === 'Updated' || REPORT_OBJECT[item.key] === 'No data found.') {
                delete REPORT_OBJECT[item.key]
              }
              innerCallback2()
              break
          }
        }, (err) => {
          if (err) {
            console.log("error while writing JSON file-------------->", err)
            throw err
          }
          const jsonData = {}
          if (Object.keys(REPORT_OBJECT).length) {
            jsonData[marketSymbol] = REPORT_OBJECT
            process.stdout.write(JSON.stringify(jsonData) + ",")
          }
          outerCallback()
        })
      }
    }, (err) => {
      if (err) {
        console.log("error while processing request-------------->", err)
        throw err
      }
    })
  } else {
    console.log("No metadata found.")
    process.exit()
  }
})()
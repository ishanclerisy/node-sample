import * as moment from 'moment'
import * as path from 'path'
import * as helper from '../utils/helper'
const oauthserver = require("oauth2-server")

const oauth = oauthserver({
  model: require('../../../expressOAUTHModel'),
  grants: ['password'],
  debug: true
})

let result
let record

/**
 * url: //domain.com/v2/me
 * @method: GET
 * @param: req
 * @param: res
 * @returns: JSON(record)
 * Desc: Used to fetch user profile
 */
export let profile = async (req, res) => {
  oauth.model.checkSubscription(req, async isActive => {
    record = {
      time: new Date(),
      username: req.user.username,
      id: req.user.id,
      email: req.user.email,
      end: moment.unix(req.user.end).format("DD/MM/YYYY"),
      active: isActive,
      clientId: req.oauth.bearerToken.clientId,
      version: req.get("App-Version"),
      bundleID: req.get("bundleID"),
      tokenExpires: req.oauth.bearerToken.expires,
      accessToken: req.oauth.bearerToken.accessToken,
      deviceID: req.get("Device-UUID"),
      expiryTimestamp: Number(req.user.end),
      blocked: req.user.blocked,
      admin: req.user.admin,
      flair: req.user.flair,
      productID: req.user.product_id
    }

    result = await helper.insertDataIntoAccessLogs(record)
    if (!result) {
      return res.status(503).send({
        error: {
          message: 'Error in inserting data to access logs collection',
          type: 'mongo_error',
        },
      })
    } else {
      result = await helper.getUserInfo('username', req.user.username)
      record = {
        username: req.user.username,
        active: (parseInt(req.user.blocked, 10) === 1) ? false : isActive,
        expiryTimestamp: Number(req.user.end),
        blocked: req.user.blocked,
        flair: req.user.flair,
        user_id: req.user.id,
        email: req.user.email,
        admin: req.user.admin,
        mod: Number(req.user.mod),
        productID: req.user.product_id,
        activeSubscriptions: await helper.getActiveSubscriptions(req.user.id),
        subscriptions: await helper.getAllSubscriptions(req.user.id)
      }
      if (result && result[0] !== undefined) {
        record.image = {
          org: process.env.JIBLA_USER_PROFILE_BASEURL + result[0].image,
          thumb: process.env.JIBLA_USER_THUMB_BASEURL + result[0].image
        }
      } else {
        record.image = ''
      }
      return res.send(record)
    }
  })
}

/**
 * url: //domain.com/v2/me/profilePicture
 * @method: POST
 * @param: req
 * @param: res
 * @returns: JSON(msg)
 * Desc: Used to upload user's profile pic
 */
export let uploadImagetoBucket = async (req, res) => {
  uploadProfilePictoBucket(req,res)
}

async function uploadProfilePictoBucket(req, res) {
  const extArray = {
    profile_pic: ['.png', '.jpg', '.jpeg', '.gif'],
    pdf_document: ['.pdf'],
    user_files_upload: ['.csv', '.docx', '.jpg', '.png', '.pdf', '.xls', '.xlsx'],
  }

  if (req.file === undefined) {
    return res.status(400).send({
      error: {
        message: 'No image found.',
        type: 'no_image_found'
      }
    })
  } else {
    if (!req.body.purpose || (req.body.purpose && req.body.purpose.trim() === '')) {
      return res.status(400).send({
        error: {
          message: 'Purpose is not defined',
          type: 'no_purpose_defined'
        }
      })
    } else if (!extArray.hasOwnProperty(req.body.purpose)) {
      return res.status(400).send({
        error: {
          message: 'Purpose is invalid. Only ' + Object.keys(extArray).join(', ') + ' purposes are acceptable',
          type: 'invalid_purpose'
        }
      })
    } else {
      record = extArray[req.body.purpose].map(el => el.slice(1))
      result = path.extname(req.file.originalname)
      if (extArray[req.body.purpose].indexOf(result) === -1) {
        helper.unlinkinvalidImageFile(req.file)
        return res.status(400).send({
          error: {
            message: 'Invalid file type. Only ' + record.join(', ') + ' are allowed',
            type: 'invalid_image_type'
          }
        })
      } else {
        result = await helper.getUserInfo('id', req.user.id)
        if(result[0].image !== '' && req.body.purpose === 'profile_pic') {
          helper.removeOldImagesFromBucket(result[0].image)
        }

        helper.uploadProfilePictoBucket(req, req.user.id).then((response) => {
          return res.send(response)
        }, (error) => {
          return res.status(500).send({
            error: {
              message: error.message ? error.message : error,
              type: 'error_uploading_file'
            }
          })
        }).catch((err) => {
          return res.status(500).send({
            error: {
              message: err.message ? err.message : err,
              type: 'error_uploading_file'
            }
          })
        })
      }
    }
  }
}

/**
 * url: //domain.com/v2/me/deleteSubscription
 * @method: GET
 * @param: req
 * @param: res
 * @returns: JSON(msg)
 * Desc: Used to delete user's subscriptions along transactions
 */
export let deleteSubscriptions = async (req, res) =>{
  if (!req.query.check || (req.query.check && req.query.check !== 'Testing')) {
    return res.status(400).send({
      error: {
        message: 'Query malformed',
        type: 'Invalid request'
      },
    })

  }
  result = await helper.deleteUsertransaction(req.user.id)
  if (!result) {
    return res.status(500).send({
      error: {
        message: 'Error in deleting the transaction data',
        type: 'mongo_error'
      },
    })
  } 
  else {
    record = await helper.deleteUserSubscriptions(req.user.id)
    if (!record) {
      return res.status(500).send({
        error: {
          message: 'Error in deleting the subscription data',
          type: 'mongo_error'
        },
      })
    }
    else{
      return res.send({
        msg: 'Deleted successfully'
      })
    }
  }
}



export let saveJiblaProducts = async (req, res) => {
  // const records = [
  //   {
  //     "name": "Delayed Feed",
  //     "code": "TADAWUL_DELAYED",
  //     "product_group_id": "TADAWUL_DELAYED",
  //     "market": "tadawul",
  //     "version": 1,
  //     "order": 0,
  //     "available": true,
  //     "summary" : "prices are 10 minutes delayed",
  //     "delay": 0,
  //     "description": "",
  //     "language" : "en",
  //     "id": 1,
  //     "includes": [],
  //     "obookDepth": null,
  //     "features": [
  //       {
  //         "title": {
  //           "ar": "الاخبار و الاعلانات",
  //           "en": "News and Announcements"
  //         },
  //         "description": {
  //           "ar": "الاخبار و الاعلانات",
  //           "en": "News and Announcements"
  //         },
  //         "id": 5,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "الأسعار التاريخية",
  //           "en": "Historical Prices"
  //         },
  //         "description": {
  //           "ar": "الأسعار التاريخية",
  //           "en": "Historical Prices"
  //         },
  //         "id": 6,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "الرسوم البيانية مع مؤشرات التحليل الفني",
  //           "en": "Stock Charts with Technical Indicators"
  //         },
  //         "description": {
  //           "ar": "الرسوم البيانية مع مؤشرات التحليل الفني",
  //           "en": "Stock Charts with Technical Indicators"
  //         },
  //         "id": 7,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "قوائم مالية مبسطة",
  //           "en": "Basic Financial Statements (last five years)"
  //         },
  //         "description": {
  //           "ar": "قوائم مالية مبسطة",
  //           "en": "Basic Financial Statements (last five years)"
  //         },
  //         "id": 8,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "تنبيهات السهم",
  //           "en": "Stock Alerts"
  //         },
  //         "description": {
  //           "ar": "تنبيهات السهم",
  //           "en": "Stock Alerts"
  //         },
  //         "id": 9,
  //         "group": "application_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "متابعة المحافظ",
  //           "en": "Portfolio Tracker"
  //         },
  //         "description": {
  //           "ar": "متابعة المحافظ",
  //           "en": "Portfolio Tracker"
  //         },
  //         "id": 10,
  //         "group": "application_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "قائمة المفضلة",
  //           "en": "Favorites List"
  //         },
  //         "description": {
  //           "ar": "قائمة المفضلة",
  //           "en": "Favorites List"
  //         },
  //         "id": 11,
  //         "group": "application_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "ملخص اليوم",
  //           "en": "Today’s Widget"
  //         },
  //         "description": {
  //           "ar": "ملخص اليوم",
  //           "en": "Today’s Widget"
  //         },
  //         "id": 12,
  //         "group": "application_features"
  //       }
  //     ],
  //     "products": [
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 5,
  //         "name": "One Month",
  //         "SKU": "TADAWUL_1MONTH_DELAYED",
  //         "duration": 31,
  //         "price": "15",
  //         "currency": "USD"
  //       },
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 6,
  //         "name": "3 Month",
  //         "SKU": "TADAWUL_3MONTH_DELAYED",
  //         "duration": 93,
  //         "price": "40",
  //         "currency": "USD"
  //       },
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 7,
  //         "name": "6 Month",
  //         "SKU": "TADAWUL_6MONTH_DELAYED",
  //         "duration": 184,
  //         "price": "70",
  //         "currency": "USD"
  //       },
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 8,
  //         "name": "1 Year",
  //         "SKU": "TADAWUL_1YEAR_DELAYED",
  //         "duration": 366,
  //         "price": "120",
  //         "currency": "USD"
  //       }
  //     ]
  //   },
  //   {
  //     "name": "Best Bid/Ask",
  //     "code": "TADAWUL_BEST_PRICE",
  //     "product_group_id": "TADAWUL_BEST_PRICE",
  //     "market": "tadawul",
  //     "version": 1,
  //     "order": 1,
  //     "available": true,
  //     "language" : "en",
  //     "summary" : "Realtime Prices with best bid/ask",
  //     "delay": 0,
  //     "description": "",
  //     "id": 2,
  //     "includes": [
  //       "TADAWUL_DELAYED"
  //     ],
  //     "obookDepth": null,
  //     "features": [
  //       {
  //         "title": {
  //           "ar": "(5x5) العروض و الطلبات لعمق ٥ اسعار بالاتجاهين",
  //           "en": "Market Depth product with 5 price levels in the orderbook (5x5)"
  //         },
  //         "description": {
  //           "ar": "(5x5) العروض و الطلبات لعمق ٥ اسعار بالاتجاهين",
  //           "en": "Market Depth product with 5 price levels in the orderbook (5x5)"
  //         },
  //         "id": 4,
  //         "group": "data_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "الاخبار و الاعلانات",
  //           "en": "News and Announcements"
  //         },
  //         "description": {
  //           "ar": "الاخبار و الاعلانات",
  //           "en": "News and Announcements"
  //         },
  //         "id": 5,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "الأسعار التاريخية",
  //           "en": "Historical Prices"
  //         },
  //         "description": {
  //           "ar": "الأسعار التاريخية",
  //           "en": "Historical Prices"
  //         },
  //         "id": 6,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "الرسوم البيانية مع مؤشرات التحليل الفني",
  //           "en": "Stock Charts with Technical Indicators"
  //         },
  //         "description": {
  //           "ar": "الرسوم البيانية مع مؤشرات التحليل الفني",
  //           "en": "Stock Charts with Technical Indicators"
  //         },
  //         "id": 7,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "قوائم مالية مبسطة",
  //           "en": "Basic Financial Statements (last five years)"
  //         },
  //         "description": {
  //           "ar": "قوائم مالية مبسطة",
  //           "en": "Basic Financial Statements (last five years)"
  //         },
  //         "id": 8,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "تنبيهات السهم",
  //           "en": "Stock Alerts"
  //         },
  //         "description": {
  //           "ar": "تنبيهات السهم",
  //           "en": "Stock Alerts"
  //         },
  //         "id": 9,
  //         "group": "application_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "متابعة المحافظ",
  //           "en": "Portfolio Tracker"
  //         },
  //         "description": {
  //           "ar": "متابعة المحافظ",
  //           "en": "Portfolio Tracker"
  //         },
  //         "id": 10,
  //         "group": "application_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "قائمة المفضلة",
  //           "en": "Favorites List"
  //         },
  //         "description": {
  //           "ar": "قائمة المفضلة",
  //           "en": "Favorites List"
  //         },
  //         "id": 11,
  //         "group": "application_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "ملخص اليوم",
  //           "en": "Today’s Widget"
  //         },
  //         "description": {
  //           "ar": "ملخص اليوم",
  //           "en": "Today’s Widget"
  //         },
  //         "id": 12,
  //         "group": "application_features"
  //       }
  //     ],
  //     "products": [
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 9,
  //         "name": "One Month",
  //         "SKU": "TADAWUL_1MONTH_BEST_PRICE",
  //         "duration": 31,
  //         "price": "26",
  //         "currency": "USD"
  //       },
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 10,
  //         "name": "Three Months",
  //         "SKU": "TADAWUL_3MONTH_BEST_PRICE",
  //         "duration": 93,
  //         "price": "75",
  //         "currency": "USD"
  //       },
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 11,
  //         "name": "Six Months",
  //         "SKU": "TADAWUL_6MONTH_BEST_PRICE",
  //         "duration": 184,
  //         "price": "140",
  //         "currency": "USD"
  //       },
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 12,
  //         "name": "One Year",
  //         "SKU": "TADAWUL_1YEAR_BEST_PRICE",
  //         "duration": 366,
  //         "price": "260",
  //         "currency": "USD"
  //       }
  //     ]
  //   },
  //   {
  //     "name": "Market Depth",
  //     "code": "TADAWUL_MARKET_DEPTH",
  //     "product_group_id": "TADAWUL_MARKET_DEPTH",
  //     "market": "tadawul",
  //     "version": 1,
  //     "order": 2,
  //     "available": true,
  //     "language" : "en",
  //     "summary" : "Realtime & market depth of 5 prices",
  //     "delay": 0,
  //     "description": "",
  //     "id": 3,
  //     "includes": [
  //       "TADAWUL_BEST_PRICE",
  //       "TADAWUL_DELAYED"
  //     ],
  //     "obookDepth": null,
  //     "features": [
  //       {
  //         "title": {
  //           "ar": "اشتراك أفضل طلب/عرض",
  //           "en": "Best bid/ask price"
  //         },
  //         "description": {
  //           "ar": "اشتراك أفضل طلب/عرض",
  //           "en": "Best bid/ask price"
  //         },
  //         "id": 2,
  //         "group": "data_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "الاخبار و الاعلانات",
  //           "en": "News and Announcements"
  //         },
  //         "description": {
  //           "ar": "الاخبار و الاعلانات",
  //           "en": "News and Announcements"
  //         },
  //         "id": 5,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "الأسعار التاريخية",
  //           "en": "Historical Prices"
  //         },
  //         "description": {
  //           "ar": "الأسعار التاريخية",
  //           "en": "Historical Prices"
  //         },
  //         "id": 6,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "الرسوم البيانية مع مؤشرات التحليل الفني",
  //           "en": "Stock Charts with Technical Indicators"
  //         },
  //         "description": {
  //           "ar": "الرسوم البيانية مع مؤشرات التحليل الفني",
  //           "en": "Stock Charts with Technical Indicators"
  //         },
  //         "id": 7,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "قوائم مالية مبسطة",
  //           "en": "Basic Financial Statements (last five years)"
  //         },
  //         "description": {
  //           "ar": "قوائم مالية مبسطة",
  //           "en": "Basic Financial Statements (last five years)"
  //         },
  //         "id": 8,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "تنبيهات السهم",
  //           "en": "Stock Alerts"
  //         },
  //         "description": {
  //           "ar": "تنبيهات السهم",
  //           "en": "Stock Alerts"
  //         },
  //         "id": 9,
  //         "group": "application_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "متابعة المحافظ",
  //           "en": "Portfolio Tracker"
  //         },
  //         "description": {
  //           "ar": "متابعة المحافظ",
  //           "en": "Portfolio Tracker"
  //         },
  //         "id": 10,
  //         "group": "application_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "قائمة المفضلة",
  //           "en": "Favorites List"
  //         },
  //         "description": {
  //           "ar": "قائمة المفضلة",
  //           "en": "Favorites List"
  //         },
  //         "id": 11,
  //         "group": "application_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "ملخص اليوم",
  //           "en": "Today’s Widget"
  //         },
  //         "description": {
  //           "ar": "ملخص اليوم",
  //           "en": "Today’s Widget"
  //         },
  //         "id": 12,
  //         "group": "application_features"
  //       }
  //     ],
  //     "products": [
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 13,
  //         "name": "One Month",
  //         "SKU": "TADAWUL_1MONTH_MARKET_DEPTH",
  //         "duration": 31,
  //         "price": "34",
  //         "currency": "USD"
  //       },
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 14,
  //         "name": "Three Months",
  //         "SKU": "TADAWUL_3MONTH_MARKET_DEPTH",
  //         "duration": 93,
  //         "price": "97",
  //         "currency": "USD"
  //       },
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 15,
  //         "name": "Six Months",
  //         "SKU": "TADAWUL_6MONTH_MARKET_DEPTH",
  //         "duration": 184,
  //         "price": "185",
  //         "currency": "USD"
  //       },
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 16,
  //         "name": "One Year",
  //         "SKU": "TADAWUL_1YEAR_MARKET_DEPTH",
  //         "duration": 366,
  //         "price": "350",
  //         "currency": "USD"
  //       }
  //     ]
  //   },
  //   {
  //     "name": "Premium",
  //     "code": "TADAWUL_MARKET_PREMIUM",
  //     "product_group_id": "TADAWUL_MARKET_PREMIUM",
  //     "market": "tadawul",
  //     "version": 1,
  //     "order": 3,
  //     "available": true,
  //     "language" : "en",
  //     "summary" : "Realtime & market depth of 10 prices",
  //     "delay": 0,
  //     "description": "",
  //     "id": 4,
  //     "includes": [
  //       "TADAWUL_MARKET_DEPTH",
  //       "TADAWUL_BEST_PRICE",
  //       "TADAWUL_DELAYED"
  //     ],
  //     "obookDepth": null,
  //     "features": [
  //       {
  //         "title": {
  //           "ar": "العروض و الطلبات لعمق ١٠ اسعار بالاتجاهين",
  //           "en": "Market Depth product with 10 price levels in the orderbook (10x10)"
  //         },
  //         "description": {
  //           "ar": "العروض و الطلبات لعمق ١٠ اسعار بالاتجاهين",
  //           "en": "Market Depth product with 10 price levels in the orderbook (10x10)"
  //         },
  //         "id": 3,
  //         "group": "data_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "الاخبار و الاعلانات",
  //           "en": "News and Announcements"
  //         },
  //         "description": {
  //           "ar": "الاخبار و الاعلانات",
  //           "en": "News and Announcements"
  //         },
  //         "id": 5,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "الأسعار التاريخية",
  //           "en": "Historical Prices"
  //         },
  //         "description": {
  //           "ar": "الأسعار التاريخية",
  //           "en": "Historical Prices"
  //         },
  //         "id": 6,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "الرسوم البيانية مع مؤشرات التحليل الفني",
  //           "en": "Stock Charts with Technical Indicators"
  //         },
  //         "description": {
  //           "ar": "الرسوم البيانية مع مؤشرات التحليل الفني",
  //           "en": "Stock Charts with Technical Indicators"
  //         },
  //         "id": 7,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "قوائم مالية مبسطة",
  //           "en": "Basic Financial Statements (last five years)"
  //         },
  //         "description": {
  //           "ar": "قوائم مالية مبسطة",
  //           "en": "Basic Financial Statements (last five years)"
  //         },
  //         "id": 8,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "تنبيهات السهم",
  //           "en": "Stock Alerts"
  //         },
  //         "description": {
  //           "ar": "تنبيهات السهم",
  //           "en": "Stock Alerts"
  //         },
  //         "id": 9,
  //         "group": "application_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "متابعة المحافظ",
  //           "en": "Portfolio Tracker"
  //         },
  //         "description": {
  //           "ar": "متابعة المحافظ",
  //           "en": "Portfolio Tracker"
  //         },
  //         "id": 10,
  //         "group": "application_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "قائمة المفضلة",
  //           "en": "Favorites List"
  //         },
  //         "description": {
  //           "ar": "قائمة المفضلة",
  //           "en": "Favorites List"
  //         },
  //         "id": 11,
  //         "group": "application_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "ملخص اليوم",
  //           "en": "Today’s Widget"
  //         },
  //         "description": {
  //           "ar": "ملخص اليوم",
  //           "en": "Today’s Widget"
  //         },
  //         "id": 12,
  //         "group": "application_features"
  //       }
  //     ],
  //     "products": [
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 17,
  //         "name": "One Month",
  //         "SKU": "TADAWUL_1MONTH_MARKET_PREMIUM",
  //         "duration": 31,
  //         "price": "42",
  //         "currency": "USD"
  //       },
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 18,
  //         "name": "Three Months",
  //         "SKU": "TADAWUL_3MONTH_MARKET_PREMIUM",
  //         "duration": 93,
  //         "price": "120",
  //         "currency": "USD"
  //       },
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 19,
  //         "name": "Six Months",
  //         "SKU": "TADAWUL_6MONTH_MARKET_PREMIUM",
  //         "duration": 184,
  //         "price": "230",
  //         "currency": "USD"
  //       },
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 20,
  //         "name": "One Year",
  //         "SKU": "TADAWUL_1YEAR_MARKET_PREMIUM",
  //         "duration": 366,
  //         "price": "450",
  //         "currency": "USD"
  //       }
  //     ]
  //   },
  //   {
  //     "name": "Delayed Feed",
  //     "code": "KSE_DELAYED_V2",
  //     "product_group_id": "KSE_DELAYED_V2",
  //     "market": "kse",
  //     "version": 2,
  //     "order": 0,
  //     "available": true,
  //     "language" : "en",
  //     "summary" : "prices are 10 minutes delayed",
  //     "delay": 0,
  //     "description": "",
  //     "id": 6,
  //     "includes": [],
  //     "obookDepth": 1,
  //     "features": [
  //       {
  //         "title": {
  //           "ar": "الاخبار و الاعلانات",
  //           "en": "News and Announcements"
  //         },
  //         "description": {
  //           "ar": "الاخبار و الاعلانات",
  //           "en": "News and Announcements"
  //         },
  //         "id": 5,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "الأسعار التاريخية",
  //           "en": "Historical Prices"
  //         },
  //         "description": {
  //           "ar": "الأسعار التاريخية",
  //           "en": "Historical Prices"
  //         },
  //         "id": 6,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "الرسوم البيانية مع مؤشرات التحليل الفني",
  //           "en": "Stock Charts with Technical Indicators"
  //         },
  //         "description": {
  //           "ar": "الرسوم البيانية مع مؤشرات التحليل الفني",
  //           "en": "Stock Charts with Technical Indicators"
  //         },
  //         "id": 7,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "قوائم مالية مبسطة",
  //           "en": "Basic Financial Statements (last five years)"
  //         },
  //         "description": {
  //           "ar": "قوائم مالية مبسطة",
  //           "en": "Basic Financial Statements (last five years)"
  //         },
  //         "id": 8,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "تنبيهات السهم",
  //           "en": "Stock Alerts"
  //         },
  //         "description": {
  //           "ar": "تنبيهات السهم",
  //           "en": "Stock Alerts"
  //         },
  //         "id": 9,
  //         "group": "application_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "متابعة المحافظ",
  //           "en": "Portfolio Tracker"
  //         },
  //         "description": {
  //           "ar": "متابعة المحافظ",
  //           "en": "Portfolio Tracker"
  //         },
  //         "id": 10,
  //         "group": "application_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "قائمة المفضلة",
  //           "en": "Favorites List"
  //         },
  //         "description": {
  //           "ar": "قائمة المفضلة",
  //           "en": "Favorites List"
  //         },
  //         "id": 11,
  //         "group": "application_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "ملخص اليوم",
  //           "en": "Today’s Widget"
  //         },
  //         "description": {
  //           "ar": "ملخص اليوم",
  //           "en": "Today’s Widget"
  //         },
  //         "id": 12,
  //         "group": "application_features"
  //       }
  //     ],
  //     "products": [
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 21,
  //         "name": "One Month",
  //         "SKU": "KSE_1MONTH_DELAYED",
  //         "duration": 31,
  //         "price": "3",
  //         "currency": "KWD"
  //       },
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 22,
  //         "name": "3 Month",
  //         "SKU": "KSE_3MONTH_DELAYED",
  //         "duration": 93,
  //         "price": "8",
  //         "currency": "KWD"
  //       },
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 23,
  //         "name": "6 Month",
  //         "SKU": "KSE_6MONTH_DELAYED",
  //         "duration": 184,
  //         "price": "15",
  //         "currency": "KWD"
  //       },
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 24,
  //         "name": "1 Year",
  //         "SKU": "KSE_1YEAR_DELAYED",
  //         "duration": 366,
  //         "price": "27",
  //         "currency": "KWD"
  //       }
  //     ]
  //   },
  //   {
  //     "name": "Best Bid/Ask",
  //     "code": "KSE_BEST_PRICE_V2",
  //     "product_group_id": "KSE_BEST_PRICE_V2",
  //     "market": "kse",
  //     "version": 2,
  //     "order": 1,
  //     "language" : "en",
  //     "available": true,
  //     "summary" : "Realtime Prices with best bid/ask",
  //     "delay": 0,
  //     "description": "",
  //     "id": 7,
  //     "includes": [
  //       "KSE_DELAYED_V2"
  //     ],
  //     "obookDepth": 1,
  //     "features": [
  //       {
  //         "title": {
  //           "ar": "الأسعار فورية",
  //           "en": "Realtime quotes"
  //         },
  //         "description": {
  //           "ar": "الأسعار فورية",
  //           "en": "Realtime quotes"
  //         },
  //         "id": 1,
  //         "group": "data_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "اشتراك أفضل طلب/عرض",
  //           "en": "Best bid/ask price"
  //         },
  //         "description": {
  //           "ar": "اشتراك أفضل طلب/عرض",
  //           "en": "Best bid/ask price"
  //         },
  //         "id": 2,
  //         "group": "data_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "الاخبار و الاعلانات",
  //           "en": "News and Announcements"
  //         },
  //         "description": {
  //           "ar": "الاخبار و الاعلانات",
  //           "en": "News and Announcements"
  //         },
  //         "id": 5,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "الأسعار التاريخية",
  //           "en": "Historical Prices"
  //         },
  //         "description": {
  //           "ar": "الأسعار التاريخية",
  //           "en": "Historical Prices"
  //         },
  //         "id": 6,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "الرسوم البيانية مع مؤشرات التحليل الفني",
  //           "en": "Stock Charts with Technical Indicators"
  //         },
  //         "description": {
  //           "ar": "الرسوم البيانية مع مؤشرات التحليل الفني",
  //           "en": "Stock Charts with Technical Indicators"
  //         },
  //         "id": 7,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "قوائم مالية مبسطة",
  //           "en": "Basic Financial Statements (last five years)"
  //         },
  //         "description": {
  //           "ar": "قوائم مالية مبسطة",
  //           "en": "Basic Financial Statements (last five years)"
  //         },
  //         "id": 8,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "تنبيهات السهم",
  //           "en": "Stock Alerts"
  //         },
  //         "description": {
  //           "ar": "تنبيهات السهم",
  //           "en": "Stock Alerts"
  //         },
  //         "id": 9,
  //         "group": "application_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "متابعة المحافظ",
  //           "en": "Portfolio Tracker"
  //         },
  //         "description": {
  //           "ar": "متابعة المحافظ",
  //           "en": "Portfolio Tracker"
  //         },
  //         "id": 10,
  //         "group": "application_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "قائمة المفضلة",
  //           "en": "Favorites List"
  //         },
  //         "description": {
  //           "ar": "قائمة المفضلة",
  //           "en": "Favorites List"
  //         },
  //         "id": 11,
  //         "group": "application_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "ملخص اليوم",
  //           "en": "Today’s Widget"
  //         },
  //         "description": {
  //           "ar": "ملخص اليوم",
  //           "en": "Today’s Widget"
  //         },
  //         "id": 12,
  //         "group": "application_features"
  //       }
  //     ],
  //     "products": [
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 25,
  //         "name": "One Month",
  //         "SKU": "KSE_1MONTH_BEST_PRICE",
  //         "duration": 31,
  //         "price": "6",
  //         "currency": "KWD"
  //       },
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 26,
  //         "name": "Three Months",
  //         "SKU": "KSE_3MONTH_BEST_PRICE",
  //         "duration": 93,
  //         "price": "18",
  //         "currency": "KWD"
  //       },
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 27,
  //         "name": "Six Months",
  //         "SKU": "KSE_6MONTH_BEST_PRICE",
  //         "duration": 184,
  //         "price": "36",
  //         "currency": "KWD"
  //       },
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 28,
  //         "name": "One Year",
  //         "SKU": "KSE_1YEAR_BEST_PRICE",
  //         "duration": 366,
  //         "price": "72",
  //         "currency": "KWD"
  //       }
  //     ]
  //   },
  //   {
  //     "name": "Market Depth",
  //     "code": "KSE_MARKET_DEPTH_V2",
  //     "product_group_id": "KSE_MARKET_DEPTH_V2",
  //     "market": "kse",
  //     "version": 2,
  //     "language" : "en",
  //     "order": 2,
  //     "available": true,
  //     "summary" : "Realtime & market depth of 5 prices",
  //     "delay": 0,
  //     "description": "",
  //     "id": 8,
  //     "includes": [
  //       "KSE_BEST_PRICE_V2",
  //       "KSE_DELAYED_V2"
  //     ],
  //     "obookDepth": 5,
  //     "features": [
  //       {
  //         "title": {
  //           "ar": "الأسعار فورية",
  //           "en": "Realtime quotes"
  //         },
  //         "description": {
  //           "ar": "الأسعار فورية",
  //           "en": "Realtime quotes"
  //         },
  //         "id": 1,
  //         "group": "data_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "(5x5) العروض و الطلبات لعمق ٥ اسعار بالاتجاهين",
  //           "en": "Market Depth product with 5 price levels in the orderbook (5x5)"
  //         },
  //         "description": {
  //           "ar": "(5x5) العروض و الطلبات لعمق ٥ اسعار بالاتجاهين",
  //           "en": "Market Depth product with 5 price levels in the orderbook (5x5)"
  //         },
  //         "id": 4,
  //         "group": "data_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "الاخبار و الاعلانات",
  //           "en": "News and Announcements"
  //         },
  //         "description": {
  //           "ar": "الاخبار و الاعلانات",
  //           "en": "News and Announcements"
  //         },
  //         "id": 5,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "الأسعار التاريخية",
  //           "en": "Historical Prices"
  //         },
  //         "description": {
  //           "ar": "الأسعار التاريخية",
  //           "en": "Historical Prices"
  //         },
  //         "id": 6,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "الرسوم البيانية مع مؤشرات التحليل الفني",
  //           "en": "Stock Charts with Technical Indicators"
  //         },
  //         "description": {
  //           "ar": "الرسوم البيانية مع مؤشرات التحليل الفني",
  //           "en": "Stock Charts with Technical Indicators"
  //         },
  //         "id": 7,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "قوائم مالية مبسطة",
  //           "en": "Basic Financial Statements (last five years)"
  //         },
  //         "description": {
  //           "ar": "قوائم مالية مبسطة",
  //           "en": "Basic Financial Statements (last five years)"
  //         },
  //         "id": 8,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "تنبيهات السهم",
  //           "en": "Stock Alerts"
  //         },
  //         "description": {
  //           "ar": "تنبيهات السهم",
  //           "en": "Stock Alerts"
  //         },
  //         "id": 9,
  //         "group": "application_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "متابعة المحافظ",
  //           "en": "Portfolio Tracker"
  //         },
  //         "description": {
  //           "ar": "متابعة المحافظ",
  //           "en": "Portfolio Tracker"
  //         },
  //         "id": 10,
  //         "group": "application_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "قائمة المفضلة",
  //           "en": "Favorites List"
  //         },
  //         "description": {
  //           "ar": "قائمة المفضلة",
  //           "en": "Favorites List"
  //         },
  //         "id": 11,
  //         "group": "application_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "ملخص اليوم",
  //           "en": "Today’s Widget"
  //         },
  //         "description": {
  //           "ar": "ملخص اليوم",
  //           "en": "Today’s Widget"
  //         },
  //         "id": 12,
  //         "group": "application_features"
  //       }
  //     ],
  //     "products": [
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 29,
  //         "name": "One Month",
  //         "SKU": "KSE_1MONTH_MARKET_DEPTH_V2",
  //         "duration": 31,
  //         "price": "7",
  //         "currency": "KWD"
  //       },
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 30,
  //         "name": "Three Months",
  //         "SKU": "KSE_3MONTH_MARKET_DEPTH_V2",
  //         "duration": 93,
  //         "price": "21",
  //         "currency": "KWD"
  //       },
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 31,
  //         "name": "Six Months",
  //         "SKU": "KSE_6MONTH_MARKET_DEPTH_V2",
  //         "duration": 184,
  //         "price": "42",
  //         "currency": "KWD"
  //       },
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 32,
  //         "name": "One Year",
  //         "SKU": "KSE_1YEAR_MARKET_DEPTH_V2",
  //         "duration": 366,
  //         "price": "84",
  //         "currency": "KWD"
  //       }
  //     ]
  //   },
  //   {
  //     "name": "Premium",
  //     "code": "KSE_MARKET_PREMIUM_V2",
  //     "product_group_id": "KSE_MARKET_PREMIUM_V2",
  //     "market": "kse",
  //     "version": 2,
  //     "language" : "en",
  //     "order": 3,
  //     "available": true,
  //     "summary" : "Realtime & market depth of 10 prices",
  //     "delay": 0,
  //     "description": "",
  //     "id": 9,
  //     "includes": [
  //       "KSE_MARKET_DEPTH_V2",
  //       "KSE_BEST_PRICE_V2",
  //       "KSE_DELAYED_V2"
  //     ],
  //     "obookDepth": null,
  //     "features": [
  //       {
  //         "title": {
  //           "ar": "الأسعار فورية",
  //           "en": "Realtime quotes"
  //         },
  //         "description": {
  //           "ar": "الأسعار فورية",
  //           "en": "Realtime quotes"
  //         },
  //         "id": 1,
  //         "group": "data_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "العروض و الطلبات لعمق ١٠ اسعار بالاتجاهين",
  //           "en": "Market Depth product with 10 price levels in the orderbook (10x10)"
  //         },
  //         "description": {
  //           "ar": "العروض و الطلبات لعمق ١٠ اسعار بالاتجاهين",
  //           "en": "Market Depth product with 10 price levels in the orderbook (10x10)"
  //         },
  //         "id": 3,
  //         "group": "data_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "الاخبار و الاعلانات",
  //           "en": "News and Announcements"
  //         },
  //         "description": {
  //           "ar": "الاخبار و الاعلانات",
  //           "en": "News and Announcements"
  //         },
  //         "id": 5,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "الأسعار التاريخية",
  //           "en": "Historical Prices"
  //         },
  //         "description": {
  //           "ar": "الأسعار التاريخية",
  //           "en": "Historical Prices"
  //         },
  //         "id": 6,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "الرسوم البيانية مع مؤشرات التحليل الفني",
  //           "en": "Stock Charts with Technical Indicators"
  //         },
  //         "description": {
  //           "ar": "الرسوم البيانية مع مؤشرات التحليل الفني",
  //           "en": "Stock Charts with Technical Indicators"
  //         },
  //         "id": 7,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "قوائم مالية مبسطة",
  //           "en": "Basic Financial Statements (last five years)"
  //         },
  //         "description": {
  //           "ar": "قوائم مالية مبسطة",
  //           "en": "Basic Financial Statements (last five years)"
  //         },
  //         "id": 8,
  //         "group": "stock_Information_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "تنبيهات السهم",
  //           "en": "Stock Alerts"
  //         },
  //         "description": {
  //           "ar": "تنبيهات السهم",
  //           "en": "Stock Alerts"
  //         },
  //         "id": 9,
  //         "group": "application_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "متابعة المحافظ",
  //           "en": "Portfolio Tracker"
  //         },
  //         "description": {
  //           "ar": "متابعة المحافظ",
  //           "en": "Portfolio Tracker"
  //         },
  //         "id": 10,
  //         "group": "application_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "قائمة المفضلة",
  //           "en": "Favorites List"
  //         },
  //         "description": {
  //           "ar": "قائمة المفضلة",
  //           "en": "Favorites List"
  //         },
  //         "id": 11,
  //         "group": "application_features"
  //       },
  //       {
  //         "title": {
  //           "ar": "ملخص اليوم",
  //           "en": "Today’s Widget"
  //         },
  //         "description": {
  //           "ar": "ملخص اليوم",
  //           "en": "Today’s Widget"
  //         },
  //         "id": 12,
  //         "group": "application_features"
  //       }
  //     ],
  //     "products": [
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 34,
  //         "name": "One Month",
  //         "SKU": "KSE_1MONTH_MARKET_PREMIUM_V2",
  //         "duration": 31,
  //         "price": "9",
  //         "currency": "KWD"
  //       },
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 35,
  //         "name": "Three Months",
  //         "SKU": "KSE_3MONTH_MARKET_PREMIUM_V2",
  //         "duration": 93,
  //         "price": "27",
  //         "currency": "KWD"
  //       },
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 36,
  //         "name": "Six Months",
  //         "SKU": "KSE_6MONTH_MARKET_PREMIUM_V2",
  //         "duration": 184,
  //         "price": "54",
  //         "currency": "KWD"
  //       },
  //       {
  //         "description": {
  //           "ar": "",
  //           "en": ""
  //         },
  //         "id": 37,
  //         "name": "One Year",
  //         "SKU": "KSE_1YEAR_MARKET_PREMIUM_V2",
  //         "duration": 366,
  //         "price": "108",
  //         "currency": "KWD"
  //       }
  //     ]
  //   }
  // ]
  // const result = await helper.insertProductRecord(records)
  // console.log('result----------------------->', result)
  // res.send(result)
}
import * as helper from '../utils/helper'


let result: any

/**
 * url: //domain.com/v2/jibla-products/all
 * @method: GET
 * @param: req
 * @param: res
 * @returns: JSON(result)
 * Desc: Used to fetch all jibla products
 */
export let allJiblaProducts = async (req, res) => {
  result = await helper.getAllJiblaProducts()
  if (result === null) {
    return res.status(500).send({
      error: {
        message: 'Error in getting jibla products',
        type: 'mongo_error'
      }
    })
  } else {
    return res.send(result)
  }
}

/**
 * url: //domain.com/v2/jibla-products
 * @method: GET
 * @param: req
 * @param: res
 * @returns: JSON(result)
 * Desc: Used to get jibla products using available market and version
 */
export let jiblaProducts = async (req, res) => {
  const market = req.query.market ? req.query.market : 'tadawul'
  const version = req.query.version ? req.query.version : 1

  result = await helper.getJiblaProducts(market,version)
  if (result === null) {
    return res.status(500).send({
      error: {
        message: 'Error in getting jibla products',
        type: 'mongo_error'
      }
    })
  } else {
    return res.send(result)
  }
}

/**
 * url: //domain.com/v2/products
 * @method: GET
 * @param: req
 * @param: res
 * @returns: JSON(result)
 * Desc: Used to get products using mysql database 
 */
export let product = async (req, res) => {
  result = await helper.getProductsFromSql()
  if (result === null) {
    return res.status(500).send({
      error: {
        message: 'Error in getting products',
        type: 'SQL_error'
      }
    })
  } else {
    return res.send(result)
  }
}
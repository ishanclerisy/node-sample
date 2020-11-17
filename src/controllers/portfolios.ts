import { validationResult } from 'express-validator/check'
import * as moment from 'moment'
import * as helper from '../utils/helper'
import { JiblaAccount } from 'jibla-finance-server-model'

let result
let record

/**
 * url: //domain.com/v2/oldPortfolios
 * @method: GET
 * @param: req
 * @param: res
 * @returns: JSON(result)
 * Desc: Used to get all user's portfolios
 */
export let getOldPortfolios = async (req, res) => {
  try {
    const account = await JiblaAccount.loadAccount(req.user.id)
    let result = await account.migrateRedisPortfoliosToMongo()
    return res.send(result)
  } catch (error) {
    console.error('Mongo Error while getting old portfolios ---------------->', error)
    return res.status(400).send({
      error: {
        message: 'Problem in getting old portfolios. Please contact us with a screenshot at support@jiblatech.com',
        type: 'error_getting_old_portfolios'
      }
    })
  }
}


/**
 * url: //domain.com/v2/portfolios?offset=1&limit=5
 * @method: GET
 * @param: req
 * @param: res
 * @returns: JSON(result)
 * Desc: Used to get all user's portfolios
 */
export let getPortfolios = async (req, res) => {
  const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10

  result = await helper.getAllPortfolios(req.user.id, offset, limit)
  if (result === null) {
    return res.status(500).send({
      error: {
        message: 'Problem getting portfolios. Please contact us with a screenshot at support@jiblatech.com',
        type: 'error_getting_portfolios'
      }
    })
  } else {
    return res.send(result)
  }
}

/**
 * url: //domain.com/v2/portfolios/:id
 * @method: GET
 * @param: req
 * @param: res
 * @returns: JSON(result[0])
 * Desc: Used to get a portfolio info
 */
export let getPortfolio = async (req, res) => {
  result = await helper.getAlertPortfolio('portfolios', req.params.id)
  if (result === null) {
    return res.status(500).send({
      error: {
        message: 'Problem in getting portfolio. Please contact us with a screenshot at support@jiblatech.com',
        type: 'error_getting_portfolios'
      }
    })
  } else {
    if (result.length) {
      return res.send(result[0])
    } else {
      return res.status(404).send({
        error: {
          message: `No portfolio found with id ${req.params.id}`,
          type: 'portfolio_not_found'
        }
      })
    }
  }
}

/**
 * url: //domain.com/v2/portfolios
 * @method: POST or PUT
 * @param: req
 * @param: res
 * @returns: JSON(msg)
 * Desc: Used to create or upldate a portfolio
 */
export let createUpdatePortfolio = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).send({ error: errors.array() })
  }
  
  const params = req.body
  params.transactions = ((params.transactions !== undefined) && (Array.isArray(params.transactions) && params.transactions.length)) ? params.transactions : []
  params.positions = ((params.positions !== undefined) && (Array.isArray(params.positions) &&params.positions.length)) ? params.positions : []
  params.userID = req.user.id
  params.creationDate = moment().valueOf()
  
  record = await helper.checkPortfolio(params)
  if (record && Object.keys(record).length) {
    if (params.id) {
      delete params.id
    }
    result = await helper.updatePortfolio(record._id, params)
  } else {
    if(params.id) {
      const id = params.id
      delete params.id
      record = await helper.checkPortfolio(params)
      if (record && Object.keys(record).length) {
        return res.status(409).send({
          error: {
            message: 'The portfolio name is alread existed with another id. Try changing your portfolio name',
            error: 'error_portfolion_duplication'
          }
        })
      } else {
        record = [{updated: 1}]
        result = await helper.updatePortfolio(id, params)
      }
    } else {
      result = await helper.createAlertPortfolio('portfolios', params)
    }
  }

  const api = (record && Object.keys(record).length) ? 'updating' : 'creating'
  const message = (record && Object.keys(record).length) ? 'updated' : 'added'

  if (result === null) {
    return res.status(500).send({
      error: {
        message: 'Problem in '+ api +' portfolios. Please contact us with a screenshot at support@jiblatech.com',
        type: 'error_' + api + '_portfolios'
      }
    })
  } else {
    return res.send({
      msg: 'Portfolio ' + message + ' successfully'
    })
  }
  
}

/**
 * url: //domain.com/v2/portfolios/:id
 * @method: DELETE
 * @param: req
 * @param: res
 * @returns: JSON(msg)
 * Desc: Used to delete a portfolio
 */
export let deletePortfolio = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).send({ error: errors.array() })
  }

  result = await helper.deleteAlertPortfolio('portfolios', req.params.id)
  if (result === null) {
    return res.status(500).send({
      error: {
        message: 'Problem in deleting portfolios. Please contact us with a screenshot at support@jiblatech.com',
        type: 'error_deleting_portfolios'
      }
    })
  } else {
    if (result.result.n) {
      return res.send({
        msg: 'Portfolio deleted successfully'
      })
    } else {
      return res.status(404).send({
        error: {
          message: `No portfolio found with id ${req.params.id}`,
          type: 'portfolio_not_found'
        }
      })
    }
  }
}
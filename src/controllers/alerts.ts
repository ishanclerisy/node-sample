import { validationResult } from 'express-validator/check'
import * as moment from 'moment'
import * as helper from '../utils/helper'

let result
let record

/**
 * url: //domain.com/v2/alerts
 * @method: GET
 * @param: req
 * @param: res
 * @returns: JSON(result)
 * Desc: Used to get all user's alerts
 */
export let getAlerts = async (req, res) => {
  const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10
  result = await helper.getAllAlerts(req.user.id, offset, limit)
  if (result === null) {
    return res.status(500).send({
      error: {
        message: 'Problem getting alerts. Please contact us with a screenshot at support@jiblatech.com',
        type: 'error_getting_alerts'
      }
    })
  } else {
    return res.send(result)
  }
}

/**
 * url: //domain.com/v2/alerts
 * @method: POST or PUT
 * @param: req
 * @param: res
 * @returns: JSON(msg)
 * Desc: Used to create or update alert
 */
export let createUpdateAlert = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).send({ error: errors.array() })
  }

  const params = req.body
  params.userID = req.user.id

  let id

  if (params.id) {
    id = params.id
    delete params.id
    record = await helper.getAlertPortfolio('alerts', id)
    params.updatedAt = moment().valueOf()
    result = await helper.updateAlert(id, params)
  } else {
    params.createdAt = moment().valueOf()
    params.updatedAt = moment().valueOf()
    result = await helper.createAlertPortfolio('alerts', params)
  }

  const api = (id && id !== undefined && record && record[0] !== undefined) ? 'updating' : 'creating'
  const message = (id && id !== undefined && record && record[0] !== undefined) ? 'updated' : 'added'

  if (result === null) {
    return res.status(500).send({
      error: {
        message: 'Problem in '+ api +' alerts. Please contact us with a screenshot at support@jiblatech.com',
        type: 'error_' + api + '_alerts'
      }
    })
  } else {
    return res.send({
      msg: 'Alert ' + message + ' successfully',
    })
  }
}

/**
 * url: //domain.com/v2/alerts:id
 * @method: GET
 * @param: req
 * @param: res
 * @returns: JSON(result[0])
 * Desc: Used to get an alert info
 */
export let getAlert = async (req, res) => {
  result = await helper.getAlertPortfolio('alerts', req.params.id)
  if (result === null) {
    return res.status(500).send({
      error: {
        message: 'Problem in getting alerts. Please contact us with a screenshot at support@jiblatech.com',
        type: 'error_getting_alerts'
      }
    })
  } else {
    if (result.length) {
      return res.send(result[0])
    } else {
      return res.status(404).send({
        error: {
          message: `No Alert found with id ${req.params.id}`,
          type: 'alert_not_found'
        }
      })
    }
  }
}

/**
 * url: //domain.com/v2/alerts/:id
 * @method: DELETE
 * @param: req
 * @param: res
 * @returns: JSON(msg)
 * Desc: Used to delete an alert
 */
export let deleteAlert = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).send({ error: errors.array() })
  }

  result = await helper.deleteAlertPortfolio('alerts', req.params.id)
  if (result === null) {
    return res.status(500).send({
      error: {
        message: 'Problem in deleting alerts. Please contact us with a screenshot at support@jiblatech.com',
        type: 'error_deleting_alerts'
      }
    })
  } else {
    if (result.result.n) {
      return res.send({
        msg: 'Alert deleted successfully'
      })
    } else {
      return res.status(404).send({
        error: {
          message: `No Alert found with id ${req.params.id}`,
          type: 'alert_not_found'
        }
      })
    }
  }
}
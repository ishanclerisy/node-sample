import * as helper from '../utils/helper'

let result: any

/**
 * url: //domain.com/v2/transactions
 * @method: GET
 * @param: req
 * @param: res
 * @returns: JSON(result)
 * Desc: Fetch all user's transactions
 */
export let getUserTransactions = async (req, res) => {
  result = await helper.getUserTransactions(req.user.id)
  if (result === null) {
    return res.status(500).send({
      error: {
        message: 'Error in getting transactions',
        type: 'SQL_error'
      }
    })
  } else {
    return res.send(result)
  }
}
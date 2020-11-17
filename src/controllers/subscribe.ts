import { validationResult } from 'express-validator/check'
import * as helper from '../utils/helper'

let result 
export let subscribe = async (req, res) =>  {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).send({ error: errors.array() })
  }

  const params = req.body

  result = await helper.getProductDetails(params.productId)
  res.send({
    result
  })
}
const _ = require("lodash")
const axios = require("axios")
const cheerio = require("cheerio")

const sendResponse = res => async request => {
  return await request
    .then(data => res.json({ status: "success", data }))
    .catch(({ status: code = 500 }) =>
      res.status(code).json({
        status: "failure",
        code,
        message: code === 404 ? "Not found" : "Request failed",
      })
    )
}

const fetchHtmlFromUrl = async url => {
  return await axios
    .get(enforceHttpsUrl(url))
    .then(response => cheerio.load(response.data))
    .catch(error => {
      error.status = (error.response && error.response.status) || 500
      throw error
    })
}

/**
 * Compose function arguments starting from right to left
 * to an overall function and  return an overall function
 */
const compose = (...fns) => arg => {
  return _.flattenDeep(fns).reduceRight((current, fn) => {
    if (_.isFunction(fn)) return fn(current)
    throw new TypeError("compose() expects only functions as parameters.")
  }, arg)
}

/**
 * Compose sync function arguments starting from right to left
 * to an overall function and return an overall function
 */
const composeAsync = (...fns) => arg => {
  return _.flattenDeep(fns).reduceRight(async (current, fn) => {
    if (_.isFunction(fn)) return fn(await current)
    throw new TypeError("composeAsync() expects only function as parameters")
  }, arg)
}

/**
 * Enforce the scheme of the URL is https
 * and returns the new URL
 */
const enforceHttpsUrl = url =>
  _.isString(url) ? url.replace(/^(https?:)?\/\//, "https://") : null

/**
 * Strip number of all non-numeric characters
 * and return the sanitized number
 */
const santinizeNumber = number =>
  _.isString(number) ? number.replace(/[^0-9-.]/g, "") : null

/**
 *Filter null value from Array
 and return array without nulls
 */
const withoutNulls = arr =>
  _.isArray(arr) ? arr.filter(val => !_.isNull(val)) : []

/**
 * Transform an array of ({key: value}) pairs to an object
 * and returns the transformed object
 */
const arrayPairsToObject = arr =>
  arr.reduce((obj, pair) => ({ ...obj, ...pair }), {})

/**
 * A composed function that removes null values from array of ({key: value}) pairs
 * and return the transformed object to the array
 */
const fromPairsToObject = compose(arrayPairsToObject, withoutNulls)

/**
 * Fetches the inner text of the element
 * and return the trimmed text
 */
const fetchElemInnerText = elem => (elem.text && elem.text.trim()) || null

/***
 * Fetches the specifed attribute from the element
 * and returns the attribute values
 */
const fetchElemAttribute = attribute => elem =>
  (elem.attr && elem.attr(attribute)) || null

/**
 * Extract an array of values from a collection of elements
 * using the extractor function and returns the array
 * or the return value from calling transform onm array
 */
const extractFromElems = extractor => transform => elems => $ => {
  const results = elems.map((i, element) => extractor($(element))).get()
  return _.isFunction(transform) ? transform(results) : results
}

/**
 * A composed function that extracts number text from an element
 * santizes the number text and returns the parsed integer
 */
const extractNumber = compose(parseInt, santinizeNumber, fetchElemInnerText)

/**
 * A composed function that extracts url string from the element's attribute(attr)
 * and returns the url with https scheme
 */
const extractUrlAttribute = attr => {
  compose(enforceHttpsUrl, fetchElemAttribute(attr))
}

module.exports = {
  compose,
  composeAsync,
  enforceHttpsUrl,
  santinizeNumber,
  withoutNulls,
  arrayPairsToObject,
  fromPairsToObject,
  sendResponse,
  fetchElemAttribute,
  fetchHtmlFromUrl,
  fetchElemInnerText,
  extractFromElems,
  extractNumber,
  extractUrlAttribute,
}

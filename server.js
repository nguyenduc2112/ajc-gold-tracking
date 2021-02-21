const logger = require("morgan")
const express = require("express")
const moment = require("moment")
const puppeteer = require("puppeteer")
const { google } = require("googleapis")
const keys = require("./keys.json")
const schedule = require("node-schedule")

const app = express()
const port = process.env.PORT || 3000

app.set("port", port)
app.use(logger("dev"))
app.listen(port, () => console.log(`App started on port ${port}`))

let startCell = "A4",
  endCell = "S4"

const spreadsheetId = "1u-iQNd_hhQAUI08nuA6rsqO7Xar99J1_bAObLsyMZOM"
const gsapi = google.sheets({ version: "v4" })
const ajcUrl = "http://ajc.com.vn"

const client = new google.auth.JWT(keys.client_email, null, keys.private_key, [
  "https://www.googleapis.com/auth/spreadsheets",
])

client.authorize(function (err, tokens) {
  if (err) {
    console.log(err)
    return
  } else {
    console.log("connected!")
    gsRun(client)
  }
})

async function gsRun(cl) {
  const rule = new schedule.RecurrenceRule()

  rule.second = 10
  console.log("Schedule is started")

  //Run the first time
  await mainProcess(cl)

  schedule.scheduleJob("*/30 * * * *", async () => {
    await mainProcess(cl)
  })
}

const mainProcess = async auth => {
  console.log("==============> Start to get gold price!!!")
  const goldData = await getGoldPrices()

  console.log("==============> Start to update gold price to google sheet!!!")
  await addNewRowToSheet(goldData, auth)
}

const getGoldPrices = async () => {
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()

  await page.goto(ajcUrl)

  const updatedDate = moment().format("MM/DD/YYYY, hh:mm")

  let goldPrices = await page.evaluate(() => {
    let goldPriceInfo = []
    const goldPriceRows = document.querySelectorAll(
      'div[data-action="others/OthersHome/priceGold"] div.table-responsive table tbody tr'
    )
    goldPriceRows.forEach(row => {
      const goldType = row.childNodes[0].innerText
      const purchasePrice = row.childNodes[1].innerText
      const sellPrice = row.childNodes[2].innerText

      goldPriceInfo.push(purchasePrice)
      goldPriceInfo.push(sellPrice)
    })

    return goldPriceInfo
  })

  goldPrices.unshift(updatedDate)

  console.log(goldPrices)
  await browser.close()

  return goldPrices
}

const getGoldPrices2 = async () => {
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()

  await page.goto(ajcUrl)

  const updatedDate = moment().format("MM/DD/YYYY, hh:mm")

  let goldPrices = await page.evaluate(() => {
    let goldPriceInfo = []
    const goldPriceRows = document.querySelectorAll(
      'div[data-action="others/OthersHome/priceGold"] div.table-responsive table tbody tr'
    )
    goldPriceRows.forEach(row => {
      const goldType = row.childNodes[0].innerText
      if (goldType.includes("SJC") || goldType.includes("TT Hà Nội")) {
        const purchasePrice = row.childNodes[1].innerText
        const sellPrice = row.childNodes[2].innerText

        goldPriceInfo.push({
          goldType,
          purchasePrice,
          sellPrice,
        })
      }
    })

    return goldPriceInfo
  })

  goldPrices.unshift(updatedDate)

  console.log(goldPrices)
  await browser.close()

  return goldPrices
}

const getSheetData = async auth => {
  const opt = {
    spreadsheetId: spreadsheetId,
    range: `Sheet1!${startCell}:${endCell}`,
    auth,
  }
  const response = await gsapi.spreadsheets.values.get(opt)

  if (response && response.data) {
    return response.data.values
  }

  return []
}

const addNewRowToSheet = async (rowData, auth) => {
  const request = {
    spreadsheetId: spreadsheetId,
    range: `Sheet1!${startCell}:${endCell}`,
    valueInputOption: "USER_ENTERED",
    resource: {
      range: `Sheet1!${startCell}:${endCell}`,
      majorDimension: "ROWS",
      values: [rowData],
    },
    auth,
  }
  const addResponse = await gsapi.spreadsheets.values.append(request)

  if (addResponse.status === 200) {
    console.log("============> Update gold price  to google sheet success!!!")
    const updatedRows = addResponse.data.updates.updatedRows

    startCell =
      "A" + (Number(startCell.substr(1, startCell.length)) + updatedRows)
    endCell =
      "S" + (Number(startCell.substr(1, startCell.length)) + updatedRows)
    console.log("============> The next cell in Google Sheet is: ", startCell)
  }
}

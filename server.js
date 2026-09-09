require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const DELHIVERY_API_TOKEN = process.env.DELHIVERY_API_TOKEN;
const DELHIVERY_ORIGIN_PIN = process.env.DELHIVERY_ORIGIN_PIN;

const DELHIVERY_RATE_URL =
  "https://track.delhivery.com/api/kinko/v1/invoice/charges/.json";


/*
|--------------------------------------------------------------------------
| Basic health check
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Dhanvin Online Backend"
  });
});


/*
|--------------------------------------------------------------------------
| Delhivery shipping rate
|--------------------------------------------------------------------------
*/

app.post("/api/delhivery/rate", async (req, res) => {

  try {

    const {
      destinationPincode,
      weightGrams,
      paymentMode,
      codAmount
    } = req.body;


    // Validate destination PIN
    if (!destinationPincode) {
      return res.status(400).json({
        ok: false,
        error: "Destination pincode is required"
      });
    }


    // Validate weight
    if (!weightGrams || Number(weightGrams) <= 0) {
      return res.status(400).json({
        ok: false,
        error: "Valid shipment weight is required"
      });
    }


    const destinationPin = String(destinationPincode).trim();

    const weight = Math.round(Number(weightGrams));


    // Convert payment mode
    const isCOD =
      String(paymentMode || "").toLowerCase() === "cod";

    const paymentType = isCOD
      ? "COD"
      : "Pre-paid";


    // COD amount is only relevant for COD
    const cod = isCOD
      ? Number(codAmount || 0)
      : 0;


    /*
     * Delhivery API parameters
     *
     * md  = S (Surface)
     * ss  = Delivered
     * o_pin = pickup PIN
     * d_pin = customer PIN
     * cgm = chargeable weight in grams
     * pt = payment type
     * cod = COD amount
     */

    const params = new URLSearchParams({
      md: "S",
      ss: "Delivered",
      o_pin: DELHIVERY_ORIGIN_PIN,
      d_pin: destinationPin,
      cgm: String(weight),
      pt: paymentType,
      cod: String(cod)
    });


    console.log(
      "Requesting Delhivery rate:",
      {
        origin: DELHIVERY_ORIGIN_PIN,
        destination: destinationPin,
        weight,
        paymentType
      }
    );


    const response = await fetch(
      `${DELHIVERY_RATE_URL}?${params.toString()}`,
      {
        method: "GET",

        headers: {
          "Authorization": `Token ${DELHIVERY_API_TOKEN}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        }
      }
    );


    const responseText = await response.text();


    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      data = {
        raw: responseText
      };
    }


    console.log(
      "Delhivery HTTP status:",
      response.status
    );


    if (!response.ok) {

      console.error(
        "Delhivery API error:",
        data
      );

      return res.status(response.status).json({
        ok: false,
        error: "Delhivery API request failed",
        details: data
      });
    }


    /*
     * We will inspect the actual Delhivery response
     * during testing before finalizing this extraction.
     */

    console.log(
      "Delhivery response:",
      JSON.stringify(data, null, 2)
    );


    /*
     * Common possible response fields.
     *
     * We will adjust this after seeing the actual
     * response from your Delhivery account.
     */
    const rateData = Array.isArray(data) ? data[0] : data;
    
    const deliveryFee =
      rateData?.total_amount ??
      rateData?.deliveryFee ??
      rateData?.delivery_fee ??
      rateData?.totalAmount ??
      rateData?.freight_charge ??
      rateData?.freightCharge;


    if (deliveryFee === undefined) {

      return res.status(502).json({
        ok: false,
        error: "Delhivery responded, but shipping fee field was not recognized",
        delhiveryResponse: data
      });
    }


    return res.json({
      ok: true,
      deliveryFee: Number(deliveryFee),
      source: "Delhivery"
    });

  } catch (error) {

    console.error(
      "Backend error:",
      error
    );

    return res.status(500).json({
      ok: false,
      error: "Internal server error"
    });
  }
});


/*
|--------------------------------------------------------------------------
| Start server
|--------------------------------------------------------------------------
*/

app.listen(PORT, () => {

  console.log(
    `Dhanvin backend running on http://localhost:${PORT}`
  );

});
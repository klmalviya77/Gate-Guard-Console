const https = require("https");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed"
    };
  }

  let body;

  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      body: "Invalid JSON"
    };
  }

  const { flatId, visitorName, purpose } = body;

  if (!flatId || !visitorName) {
    return {
      statusCode: 400,
      body: "Missing required fields: flatId, visitorName"
    };
  }

  const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
  const ONESIGNAL_REST_API_KEY =
    process.env.ONESIGNAL_REST_API_KEY;

  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    console.warn(
      "⚠️ OneSignal env keys not configured"
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: false,
        reason:
          "OneSignal keys not configured"
      })
    };
  }

  console.log("========== PUSH DEBUG ==========");
  console.log("Flat ID:", flatId);
  console.log("Visitor:", visitorName);
  console.log("Purpose:", purpose);
  console.log(
    "APP ID Exists:",
    !!ONESIGNAL_APP_ID
  );
  console.log(
    "REST KEY Exists:",
    !!ONESIGNAL_REST_API_KEY
  );

  const payload = JSON.stringify({
    app_id: ONESIGNAL_APP_ID,

    include_aliases: {
      external_id: [String(flatId)]
    },

    target_channel: "push",

    headings: {
      en: "🔔 Visitor at Gate"
    },

    contents: {
      en:
        (visitorName || "Someone") +
        " has arrived" +
        (purpose
          ? " (" + purpose + ")"
          : "") +
        "."
    },

    priority: 10,
    ttl: 300
  });

  console.log(
    "OneSignal Payload:",
    payload
  );

  const options = {
    hostname: "api.onesignal.com",
    port: 443,
    path: "/notifications",
    method: "POST",
    headers: {
      "Content-Type":
        "application/json",
      Authorization:
        "Key " +
        ONESIGNAL_REST_API_KEY
    }
  };

  return new Promise((resolve) => {
    const req = https.request(
      options,
      (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          console.log(
            "OneSignal Status:",
            res.statusCode
          );

          console.log(
            "OneSignal Response:",
            data
          );

          let parsed;

          try {
            parsed = JSON.parse(data);
          } catch (err) {
            parsed = {
              raw: data
            };
          }

          resolve({
            statusCode:
              res.statusCode || 500,
            body: JSON.stringify({
              success:
                res.statusCode >= 200 &&
                res.statusCode < 300,
              response: parsed
            })
          });
        });
      }
    );

    req.on("error", (err) => {
      console.error(
        "OneSignal Request Error:",
        err
      );

      resolve({
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: err.message
        })
      });
    });

    req.write(payload);
    req.end();
  });
};
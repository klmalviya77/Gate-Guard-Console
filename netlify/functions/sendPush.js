const https = require("https");

exports.handler = async function (event) {
  // Sirf POST allow karo
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: "Invalid JSON body" };
  }

  const { flatId, visitorName, purpose } = body;

  if (!flatId || !visitorName) {
    return { statusCode: 400, body: "Missing flatId or visitorName" };
  }

  // ✅ Yeh values Netlify Environment Variables mein set karo
  // Netlify Dashboard → Site Settings → Environment Variables
  const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
  const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    console.error("OneSignal env variables not set!");
    return { statusCode: 500, body: "Server config error: OneSignal keys missing" };
  }

  const notificationPayload = JSON.stringify({
    app_id: ONESIGNAL_APP_ID,
    // Sirf us flat ko notification jayegi jisko visitor aaya hai
    filters: [{ field: "external_user_id", value: flatId }],
    headings: { en: "🔔 Visitor at Gate" },
    contents: {
      en: `${visitorName} has arrived for ${purpose || "a visit"}.`
    },
    priority: 10,
    ttl: 300, // 5 minutes mein expire ho jayegi agar deliver na ho
  });

  const options = {
    hostname: "onesignal.com",
    port: 443,
    path: "/api/v1/notifications",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`,
    },
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        console.log("OneSignal Response:", data);
        resolve({
          statusCode: 200,
          body: JSON.stringify({ success: true, onesignal: JSON.parse(data) }),
        });
      });
    });

    req.on("error", (err) => {
      console.error("OneSignal Request Error:", err);
      resolve({
        statusCode: 500,
        body: JSON.stringify({ success: false, error: err.message }),
      });
    });

    req.write(notificationPayload);
    req.end();
  });
};

const axios = require("axios");
const express = require("express");
const cluster = require("cluster");
const numCPUs = require("os").cpus().length;
const mongoose = require("mongoose");

const API_URI = "https://api.weatherlink.com/v2/";
const API_KEY = "wmrdzimw9fwlpo1mr81s9uuf1xhaqezu";
const API_SECRET = "jr0uy8mkraiw1rzrueajrvgvuijxnx7l";
const STID = 149767;
const MDB_PASS = "qzWeMKgobx3UeSM0";
const MDB_URI = `mongodb+srv://sidhardhchandra141:${MDB_PASS}@cluster0.aha7svt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const cors = require("cors");
const path = require("path");
const { register, login, getAllUsers, approveRequest, discardRequest } = require("./controllers/auth");
const tokenMiddleware = require("./middleware/tokenMiddleware");
const checkRole = require("./middleware/role");

const fTocConver = (temp) => {
  return parseFloat(((temp - 32) / 1.8).toFixed(2));
};

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);
  console.log("try http://localhost:3500/")

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
  });
} else {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  app.use(express.static(path.join(__dirname, "public")));

  app.get("/", (req, res) => res.render("index.ejs"));
  app.get("/login", (req, res) => res.render("login.ejs"));
  app.get("/register", (req, res) => res.render("register.ejs"));
  app.get("/users", checkRole("admin"), (req, res) => res.render("users.ejs"));
  app.get("/history", (req, res) => res.render("history.ejs"));
  
  app.get("/api/current", async (req, res) => {
    try {
      const response = await axios.get(
        API_URI + `current/${STID}/?api-key=${API_KEY}`,
        {
          headers: {
            "X-Api-Secret": API_SECRET,
          },
        }
        );

        const finalData = {
          temp: {
          temp_1: fTocConver(response.data.sensors[2].data[0].temp_in),
          temp_2: fTocConver(response.data.sensors[3].data[0].temp),
          temp_3: fTocConver(response.data.sensors[6].data[0].temp),

          wet_bulb_1: fTocConver(response.data.sensors[3].data[0].wet_bulb),
          wet_bulb_2: fTocConver(response.data.sensors[6].data[0].wet_bulb),

          wind_chill: fTocConver(response.data.sensors[3].data[0].wind_chill),

          dew_point_1: fTocConver(response.data.sensors[3].data[0].dew_point),
          dew_point_2: fTocConver(response.data.sensors[6].data[0].dew_point),
        },
        wind: {
          speed: {
            current: response.data.sensors[3].data[0].wind_speed_last,
            high: response.data.sensors[3].data[0].wind_speed_hi_last_10_min,
          },
          direction: response.data.sensors[3].data[0].wind_dir_last,
          avg_2min: response.data.sensors[3].data[0].wind_speed_avg_last_2_min,
          avg_10min:
            response.data.sensors[3].data[0].wind_speed_avg_last_10_min,
        },
        rain: {
          total: response.data.sensors[3].data[0].rainfall_monthly_mm,
          current: {
            day: response.data.sensors[3].data[0].rainfall_daily_mm,
            storm: response.data.sensors[3].data[0].rain_storm_mm,
            rate: response.data.sensors[3].data[0].rain_rate_last_mm,
          },
          storm: response.data.sensors[3].data[0].rain_storm_last_mm,
          month: response.data.sensors[3].data[0].rainfall_monthly_mm,
          year: response.data.sensors[3].data[0].rainfall_year_mm,
        },
        humidity: {
          outside: response.data.sensors[3].data[0].hum,
          inside: response.data.sensors[2].data[0].hum_in,
          airQuality: response.data.sensors[6].data[0].hum,
        },
        barometer: {
          pressure: response.data.sensors[1].data[0].bar_absolute,
          trend: response.data.sensors[1].data[0].bar_trend,
        },
        solarRadiation: response.data.sensors[3].data[0].solar_rad,
        uvIndex: response.data.sensors[3].data[0].uv_index,
        localForecast: {
          sunrise: "5:22 AM",
          sunset: "6:34 PM",
        },
        thwIndex: fTocConver(response.data.sensors[3].data[0].thw_index),
        thswIndex: fTocConver(response.data.sensors[3].data[0].thsw_index),
        insideTempHum: {
          temp: fTocConver(response.data.sensors[2].data[0].temp_in),
          humidity: response.data.sensors[2].data[0].hum_in,
        },
        airQuality: {
          currentAQI: response.data.sensors[6].data[0].aqi_nowcast_val,
          index: response.data.sensors[6].data[0].aqi_type,
          particulateMatter: {
            pm1: response.data.sensors[6].data[0].pm_1,
            pm2p5: response.data.sensors[6].data[0].pm_2p5,
            pm10: response.data.sensors[6].data[0].pm_10,
          },
          aqi_1hour: response.data.sensors[6].data[0].aqi_1_hour_val,
          aqi_nowcast: response.data.sensors[6].data[0].aqi_nowcast_val,
          aqi_24hour: response.data.sensors[6].data[0].aqi_val,
        },
        evapotranspiration: {
          daily: response.data.sensors[3].data[0].et,
          monthly: response.data.sensors[3].data[0].et_monthly,
          yearly: response.data.sensors[3].data[0].et_yearly,
        },
      };
      res.status(200).json({ data: finalData });
    } catch (error) {
      console.log(error);
      res.status(500).json({ data: "Server error" });
    }
  });

  app.post("/api/register", register)
  app.post("/api/login", login)
  app.get("/api/users", getAllUsers);
  app.get("/api/approveRequest/:id", approveRequest);
  app.get("/api/discardRequest/:id", discardRequest);
  app.get("/api/history/:start/:end", tokenMiddleware, async (req, res) => {
    try {
      const { start, end } = req.params;
      const response = await axios.get(`http://viit-weather.ddns.net:5000/api/weather?start_date=${start}&start_time=00:00&end_date=${end}&end_time=23:00`);
      if(response.status == 200){
        res.status(200).json({ data: response.data , code: 103 });
      }else{
        res.status(500).json({ msg: "Server timeout, Please try again" });
      }
    } catch (error) {
      console.log(error)
      res.status(500).json({ msg: "server error" });
    }
  });

  const PORT = process.env.PORT || 3500;
  mongoose.connect(MDB_URI).then(() => {
    app.listen(PORT, () => {
      console.log(`Worker ${process.pid} started on port ${PORT}`);
    });
  }).catch((e) => {
    console.log(e)
  })
}

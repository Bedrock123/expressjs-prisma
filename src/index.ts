import express from "express";
// @ts-ignore
import geoblaze from "geoblaze";

import area from "@turf/area";
import centroid from "@turf/centroid";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.raw({ type: "application/vnd.custom-type" }));
app.use(express.text({ type: "text/html" }));

let population4GeoRaster: any;

app.get("/", async (req, res) => {
  const start = Date.now();
  if (!population4GeoRaster) {
    console.log("first Load");
    population4GeoRaster = await geoblaze.parse(
      `https://map-gules.vercel.app/maps/pop3.tif`
    );
  } else {
    console.log("Population GeoRaster is already loaded");
  }

  const populationResult = await geoblaze.sum(population4GeoRaster);
  const end = Date.now();
  console.log(`Execution time: ${end - start} ms`);
  res.send(populationResult);
});

app.listen(Number(port), "0.0.0.0", () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

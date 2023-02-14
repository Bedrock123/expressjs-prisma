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

let pop4MapGeoRaster: any;
let pop3MapGeoRaster: any;
let pop2MapGeoRaster: any;
let pop1MapGeoRaster: any;

// @ts-ignore
var createGeoJSONCircle = function (center, outerRadiusInKm, points) {
  if (!points) points = 64;

  var coords = {
    latitude: center[1],
    longitude: center[0],
  };

  var km = outerRadiusInKm;

  var ret = [];
  var distanceX = km / (111.32 * Math.cos((coords.latitude * Math.PI) / 180));
  var distanceY = km / 110.574;

  var theta, x, y;
  for (var i = 0; i < points; i++) {
    theta = (i / points) * (2 * Math.PI);
    x = distanceX * Math.cos(theta);
    y = distanceY * Math.sin(theta);

    ret.push([coords.longitude + x, coords.latitude + y]);
  }
  ret.push(ret[0]);

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [ret],
        },
      },
    ],
  };
};

app.post("/", async (req, res) => {
  const body = req.body;
  const startPrepTime = performance.now();
  let blastGeoJson = body.data;
  const blastAreaM = area(blastGeoJson);
  const blastAreaKm = blastAreaM / 1000000;

  let _resultDampening = 1;
  let _expandedBlastGeoJson;

  // If the blast area is too small, expand it and then dampen the result
  if (blastAreaKm <= 0.5) {
    const blastCenterGeoJson = centroid(blastGeoJson);
    const blastCenterCoordinates = blastCenterGeoJson.geometry.coordinates;

    _expandedBlastGeoJson = createGeoJSONCircle(
      blastCenterCoordinates,
      4.9,
      64 * 4
    );
    // @ts-ignore
    const _expandedBlastGeoJsonAreaM = area(_expandedBlastGeoJson);
    _resultDampening = (blastAreaM / _expandedBlastGeoJsonAreaM) * 2;
  }

  // Determine the map type to use
  let populationMapType = "pop4";
  let popGeoRaster = pop4MapGeoRaster;

  if (blastAreaKm > 1500) {
    populationMapType = "pop3";
    popGeoRaster = pop3MapGeoRaster;
  }

  if (blastAreaKm > 15000) {
    populationMapType = "pop2";
    popGeoRaster = pop2MapGeoRaster;
  }
  if (blastAreaKm > 30000) {
    populationMapType = "pop1";
    popGeoRaster = pop1MapGeoRaster;
  }
  const endPrepTime = performance.now();

  console.log(
    `Call to doSomething took ${endPrepTime - startPrepTime} milliseconds`
  );
  try {
    // Calculate the population
    const startReadTime = performance.now();
    const populationResult = await geoblaze.sum(
      pop4MapGeoRaster,
      _expandedBlastGeoJson || blastGeoJson
    );
    const endReadTime = performance.now();

    console.log(
      `Call to doSomething took ${endReadTime - startPrepTime} milliseconds`
    );

    res.status(200).json({
      population: (
        parseInt(populationResult) * _resultDampening
      ).toLocaleString("en-US"),
      mapType: populationMapType,
      blastAreaKm: blastAreaKm.toLocaleString("en-US"),
      resultDampening: _resultDampening,
    });
  } catch {
    res.status(500).json({
      error: "Something went wrong",
      mapType: populationMapType,
      blastAreaKm: blastAreaKm.toLocaleString("en-US"),
      resultDampening: _resultDampening,
      hasExpandedBlastGeoJson: _expandedBlastGeoJson ? true : false,
    });
  }
});

app.listen(Number(port), "0.0.0.0", async () => {
  pop4MapGeoRaster = await geoblaze.load(
    `https://map-gules.vercel.app/maps/pop4.tif`
  );
  console.log("Loaded Pop 4 Map");

  pop3MapGeoRaster = await geoblaze.load(
    `https://map-gules.vercel.app/maps/pop3.tif`
  );
  console.log("Loaded Pop 3 Map");

  pop2MapGeoRaster = await geoblaze.load(
    `https://map-gules.vercel.app/maps/pop2.tif`
  );
  console.log("Loaded Pop 2 Map");

  pop1MapGeoRaster = await geoblaze.load(
    `https://map-gules.vercel.app/maps/pop1.tif`
  );
  console.log("Loaded Pop 1 Map");

  console.log(`Example app listening at http://localhost:${port}`);
});

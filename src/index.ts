import express from "express";
// @ts-ignore
import geoblaze from "geoblaze";
import area from "@turf/area";
import centroid from "@turf/centroid";

import { createGeoJSONCircle, createGeoJSONDonut } from "./helpers";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.raw({ type: "application/vnd.custom-type" }));
app.use(express.text({ type: "text/html" }));

let pop4MapGeoRaster: any;
let pop3MapGeoRaster: any;
let pop2MapGeoRaster: any;
let pop1MapGeoRaster: any;

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

    _expandedBlastGeoJson = createGeoJSONCircle({
      center: blastCenterCoordinates,
      outerRadiusInKm: 4.9,
      points: 64 * 4,
    });
    // @ts-ignore
    const _expandedBlastGeoJsonAreaM = area(_expandedBlastGeoJson);
    console.log(_expandedBlastGeoJsonAreaM / 1000000);
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

  console.log(`Call to sdf took ${endPrepTime - startPrepTime} milliseconds`);
  try {
    // Calculate the population
    const startReadTime = performance.now();
    const populationResult = await geoblaze.sum(
      pop4MapGeoRaster,
      _expandedBlastGeoJson || blastGeoJson
    );

    const endReadTime = performance.now();

    console.log(`Read File Time: ${endReadTime - startReadTime} milliseconds`);

    res.status(200).json({
      population: (parseInt(populationResult) * _resultDampening)
        .toLocaleString("en-US")
        .split(".")[0],
      mapType: populationMapType,
      blastAreaKm: blastAreaKm.toLocaleString("en-US"),
      resultDampening: _resultDampening,
      hasExpandedBlastGeoJson: _expandedBlastGeoJson ? true : false,
    });
  } catch {
    res.status(500).json({
      error: "Something went wrong",
      mapType: populationMapType,
      blastAreaKm: blastAreaKm.toLocaleString("en-US"),
      resultDampening: _resultDampening,
    });
  }
});

app.post("/pop", async (req, res) => {
  console.log("-----------------------------------");
  const body = req.body;
  const defaultPoints = 64;

  const {
    center,
    radii,
  }: {
    center: number[];
    radii: number[];
  } = body;

  // Check for missing data
  if (!center || !radii) {
    res.status(400).json({
      error: "Missing center or radii",
    });
    res.end();
    return;
  }

  // Create the blast areas
  let _blastAreas = [];
  for (let i = 0; i < radii.length; i++) {
    const radius = radii[i];

    const _blastGeoJson = createGeoJSONCircle({
      center: center,
      outerRadiusInKm: radius,
      points: defaultPoints,
    });
    _blastAreas.push(_blastGeoJson);
  }

  // Loop through the blast areas and calculate the population
  let _populationResults: any = [];

  for (let i = 0; i < _blastAreas.length; i++) {
    const _blastArea: any = _blastAreas[i];

    // @ts-ignore
    let _blastAreaKm = area(_blastArea) / 1000000;

    // Determine the map type to use
    let populationMapType = "pop4";
    let popGeoRaster = pop4MapGeoRaster;

    if (_blastAreaKm > 1500) {
      populationMapType = "pop3";
      popGeoRaster = pop3MapGeoRaster;
    }
    if (_blastAreaKm > 15000) {
      populationMapType = "pop2";
      popGeoRaster = pop2MapGeoRaster;
    }
    if (_blastAreaKm > 100000) {
      populationMapType = "pop1";
      popGeoRaster = pop1MapGeoRaster;
    }

    let populationResult;
    try {
      populationResult = await geoblaze.sum(popGeoRaster, _blastArea);
    } catch {
      populationResult = 0;
    }

    _populationResults.push({
      population: parseInt(populationResult),
      radiusKm: radii[i],
      areaKm: Math.round(_blastAreaKm),
      mapType: populationMapType,
    });
  }

  for (let i = 0; i < _populationResults.length; i++) {
    const _populationResult = _populationResults[i];
    const _previousPopulationResult = _populationResults[i - 1];

    if (_previousPopulationResult) {
      _populationResult.populationOriginal = _populationResult.population;
      _populationResult.population =
        _populationResult.population - _previousPopulationResult.population;

      _populationResult.areaKm =
        _populationResult.areaKm - _previousPopulationResult.areaKm;
    }
  }

  res.status(200).json({
    population: _populationResults,
  });
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

  pop1MapGeoRaster = await geoblaze.parse(
    `https://map-gules.vercel.app/maps/pop1.tif`
  );
  console.log("Loaded Pop 1 Map");

  console.log(`Example app listening at http://localhost:${port}`);
});
